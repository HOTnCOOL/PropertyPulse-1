import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  format,
  differenceInDays,
  differenceInCalendarMonths,
  addMonths,
  addWeeks,
  startOfDay,
  isSameDay,
  getDate,
  addDays
} from "date-fns";
import { AlertTriangle, Info, TrendingDown, AlertCircle } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

interface PaymentEstimatorProps {
  property?: Property;
  checkIn?: Date;
  checkOut?: Date;
}

// Update the discount calculation function
function calculateDiscount(
  periodIndex: number, 
  discountConfig: any, 
  selectedPeriods: number[],
  preferredType: 'monthly' | 'weekly' | 'daily',
  period: PaymentPeriod
): number {
  // Early return if no discount config or period type doesn't match
  if (!discountConfig || !discountConfig[preferredType] || period.type !== preferredType) return 0;

  const planConfig = discountConfig[preferredType];

  // Return 0 if plan config is invalid
  if (!planConfig || !planConfig.type) return 0;

  if (planConfig.type === 'progressive') {
    // First period has no discount
    if (periodIndex <= 0) return 0;
    // Calculate progressive discount (configurable rate per period, up to max)
    const rate = (planConfig.progressiveRate ?? 10) / 100; // Default 10%
    const max = (planConfig.progressiveMax ?? 50) / 100; // Default 50%
    return Math.min(periodIndex * rate, max);
  } else if (planConfig.type === 'bulkPrepay') {
    const periodsRequired = planConfig.periodsRequired ?? 5;
    const discount = (planConfig.nextPeriodDiscount ?? 50) / 100;

    // Check if we have enough consecutive prepaid periods before this one
    const consecutivePrepaidBefore = selectedPeriods
      .filter(i => i < periodIndex)
      .sort((a, b) => a - b)
      .reduce((count, current, i, arr) => {
        // Reset count if there's a gap in consecutive numbers
        if (i > 0 && current !== arr[i-1] + 1) return 0;
        return count + 1;
      }, 0);

    // Apply discount if we have the required number of consecutive prepaid periods
    if (consecutivePrepaidBefore > 0 && consecutivePrepaidBefore % periodsRequired === 0) {
      return discount;
    }
  }
  return 0;
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
}

interface PaymentBreakdown {
  primaryType: 'monthly' | 'weekly' | 'daily';
  periods: PaymentPeriod[];
  totalAmount: number;
  depositAmount: number;
  initialPayment: number;
  totalSavings: number;
  effectiveRate: number;
  savingsPercentage: number;
}

// Fixed rates as per requirements
const DAILY_RATE = 70;
const WEEKLY_RATE = 420;
const MONTHLY_RATE = 1500;

const calculateDepositAmount = (plan: 'monthly' | 'weekly' | 'daily', prepaidPeriodsCount: number, stayDurationDays: number): number => {
  let baseDeposit;

  // Calculate base deposit
  if (plan === 'daily') {
    baseDeposit = DAILY_RATE; // Always one daily rate for daily plans
  } else if (stayDurationDays > 60) {
    baseDeposit = MONTHLY_RATE;
  } else if (stayDurationDays > 14) {
    baseDeposit = WEEKLY_RATE;
  } else {
    baseDeposit = DAILY_RATE;
  }

  // Apply deposit reductions based on prepaid periods
  if (prepaidPeriodsCount >= 3) {
    return 0; // No deposit required for 3+ prepaid periods
  } else if (prepaidPeriodsCount >= 2) {
    baseDeposit *= 0.5; // 50% deposit reduction for 2 prepaid periods
  }

  // Apply plan-specific maximum deposit limits
  switch (plan) {
    case 'daily':
      return Math.min(baseDeposit, DAILY_RATE);
    case 'weekly':
      return Math.min(baseDeposit, WEEKLY_RATE);
    case 'monthly':
      return Math.min(baseDeposit, MONTHLY_RATE);
  }
};

function calculateOptimalPaymentBreakdown(
  checkIn: Date,
  checkOut: Date,
  preferredType: 'monthly' | 'weekly' | 'daily',
  selectedPeriods: number[],
  prepayAll: boolean,
  discountConfig: any
): PaymentBreakdown {
  const periods: PaymentPeriod[] = [];
  let currentDate = startOfDay(new Date(checkIn));
  const endDate = startOfDay(new Date(checkOut));
  const totalDays = differenceInDays(endDate, currentDate);

  // Simplified payment schedule as per requirements
  // Only create the first payment period based on the selected plan
  if (preferredType === 'daily') {
    // First daily period (required)
    periods.push({
      type: 'daily',
      startDate: currentDate,
      endDate: addDays(currentDate, 1),
      baseAmount: DAILY_RATE,
      amount: DAILY_RATE,
      label: '1 daily period (Required)',
      index: 0,
      isPrepaid: true // Always prepaid as it's required
    });

    // Group remaining days for a simplified payment schedule
    if (totalDays > 1) {
      // Group consecutive days into one payment period
      const remainingDays = totalDays - 1;
      periods.push({
        type: 'daily',
        startDate: addDays(currentDate, 1),
        endDate: endDate,
        baseAmount: DAILY_RATE * remainingDays,
        amount: DAILY_RATE * remainingDays,
        label: `${remainingDays}x daily periods`,
        index: 1,
        isPrepaid: false
      });
    }
  } else if (preferredType === 'weekly' && totalDays >= 7) {
    // First week (required)
    const weekEnd = addDays(currentDate, 7);
    periods.push({
      type: 'weekly',
      startDate: currentDate,
      endDate: weekEnd > endDate ? endDate : weekEnd,
      baseAmount: WEEKLY_RATE,
      amount: WEEKLY_RATE,
      label: '1 weekly period (Required)',
      index: 0,
      isPrepaid: true
    });

    // Handle remaining weeks as a single grouped period
    const remainingDays = differenceInDays(endDate, weekEnd);
    if (remainingDays > 0) {
      const completeWeeks = Math.floor(remainingDays / 7);
      const remainingPartialDays = remainingDays % 7;
      
      if (completeWeeks > 0) {
        periods.push({
          type: 'weekly',
          startDate: weekEnd,
          endDate: addDays(weekEnd, completeWeeks * 7),
          baseAmount: WEEKLY_RATE * completeWeeks,
          amount: WEEKLY_RATE * completeWeeks,
          label: `${completeWeeks}x weekly periods`,
          index: 1,
          isPrepaid: false
        });
      }
      
      if (remainingPartialDays > 0) {
        const weeklyPerNightRate = WEEKLY_RATE / 7;
        periods.push({
          type: 'weekly',
          startDate: addDays(weekEnd, completeWeeks * 7),
          endDate: endDate,
          baseAmount: weeklyPerNightRate * remainingPartialDays,
          amount: weeklyPerNightRate * remainingPartialDays,
          label: `${remainingPartialDays} days at weekly rate`,
          index: completeWeeks > 0 ? 2 : 1,
          isPrepaid: false
        });
      }
    }
  } else if (preferredType === 'monthly' && differenceInCalendarMonths(endDate, currentDate) >= 1) {
    // First month (required)
    const monthEnd = addMonths(currentDate, 1);
    periods.push({
      type: 'monthly',
      startDate: currentDate,
      endDate: monthEnd > endDate ? endDate : monthEnd,
      baseAmount: MONTHLY_RATE,
      amount: MONTHLY_RATE,
      label: '1 monthly period (Required)',
      index: 0,
      isPrepaid: true
    });

    // Handle remaining time as a grouped period
    if (monthEnd < endDate) {
      const remainingMonths = differenceInCalendarMonths(endDate, monthEnd);
      const remainingDays = differenceInDays(endDate, addMonths(monthEnd, remainingMonths));
      
      if (remainingMonths > 0) {
        periods.push({
          type: 'monthly',
          startDate: monthEnd,
          endDate: addMonths(monthEnd, remainingMonths),
          baseAmount: MONTHLY_RATE * remainingMonths,
          amount: MONTHLY_RATE * remainingMonths,
          label: `${remainingMonths}x monthly periods`,
          index: 1,
          isPrepaid: false
        });
      }
      
      if (remainingDays > 0) {
        const monthlyPerNightRate = MONTHLY_RATE / 30;
        periods.push({
          type: 'monthly',
          startDate: addMonths(monthEnd, remainingMonths),
          endDate: endDate,
          baseAmount: monthlyPerNightRate * remainingDays,
          amount: monthlyPerNightRate * remainingDays,
          label: `${remainingDays} days at monthly rate`,
          index: remainingMonths > 0 ? 2 : 1,
          isPrepaid: false
        });
      }
    }
  }

  // Apply prepayment selections and discounts
  periods.forEach((period, index) => {
    if (!period.isPrepaid) { // Skip already prepaid periods (first period)
      period.isPrepaid = prepayAll || selectedPeriods.includes(index);
    }
  });

  // Apply discounts to prepaid periods
  periods.forEach((period, index) => {
    if (period.isPrepaid && index > 0) { // Skip first period
      const discount = calculateDiscount(index, discountConfig, selectedPeriods, preferredType, period);
      period.amount = period.baseAmount * (1 - discount);
    }
  });

  const totalAmount = periods.reduce((sum, period) => sum + period.amount, 0);

  const depositAmount = calculateDepositAmount(preferredType, periods.filter(p => p.isPrepaid && p.type === preferredType).length, totalDays);

  // Calculate initial payment (only first period as per requirement, deposit is separate)
  const initialPayment = periods[0].amount;

  const totalSavings = periods.reduce((sum, period) =>
    sum + (period.baseAmount - period.amount), 0);

  // Calculate the percentage savings compared to standard price
  const standardPrice = totalDays * DAILY_RATE;
  const savingsPercentage = ((standardPrice - totalAmount) / standardPrice) * 100;

  return {
    primaryType: preferredType,
    periods,
    totalAmount,
    depositAmount,
    initialPayment,
    totalSavings,
    effectiveRate: totalAmount / totalDays,
    savingsPercentage: savingsPercentage > 0 ? savingsPercentage : 0
  };
}

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 }
};

const discountVariants = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 25 }
  }
};

const isEligibleForMonthlyPlan = (checkIn: Date, checkOut: Date): boolean => {
  const nextMonthSameDate = addMonths(checkIn, 1);
  const checkInDate = getDate(checkIn);
  const lastDayNextMonth = addMonths(new Date(checkIn.getFullYear(), checkIn.getMonth() + 1, 0), 1);

  // Handle special case for end of month dates
  const targetDate = checkInDate > getDate(lastDayNextMonth) ? lastDayNextMonth : nextMonthSameDate;

  return checkOut >= targetDate;
};

const isEligibleForWeeklyPlan = (checkIn: Date, checkOut: Date): boolean => {
  return differenceInDays(checkOut, checkIn) >= 7;
};

const PlanCard = ({
  type,
  rate,
  standardAmount,
  isSelected,
  isEligible,
  totalDays,
  onSelect
}: {
  type: 'monthly' | 'weekly' | 'daily';
  rate: number;
  standardAmount: number;
  isSelected: boolean;
  isEligible: boolean;
  totalDays: number;
  onSelect: () => void;
}) => {
  // Calculate per night rate
  const perNightRate = type === 'monthly' ?
    (rate / 30) : type === 'weekly' ?
      (rate / 7) : rate;

  // Calculate total stay cost without any discounts
  const totalStayCost = perNightRate * totalDays;

  return (
    <motion.div
      className={`p-3 bg-white rounded border cursor-pointer transition-colors ${
        !isEligible ? 'opacity-50 cursor-not-allowed' :
          isSelected ? 'border-primary' : ''
      }`}
      onClick={onSelect}
      whileHover={isEligible ? { scale: 1.02 } : {}}
      whileTap={isEligible ? { scale: 0.98 } : {}}
    >
      <div className="text-sm font-medium">{type.charAt(0).toUpperCase() + type.slice(1)} Plan</div>
      <div className="text-2xl font-bold">${perNightRate.toFixed(2)}</div>
      <div className="text-xs text-muted-foreground">per night</div>
      <div className="mt-2 space-y-1 border-t pt-2">
        <div className="text-sm text-muted-foreground">
          ${standardAmount} per {type === 'monthly' ? 'month' : type === 'weekly' ? 'week' : 'day'}
        </div>
        <div className="text-xs text-green-600">
          Save {((DAILY_RATE - perNightRate) / DAILY_RATE * 100).toFixed(1)}% vs daily rate
        </div>
        <div className="text-sm font-medium mt-2 text-muted-foreground">
          Total for {totalDays} nights: ${totalStayCost.toLocaleString()}
        </div>
      </div>
      {!isEligible && (
        <div className="text-xs text-red-500 mt-1">
          {type === 'monthly'
            ? 'Requires full month stay'
            : type === 'weekly'
              ? 'Minimum 7 days required'
              : ''}
        </div>
      )}
    </motion.div>
  );
};

export default function PaymentEstimator({ property, checkIn, checkOut }: PaymentEstimatorProps) {
  const [, setLocation] = useLocation();
  const [preferredPackageType, setPreferredPackageType] = useState<'monthly' | 'weekly' | 'daily'>('daily');
  const [selectedPeriods, setSelectedPeriods] = useState<number[]>([0]);
  const [prepayAll, setPrepayAll] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const eligibility = useMemo(() => {
    if (!checkIn || !checkOut) return { weekly: false, monthly: false };
    return {
      weekly: isEligibleForWeeklyPlan(checkIn, checkOut),
      monthly: isEligibleForMonthlyPlan(checkIn, checkOut)
    };
  }, [checkIn, checkOut]);

  const handlePackageTypeChange = (type: 'monthly' | 'weekly' | 'daily') => {
    setPlanError(null);

    if (type === 'monthly' && !eligibility.monthly) {
      setPlanError('Monthly plan requires stay until at least the same date of next month');
      return;
    }

    if (type === 'weekly' && !eligibility.weekly) {
      setPlanError('Weekly plan requires minimum 7 days stay');
      return;
    }

    setPreferredPackageType(type);
    setSelectedPeriods([0]); // Reset selected periods when plan changes
    setPrepayAll(false);
  };

  const paymentBreakdown = useMemo(() => {
    if (!checkIn || !checkOut || !property) return null;
    return calculateOptimalPaymentBreakdown(
      checkIn,
      checkOut,
      preferredPackageType,
      selectedPeriods,
      prepayAll,
      property.discountConfig
    );
  }, [checkIn, checkOut, preferredPackageType, selectedPeriods, prepayAll, property]);

  const handlePeriodSelect = (index: number) => {
    if (index === 0) return; // Can't toggle first period

    setSelectedPeriods(prev => {
      // Check if all previous periods are selected
      const allPreviousSelected = Array.from({ length: index })
        .every((_, i) => i === 0 || prev.includes(i));

      if (!allPreviousSelected) {
        // Can't select this period if previous ones aren't selected
        return prev;
      }

      if (prev.includes(index)) {
        // When deselecting, remove this and all subsequent periods
        return prev.filter(i => i < index);
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
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle>Payment Plan Selection</CardTitle>
        </CardHeader>
        <CardContent>
          <motion.div
            className="space-y-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div
              className="p-4 bg-primary/5 rounded-lg space-y-4"
              variants={itemVariants}
            >
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">
                  {checkIn && checkOut ? (
                    `Select a Payment Plan for your ${differenceInDays(checkOut, checkIn)}-days booking`
                  ) : (
                    'Select a Payment Plan'
                  )}
                </h3>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="prepayAll"
                    checked={prepayAll}
                    onCheckedChange={handlePrepayAll}
                  />
                  <motion.label
                    htmlFor="prepayAll"
                    className="text-sm cursor-pointer"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Prepay All (Maximum Discount)
                  </motion.label>
                </div>
              </div>

              {planError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{planError}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <motion.div className="space-y-2" variants={itemVariants}>
                  <PlanCard
                    type="monthly"
                    rate={MONTHLY_RATE}
                    standardAmount={1500}
                    isSelected={preferredPackageType === 'monthly'}
                    isEligible={eligibility.monthly}
                    totalDays={checkIn && checkOut ? differenceInDays(checkOut, checkIn) : 0}
                    onSelect={() => handlePackageTypeChange('monthly')}
                  />
                </motion.div>

                <motion.div className="space-y-2" variants={itemVariants}>
                  <PlanCard
                    type="weekly"
                    rate={WEEKLY_RATE}
                    standardAmount={420}
                    isSelected={preferredPackageType === 'weekly'}
                    isEligible={eligibility.weekly}
                    totalDays={checkIn && checkOut ? differenceInDays(checkOut, checkIn) : 0}
                    onSelect={() => handlePackageTypeChange('weekly')}
                  />
                </motion.div>

                <motion.div className="space-y-2" variants={itemVariants}>
                  <PlanCard
                    type="daily"
                    rate={DAILY_RATE}
                    standardAmount={70}
                    isSelected={preferredPackageType === 'daily'}
                    isEligible={true}
                    totalDays={checkIn && checkOut ? differenceInDays(checkOut, checkIn) : 0}
                    onSelect={() => handlePackageTypeChange('daily')}
                  />
                </motion.div>
              </div>
            </motion.div>

            {/* Update discount type information */}
            {property?.discountConfig && property.discountConfig[preferredPackageType] && (
              <motion.div className="p-4 bg-green-50 border border-green-200 rounded-lg" variants={itemVariants}>
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingDown className="text-green-600 h-5 w-5" />
                  <h3 className="font-semibold text-green-700">Available Discounts</h3>
                </div>
                <div className="text-sm">
                  {property.discountConfig[preferredPackageType]?.type === 'progressive' ? (
                    <p>
                      Progressive prepayment discount: {property.discountConfig[preferredPackageType]?.progressiveRate ?? 0}% per period,
                      up to {property.discountConfig[preferredPackageType]?.progressiveMax ?? 0}% maximum discount
                    </p>
                  ) : property.discountConfig[preferredPackageType]?.type === 'bulkPrepay' ? (
                    <p>
                      Prepay {property.discountConfig[preferredPackageType]?.periodsRequired ?? 0} consecutive {preferredPackageType} periods
                      to get {property.discountConfig[preferredPackageType]?.nextPeriodDiscount ?? 0}% off your next period!
                    </p>
                  ) : (
                    <p>No discount configuration available for {preferredPackageType} payments.</p>
                  )}
                </div>
              </motion.div>
            )}

            <motion.div
              className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-4"
              variants={itemVariants}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Initial Payment Required</h3>
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
              </div>
              <div className="space-y-2">
                {/* Only show the first period as per requirements */}
                {paymentBreakdown.periods.length > 0 && (
                  <motion.div className="flex justify-between text-sm" variants={itemVariants}>
                    <span>{paymentBreakdown.periods[0].label}</span>
                    <span>${paymentBreakdown.periods[0].amount.toLocaleString()}</span>
                  </motion.div>
                )}
                
                <motion.div className="flex justify-between font-semibold text-base pt-2 border-t" variants={itemVariants}>
                  <span>Initial Payment Due</span>
                  <span>${paymentBreakdown.initialPayment.toLocaleString()}</span>
                </motion.div>
              </div>

              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm text-yellow-700">
                  <p>
                    Initial payment must be received within 24 hours to guarantee availability.
                    You'll only be charged for the first period of your selected plan.
                  </p>
                  <p>
                    Additional periods will be billed according to the payment schedule.
                    See the Security Deposit section for details on the fully refundable guarantee.
                  </p>
                </div>
              </div>
            </motion.div>

            <AnimatePresence>
              {paymentBreakdown.totalSavings > 0 && (
                <motion.div
                  className="p-4 bg-green-50 border border-green-200 rounded-lg"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  layout
                >
                  <motion.div className="flex items-center space-x-2 mb-2">
                    <TrendingDown className="text-green-600 h-5 w-5" />
                    <h3 className="font-semibold text-green-700">Your Savings</h3>
                  </motion.div>
                  <div className="space-y-2">
                    <motion.div
                      className="flex justify-between"
                      variants={discountVariants}
                    >
                      <span>Total Savings</span>
                      <motion.span
                        className="font-semibold text-green-600"
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        ${paymentBreakdown.totalSavings.toLocaleString()}
                      </motion.span>
                    </motion.div>
                    <motion.div
                      className="flex justify-between"
                      variants={discountVariants}
                    >
                      <span>Effective Daily Rate</span>
                      <span>${paymentBreakdown.effectiveRate.toFixed(2)}</span>
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div className="space-y-4" variants={itemVariants}>
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold">Payment Schedule</h3>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      Prepay multiple periods to receive a discount.
                      Prepay 2+ periods for 50% off deposit, 3+ periods for no deposit!
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="divide-y">
                {paymentBreakdown.periods.map((period, index) => {
                  const isSelected = selectedPeriods.includes(index) || prepayAll;
                  const canSelect = index === 0 ||
                    selectedPeriods.includes(index - 1) ||
                    (index === 1 && period.type === preferredPackageType);

                  // Calculate the discount that would apply to this period
                  const discount = calculateDiscount(
                    index,
                    property?.discountConfig,
                    selectedPeriods,
                    preferredPackageType,
                    period
                  );
                  const discountedAmount = period.baseAmount * (1 - discount);
                  
                  // Format the date range for display
                  const startDateFormat = format(period.startDate, "MMM d");
                  const endDateFormat = format(period.endDate, "MMM d");
                  const dateDisplay = `${startDateFormat} - ${endDateFormat}`;
                  
                  // Define the discount text if applicable
                  const discountText = discount > 0 && index > 0 
                    ? `Prepay this period to get ${(discount * 100).toFixed(0)}% discount.` 
                    : '';
                  
                  // Create the payment info text
                  const paymentInfo = index === 0 
                    ? 'Required Initial Payment' 
                    : isSelected 
                      ? 'Prepaid' 
                      : `Due by ${startDateFormat}`;

                  return (
                    <motion.div
                      key={index}
                      className="py-4"
                      variants={itemVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-start space-x-3">
                          {index > 0 && (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handlePeriodSelect(index)}
                              disabled={!canSelect || prepayAll}
                            />
                          )}
                          <div className="space-y-1">
                            <div className="font-medium">
                              {period.label}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {dateDisplay} - {paymentInfo}
                            </div>
                            {discount > 0 && index > 0 && (
                              <div className={`text-xs ${isSelected ? 'text-green-600' : 'text-muted-foreground'}`}>
                                {discountText}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">
                            {index === 0 ? (
                              `$${period.baseAmount.toLocaleString()}`
                            ) : (
                              <>
                                <span className={`${isSelected ? 'text-muted-foreground line-through' : ''} mr-2`}>
                                  ${period.baseAmount.toLocaleString()}
                                </span>
                                <span className={isSelected ? 'text-green-600' : 'text-muted-foreground'}>
                                  ${discountedAmount.toLocaleString()}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {isSelected ? 'Prepaid' : `Due by ${format(period.startDate, "MMM d")}`}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Separate Security Deposit section */}
                <motion.div className="py-4 bg-primary/5 rounded-lg mt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">Security Deposit</div>
                        <div className="text-sm text-muted-foreground">
                          Fully refundable after checkout
                        </div>
                        {paymentBreakdown.depositAmount === 0 ? (
                          <div className="text-green-600 text-sm">
                            Deposit waived for bookings with 3+ prepaid periods
                          </div>
                        ) : paymentBreakdown.depositAmount < calculateDepositAmount(preferredPackageType, 0, differenceInDays(checkOut!, checkIn!)) ? (
                          <div className="text-green-600 text-sm">
                            50% deposit discount applied (2 periods prepaid)
                          </div>
                        ) : null}
                      </div>
                      <span className="font-medium">
                        ${paymentBreakdown.depositAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <p>The security deposit is a fully refundable guarantee that will be returned to you 
                      after checkout and property inspection.</p>
                      <p>This amount is <strong>not</strong> part of your accommodation cost and is handled separately.</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            <motion.div
              variants={itemVariants}
            >
              <div>
                <h3 className="text-sm font-semibold mb-2">Total Accommodation Cost</h3>
                <motion.div className="p-4 bg-primary/5 rounded-lg" variants={itemVariants}>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="space-y-1">
                        <div className="font-semibold text-lg">${paymentBreakdown.totalAmount.toLocaleString()}</div>
                        {paymentBreakdown.savingsPercentage > 0 && (
                          <div className="text-green-600 text-sm">
                            You save {formatPercent(paymentBreakdown.savingsPercentage)} compared to the standard rate
                          </div>
                        )}
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <div>${formatCurrency(paymentBreakdown.effectiveRate)} per night</div>
                        <div>for {differenceInDays(checkOut!, checkIn!)} nights</div>
                      </div>
                    </div>

                    {paymentBreakdown.totalSavings > 0 && (
                      <div className="flex items-center justify-between p-2 bg-green-50 border border-green-100 rounded">
                        <div className="text-green-700">
                          <TrendingDown className="inline-block h-4 w-4 mr-1" />
                          <span className="font-medium">Total Savings</span>
                        </div>
                        <span className="font-medium text-green-700">
                          ${paymentBreakdown.totalSavings.toLocaleString()}
                        </span>
                      </div>
                    )}
                    
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      <p>The initial payment required is ${formatCurrency(paymentBreakdown.initialPayment)} 
                      for the first period based on your selected plan.</p>
                      <p>Additional periods will be billed according to the payment schedule above.</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                className="w-full"
                onClick={() => {
                  // Build query parameters with all user preferences
                  const queryParams = new URLSearchParams({
                    propertyId: property?.id?.toString() || '',
                    packageType: paymentBreakdown.primaryType,
                    totalAmount: paymentBreakdown.totalAmount.toString(),
                    depositAmount: paymentBreakdown.depositAmount.toString(),
                    initialPayment: paymentBreakdown.initialPayment.toString(),
                    prepaidPeriods: selectedPeriods.join(','),
                    savingsPercent: paymentBreakdown.savingsPercentage.toFixed(0)
                  });
                  
                  // Navigate to payment page with all parameters
                  setLocation(`/payment?${queryParams.toString()}`);
                }}
              >
                Proceed to Payment
              </Button>
            </motion.div>
          </motion.div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}