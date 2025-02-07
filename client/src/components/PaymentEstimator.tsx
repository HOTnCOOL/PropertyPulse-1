import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  format, 
  differenceInDays,
  differenceInCalendarMonths,
  addMonths,
  addWeeks,
  startOfDay,
  isBefore,
} from "date-fns";
import type { Property } from "@db/schema";

interface PaymentEstimatorProps {
  property?: Property;
  checkIn?: Date;
  checkOut?: Date;
}

interface PricePeriod {
  type: 'monthly' | 'weekly' | 'daily';
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

const calculateDiscountedRate = (baseRate: number, periodIndex: number): { amount: number; discountPercent: number } => {
  const discountPercent = Math.min(periodIndex * 10, 50);
  const amount = baseRate * (1 - discountPercent / 100);
  return { amount, discountPercent };
};

const calculatePricePeriods = (property: Property, checkIn: Date, checkOut: Date): PricePeriod[] => {
  const periods: PricePeriod[] = [];
  let currentDate = startOfDay(new Date(checkIn));
  const endDate = startOfDay(new Date(checkOut));
  const totalDays = differenceInDays(endDate, currentDate);
  const normalDailyRate = Number(property.rate);

  const calculatePeriodMetrics = (start: Date, end: Date, amount: number, baseAmount: number): Pick<PricePeriod, 'daysInPeriod' | 'effectiveDailyRate' | 'normalDailyTotal' | 'discountPercentage' | 'discountAmount'> => {
    const daysInPeriod = differenceInDays(end, start);
    const effectiveDailyRate = amount / daysInPeriod;
    const normalDailyTotal = baseAmount;
    const discountPercentage = ((baseAmount - amount) / baseAmount) * 100;
    const discountAmount = baseAmount - amount;
    return { 
      daysInPeriod, 
      effectiveDailyRate, 
      normalDailyTotal, 
      discountPercentage,
      discountAmount
    };
  };

  let periodIndex = 0;

  // Try to fit complete months
  while (currentDate < endDate) {
    if (property.monthlyRate && differenceInCalendarMonths(endDate, currentDate) >= 1) {
      const monthlyEnd = addMonths(currentDate, 1);
      const isCompleteMonth = differenceInCalendarMonths(monthlyEnd, currentDate) === 1;

      if (isCompleteMonth && monthlyEnd <= endDate) {
        const baseRate = Number(property.monthlyRate);
        const { amount, discountPercent } = calculateDiscountedRate(baseRate, periodIndex);
        const metrics = calculatePeriodMetrics(currentDate, monthlyEnd, amount, baseRate);

        periods.push({
          type: 'monthly',
          startDate: currentDate,
          endDate: monthlyEnd,
          amount,
          baseRate,
          duration: 1,
          ...metrics
        });

        currentDate = monthlyEnd;
        periodIndex++;
        continue;
      }
    }

    // Try weeks if months don't fit
    if (property.weeklyRate && differenceInDays(endDate, currentDate) >= 7) {
      const weeklyEnd = addWeeks(currentDate, 1);
      const baseRate = Number(property.weeklyRate);
      const { amount, discountPercent } = calculateDiscountedRate(baseRate, periodIndex);
      const metrics = calculatePeriodMetrics(currentDate, weeklyEnd, amount, baseRate);

      periods.push({
        type: 'weekly',
        startDate: currentDate,
        endDate: weeklyEnd,
        amount,
        baseRate,
        duration: 1,
        ...metrics
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
      const metrics = calculatePeriodMetrics(currentDate, endDate, amount, baseRate);

      periods.push({
        type: 'daily',
        startDate: currentDate,
        endDate: endDate,
        amount,
        baseRate,
        duration: remainingDays,
        ...metrics
      });

      currentDate = endDate;
    }
  }

  return periods;
};

export default function PaymentEstimator({ property, checkIn, checkOut }: PaymentEstimatorProps) {
  const estimates = useMemo(() => {
    if (!property || !checkIn || !checkOut) return null;

    const pricePeriods = calculatePricePeriods(property, checkIn, checkOut);
    const totalBaseAmount = pricePeriods.reduce((sum, period) => sum + period.baseRate, 0);
    const totalDiscountAmount = pricePeriods.reduce((sum, period) => sum + (period.discountAmount || 0), 0);
    const finalAmount = pricePeriods.reduce((sum, period) => sum + period.amount, 0);

    return {
      periods: pricePeriods,
      totalBaseAmount,
      totalDiscountAmount,
      finalAmount
    };
  }, [property, checkIn, checkOut]);

  if (!estimates) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Estimation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Period Details */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Payment Schedule</h3>
            <div className="divide-y">
              {estimates.periods.map((period, index) => (
                <div key={index} className="py-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>
                      {period.type === 'monthly' && `Month ${index + 1}`}
                      {period.type === 'weekly' && `Week ${index + 1}`}
                      {period.type === 'daily' && `${period.duration} Day${period.duration > 1 ? 's' : ''}`}
                    </span>
                    <span className="font-medium">${period.amount.toLocaleString()}</span>
                  </div>

                  <div className="text-xs text-muted-foreground flex justify-between">
                    <span>{format(period.startDate, "MMM d")} - {format(period.endDate, "MMM d")}</span>
                    <span>
                      {period.discountPercentage > 0 && (
                        <span className="text-green-600">
                          Save ${period.discountAmount?.toLocaleString()} ({Math.round(period.discountPercentage)}% off)
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    <span>
                      Effective daily rate: ${Math.round(period.effectiveDailyRate)}/day
                      {period.discountPercentage > 0 && (
                        <span className="text-green-600">
                          {' '}(down from ${Math.round(period.normalDailyTotal/period.daysInPeriod)}/day)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total Summary */}
          <div className="pt-4 border-t space-y-2">
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

            <p className="text-xs text-muted-foreground mt-2">
              * Early payment discounts are applied progressively: 10% off for each prepaid period, up to 50% maximum discount.
              The displayed amounts reflect the discounted rates if paid according to schedule.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}