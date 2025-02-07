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

  // Helper function to calculate period end date for monthly package
  const calculateMonthlyEnd = (date: Date): Date => {
    const nextMonth = addMonths(date, 1);
    // Ensure we maintain the same day of month for monthly packages
    return nextMonth <= endDate ? nextMonth : endDate;
  };

  // Helper function to calculate period end date for weekly package
  const calculateWeeklyEnd = (date: Date): Date => {
    const nextWeek = addWeeks(date, 1);
    return nextWeek <= endDate ? nextWeek : endDate;
  };

  // First try to fit monthly package
  if (property.monthlyRate) {
    const monthlyEnd = calculateMonthlyEnd(currentDate);
    if (differenceInCalendarMonths(endDate, currentDate) >= 1) {
      periods.push({
        type: 'monthly',
        startDate: currentDate,
        endDate: monthlyEnd,
        amount: Number(property.monthlyRate),
        baseRate: Number(property.monthlyRate),
        duration: 1 // 1 month
      });
      currentDate = monthlyEnd;
    }
  }

  // Then fit as many weekly packages as possible
  if (property.weeklyRate) {
    while (differenceInDays(endDate, currentDate) >= 7) {
      const weeklyEnd = calculateWeeklyEnd(currentDate);
      periods.push({
        type: 'weekly',
        startDate: currentDate,
        endDate: weeklyEnd,
        amount: Number(property.weeklyRate),
        baseRate: Number(property.weeklyRate),
        duration: 1 // 1 week
      });
      currentDate = weeklyEnd;
    }
  }

  // Use daily rate for any remaining days
  const remainingDays = differenceInDays(endDate, currentDate);
  if (remainingDays > 0) {
    periods.push({
      type: 'daily',
      startDate: currentDate,
      endDate: endDate,
      amount: Number(property.rate) * remainingDays,
      baseRate: Number(property.rate),
      duration: remainingDays
    });
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