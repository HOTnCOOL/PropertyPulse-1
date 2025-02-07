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
  isAfter,
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

const calculatePricePeriods = (property: Property, checkIn: Date, checkOut: Date): PricePeriod[] => {
  const periods: PricePeriod[] = [];
  let currentDate = startOfDay(new Date(checkIn));
  const endDate = startOfDay(new Date(checkOut));
  const normalDailyRate = Number(property.rate);

  const calculateMonthlyEnd = (date: Date): Date => {
    const nextMonth = addMonths(date, 1);
    return isBefore(nextMonth, endDate) ? nextMonth : endDate;
  };

  const calculateWeeklyEnd = (date: Date): Date => {
    const nextWeek = addWeeks(date, 1);
    return isBefore(nextWeek, endDate) ? nextWeek : endDate;
  };

  const calculatePeriodMetrics = (start: Date, end: Date, amount: number): Pick<PricePeriod, 'daysInPeriod' | 'effectiveDailyRate' | 'normalDailyTotal' | 'discountPercentage'> => {
    const daysInPeriod = differenceInDays(end, start);
    const effectiveDailyRate = amount / daysInPeriod;
    const normalDailyTotal = normalDailyRate * daysInPeriod;
    const discountPercentage = ((normalDailyRate - effectiveDailyRate) / normalDailyRate) * 100;
    return { daysInPeriod, effectiveDailyRate, normalDailyTotal, discountPercentage };
  };

  while (currentDate < endDate) {
    // For monthly periods, we need to ensure we're getting complete months
    if (property.monthlyRate) {
      const monthsUntilEnd = differenceInCalendarMonths(endDate, currentDate);
      if (monthsUntilEnd >= 1) {
        const monthlyEnd = calculateMonthlyEnd(currentDate);
        // Only apply monthly rate if it's a complete month
        const completeMonth = differenceInCalendarMonths(monthlyEnd, currentDate) === 1;
        if (completeMonth) {
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
    }

    // For weekly periods
    if (property.weeklyRate) {
      const daysUntilEnd = differenceInDays(endDate, currentDate);
      if (daysUntilEnd >= 7) {
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
    }

    // Remaining days at daily rate
    const remainingDays = differenceInDays(endDate, currentDate);
    if (remainingDays > 0) {
      const dailyAmount = normalDailyRate * remainingDays;
      const metrics = calculatePeriodMetrics(currentDate, endDate, dailyAmount);
      periods.push({
        type: 'daily',
        startDate: currentDate,
        endDate,
        amount: dailyAmount,
        baseRate: normalDailyRate,
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
    const accommodationTotal = pricePeriods.reduce((sum, period) => sum + period.amount, 0);

    // Calculate deposit based on the longest rate period actually used in the booking
    const longestPeriodUsed = pricePeriods.reduce((longest, current) => {
      const currentBaseAmount = current.baseRate;
      const longestBaseAmount = longest ? longest.baseRate : 0;
      return currentBaseAmount > longestBaseAmount ? current : longest;
    }, null as PricePeriod | null);

    const securityDeposit = longestPeriodUsed ? longestPeriodUsed.baseRate : Number(property.rate);

    return {
      periods: pricePeriods,
      accommodationTotal,
      securityDeposit,
      grandTotal: accommodationTotal + securityDeposit,
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
          {/* Accommodation Charges Section */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Accommodation Charges</h3>
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
            </div>
            <div className="flex justify-between text-sm font-medium pt-2 border-t">
              <span>Accommodation Total</span>
              <span>${estimates.accommodationTotal.toLocaleString()}</span>
            </div>
          </div>

          {/* Security Deposit Section */}
          <div className="space-y-2 pt-4 border-t border-dashed">
            <h3 className="text-sm font-semibold flex items-center justify-between">
              <span>Security Deposit</span>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Fully Refundable</span>
            </h3>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">One-time refundable deposit</span>
              <span className="font-medium">${estimates.securityDeposit.toLocaleString()}</span>
            </div>
          </div>

          {/* Grand Total Section */}
          <div className="pt-4 border-t">
            <div className="flex justify-between font-semibold text-lg">
              <span>Total Due Now</span>
              <span>${estimates.grandTotal.toLocaleString()}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Includes accommodation charges and refundable security deposit
            </p>
          </div>

          <div className="text-sm text-muted-foreground space-y-4">
            <div>
              <h4 className="font-medium mb-2">Security Deposit Terms:</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>Fully refundable upon check-out if no damages or additional charges</li>
                <li>May be used to cover damages, late check-out, or other incidental charges</li>
                <li>Refund processed within 7 business days after check-out</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">Payment Schedule:</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>Security Deposit: Due at booking</li>
                <li>First Payment: Due before check-in</li>
                <li>Subsequent payments: Due on the 1st of each period</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}