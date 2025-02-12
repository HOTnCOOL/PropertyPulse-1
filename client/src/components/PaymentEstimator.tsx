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
import { AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Property } from "@db/schema";
import { useLocation } from "wouter";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link } from "wouter";

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
  baseAmount: number;
  label: string;
  isPrepaid?: boolean;
  index?: number;
  discountAmount?: number; // Track the actual discount amount
  discountPercent?: number; // Track the applied discount percentage
}

interface PaymentBreakdown {
  primaryType: 'monthly' | 'weekly' | 'daily';
  periods: PaymentPeriod[];
  totalAmount: number;
  depositAmount: number;
  initialPayment: number;
  totalSavings: number;
  effectiveRate: number;
}

const calculateOptimalPaymentBreakdown = (
  property: Property,
  checkIn: Date,
  checkOut: Date,
  preferredType: 'monthly' | 'weekly' | 'daily',
  selectedPeriods: number[],
  prepayAll: boolean
): PaymentBreakdown => {
  const periods: PaymentPeriod[] = [];
  let currentDate = startOfDay(new Date(checkIn));
  const endDate = startOfDay(new Date(checkOut));
  let periodCount = { monthly: 0, weekly: 0, daily: 0 };
  const totalDays = differenceInDays(endDate, currentDate);

  // Calculate progressive discount based on period index and type
  const calculateDiscount = (periodType: 'monthly' | 'weekly' | 'daily', index: number): number => {
    const selectedPeriodsOfType = periods
      .filter((p, i) => p.type === periodType && (selectedPeriods.includes(i) || prepayAll))
      .length;

    // Progressive discount: 10% per prepaid period, max 50%
    const baseDiscount = Math.min((selectedPeriodsOfType - 1) * 10, 50);

    // Additional early booking discount if booking is more than 30 days in advance
    const daysUntilCheckIn = differenceInDays(checkIn, new Date());
    const earlyBookingBonus = daysUntilCheckIn > 30 ? 5 : 0;

    return Math.min(baseDiscount + earlyBookingBonus, 50) / 100;
  };

  // Calculate periods based on preferred payment type
  if (preferredType === 'daily') {
    if (totalDays > 0) {
      const baseAmount = Number(property.rate) * totalDays;
      periods.push({
        type: 'daily',
        startDate: currentDate,
        endDate: endDate,
        baseAmount,
        amount: baseAmount,
        label: `${totalDays} Day${totalDays > 1 ? 's' : ''}`,
        index: 0
      });
      periodCount.daily = totalDays;
    }
  } else {
    let periodIndex = 0;
    // Calculate full months first if monthly rate is available
    if (property.monthlyRate && preferredType !== 'weekly') {
      while (differenceInCalendarMonths(endDate, currentDate) >= 1) {
        const monthlyEnd = addMonths(currentDate, 1);
        const baseAmount = Number(property.monthlyRate);
        periods.push({
          type: 'monthly',
          startDate: currentDate,
          endDate: monthlyEnd,
          baseAmount,
          amount: baseAmount,
          label: `Month ${++periodCount.monthly}`,
          index: periodIndex++
        });
        currentDate = monthlyEnd;
      }
    }

    // Update the comparison on line 107 to fix type error
    if (property.weeklyRate && preferredType !== 'daily') {
      while (differenceInDays(endDate, currentDate) >= 7) {
        const weeklyEnd = addWeeks(currentDate, 1);
        const baseAmount = Number(property.weeklyRate);
        periods.push({
          type: 'weekly',
          startDate: currentDate,
          endDate: weeklyEnd,
          baseAmount,
          amount: baseAmount,
          label: `Week ${++periodCount.weekly}`,
          index: periodIndex++
        });
        currentDate = weeklyEnd;
      }
    }


    // Calculate remaining days at daily rate
    const remainingDays = differenceInDays(endDate, currentDate);
    if (remainingDays > 0) {
      const baseAmount = Number(property.rate) * remainingDays;
      periods.push({
        type: 'daily',
        startDate: currentDate,
        endDate: endDate,
        baseAmount,
        amount: baseAmount,
        label: `${remainingDays} Day${remainingDays > 1 ? 's' : ''}`,
        index: periodIndex++
      });
      periodCount.daily = remainingDays;
    }
  }

  // Apply discounts to selected periods
  periods.forEach((period, index) => {
    if (selectedPeriods.includes(index) || prepayAll) {
      const discountPercent = calculateDiscount(period.type, index);
      const discountAmount = period.baseAmount * discountPercent;
      period.amount = period.baseAmount - discountAmount;
      period.isPrepaid = true;
      period.discountAmount = discountAmount;
      period.discountPercent = discountPercent * 100;
    } else {
      period.amount = period.baseAmount;
      period.isPrepaid = false;
      period.discountAmount = 0;
      period.discountPercent = 0;
    }
  });

  // Calculate total savings
  const totalSavings = periods.reduce((sum, period) => sum + (period.discountAmount || 0), 0);

  // Return updated breakdown with savings information
  return {
    primaryType: preferredType === 'daily' ? 'daily' :
                periodCount.monthly > 0 ? 'monthly' :
                periodCount.weekly > 0 ? 'weekly' : 'daily',
    periods,
    totalAmount: periods.reduce((sum, period) => sum + period.amount, 0),
    depositAmount: calculateDepositAmount(property, totalDays, periods),
    initialPayment: calculateInitialPayment(periods, selectedPeriods, prepayAll),
    totalSavings,
    effectiveRate: calculateEffectiveRate(periods, totalDays)
  };
};

// Add helper functions for cleaner code
const calculateDepositAmount = (property: Property, totalDays: number, periods: PaymentPeriod[]): number => {
  let baseDepositAmount = 0;
  if (totalDays > 3) {
    if (totalDays > 60) {
      baseDepositAmount = property.monthlyRate ? Number(property.monthlyRate) : 1200;
    } else if (totalDays > 14) {
      baseDepositAmount = property.weeklyRate ? Number(property.weeklyRate) : 420;
    } else {
      baseDepositAmount = property.rate ? Number(property.rate) : 90;
    }
  }

  const prepaidPeriodsCount = periods.filter(p => p.isPrepaid).length;
  const isFullyPrepaid = periods.every(p => p.isPrepaid);

  return isFullyPrepaid ? 0 : prepaidPeriodsCount >= 2 ? baseDepositAmount / 2 : baseDepositAmount;
};

const calculateInitialPayment = (
  periods: PaymentPeriod[],
  selectedPeriods: number[],
  prepayAll: boolean
): number => {
  return periods.reduce((sum, period, index) =>
    sum + (selectedPeriods.includes(index) || prepayAll ? period.amount : 0), 0);
};

const calculateEffectiveRate = (periods: PaymentPeriod[], totalDays: number): number => {
  const totalAmount = periods.reduce((sum, period) => sum + period.amount, 0);
  return totalAmount / totalDays; // Daily effective rate after all discounts
};

// Update the component's JSX to show more detailed discount information
export default function PaymentEstimator({ property, checkIn, checkOut }: PaymentEstimatorProps) {
  const [, setLocation] = useLocation();
  const [preferredPackageType, setPreferredPackageType] = useState<'monthly' | 'weekly' | 'daily'>('monthly');
  const [selectedPeriods, setSelectedPeriods] = useState<number[]>([0]); // First period always selected
  const [prepayAll, setPrepayAll] = useState(false);

  // Calculate payment scenarios
  const paymentBreakdown = useMemo(() => {
    if (!property || !checkIn || !checkOut) return null;
    return calculateOptimalPaymentBreakdown(
      property,
      checkIn,
      checkOut,
      preferredPackageType,
      selectedPeriods,
      prepayAll
    );
  }, [property, checkIn, checkOut, preferredPackageType, selectedPeriods, prepayAll]);

  const handlePeriodSelect = (index: number) => {
    if (index === 0) return; // First period always selected
    setSelectedPeriods(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index].sort();
      }
    });
  };

  const handlePrepayAll = () => {
    setPrepayAll(!prepayAll);
    if (!prepayAll) {
      setSelectedPeriods(paymentBreakdown?.periods.map((_, i) => i) || []);
    }
  };

  const formatPercent = (value: number) => `${value.toFixed(0)}%`;
  const formatCurrency = (value: number) => `$${value.toLocaleString()}`;

  if (!paymentBreakdown || !property) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Plan Selection</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Standard Rates */}
          <div className="p-4 bg-primary/5 rounded-lg space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Available Payment Plans</h3>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="prepayAll"
                  checked={prepayAll}
                  onCheckedChange={handlePrepayAll}
                />
                <label htmlFor="prepayAll" className="text-sm cursor-pointer">
                  Prepay All (Maximum Discount)
                </label>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {property.monthlyRate && (
                <div className="space-y-2">
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
                </div>
              )}
              {property.weeklyRate && (
                <div className="space-y-2">
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
                </div>
              )}
              <div className="space-y-2">
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
          </div>

          {/* Initial Payment Information */}
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Initial Payment Required</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href="/policies/deposit-policy" className="text-muted-foreground hover:text-primary">
                      <Info className="h-4 w-4" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View our detailed deposit policy</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="space-y-2">
              {selectedPeriods.map(index => {
                const period = paymentBreakdown.periods[index];
                if (!period) return null;
                return (
                  <div key={index} className="flex justify-between text-sm">
                    <span>{period.label} {period.discountPercent > 0 && `(${formatPercent(period.discountPercent)} off)`}</span>
                    <span>${period.amount.toLocaleString()}</span>
                  </div>
                );
              })}
              {paymentBreakdown.depositAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Security Deposit (Fully Refundable)</span>
                  <span>+${paymentBreakdown.depositAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-base pt-2 border-t">
                <span>Total Initial Payment</span>
                <span>${paymentBreakdown.initialPayment.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm text-yellow-700">
                <p>
                  Initial payment must be received within 24 hours to guarantee availability.
                  The security deposit is fully refundable after stay completion and property inspection.
                </p>
                {paymentBreakdown.depositAmount === 0 ? (
                  <p className="font-medium">
                    No security deposit required for fully prepaid bookings.
                  </p>
                ) : (
                  <p>
                    Security deposit can be paid in advance or guaranteed by credit card.
                    {paymentBreakdown.periods.filter(p => p.isPrepaid).length >= 2 &&
                      " Your deposit is reduced by 50% as you've prepaid 2 or more payment periods."}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Add a new section for savings summary */}
          {paymentBreakdown.totalSavings > 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-700 mb-2">Your Savings</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Savings</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(paymentBreakdown.totalSavings)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Effective Daily Rate</span>
                  <span>{formatCurrency(paymentBreakdown.effectiveRate)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Payment Schedule */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Payment Schedule</h3>
            <div className="divide-y">
              {paymentBreakdown.periods.map((period, index) => {
                const isSelected = selectedPeriods.includes(index) || prepayAll;
                return (
                  <div key={index} className="py-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start space-x-3">
                        {index > 0 && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handlePeriodSelect(index)}
                            disabled={prepayAll}
                          />
                        )}
                        <div className="space-y-1">
                          <div className="font-medium">
                            {period.label}
                            {isSelected && period.discountPercent && period.discountPercent > 0 && (
                              <span className="ml-2 text-sm text-green-600">
                                ({formatPercent(period.discountPercent)} off)
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(period.startDate, "MMM d")} - {format(period.endDate, "MMM d")}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {formatCurrency(period.amount)}
                          {isSelected && period.discountAmount && period.discountAmount > 0 && (
                            <div className="text-sm text-muted-foreground line-through">
                              {formatCurrency(period.baseAmount)}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {isSelected ? 'Prepaid' : `Due by ${format(period.startDate, "MMM d")}`}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total Summary */}
          <div className="space-y-4 pt-4 border-t">
            <div>
              <h3 className="text-sm font-semibold mb-2">Total Stay Cost</h3>
              <div className="p-4 bg-primary/5 rounded-lg">
                <div className="space-y-2">
                  {paymentBreakdown.periods.map((period, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>
                        {period.label}
                        {(selectedPeriods.includes(index) || prepayAll) && period.discountAmount && period.discountAmount > 0 && (
                          <span className="ml-2 text-green-600">
                            ({formatPercent(period.discountPercent)} off)
                          </span>
                        )}
                      </span>
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

          <Button
            className="w-full"
            onClick={() => setLocation(`/payment?propertyId=${property.id}&packageType=${paymentBreakdown.primaryType}`)}
          >
            Proceed to Payment
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}