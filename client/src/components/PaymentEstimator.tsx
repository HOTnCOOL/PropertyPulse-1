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

  // Calculate full months first if monthly rate is available
  if (property.monthlyRate && preferredType !== 'daily' && preferredType !== 'weekly') {
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
  if (property.weeklyRate && preferredType !== 'daily' && differenceInDays(endDate, currentDate) >= 7) {
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
    periodCount.daily += remainingDays;
  }

  // Determine primary package type based on which type covers most days
  const primaryType = periodCount.monthly > 0 ? 'monthly' :
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

export default function PaymentEstimator({ property, checkIn, checkOut }: PaymentEstimatorProps) {
  const [, setLocation] = useLocation();
  const [preferredPackageType, setPreferredPackageType] = useState<'monthly' | 'weekly' | 'daily'>('monthly');

  // Calculate payment scenarios
  const paymentBreakdown = useMemo(() => {
    if (!property || !checkIn || !checkOut) return null;
    return calculateOptimalPaymentBreakdown(property, checkIn, checkOut, preferredPackageType);
  }, [property, checkIn, checkOut, preferredPackageType]);

  if (!paymentBreakdown || !property) return null;

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
                <div 
                  className={`p-3 bg-white rounded border cursor-pointer transition-colors ${
                    preferredPackageType === 'monthly' ? 'border-primary' : ''
                  }`}
                  onClick={() => setPreferredPackageType('monthly')}
                >
                  <div className="text-sm font-medium">Monthly Plan</div>
                  <div className="text-2xl font-bold">${Number(property.monthlyRate).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">per month</div>
                </div>
              )}
              {property.weeklyRate && (
                <div 
                  className={`p-3 bg-white rounded border cursor-pointer transition-colors ${
                    preferredPackageType === 'weekly' ? 'border-primary' : ''
                  }`}
                  onClick={() => setPreferredPackageType('weekly')}
                >
                  <div className="text-sm font-medium">Weekly Plan</div>
                  <div className="text-2xl font-bold">${Number(property.weeklyRate).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">per week</div>
                </div>
              )}
              <div 
                className={`p-3 bg-white rounded border cursor-pointer transition-colors ${
                  preferredPackageType === 'daily' ? 'border-primary' : ''
                }`}
                onClick={() => setPreferredPackageType('daily')}
              >
                <div className="text-sm font-medium">Daily Rate</div>
                <div className="text-2xl font-bold">${Number(property.rate).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">per day</div>
              </div>
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

          {/* Security Deposit */}
          <div className="p-4 bg-primary/5 rounded-lg space-y-2">
            <h3 className="font-semibold">Security Deposit</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Required Deposit Amount</span>
                <span>${paymentBreakdown.depositAmount.toLocaleString()}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Fully refundable after stay completion and property inspection
              </p>
            </div>
          </div>

          {/* Total Summary */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span>Total Stay Cost</span>
              <span>${paymentBreakdown.totalAmount.toLocaleString()}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span>Security Deposit (Refundable)</span>
              <span>+${paymentBreakdown.depositAmount.toLocaleString()}</span>
            </div>

            <div className="flex justify-between font-semibold text-lg pt-2 border-t">
              <span>Initial Payment Required</span>
              <span>${paymentBreakdown.initialPayment.toLocaleString()}</span>
            </div>

            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-700">
                Initial payment includes your first payment plus security deposit. 
                Payment must be received within 24 hours to guarantee availability.
              </p>
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