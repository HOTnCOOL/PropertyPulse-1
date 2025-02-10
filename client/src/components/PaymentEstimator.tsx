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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Property } from "@db/schema";

interface PaymentEstimatorProps {
  property?: Property;
  checkIn?: Date;
  checkOut?: Date;
}

type PaymentInterval = 'monthly' | 'weekly' | 'daily';

interface PricePeriod {
  type: PaymentInterval;
  startDate: Date;
  endDate: Date;
  amount: number;
  baseRate: number;
  duration: number;
  daysInPeriod: number;
  effectiveDailyRate: number;
  normalDailyTotal: number;
  discountPercentage: number;
  discountAmount?: number;
}

interface PaymentEstimate {
  periods: PricePeriod[];
  totalBaseAmount: number;
  totalDiscountAmount: number;
  finalAmount: number;
  depositRequired: boolean;
  depositAmount: number;
  minimumPayment: number;
  depositRefundable: boolean;
  depositPartiallyRefundable: boolean;
}

const calculateDiscountedRate = (baseRate: number, periodIndex: number): { amount: number; discountPercent: number } => {
  const discountPercent = Math.min(periodIndex * 10, 50);
  const amount = baseRate * (1 - discountPercent / 100);
  return { amount, discountPercent };
};

const calculatePricePeriods = (
  property: Property, 
  checkIn: Date, 
  checkOut: Date,
  preferredInterval: PaymentInterval
): PricePeriod[] => {
  const periods: PricePeriod[] = [];
  let currentDate = startOfDay(new Date(checkIn));
  const endDate = startOfDay(new Date(checkOut));
  const normalDailyRate = Number(property.rate);
  let periodIndex = 0;

  const canUseMonthly = preferredInterval === 'monthly' && property.monthlyRate;
  const canUseWeekly = (preferredInterval === 'weekly' || !canUseMonthly) && property.weeklyRate;

  while (currentDate < endDate) {
    if (canUseMonthly && differenceInCalendarMonths(endDate, currentDate) >= 1) {
      const monthlyEnd = addMonths(currentDate, 1);
      const isCompleteMonth = differenceInCalendarMonths(monthlyEnd, currentDate) === 1;

      if (isCompleteMonth && monthlyEnd <= endDate) {
        const baseRate = Number(property.monthlyRate);
        const { amount, discountPercent } = calculateDiscountedRate(baseRate, periodIndex);
        const daysInPeriod = differenceInDays(monthlyEnd, currentDate);

        periods.push({
          type: 'monthly',
          startDate: currentDate,
          endDate: monthlyEnd,
          amount,
          baseRate,
          duration: 1,
          daysInPeriod,
          effectiveDailyRate: amount / daysInPeriod,
          normalDailyTotal: baseRate,
          discountPercentage: discountPercent,
          discountAmount: baseRate - amount,
        });

        currentDate = monthlyEnd;
        periodIndex++;
        continue;
      }
    }

    if (canUseWeekly && differenceInDays(endDate, currentDate) >= 7) {
      const weeklyEnd = addWeeks(currentDate, 1);
      const baseRate = Number(property.weeklyRate);
      const { amount, discountPercent } = calculateDiscountedRate(baseRate, periodIndex);

      periods.push({
        type: 'weekly',
        startDate: currentDate,
        endDate: weeklyEnd,
        amount,
        baseRate,
        duration: 1,
        daysInPeriod: 7,
        effectiveDailyRate: amount / 7,
        normalDailyTotal: baseRate,
        discountPercentage: discountPercent,
        discountAmount: baseRate - amount,
      });

      currentDate = weeklyEnd;
      periodIndex++;
      continue;
    }

    // Use daily rate for remaining days
    const remainingDays = differenceInDays(endDate, currentDate);
    if (remainingDays > 0) {
      const baseRate = normalDailyRate * remainingDays;
      const { amount, discountPercent } = calculateDiscountedRate(baseRate, periodIndex);

      periods.push({
        type: 'daily',
        startDate: currentDate,
        endDate: endDate,
        amount,
        baseRate,
        duration: remainingDays,
        daysInPeriod: remainingDays,
        effectiveDailyRate: amount / remainingDays,
        normalDailyTotal: baseRate,
        discountPercentage: discountPercent,
        discountAmount: baseRate - amount,
      });

      currentDate = endDate;
    }
  }

  return periods;
};

const calculatePaymentEstimate = (periods: PricePeriod[]): PaymentEstimate => {
  const totalBaseAmount = periods.reduce((sum, period) => sum + period.baseRate, 0);
  const totalDiscountAmount = periods.reduce((sum, period) => sum + (period.discountAmount || 0), 0);
  const finalAmount = periods.reduce((sum, period) => sum + period.amount, 0);

  // Check if deposit is required (2 or more packages)
  const hasMultiplePackages = periods.length >= 2;

  // Calculate deposit amount (equal to one regular package)
  const depositAmount = hasMultiplePackages ? periods[0].baseRate : 0;

  // Calculate minimum payment (first package + deposit if required)
  const minimumPayment = periods[0].amount + depositAmount;

  // Determine deposit refund conditions
  const depositPartiallyRefundable = periods.length >= 2;
  const depositRefundable = true; // As per requirement, deposit is fully refundable at end of stay

  return {
    periods,
    totalBaseAmount,
    totalDiscountAmount,
    finalAmount,
    depositRequired: hasMultiplePackages,
    depositAmount,
    minimumPayment,
    depositRefundable,
    depositPartiallyRefundable
  };
};

export default function PaymentEstimator({ property, checkIn, checkOut }: PaymentEstimatorProps) {
  // Default to the longest available interval
  const defaultInterval = property?.monthlyRate ? 'monthly' : property?.weeklyRate ? 'weekly' : 'daily';
  const [selectedInterval, setSelectedInterval] = useState<PaymentInterval>(defaultInterval);

  const estimates = useMemo(() => {
    if (!property || !checkIn || !checkOut) return null;

    const periods = calculatePricePeriods(property, checkIn, checkOut, selectedInterval);
    return calculatePaymentEstimate(periods);
  }, [property, checkIn, checkOut, selectedInterval]);

  if (!estimates) return null;

  const getIntervalSummary = (interval: PaymentInterval) => {
    const periods = calculatePricePeriods(property!, checkIn!, checkOut!, interval);
    const estimate = calculatePaymentEstimate(periods);
    return {
      count: periods.length,
      totalAmount: estimate.finalAmount,
      savings: estimate.totalDiscountAmount,
      effectiveDailyRate: estimate.finalAmount / differenceInDays(checkOut!, checkIn!),
    };
  };

  const availableIntervals = [
    property?.monthlyRate && 'monthly',
    property?.weeklyRate && 'weekly',
    'daily',
  ].filter(Boolean) as PaymentInterval[];

  const intervalSummaries = availableIntervals.map(interval => ({
    interval,
    ...getIntervalSummary(interval),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Estimation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Payment Window Warning */}
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-700">
              Payment must be received within 24 hours to guarantee availability. 
              The initial payment includes the first package{estimates.depositRequired ? ' plus security deposit' : ''}.
            </p>
          </div>

          {/* Payment Interval Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Select Payment Interval</h3>
              <Select
                value={selectedInterval}
                onValueChange={(value) => setSelectedInterval(value as PaymentInterval)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableIntervals.map(interval => (
                    <SelectItem key={interval} value={interval}>
                      {interval.charAt(0).toUpperCase() + interval.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Interval Comparison */}
            <div className="space-y-2">
              {intervalSummaries.map(summary => (
                <div
                  key={summary.interval}
                  className={`p-3 rounded-lg ${
                    selectedInterval === summary.interval
                      ? 'bg-primary/5 border border-primary/10'
                      : 'bg-muted/50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-medium">
                        {summary.count} {summary.interval} payment{summary.count > 1 ? 's' : ''}
                      </span>
                      <p className="text-sm text-muted-foreground">
                        ${Math.round(summary.effectiveDailyRate)}/day average
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        ${summary.totalAmount.toLocaleString()}
                      </div>
                      <div className="text-sm text-green-600">
                        Save ${summary.savings.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security Deposit Section */}
          {estimates.depositRequired && (
            <div className="p-4 bg-primary/5 rounded-lg space-y-2">
              <h3 className="font-semibold">Security Deposit</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Required Deposit Amount</span>
                  <span>${estimates.depositAmount.toLocaleString()}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Fully refundable deposit at the end of your stay
                </p>
              </div>
            </div>
          )}

          {/* Total Summary */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span>Base Price</span>
              <span>${estimates.totalBaseAmount.toLocaleString()}</span>
            </div>

            <div className="flex justify-between text-sm text-green-600">
              <span>Total Savings</span>
              <span>-${estimates.totalDiscountAmount.toLocaleString()}</span>
            </div>

            <div className="flex justify-between font-semibold text-lg pt-2 border-t">
              <span>Final Price</span>
              <span>${estimates.finalAmount.toLocaleString()}</span>
            </div>

            {estimates.depositRequired && (
              <div className="flex justify-between text-sm pt-2 border-t">
                <span>Security Deposit (Refundable)</span>
                <span>+${estimates.depositAmount.toLocaleString()}</span>
              </div>
            )}

            <div className="flex justify-between font-semibold text-lg pt-2 border-t">
              <span>Total Required Payment</span>
              <span>${(estimates.finalAmount + estimates.depositAmount).toLocaleString()}</span>
            </div>

            <p className="text-xs text-muted-foreground">
              * Early payment discounts: 10% off for each prepaid period (up to 50% maximum).
              The displayed amounts reflect the discounted rates if paid according to schedule.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}