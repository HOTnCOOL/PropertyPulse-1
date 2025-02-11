import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  format, 
  differenceInDays,
  differenceInCalendarMonths,
  addMonths,
  addWeeks,
  startOfDay,
} from "date-fns";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Property } from "@db/schema";
import { useLocation } from "wouter";

interface PaymentEstimatorProps {
  property?: Property;
  checkIn?: Date;
  checkOut?: Date;
}

interface PaymentPeriod {
  type: 'monthly' | 'weekly' | 'daily';
  startDate: Date;
  endDate: Date;
  amount: number;
  label: string;
}

interface PaymentBreakdown {
  primaryType: 'monthly' | 'weekly' | 'daily';
  periods: PaymentPeriod[];
  totalAmount: number;
  depositAmount: number;
  initialPayment: number;
}

const calculateOptimalPaymentBreakdown = (
  property: Property,
  checkIn: Date,
  checkOut: Date,
  preferredType: 'monthly' | 'weekly' | 'daily'
): PaymentBreakdown => {
  const periods: PaymentPeriod[] = [];
  let currentDate = startOfDay(new Date(checkIn));
  const endDate = startOfDay(new Date(checkOut));
  let periodCount = { monthly: 0, weekly: 0, daily: 0 };

  // If daily rate is preferred, calculate entire stay as daily
  if (preferredType === 'daily') {
    const totalDays = differenceInDays(endDate, currentDate);
    if (totalDays > 0) {
      periods.push({
        type: 'daily',
        startDate: currentDate,
        endDate: endDate,
        amount: Number(property.rate) * totalDays,
        label: `${totalDays} Day${totalDays > 1 ? 's' : ''}`
      });
      periodCount.daily = totalDays; // Set the actual number of days
    }
  } else {
    // Calculate full months first if monthly rate is available
    if (property.monthlyRate && preferredType !== 'weekly') {
      while (differenceInCalendarMonths(endDate, currentDate) >= 1) {
        const monthlyEnd = addMonths(currentDate, 1);
        periods.push({
          type: 'monthly',
          startDate: currentDate,
          endDate: monthlyEnd,
          amount: Number(property.monthlyRate),
          label: `Month ${++periodCount.monthly}`
        });
        currentDate = monthlyEnd;
      }
    }

    // Calculate full weeks for remaining days if weekly rate is available
    if (property.weeklyRate && preferredType !== 'daily') {
      while (differenceInDays(endDate, currentDate) >= 7) {
        const weeklyEnd = addWeeks(currentDate, 1);
        periods.push({
          type: 'weekly',
          startDate: currentDate,
          endDate: weeklyEnd,
          amount: Number(property.weeklyRate),
          label: `Week ${++periodCount.weekly}`
        });
        currentDate = weeklyEnd;
      }
    }

    // Calculate remaining days at daily rate
    const remainingDays = differenceInDays(endDate, currentDate);
    if (remainingDays > 0) {
      periods.push({
        type: 'daily',
        startDate: currentDate,
        endDate: endDate,
        amount: Number(property.rate) * remainingDays,
        label: `${remainingDays} Day${remainingDays > 1 ? 's' : ''}`
      });
      periodCount.daily = remainingDays;
    }
  }

  // Determine primary package type based on which type covers most days
  const primaryType = preferredType === 'daily' ? 'daily' :
                     periodCount.monthly > 0 ? 'monthly' :
                     periodCount.weekly > 0 ? 'weekly' : 'daily';

  const totalAmount = periods.reduce((sum, period) => sum + period.amount, 0);
  const depositAmount = primaryType === 'monthly' ? Number(property.monthlyRate) :
                       primaryType === 'weekly' ? Number(property.weeklyRate) :
                       Number(property.rate) * 7;

  return {
    primaryType,
    periods,
    totalAmount,
    depositAmount,
    initialPayment: periods[0]?.amount + depositAmount || 0
  };
};

const calculateTotalCost = (
  property: Property,
  checkIn: Date,
  checkOut: Date,
  type: 'monthly' | 'weekly' | 'daily'
): number => {
  const breakdown = calculateOptimalPaymentBreakdown(property, checkIn, checkOut, type);
  return breakdown.totalAmount;
};

export default function PaymentEstimator({ property, checkIn, checkOut }: PaymentEstimatorProps) {
  const [, setLocation] = useLocation();
  const [preferredPackageType, setPreferredPackageType] = useState<'monthly' | 'weekly' | 'daily'>('monthly');

  // Calculate payment scenarios
  const paymentBreakdown = useMemo(() => {
    if (!property || !checkIn || !checkOut) return null;
    return calculateOptimalPaymentBreakdown(property, checkIn, checkOut, preferredPackageType);
  }, [property, checkIn, checkOut, preferredPackageType]);

  // Calculate package counts
  const packageCounts = useMemo(() => {
    if (!paymentBreakdown) return { monthly: 0, weekly: 0, daily: 0 };
    return paymentBreakdown.periods.reduce((counts, period) => {
      if (period.type === 'daily') {
        // Extract the number from the label (e.g., "3 Days" -> 3)
        const dayCount = parseInt(period.label.split(' ')[0]);
        counts.daily += dayCount;
      } else {
        counts[period.type]++;
      }
      return counts;
    }, { monthly: 0, weekly: 0, daily: 0 });
  }, [paymentBreakdown]);

  // Calculate costs for all package types
  const allCosts = useMemo(() => {
    if (!property || !checkIn || !checkOut) return null;
    return {
      monthly: property.monthlyRate ? calculateTotalCost(property, checkIn, checkOut, 'monthly') : null,
      weekly: property.weeklyRate ? calculateTotalCost(property, checkIn, checkOut, 'weekly') : null,
      daily: calculateTotalCost(property, checkIn, checkOut, 'daily')
    };
  }, [property, checkIn, checkOut]);

  if (!paymentBreakdown || !property || !allCosts) return null;

  const handleConfirm = () => {
    setLocation(`/payment?propertyId=${property.id}&packageType=${paymentBreakdown.primaryType}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Plan Selection</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Standard Rates */}
          <div className="p-4 bg-primary/5 rounded-lg space-y-4">
            <h3 className="font-semibold">Available Payment Plans</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {property.monthlyRate && (
                <div className="space-y-2">
                  <div 
                    className={`p-3 bg-white rounded border cursor-pointer transition-colors relative ${
                      preferredPackageType === 'monthly' ? 'border-primary' : ''
                    }`}
                    onClick={() => setPreferredPackageType('monthly')}
                  >
                    <div className="text-sm font-medium">Monthly Plan</div>
                    <div className="text-2xl font-bold">${Number(property.monthlyRate).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">per month</div>
                    {packageCounts.monthly > 0 && (
                      <div className={`absolute top-3 right-3 px-4 py-1.5 rounded-full text-base font-semibold
                        ${preferredPackageType === 'monthly' 
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted/20 text-muted-foreground'}`}>
                        ×{packageCounts.monthly}
                      </div>
                    )}
                  </div>
                  {allCosts.monthly && (
                    <div className={`text-center ${
                      preferredPackageType === 'monthly' 
                        ? 'text-primary font-medium'
                        : 'text-muted-foreground'
                    }`}>
                      Total: ${allCosts.monthly.toLocaleString()}
                    </div>
                  )}
                </div>
              )}
              {property.weeklyRate && (
                <div className="space-y-2">
                  <div 
                    className={`p-3 bg-white rounded border cursor-pointer transition-colors relative ${
                      preferredPackageType === 'weekly' ? 'border-primary' : ''
                    }`}
                    onClick={() => setPreferredPackageType('weekly')}
                  >
                    <div className="text-sm font-medium">Weekly Plan</div>
                    <div className="text-2xl font-bold">${Number(property.weeklyRate).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">per week</div>
                    {packageCounts.weekly > 0 && (
                      <div className={`absolute top-3 right-3 px-4 py-1.5 rounded-full text-base font-semibold
                        ${preferredPackageType === 'weekly'
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted/20 text-muted-foreground'}`}>
                        ×{packageCounts.weekly}
                      </div>
                    )}
                  </div>
                  {allCosts.weekly && (
                    <div className={`text-center ${
                      preferredPackageType === 'weekly' 
                        ? 'text-primary font-medium'
                        : 'text-muted-foreground'
                    }`}>
                      Total: ${allCosts.weekly.toLocaleString()}
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <div 
                  className={`p-3 bg-white rounded border cursor-pointer transition-colors relative ${
                    preferredPackageType === 'daily' ? 'border-primary' : ''
                  }`}
                  onClick={() => setPreferredPackageType('daily')}
                >
                  <div className="text-sm font-medium">Daily Rate</div>
                  <div className="text-2xl font-bold">${Number(property.rate).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">per day</div>
                  {packageCounts.daily > 0 && (
                    <div className={`absolute top-3 right-3 px-4 py-1.5 rounded-full text-base font-semibold
                      ${preferredPackageType === 'daily'
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted/20 text-muted-foreground'}`}>
                      ×{packageCounts.daily}
                    </div>
                  )}
                </div>
                <div className={`text-center ${
                  preferredPackageType === 'daily' 
                    ? 'text-primary font-medium'
                    : 'text-muted-foreground'
                }`}>
                  Total: ${allCosts.daily.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Initial Payment Information */}
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Initial Payment Required</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>First {paymentBreakdown.periods[0]?.label}</span>
                  <span>${paymentBreakdown.periods[0]?.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Security Deposit (Fully Refundable)</span>
                  <span>+${paymentBreakdown.depositAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold text-base pt-2 border-t">
                  <span>Total Initial Payment</span>
                  <span>${paymentBreakdown.initialPayment.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-700">
                Initial payment must be received within 24 hours to guarantee availability.
                The security deposit is fully refundable after stay completion and property inspection.
              </p>
            </div>
          </div>

          {/* Payment Schedule */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Payment Schedule</h3>
            <div className="divide-y">
              {paymentBreakdown.periods.map((period, index) => (
                <div key={index} className="py-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="font-medium">
                        {period.label}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(period.startDate, "MMM d")} - {format(period.endDate, "MMM d")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        ${period.amount.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Due {index === 0 ? 'at booking' : `by ${format(period.startDate, "MMM d")}`}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total Summary */}
          <div className="space-y-4 pt-4 border-t">
            {/* Total Accommodation Cost */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Total Stay Cost</h3>
              <div className="p-4 bg-primary/5 rounded-lg">
                <div className="space-y-2">
                  {paymentBreakdown.periods.map((period, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>{period.label}</span>
                      <span>${period.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                    <span>Total Accommodation Cost</span>
                    <span>${paymentBreakdown.totalAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Button className="w-full" onClick={handleConfirm}>
            Proceed to Payment
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}