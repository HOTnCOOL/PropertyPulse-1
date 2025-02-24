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
}

const DAILY_RATE = 70;
const WEEKLY_RATE = 420;
const MONTHLY_RATE = 1500;

function calculateDiscountForPeriod(periodIndex: number): number {
  // First period has no discount
  if (periodIndex <= 0) return 0;
  // Calculate progressive discount (10% increase per period, max 50%)
  return Math.min((periodIndex) * 0.1, 0.5);
}

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
  prepayAll: boolean
): PaymentBreakdown {
  const periods: PaymentPeriod[] = [];
  let currentDate = startOfDay(new Date(checkIn));
  const endDate = startOfDay(new Date(checkOut));
  const totalDays = differenceInDays(endDate, currentDate);

  if (preferredType === 'daily') {
    // First day as a separate period (required)
    periods.push({
      type: 'daily',
      startDate: currentDate,
      endDate: addDays(currentDate, 1),
      baseAmount: DAILY_RATE,
      amount: DAILY_RATE,
      label: 'Day 1 (Required)',
      index: 0,
      isPrepaid: true // Always prepaid as it's required
    });

    // Remaining days as separate periods
    for (let i = 1; i < totalDays; i++) {
      const dayStart = addDays(checkIn, i);
      periods.push({
        type: 'daily',
        startDate: dayStart,
        endDate: addDays(dayStart, 1),
        baseAmount: DAILY_RATE,
        amount: DAILY_RATE,
        label: `Day ${i + 1}`,
        index: i,
        isPrepaid: false // Optional prepayment
      });
    }
  } else if (preferredType === 'weekly' && totalDays >= 7) {
    // Handle complete weeks
    let weekIndex = 0;
    while (differenceInDays(endDate, currentDate) >= 7) {
      const weekEnd = addWeeks(currentDate, 1);
      periods.push({
        type: 'weekly',
        startDate: currentDate,
        endDate: weekEnd,
        baseAmount: WEEKLY_RATE,
        amount: WEEKLY_RATE,
        label: weekIndex === 0 ? 'Week 1 (Required)' : `Week ${weekIndex + 1}`,
        index: weekIndex,
        isPrepaid: weekIndex === 0 // First week always prepaid
      });
      currentDate = weekEnd;
      weekIndex++;
    }

    // Handle remaining days for weekly plan
    const remainingDays = differenceInDays(endDate, currentDate);
    if (remainingDays > 0) {
      const weeklyPerNightRate = WEEKLY_RATE / 7; // 60 BGN per night
      const remainingAmount = weeklyPerNightRate * remainingDays;

      periods.push({
        type: 'weekly',
        startDate: currentDate,
        endDate: endDate,
        baseAmount: remainingAmount,
        amount: remainingAmount,
        label: `${remainingDays} night${remainingDays > 1 ? 's' : ''} at weekly rate`,
        index: periods.length,
        isPrepaid: false
      });
    }
  } else if (preferredType === 'monthly' && differenceInCalendarMonths(endDate, currentDate) >= 1) {
    // Handle complete months
    let monthIndex = 0;
    while (differenceInCalendarMonths(endDate, currentDate) >= 1) {
      const monthEnd = addMonths(currentDate, 1);
      periods.push({
        type: 'monthly',
        startDate: currentDate,
        endDate: monthEnd,
        baseAmount: MONTHLY_RATE,
        amount: MONTHLY_RATE,
        label: monthIndex === 0 ? 'Month 1 (Required)' : `Month ${monthIndex + 1}`,
        index: monthIndex,
        isPrepaid: monthIndex === 0 // First month always prepaid
      });
      currentDate = monthEnd;
      monthIndex++;
    }

    // Handle remaining days for monthly plan
    const remainingDays = differenceInDays(endDate, currentDate);
    if (remainingDays > 0) {
      const monthlyPerNightRate = MONTHLY_RATE / 30; // 50 BGN per night
      const remainingAmount = monthlyPerNightRate * remainingDays;

      periods.push({
        type: 'monthly',
        startDate: currentDate,
        endDate: endDate,
        baseAmount: remainingAmount,
        amount: remainingAmount,
        label: `${remainingDays} night${remainingDays > 1 ? 's' : ''} at monthly rate`,
        index: periods.length,
        isPrepaid: false
      });
    }
  }

  // Apply prepayment selections and progressive discounts
  periods.forEach((period, index) => {
    if (!period.isPrepaid) { // Skip already prepaid periods (first period)
      period.isPrepaid = prepayAll || selectedPeriods.includes(index);
    }
  });

  // Apply progressive discounts to prepaid periods
  periods.forEach((period, index) => {
    if (period.isPrepaid && index > 0) { // Skip first period
      const discount = calculateDiscountForPeriod(index);
      period.amount = period.baseAmount * (1 - discount);
    }
  });

  const totalAmount = periods.reduce((sum, period) => sum + period.amount, 0);

  // Count prepaid periods of the same type for deposit calculation
  const prepaidPeriodsCount = periods.filter(p => p.isPrepaid && p.type === preferredType).length;
  const depositAmount = calculateDepositAmount(preferredType, prepaidPeriodsCount, totalDays);

  // Calculate initial payment (prepaid periods + deposit)
  const initialPayment = periods.reduce((sum, period) =>
    sum + (period.isPrepaid ? period.amount : 0), 0) + depositAmount;

  const totalSavings = periods.reduce((sum, period) =>
    sum + (period.baseAmount - period.amount), 0);

  return {
    primaryType: preferredType,
    periods,
    totalAmount,
    depositAmount,
    initialPayment,
    totalSavings,
    effectiveRate: totalAmount / totalDays
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
    if (!checkIn || !checkOut) return null;
    return calculateOptimalPaymentBreakdown(
      checkIn,
      checkOut,
      preferredPackageType,
      selectedPeriods,
      prepayAll
    );
  }, [checkIn, checkOut, preferredPackageType, selectedPeriods, prepayAll]);

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
                {paymentBreakdown.periods.map(period => {
                  if (!period) return null;
                  return (
                    <motion.div key={period.index} className="flex justify-between text-sm" variants={itemVariants}>
                      <span>{period.label} </span>
                      <span>${period.amount.toLocaleString()}</span>
                    </motion.div>
                  );
                })}
                {paymentBreakdown.depositAmount > 0 && (
                  <motion.div className="flex justify-between text-sm" variants={itemVariants}>
                    <span>Security Deposit (Fully Refundable)</span>
                    <span>+${paymentBreakdown.depositAmount.toLocaleString()}</span>
                  </motion.div>
                )}
                <motion.div className="flex justify-between font-semibold text-base pt-2 border-t" variants={itemVariants}>
                  <span>Total Initial Payment</span>
                  <span>${paymentBreakdown.initialPayment.toLocaleString()}</span>
                </motion.div>
              </div>

              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm text-yellow-700">
                  <p>
                    Initial payment must be received within 24 hours to guarantee availability.
                    The security deposit is fully refundable after stay completion and property inspection.
                  </p>
                  {paymentBreakdown.depositAmount === 0 ? (
                    <p className="font-medium">
                      No security deposit required for fully prepaid bookings.
                    </p>
                  ) : (
                    <p>
                      Security deposit can be paid in advance or guaranteed by credit card.
                      {paymentBreakdown.periods.filter(p => p.isPrepaid).length >= 2 &&
                        " Your deposit is reduced by 50% as you've prepaid 2 or more payment periods."}
                    </p>
                  )}
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
                      Select additional periods to prepay and get progressive discounts.
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
                    (index === 1 && period.type === preferredType);

                  // Calculate the discount that would apply to this period
                  const discount = calculateDiscountForPeriod(index);
                  const discountedAmount = period.baseAmount * (1 - discount);

                  return (
                    <motion.div
                      key={index}
                      className="py-4"
                      variants={itemVariants}
                      initial="hidden"
                      animate="visible"
                      layout
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
                            <div
                              className="font-medium"
                              layout
                            >
                              {period.label}
                              {discount > 0 && index > 0 && (
                                <span
                                  className={`ml-2 text-sm ${isSelected ? 'text-green-600' : 'text-muted-foreground'}`}
                                >
                                  ({(discount * 100).toFixed(0)}% off if prepaid)
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {format(period.startDate, "MMM d")} - {format(period.endDate, "MMM d")}
                            </div>
                          </div>
                        </div>
                        <div
                          className="text-right"
                          layout
                        >
                          <div
                            className="font-medium"
                            layout
                          >
                            {index === 0 ? (
                              // First period is always at base price
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
                          <div
                            className="text-xs text-muted-foreground"
                            layout
                          >
                            {isSelected ? 'Prepaid' : `Due by ${format(period.startDate, "MMM d")}`}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Deposit information */}
                <motion.div className="py-4 bg-primary/5 rounded-lg mt-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium">Security Deposit</span>
                      {paymentBreakdown.depositAmount === 0 ? (
                        <span className="text-green-600 text-sm ml-2">
                          (Waived - 3+ periods prepaid)
                        </span>
                      ) : paymentBreakdown.depositAmount < calculateDepositAmount(preferredPackageType, 0, differenceInDays(checkOut!, checkIn!)) ? (
                        <span className="text-green-600 text-sm ml-2">
                          (50% off - 2 periods prepaid)
                        </span>
                      ) : null}
                    </div>
                    <span className="font-medium">
                      ${paymentBreakdown.depositAmount.toLocaleString()}
                    </span>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            <motion.div
              className="space-y-4 pt-4 border-t"
              variants={itemVariants}
            >
              <div>
                <h3 className="text-sm font-semibold mb-2">Total Stay Cost</h3>
                <motion.div className="p-4 bg-primary/5 rounded-lg" variants={itemVariants}>
                  <div className="space-y-2">
                    {paymentBreakdown.periods.map((period, index) => (
                      <motion.div key={index} className="flex justify-between text-sm" variants={itemVariants}>
                        <span>
                          {period.label}
                        </span>
                        <span>${period.amount.toLocaleString()}</span>
                      </motion.div>
                    ))}
                    <motion.div className="flex justify-between font-semibold text-lg pt-2 border-t" variants={itemVariants}>
                      <span>Total Accommodation Cost</span>
                      <span>${paymentBreakdown.totalAmount.toLocaleString()}</span>
                    </motion.div>
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
                onClick={() => setLocation(`/payment?propertyId=${property?.id}&packageType=${paymentBreakdown.primaryType}`)}
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