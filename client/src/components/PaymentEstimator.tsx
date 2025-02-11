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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Property } from "@db/schema";
import { useLocation } from "wouter";

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

const calculatePricePeriods = (property: Property, checkIn: Date, checkOut: Date, selectedRateType: 'monthly' | 'weekly' | 'daily'): PricePeriod[] => {
  const periods: PricePeriod[] = [];
  let currentDate = startOfDay(new Date(checkIn));
  const endDate = startOfDay(new Date(checkOut));
  const totalDays = differenceInDays(endDate, currentDate);
  let periodIndex = 0;

  // Try to fit monthly packages first if available
  while (currentDate < endDate && selectedRateType === 'monthly' && property.monthlyRate) {
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
        isSelected: true
      });

      currentDate = monthlyEnd;
      periodIndex++;
    } else {
      break; // Can't fit more monthly packages
    }
  }

  // Try to fit weekly packages for remaining period if available
  while (currentDate < endDate && (selectedRateType === 'weekly' || selectedRateType === 'monthly') && property.weeklyRate && differenceInDays(endDate, currentDate) >= 7) {
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
      isSelected: true
    });

    currentDate = weeklyEnd;
    periodIndex++;
  }

  // Use daily rate for any remaining days
  const remainingDays = differenceInDays(endDate, currentDate);
  if (remainingDays > 0) {
    const baseRate = Number(property.rate) * remainingDays;
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
      isSelected: true
    });
  }

  // Ensure first period is always selected
  if (periods.length > 0) {
    periods[0].isSelected = true;
  }

  return periods;
};

const calculatePaymentEstimate = (periods: PricePeriod[]): PaymentEstimate => {
  const selectedPeriods = periods.filter(p => p.isSelected);
  const totalBaseAmount = selectedPeriods.reduce((sum, period) => sum + period.baseRate, 0);
  const totalDiscountAmount = selectedPeriods.reduce((sum, period) => sum + (period.discountAmount || 0), 0);
  const finalAmount = selectedPeriods.reduce((sum, period) => sum + period.amount, 0);

  // Check if deposit is required (2 or more packages of same type)
  const hasMultiplePackages = periods.length >= 2;

  // Calculate deposit amount (equal to one regular package)
  const depositAmount = hasMultiplePackages ? periods[0].baseRate : 0;

  // Calculate minimum payment (first package + deposit if required)
  const minimumPayment = periods[0].amount + depositAmount;

  // Update deposit refund conditions based on selected periods
  const selectedPackagesCount = selectedPeriods.length;
  const totalPackagesCount = periods.length;

  // Deposit is fully refundable if all packages are selected (entire stay prepaid)
  const depositRefundable = selectedPackagesCount === totalPackagesCount;

  // Deposit is partially refundable (50%) if at least 2 packages are prepaid
  const depositPartiallyRefundable = selectedPackagesCount >= 2;

  // Calculate actual deposit amount based on refund conditions
  let effectiveDepositAmount = depositAmount;
  if (depositRefundable) {
    effectiveDepositAmount = 0; // No deposit needed if entire stay is prepaid
  } else if (depositPartiallyRefundable) {
    effectiveDepositAmount = depositAmount * 0.5; // 50% deposit if 2+ packages prepaid
  }

  return {
    periods,
    totalBaseAmount,
    totalDiscountAmount,
    finalAmount,
    depositRequired: hasMultiplePackages,
    depositAmount: effectiveDepositAmount,
    minimumPayment: depositRefundable ? finalAmount : periods[0].amount + effectiveDepositAmount,
    depositRefundable,
    depositPartiallyRefundable
  };
};

export default function PaymentEstimator({ property, checkIn, checkOut }: PaymentEstimatorProps) {
  const [, setLocation] = useLocation();
  const [selectedRateType, setSelectedRateType] = useState<'monthly' | 'weekly' | 'daily'>('monthly');
  const [modifiedPeriods, setModifiedPeriods] = useState<PricePeriod[]>([]);

  // Calculate the best fitting rate type based on stay duration
  const bestFittingRateType = useMemo(() => {
    if (!property || !checkIn || !checkOut) return 'daily';

    const totalDays = differenceInDays(checkOut, checkIn);
    const monthsAvailable = property.monthlyRate && differenceInCalendarMonths(checkOut, checkIn) >= 1;
    const weeksAvailable = property.weeklyRate && totalDays >= 7;

    return monthsAvailable ? 'monthly' : weeksAvailable ? 'weekly' : 'daily';
  }, [property, checkIn, checkOut]);

  // Set initial rate type when component mounts or dates change
  useMemo(() => {
    setSelectedRateType(bestFittingRateType);
  }, [bestFittingRateType]);

  const estimates = useMemo(() => {
    if (!property || !checkIn || !checkOut) return null;

    const initialPeriods = calculatePricePeriods(property, checkIn, checkOut, selectedRateType);
    setModifiedPeriods(initialPeriods);
    return calculatePaymentEstimate(initialPeriods);
  }, [property, checkIn, checkOut, selectedRateType]);

  const handlePeriodSelection = (periodId: string, isSelected: boolean) => {
    setModifiedPeriods(currentPeriods => {
      return currentPeriods.map(period => {
        if (period.id === periodId) {
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

  if (!currentEstimates || !property) return null;

  // Calculate effective daily rates
  const monthlyDailyRate = property.monthlyRate ? Math.round(Number(property.monthlyRate) / 30) : null;
  const weeklyDailyRate = property.weeklyRate ? Math.round(Number(property.weeklyRate) / 7) : null;
  const dailyRate = Number(property.rate);

  const handleConfirm = () => {
    // Navigate to payment page with selected options
    if (currentEstimates.periods[0]) {
      setLocation(`/payment?propertyId=${property.id}&rateType=${selectedRateType}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Estimation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Standard Rates */}
          <div className="p-4 bg-primary/5 rounded-lg space-y-4">
            <h3 className="font-semibold">Standard Rates</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {property.monthlyRate && (
                <div className={`p-3 bg-white rounded border ${selectedRateType === 'monthly' ? 'ring-2 ring-primary' : ''}`}>
                  <div className="text-sm font-medium">Monthly Rate</div>
                  <div className="text-2xl font-bold">${Number(property.monthlyRate).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">
                    ${monthlyDailyRate}/day
                  </div>
                </div>
              )}
              {property.weeklyRate && (
                <div className={`p-3 bg-white rounded border ${selectedRateType === 'weekly' ? 'ring-2 ring-primary' : ''}`}>
                  <div className="text-sm font-medium">Weekly Rate</div>
                  <div className="text-2xl font-bold">${Number(property.weeklyRate).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">
                    ${weeklyDailyRate}/day
                  </div>
                </div>
              )}
              <div className={`p-3 bg-white rounded border ${selectedRateType === 'daily' ? 'ring-2 ring-primary' : ''}`}>
                <div className="text-sm font-medium">Daily Rate</div>
                <div className="text-2xl font-bold">${dailyRate.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Standard rate</div>
              </div>
            </div>
          </div>

          {/* Rate Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Select Payment Rate</h3>
              <Select
                value={selectedRateType}
                onValueChange={(value) => setSelectedRateType(value as 'monthly' | 'weekly' | 'daily')}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {property.monthlyRate && differenceInCalendarMonths(checkOut!, checkIn!) >= 1 && (
                    <SelectItem value="monthly">Monthly</SelectItem>
                  )}
                  {property.weeklyRate && differenceInDays(checkOut!, checkIn!) >= 7 && (
                    <SelectItem value="weekly">Weekly</SelectItem>
                  )}
                  <SelectItem value="daily">Daily</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Payment Window Warning */}
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-700">
              Payment must be received within 24 hours to guarantee availability. 
              The initial payment includes the first package{currentEstimates.depositRequired ? ' plus security deposit' : ''}.
            </p>
          </div>

          {/* Package Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Select Packages to Prepay</h3>
              <p className="text-xs text-muted-foreground">
                Save up to 50% with prepayment discounts
              </p>
            </div>

            <div className="divide-y">
              {currentEstimates.periods.map((period, index) => (
                <div key={period.id} className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={period.isSelected}
                        disabled={index === 0} // First package always selected
                        onCheckedChange={(checked) => handlePeriodSelection(period.id, checked as boolean)}
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {period.type === 'monthly' && `Month ${index + 1}`}
                            {period.type === 'weekly' && `Week ${index + 1}`}
                            {period.type === 'daily' && `${period.duration} Day${period.duration > 1 ? 's' : ''}`}
                          </span>
                          {index === 0 && (
                            <span className="text-xs text-muted-foreground">(Required)</span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(period.startDate, "MMM d")} - {format(period.endDate, "MMM d")}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-medium">
                        ${period.amount.toLocaleString()}
                      </div>
                      {period.discountPercentage > 0 && (
                        <div className="text-xs text-green-600">
                          Save ${period.discountAmount?.toLocaleString()} ({Math.round(period.discountPercentage)}% off)
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        ${Math.round(period.effectiveDailyRate)}/day
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security Deposit */}
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
                    ? 'No deposit required - entire stay prepaid'
                    : currentEstimates.depositPartiallyRefundable
                      ? '50% deposit required - 2+ packages prepaid'
                      : 'Full deposit required'}
                </p>
              </div>
            </div>
          )}

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
          </div>

          <Button className="w-full" onClick={handleConfirm}>
            Proceed to Payment
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}