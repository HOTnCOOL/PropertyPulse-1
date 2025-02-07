import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  format, 
  differenceInDays, 
  differenceInCalendarMonths,
  addMonths,
  addWeeks,
  isBefore,
  isAfter,
  startOfDay
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
}

function calculatePricePeriods(property: Property, checkIn: Date, checkOut: Date): PricePeriod[] {
  const periods: PricePeriod[] = [];
  let currentDate = startOfDay(new Date(checkIn));
  const endDate = startOfDay(new Date(checkOut));

  // Helper function to calculate period end date
  const calculatePeriodEnd = (date: Date, type: 'monthly' | 'weekly'): Date => {
    const tentativeEnd = type === 'monthly' 
      ? addMonths(date, 1)
      : addWeeks(date, 1);
    return isBefore(tentativeEnd, endDate) ? tentativeEnd : endDate;
  };

  while (isBefore(currentDate, endDate)) {
    // Try monthly package first
    if (property.monthlyRate && 
        differenceInCalendarMonths(endDate, currentDate) >= 1) {
      const periodEnd = calculatePeriodEnd(currentDate, 'monthly');
      const days = differenceInDays(periodEnd, currentDate);
      periods.push({
        type: 'monthly',
        startDate: currentDate,
        endDate: periodEnd,
        amount: Number(property.monthlyRate),
        baseRate: Number(property.monthlyRate),
        duration: 1 // 1 month
      });
      currentDate = periodEnd;
      continue;
    }

    // Try weekly package
    if (property.weeklyRate && 
        differenceInDays(endDate, currentDate) >= 7) {
      const periodEnd = calculatePeriodEnd(currentDate, 'weekly');
      const days = differenceInDays(periodEnd, currentDate);
      periods.push({
        type: 'weekly',
        startDate: currentDate,
        endDate: periodEnd,
        amount: Number(property.weeklyRate),
        baseRate: Number(property.weeklyRate),
        duration: 1 // 1 week
      });
      currentDate = periodEnd;
      continue;
    }

    // Use daily rate for remaining days
    const daysLeft = differenceInDays(endDate, currentDate);
    if (daysLeft > 0) {
      periods.push({
        type: 'daily',
        startDate: currentDate,
        endDate: endDate,
        amount: Number(property.rate) * daysLeft,
        baseRate: Number(property.rate),
        duration: daysLeft
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

    // Add security deposit
    const deposit = property.monthlyRate 
      ? Number(property.monthlyRate)
      : property.weeklyRate 
        ? Number(property.weeklyRate)
        : Number(property.rate) * 7;

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
              <div key={index} className="flex justify-between text-sm">
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
            ))}
            <div className="flex justify-between text-sm">
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