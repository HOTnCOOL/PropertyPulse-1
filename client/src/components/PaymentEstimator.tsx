import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  format, 
  differenceInDays,
  differenceInCalendarMonths,
  addMonths,
  addWeeks,
  startOfDay,
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
}

function calculatePricePeriods(property: Property, checkIn: Date, checkOut: Date): PricePeriod[] {
  const periods: PricePeriod[] = [];
  let currentDate = startOfDay(new Date(checkIn));
  const endDate = startOfDay(new Date(checkOut));
  const normalDailyRate = Number(property.rate);

  const calculateMonthlyEnd = (date: Date): Date => {
    const nextMonth = addMonths(date, 1);
    return nextMonth <= endDate ? nextMonth : endDate;
  };

  const calculateWeeklyEnd = (date: Date): Date => {
    const nextWeek = addWeeks(date, 1);
    return nextWeek <= endDate ? nextWeek : endDate;
  };

  const calculatePeriodMetrics = (start: Date, end: Date, amount: number): Pick<PricePeriod, 'daysInPeriod' | 'effectiveDailyRate' | 'normalDailyTotal' | 'discountPercentage'> => {
    const daysInPeriod = differenceInDays(end, start);
    const effectiveDailyRate = amount / daysInPeriod;
    const normalDailyTotal = normalDailyRate * daysInPeriod;
    const discountPercentage = ((normalDailyRate - effectiveDailyRate) / normalDailyRate) * 100;
    return { daysInPeriod, effectiveDailyRate, normalDailyTotal, discountPercentage };
  };

  while (currentDate < endDate) {
    if (property.monthlyRate && differenceInCalendarMonths(endDate, currentDate) >= 1) {
      const monthlyEnd = calculateMonthlyEnd(currentDate);
      if (differenceInCalendarMonths(monthlyEnd, currentDate) === 1) {
        const metrics = calculatePeriodMetrics(currentDate, monthlyEnd, Number(property.monthlyRate));
        periods.push({
          type: 'monthly',
          startDate: currentDate,
          endDate: monthlyEnd,
          amount: Number(property.monthlyRate),
          baseRate: Number(property.monthlyRate),
          duration: 1,
          ...metrics
        });
        currentDate = monthlyEnd;
        continue;
      }
    }

    if (property.weeklyRate && differenceInDays(endDate, currentDate) >= 7) {
      const weeklyEnd = calculateWeeklyEnd(currentDate);
      const metrics = calculatePeriodMetrics(currentDate, weeklyEnd, Number(property.weeklyRate));
      periods.push({
        type: 'weekly',
        startDate: currentDate,
        endDate: weeklyEnd,
        amount: Number(property.weeklyRate),
        baseRate: Number(property.weeklyRate),
        duration: 1,
        ...metrics
      });
      currentDate = weeklyEnd;
      continue;
    }

    const remainingDaysCount = differenceInDays(endDate, currentDate);
    if (remainingDaysCount > 0) {
      const metrics = calculatePeriodMetrics(currentDate, endDate, normalDailyRate * remainingDaysCount);
      periods.push({
        type: 'daily',
        startDate: currentDate,
        endDate,
        amount: normalDailyRate * remainingDaysCount,
        baseRate: normalDailyRate,
        duration: remainingDaysCount,
        ...metrics
      });
      currentDate = endDate;
    }
  }

  return periods;
}

export default function PaymentEstimator({ property, checkIn, checkOut }: PaymentEstimatorProps) {
  const estimates = useMemo(() => {
    if (!property || !checkIn || !checkOut) return null;

    const pricePeriods = calculatePricePeriods(property, checkIn, checkOut);
    const totalAmount = pricePeriods.reduce((sum, period) => sum + period.amount, 0);

    let deposit = Number(property.rate) * 7; 
    const hasMonthlyPeriod = pricePeriods.some(p => p.type === 'monthly');
    const hasWeeklyPeriod = pricePeriods.some(p => p.type === 'weekly');

    if (hasMonthlyPeriod && property.monthlyRate) {
      deposit = Number(property.monthlyRate); 
    } else if (hasWeeklyPeriod && property.weeklyRate) {
      deposit = Number(property.weeklyRate); 
    }

    return {
      periods: pricePeriods,
      deposit,
      total: totalAmount + deposit,
    };
  }, [property, checkIn, checkOut]);

  if (!estimates) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Estimation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            {estimates.periods.map((period, index) => (
              <div key={index} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>
                    {period.type === 'monthly' && 'Monthly Rate'}
                    {period.type === 'weekly' && 'Weekly Rate'}
                    {period.type === 'daily' && 'Daily Rate'}
                    {' '}
                    ({format(period.startDate, "MMM d")} - {format(period.endDate, "MMM d")})
                    {period.duration > 1 && period.type === 'daily' && ` (${period.duration} days)`}
                  </span>
                  <span className="font-medium">${period.amount.toLocaleString()}</span>
                </div>
                <div className="text-xs text-muted-foreground flex justify-between">
                  <span>
                    <span className="line-through">${period.normalDailyTotal.toLocaleString()}</span>
                    {' '}→{' '}
                    <span className="text-green-600">${Math.round(period.effectiveDailyRate)}/day</span>
                    {' '}
                    {period.discountPercentage > 0 && (
                      <span className="text-green-600">
                        ({Math.round(period.discountPercentage)}% off)
                      </span>
                    )}
                  </span>
                  <span>{period.daysInPeriod} days</span>
                </div>
              </div>
            ))}
            <div className="flex justify-between text-sm pt-2 border-t">
              <span>Security Deposit (refundable)</span>
              <span className="font-medium">${estimates.deposit.toLocaleString()}</span>
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="flex justify-between font-semibold">
              <span>Total Amount</span>
              <span>${estimates.total.toLocaleString()}</span>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            <p>Payment Schedule:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Security Deposit: Due at booking</li>
              <li>First Payment: Due before check-in</li>
              <li>Subsequent payments: Due on the 1st of each period</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}