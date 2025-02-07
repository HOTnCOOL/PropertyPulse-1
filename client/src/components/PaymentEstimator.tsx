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
}

const calculatePricePeriods = (property: Property, checkIn: Date, checkOut: Date): PricePeriod[] => {
  const periods: PricePeriod[] = [];
  let currentDate = startOfDay(new Date(checkIn));
  const endDate = startOfDay(new Date(checkOut));
  const totalDays = differenceInDays(endDate, currentDate);
  const normalDailyRate = Number(property.rate);

  const calculatePeriodMetrics = (start: Date, end: Date, amount: number): Pick<PricePeriod, 'daysInPeriod' | 'effectiveDailyRate' | 'normalDailyTotal' | 'discountPercentage'> => {
    const daysInPeriod = differenceInDays(end, start);
    const effectiveDailyRate = amount / daysInPeriod;
    const normalDailyTotal = normalDailyRate * daysInPeriod;
    const discountPercentage = ((normalDailyRate - effectiveDailyRate) / normalDailyRate) * 100;
    return { daysInPeriod, effectiveDailyRate, normalDailyTotal, discountPercentage };
  };

  // Helper to add a period
  const addPeriod = (type: 'monthly' | 'weekly' | 'daily', duration: number, rate: number) => {
    const periodEnd = type === 'monthly' 
      ? addMonths(currentDate, duration)
      : type === 'weekly'
        ? addWeeks(currentDate, duration)
        : new Date(currentDate.getTime() + duration * 24 * 60 * 60 * 1000);

    const amount = rate * duration;
    const metrics = calculatePeriodMetrics(currentDate, periodEnd, amount);

    periods.push({
      type,
      startDate: currentDate,
      endDate: periodEnd,
      amount,
      baseRate: rate,
      duration,
      ...metrics
    });

    currentDate = periodEnd;
  };

  let remainingDays = totalDays;

  // Try to fit as many complete months as possible
  if (property.monthlyRate) {
    const completeMonths = Math.floor(differenceInCalendarMonths(endDate, currentDate));
    if (completeMonths > 0) {
      addPeriod('monthly', completeMonths, Number(property.monthlyRate));
      remainingDays = differenceInDays(endDate, currentDate);
    }
  }

  // Then try to fit complete weeks in the remaining time
  if (property.weeklyRate && remainingDays >= 7) {
    const completeWeeks = Math.floor(remainingDays / 7);
    if (completeWeeks > 0) {
      addPeriod('weekly', completeWeeks, Number(property.weeklyRate));
      remainingDays = differenceInDays(endDate, currentDate);
    }
  }

  // Use daily rate for any remaining days
  if (remainingDays > 0) {
    addPeriod('daily', remainingDays, normalDailyRate);
  }

  return periods;
};

export default function PaymentEstimator({ property, checkIn, checkOut }: PaymentEstimatorProps) {
  const estimates = useMemo(() => {
    if (!property || !checkIn || !checkOut) return null;

    const pricePeriods = calculatePricePeriods(property, checkIn, checkOut);
    const accommodationTotal = pricePeriods.reduce((sum, period) => sum + period.amount, 0);

    // Find the longest period pack actually used in this booking
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
                      {period.type === 'monthly' && `${period.duration} Month${period.duration > 1 ? 's' : ''}`}
                      {period.type === 'weekly' && `${period.duration} Week${period.duration > 1 ? 's' : ''}`}
                      {period.type === 'daily' && `${period.duration} Day${period.duration > 1 ? 's' : ''}`}
                      {' '}
                      ({format(period.startDate, "MMM d")} - {format(period.endDate, "MMM d")})
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
              <span className="text-muted-foreground">Based on longest period rate used</span>
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
        </div>
      </CardContent>
    </Card>
  );
}