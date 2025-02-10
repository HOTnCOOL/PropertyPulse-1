import { useMemo, useState } from "react";
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
import { AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

interface PricePeriod {
  id: string;
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
  isSelected?: boolean;
  canModifyPeriod: boolean;
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

const splitPeriodToShorter = (period: PricePeriod, property: Property, targetType: 'weekly' | 'daily'): PricePeriod[] => {
  const periods: PricePeriod[] = [];
  let currentDate = startOfDay(new Date(period.startDate));
  const endDate = startOfDay(new Date(period.endDate));
  let periodIndex = 0;

  while (currentDate < endDate) {
    if (targetType === 'weekly' && differenceInDays(endDate, currentDate) >= 7) {
      const weeklyEnd = addWeeks(currentDate, 1);
      const weeklyRate = Number(property.weeklyRate);
      const { amount, discountPercent } = calculateDiscountedRate(weeklyRate, periodIndex);

      periods.push({
        id: `${currentDate.getTime()}-weekly`,
        type: 'weekly',
        startDate: currentDate,
        endDate: weeklyEnd,
        amount,
        baseRate: weeklyRate,
        duration: 1,
        daysInPeriod: 7,
        effectiveDailyRate: amount / 7,
        normalDailyTotal: weeklyRate,
        discountPercentage: discountPercent,
        discountAmount: weeklyRate - amount,
        isSelected: true,
        canModifyPeriod: true
      });

      currentDate = weeklyEnd;
    } else {
      // Use daily rate for remaining days
      const remainingDays = differenceInDays(endDate, currentDate);
      const dailyRate = Number(property.rate);
      const baseRate = dailyRate * remainingDays;
      const { amount, discountPercent } = calculateDiscountedRate(baseRate, periodIndex);

      periods.push({
        id: `${currentDate.getTime()}-daily`,
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
        isSelected: true,
        canModifyPeriod: false
      });

      currentDate = endDate;
    }
    periodIndex++;
  }

  return periods;
};

const calculatePricePeriods = (property: Property, checkIn: Date, checkOut: Date): PricePeriod[] => {
  const periods: PricePeriod[] = [];
  let currentDate = startOfDay(new Date(checkIn));
  const endDate = startOfDay(new Date(checkOut));
  const totalDays = differenceInDays(endDate, currentDate);
  const normalDailyRate = Number(property.rate);
  let periodIndex = 0;

  while (currentDate < endDate) {
    if (property.monthlyRate && differenceInCalendarMonths(endDate, currentDate) >= 1) {
      const monthlyEnd = addMonths(currentDate, 1);
      const isCompleteMonth = differenceInCalendarMonths(monthlyEnd, currentDate) === 1;

      if (isCompleteMonth && monthlyEnd <= endDate) {
        const baseRate = Number(property.monthlyRate);
        const { amount, discountPercent } = calculateDiscountedRate(baseRate, periodIndex);
        const daysInPeriod = differenceInDays(monthlyEnd, currentDate);

        periods.push({
          id: `${currentDate.getTime()}-monthly`,
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
          isSelected: true,
          canModifyPeriod: true
        });

        currentDate = monthlyEnd;
        periodIndex++;
        continue;
      }
    }

    if (property.weeklyRate && differenceInDays(endDate, currentDate) >= 7) {
      const weeklyEnd = addWeeks(currentDate, 1);
      const baseRate = Number(property.weeklyRate);
      const { amount, discountPercent } = calculateDiscountedRate(baseRate, periodIndex);

      periods.push({
        id: `${currentDate.getTime()}-weekly`,
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
        isSelected: true,
        canModifyPeriod: true
      });

      currentDate = weeklyEnd;
      periodIndex++;
      continue;
    }

    const remainingDays = differenceInDays(endDate, currentDate);
    if (remainingDays > 0) {
      const baseRate = normalDailyRate * remainingDays;
      const { amount, discountPercent } = calculateDiscountedRate(baseRate, periodIndex);

      periods.push({
        id: `${currentDate.getTime()}-daily`,
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
        isSelected: true,
        canModifyPeriod: false
      });

      currentDate = endDate;
    }
  }

  // Mark first period as always selected and not modifiable
  if (periods.length > 0) {
    periods[0].isSelected = true;
    periods[0].canModifyPeriod = false;
  }

  return periods;
};

const calculatePaymentEstimate = (periods: PricePeriod[]): PaymentEstimate => {
  const selectedPeriods = periods.filter(p => p.isSelected);
  const totalBaseAmount = selectedPeriods.reduce((sum, period) => sum + period.baseRate, 0);
  const totalDiscountAmount = selectedPeriods.reduce((sum, period) => sum + (period.discountAmount || 0), 0);
  const finalAmount = selectedPeriods.reduce((sum, period) => sum + period.amount, 0);

  // Check if deposit is required (2 or more packages of same type)
  const hasMultiplePackages = periods.length >= 2 && 
    periods.filter(p => p.type === periods[0].type).length >= 2;

  // Calculate deposit amount (equal to one regular package)
  const depositAmount = hasMultiplePackages ? periods[0].baseRate : 0;

  // Calculate minimum payment (first package + deposit if required)
  const minimumPayment = periods[0].amount + depositAmount;

  // Determine deposit refund conditions based on selected periods
  const selectedPackagesCount = selectedPeriods.length;
  const totalPackagesCount = periods.length;
  const depositPartiallyRefundable = selectedPackagesCount >= 2;
  const depositRefundable = selectedPackagesCount === totalPackagesCount;

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
  const [modifiedPeriods, setModifiedPeriods] = useState<PricePeriod[]>([]);

  const estimates = useMemo(() => {
    if (!property || !checkIn || !checkOut) return null;

    const initialPeriods = calculatePricePeriods(property, checkIn, checkOut);
    setModifiedPeriods(initialPeriods);
    return calculatePaymentEstimate(initialPeriods);
  }, [property, checkIn, checkOut]);

  const handlePeriodTypeChange = (periodId: string, newType: 'monthly' | 'weekly' | 'daily') => {
    if (!property) return;

    setModifiedPeriods(currentPeriods => {
      const periodIndex = currentPeriods.findIndex(p => p.id === periodId);
      if (periodIndex === -1) return currentPeriods;

      const period = currentPeriods[periodIndex];
      if (!period.canModifyPeriod) return currentPeriods;

      const newPeriods = [...currentPeriods];
      const splitPeriods = splitPeriodToShorter(period, property, newType);

      // Replace the original period with split periods
      newPeriods.splice(periodIndex, 1, ...splitPeriods);

      return newPeriods;
    });
  };

  const handlePeriodSelection = (periodId: string, isSelected: boolean) => {
    setModifiedPeriods(currentPeriods => {
      return currentPeriods.map(period => {
        if (period.id === periodId && period.canModifyPeriod) {
          return { ...period, isSelected };
        }
        return period;
      });
    });
  };

  const currentEstimates = useMemo(() => {
    if (!modifiedPeriods.length) return estimates;
    return calculatePaymentEstimate(modifiedPeriods);
  }, [modifiedPeriods, estimates]);

  if (!currentEstimates) return null;

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
              The initial payment includes the first package{currentEstimates.depositRequired ? ' plus security deposit' : ''}.
            </p>
          </div>

          {/* Security Deposit Section */}
          {currentEstimates.depositRequired && (
            <div className="p-4 bg-primary/5 rounded-lg space-y-2">
              <h3 className="font-semibold">Security Deposit</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Required Deposit Amount</span>
                  <span>${currentEstimates.depositAmount.toLocaleString()}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {currentEstimates.depositRefundable 
                    ? '100% refundable - entire stay prepaid'
                    : currentEstimates.depositPartiallyRefundable
                      ? '50% refundable - 2+ packages prepaid'
                      : 'Fully refundable after stay completion'}
                </p>
              </div>
            </div>
          )}

          {/* Package Selection */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Select Packages to Prepay</h3>
            <p className="text-xs text-muted-foreground">
              Prepay multiple packages to earn higher discounts. You can modify payment periods for better flexibility.
            </p>

            <div className="divide-y">
              {modifiedPeriods.map((period, index) => (
                <div key={period.id} className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={period.isSelected}
                        disabled={!period.canModifyPeriod}
                        onCheckedChange={(checked) => handlePeriodSelection(period.id, checked as boolean)}
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {period.type === 'monthly' && `Month ${index + 1}`}
                            {period.type === 'weekly' && `Week ${index + 1}`}
                            {period.type === 'daily' && `${period.duration} Day${period.duration > 1 ? 's' : ''}`}
                          </span>
                          {!period.canModifyPeriod && (
                            <span className="text-xs text-muted-foreground">(Required)</span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(period.startDate, "MMM d")} - {format(period.endDate, "MMM d")}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-right">
                      {period.canModifyPeriod && (
                        <Select
                          value={period.type}
                          onValueChange={(value) => handlePeriodTypeChange(period.id, value as 'monthly' | 'weekly' | 'daily')}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {period.type === 'monthly' && (
                              <>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="daily">Daily</SelectItem>
                              </>
                            )}
                            {period.type === 'weekly' && (
                              <>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="daily">Daily</SelectItem>
                              </>
                            )}
                            {period.type === 'daily' && (
                              <SelectItem value="daily">Daily</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      )}
                      <div className="flex flex-col items-end">
                        <span className="font-medium">
                          ${period.amount.toLocaleString()}
                        </span>
                        {period.discountPercentage > 0 && (
                          <span className="text-xs text-green-600">
                            Save ${period.discountAmount?.toLocaleString()} ({Math.round(period.discountPercentage)}% off)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-muted-foreground">
                    <span>
                      ${Math.round(period.effectiveDailyRate)}/day
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
          <div className="space-y-4 pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span>Base Price (Selected Packages)</span>
              <span>${currentEstimates.totalBaseAmount.toLocaleString()}</span>
            </div>

            <div className="flex justify-between text-sm text-green-600">
              <span>Total Savings</span>
              <span>-${currentEstimates.totalDiscountAmount.toLocaleString()}</span>
            </div>

            <div className="flex justify-between font-semibold text-lg pt-2 border-t">
              <span>Final Price</span>
              <span>${currentEstimates.finalAmount.toLocaleString()}</span>
            </div>

            {currentEstimates.depositRequired && (
              <div className="flex justify-between text-sm pt-2 border-t">
                <span>Security Deposit (Refundable)</span>
                <span>+${currentEstimates.depositAmount.toLocaleString()}</span>
              </div>
            )}

            <div className="flex justify-between font-semibold text-lg pt-2 border-t">
              <span>Total Required Payment</span>
              <span>${(currentEstimates.finalAmount + currentEstimates.depositAmount).toLocaleString()}</span>
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