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

const calculateDepositAmount = (stayDurationDays: number): number => {
  if (stayDurationDays > 60) {
    return 1500; // 1500 BGN for stays longer than 60 days
  } else if (stayDurationDays > 14) {
    return 420; // 420 BGN for stays between 15-60 days
  } else {
    return 70; // 70 BGN for stays up to 14 days
  }
};

const calculateOptimalPaymentBreakdown = (
  checkIn: Date,
  checkOut: Date,
  preferredType: 'monthly' | 'weekly' | 'daily',
  selectedPeriods: number[],
  prepayAll: boolean
): PaymentBreakdown => {
  const periods: PaymentPeriod[] = [];
  let currentDate = startOfDay(new Date(checkIn));
  const endDate = startOfDay(new Date(checkOut));
  const totalDays = differenceInDays(endDate, currentDate);

  const standardPeriodAmount = {
    monthly: MONTHLY_RATE, // 1500 BGN
    weekly: WEEKLY_RATE,    // 420 BGN
    daily: DAILY_RATE           // 70 BGN
  };

  // Calculate number of complete months
  const completeMonths = differenceInCalendarMonths(endDate, currentDate);
  let periodIndex = 0;

  if (preferredType === 'monthly' && completeMonths >= 1) {
    // Add monthly periods
    for (let i = 0; i < completeMonths; i++) {
      const monthEnd = addMonths(currentDate, 1);
      periods.push({
        type: 'monthly',
        startDate: currentDate,
        endDate: monthEnd,
        baseAmount: standardPeriodAmount.monthly,
        amount: standardPeriodAmount.monthly,
        label: `Month ${i + 1}`,
        index: periodIndex++
      });
      currentDate = monthEnd;
    }
  } else if (preferredType === 'weekly' && totalDays >= 7) {
    // Add weekly periods
    while (differenceInDays(endDate, currentDate) >= 7) {
      const weekEnd = addWeeks(currentDate, 1);
      periods.push({
        type: 'weekly',
        startDate: currentDate,
        endDate: weekEnd,
        baseAmount: standardPeriodAmount.weekly,
        amount: standardPeriodAmount.weekly,
        label: `Week ${periodIndex + 1}`,
        index: periodIndex++
      });
      currentDate = weekEnd;
    }
  }

  // Add remaining days as daily periods
  const remainingDays = differenceInDays(endDate, currentDate);
  if (remainingDays > 0) {
    periods.push({
      type: 'daily',
      startDate: currentDate,
      endDate: endDate,
      baseAmount: DAILY_RATE * remainingDays,
      amount: DAILY_RATE * remainingDays,
      label: `${remainingDays} Day${remainingDays > 1 ? 's' : ''}`,
      index: periodIndex++
    });
  }

  // Apply prepayment benefits
  const prepaidPeriodsCount = prepayAll ? periods.length : selectedPeriods.length;

  // Calculate sixth period discount if applicable
  if (prepaidPeriodsCount >= 5 && periods.length >= 6) {
    const sixthPeriod = periods[5];
    if (sixthPeriod) {
      sixthPeriod.amount = sixthPeriod.baseAmount * 0.5; // 50% off 6th period
    }
  }

  // Mark prepaid periods
  periods.forEach((period, index) => {
    period.isPrepaid = prepayAll || selectedPeriods.includes(index);
  });

  const totalAmount = periods.reduce((sum, period) => sum + period.amount, 0);
  const depositAmount = calculateDepositAmount(totalDays);
  const firstPeriod = periods[0];
  const initialPayment = (firstPeriod ? firstPeriod.amount : 0) + depositAmount;

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
};

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
    if (index === 0) return;
    setSelectedPeriods(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
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
                <h3 className="font-semibold">Available Payment Plans</h3>
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
                {selectedPeriods.map(index => {
                  const period = paymentBreakdown.periods[index];
                  if (!period) return null;
                  return (
                    <motion.div key={index} className="flex justify-between text-sm" variants={itemVariants}>
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
              <h3 className="text-sm font-semibold">Payment Schedule</h3>
              <div className="divide-y">
                {paymentBreakdown.periods.map((period, index) => {
                  const isSelected = selectedPeriods.includes(index) || prepayAll;
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
                            <motion.div whileHover={{ scale: 1.1 }}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handlePeriodSelect(index)}
                                disabled={prepayAll}
                              />
                            </motion.div>
                          )}
                          <div className="space-y-1">
                            <motion.div
                              className="font-medium"
                              layout
                            >
                              {period.label}
                              {isSelected && (
                                <motion.span
                                  className="ml-2 text-sm text-green-600"
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: 10 }}
                                >
                                </motion.span>
                              )}
                            </motion.div>
                            <div className="text-sm text-muted-foreground">
                              {format(period.startDate, "MMM d")} - {format(period.endDate, "MMM d")}
                            </div>
                          </div>
                        </div>
                        <motion.div
                          className="text-right"
                          layout
                        >
                          <motion.div
                            className="font-medium"
                            layout
                          >
                            ${period.amount.toLocaleString()}
                          </motion.div>
                          <motion.div
                            className="text-xs text-muted-foreground"
                            layout
                          >
                            {isSelected ? 'Prepaid' : `Due by ${format(period.startDate, "MMM d")}`}
                          </motion.div>
                        </motion.div>
                      </div>
                    </motion.div>
                  );
                })}
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