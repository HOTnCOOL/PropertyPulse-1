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
import { 
  AlertTriangle, 
  Info, 
  TrendingDown, 
  AlertCircle, 
  Calendar as CalendarIcon, 
  Check,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  Percent
} from "lucide-react";
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

// Updated discount calculation function with progressive discounts (5% to 20%)
function calculateDiscount(
  periodIndex: number, 
  selectedPeriods: number[],
  preferredType: 'monthly' | 'weekly' | 'daily',
  period: PaymentPeriod,
  discountType: 'progressive' | 'bulkPrepay' = 'progressive'
): number {
  // First period has no discount
  if (periodIndex <= 0) return 0;
  
  // Make sure period type matches preferred type
  if (period.type !== preferredType) return 0;
  
  // Only apply discount if the period is selected for prepayment
  if (!selectedPeriods.includes(periodIndex)) return 0;
  
  if (discountType === 'progressive') {
    // Calculate the prepaid period number (1-based)
    // This is different from the period index - it's the position in the series of prepaid periods
    // Sort selected periods to ensure correct order
    const sortedPrepaidPeriods = [...selectedPeriods].sort((a, b) => a - b);
    // Find position of this period in the prepaid periods (excluding the first required period)
    const prepaidPosition = sortedPrepaidPeriods.filter(p => p > 0).indexOf(periodIndex) + 1;
    
    // Progressive discounts: 
    // 1st additional prepaid (2nd period): 5%
    // 2nd additional prepaid (3rd period): 10%
    // 3rd additional prepaid (4th period): 15%
    // 4th+ additional prepaid (5th+ period): 20%
    if (prepaidPosition === 1) return 0.05;
    if (prepaidPosition === 2) return 0.10;
    if (prepaidPosition === 3) return 0.15;
    return 0.20; // 4th and beyond
  } else if (discountType === 'bulkPrepay') {
    // Buy 5 get 1 at 50% off (alternative discount strategy)
    const periodsRequired = 5;
    const discount = 0.5; // 50% off
    
    // Count how many full groups of 5 we have up to this period
    const fullGroupsBeforeThisPeriod = Math.floor((periodIndex - 1) / periodsRequired);
    
    // If this is a 6th period (index 5, 11, 17, etc.), apply the discount
    if (fullGroupsBeforeThisPeriod > 0 && periodIndex % periodsRequired === 0) {
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

  // Apply prepayment selections
  periods.forEach((period, index) => {
    if (!period.isPrepaid) { // Skip already prepaid periods (first period)
      period.isPrepaid = prepayAll || selectedPeriods.includes(index);
    }
  });

  // Recalculate labels for consecutive periods
  let currentPeriodCount = 1; // Start with 1 (required period)
  periods.forEach((period, index) => {
    if (index === 0) {
      period.label = `1 ${preferredType} period (Required)`;
    } else if (index === 1 && period.isPrepaid) {
      // Update the first and second period label when the second is prepaid
      periods[0].label = `${++currentPeriodCount} ${preferredType} periods (Required)`;
      period.label = periods[0].label;
    } else if (index > 1 && period.isPrepaid) {
      // Update prepaid periods labels to show as one group
      currentPeriodCount++;
      periods[0].label = `${currentPeriodCount} ${preferredType} periods (Required)`;
      period.label = periods[0].label;
    } else if (index > 0 && !period.isPrepaid) {
      // Adjust non-prepaid period labels
      if (period.type === preferredType) {
        // Count remaining periods of the same type
        const remainingCount = periods.slice(index).filter(p => 
          p.type === preferredType && !p.isPrepaid).length;
        
        if (remainingCount > 1) {
          period.label = `${remainingCount}x ${preferredType} periods`;
        } else {
          period.label = `1 ${preferredType} period`;
        }
      }
    }
  });

  // Apply discounts to prepaid periods
  periods.forEach((period, index) => {
    if (period.isPrepaid && index > 0) { // Skip first period
      const discount = calculateDiscount(index, selectedPeriods, preferredType, period);
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
  
  // Calculate savings percentage
  const savingsPercentage = ((DAILY_RATE - perNightRate) / DAILY_RATE * 100);
  
  // Plan title and icon based on type
  const planTitle = type === 'monthly' ? '30-Day Plan' : type === 'weekly' ? '7-Day Plan' : 'Daily Plan';
  const planIcon = type === 'monthly' ? 
    <span className="bg-primary/10 p-1 rounded"><CalendarIcon className="h-4 w-4 text-primary" /></span> :
    type === 'weekly' ? 
    <span className="bg-green-100 p-1 rounded"><CalendarIcon className="h-4 w-4 text-green-600" /></span> :
    <span className="bg-blue-100 p-1 rounded"><CalendarIcon className="h-4 w-4 text-blue-600" /></span>;
  
  // Define a different color theme based on plan type
  const cardTheme = {
    monthly: {
      bg: 'bg-gradient-to-b from-white to-primary/5',
      border: isSelected ? 'border-primary border-2' : 'border-primary/20',
      shadow: isSelected ? 'shadow-md shadow-primary/10' : 'shadow-sm'
    },
    weekly: {
      bg: 'bg-gradient-to-b from-white to-green-50',
      border: isSelected ? 'border-green-500 border-2' : 'border-green-200',
      shadow: isSelected ? 'shadow-md shadow-green-100/50' : 'shadow-sm'
    },
    daily: {
      bg: 'bg-gradient-to-b from-white to-blue-50',
      border: isSelected ? 'border-blue-500 border-2' : 'border-blue-200',
      shadow: isSelected ? 'shadow-md shadow-blue-100/50' : 'shadow-sm'
    }
  };

  return (
    <motion.div
      className={`rounded-lg border p-4 transition-all ${cardTheme[type].bg} ${cardTheme[type].border} ${cardTheme[type].shadow}
        ${!isEligible ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      onClick={isEligible ? onSelect : undefined}
      whileHover={isEligible ? { y: -4, scale: 1.02 } : {}}
      whileTap={isEligible ? { y: 0, scale: 0.98 } : {}}
      transition={{ type: "spring", stiffness: 400, damping: 15 }}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          {planIcon}
          <div className="font-medium">
            {planTitle}
          </div>
        </div>
        {isSelected && (
          <div className="bg-primary/80 text-primary-foreground text-xs px-2 py-0.5 rounded-full font-medium">
            Selected
          </div>
        )}
      </div>
      
      <div className="flex items-baseline gap-1 mb-1">
        <div className="text-2xl font-bold">
          ${perNightRate.toFixed(2)}
        </div>
        <div className="text-xs text-muted-foreground">
          per night
        </div>
      </div>
      
      <div className="bg-white/60 rounded-md p-3 border border-border space-y-2 mb-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Standard rate</span>
          <span>${standardAmount} {type === 'monthly' ? '/month' : type === 'weekly' ? '/week' : '/day'}</span>
        </div>
        
        {savingsPercentage > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-green-600">
            <TrendingDown className="h-3.5 w-3.5" />
            <span>Save {savingsPercentage.toFixed(1)}% vs daily rate</span>
          </div>
        )}
      </div>
      
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">Total ({totalDays} nights)</span>
        <span className="font-medium">${totalStayCost.toLocaleString()}</span>
      </div>
      
      {!isEligible && (
        <div className="mt-3 text-xs bg-red-50 text-red-600 p-2 rounded border border-red-100 flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>
            {type === 'monthly'
              ? 'Requires minimum 30-day stay'
              : type === 'weekly'
                ? 'Requires minimum 7-day stay'
                : ''}
          </span>
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
        return [...prev, index].sort((a, b) => a - b);
      }
    });
  };

  // Function to handle clicking the up arrow to prepay the next period
  const handlePrepayNext = () => {
    if (!paymentBreakdown) return;
    
    const nextIndex = selectedPeriods.length > 0 
      ? Math.max(...selectedPeriods) + 1 
      : 1;
    
    // Check if we have reached the end of available periods
    if (nextIndex >= paymentBreakdown.periods.length) return;
    
    setSelectedPeriods(prev => [...prev, nextIndex].sort((a, b) => a - b));
  };

  // Function to handle clicking the down arrow to remove the last prepaid period
  const handleRemoveLastPrepaid = () => {
    if (!paymentBreakdown || selectedPeriods.length <= 1) return; // Always keep the first period
    
    const lastSelected = Math.max(...selectedPeriods);
    if (lastSelected === 0) return; // Don't remove the required period
    
    setSelectedPeriods(prev => prev.filter(i => i !== lastSelected));
  };

  const handlePrepayAll = () => {
    setPrepayAll(!prepayAll);
    if (!prepayAll) {
      setSelectedPeriods(paymentBreakdown?.periods.map((_, i) => i) || []);
    } else {
      setSelectedPeriods([0]); // Reset to just the required period
    }
  };

  const formatPercent = (value: number) => `${value.toFixed(0)}%`;
  const formatCurrency = (value: number) => `$${value.toLocaleString()}`;

  if (!paymentBreakdown || !property) return null;

  return (
    <TooltipProvider>
      <Card className="border border-border shadow-sm w-full max-w-full" style={{ width: '100%' }}>
        <CardHeader className="bg-muted/30 w-full">
          <CardTitle className="flex items-center text-xl">
            <span className="bg-primary/10 p-1.5 rounded-md mr-2">
              <TrendingDown className="h-5 w-5 text-primary" />
            </span>
            Payment Plan Selection
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 w-full">
          <motion.div
            className="space-y-6 w-full"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div
              className="p-5 bg-card rounded-lg shadow-sm border border-border space-y-4"
              variants={itemVariants}
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <h3 className="font-semibold text-foreground">
                  {checkIn && checkOut ? (
                    `Select a Plan for your ${differenceInDays(checkOut, checkIn)}-night stay`
                  ) : (
                    'Select a Payment Plan'
                  )}
                </h3>
                <div className="flex items-center space-x-2 bg-muted/20 p-2 rounded-md">
                  <Checkbox
                    id="prepayAll"
                    checked={prepayAll}
                    onCheckedChange={handlePrepayAll}
                    className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                  />
                  <motion.label
                    htmlFor="prepayAll"
                    className="text-sm font-medium cursor-pointer hover:text-primary transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Prepay All (Maximum Discount)
                  </motion.label>
                </div>
              </div>

              {planError && (
                <Alert variant="destructive" className="animate-in fade-in-50 zoom-in-95">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{planError}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                <motion.div 
                  className="space-y-2" 
                  variants={itemVariants}
                  whileHover={eligibility.monthly ? { scale: 1.01, y: -2 } : {}}
                  transition={{ type: "spring", stiffness: 500, damping: 15 }}
                >
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

                <motion.div 
                  className="space-y-2" 
                  variants={itemVariants}
                  whileHover={eligibility.weekly ? { scale: 1.01, y: -2 } : {}}
                  transition={{ type: "spring", stiffness: 500, damping: 15 }}
                >
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

                <motion.div 
                  className="space-y-2 sm:col-span-2 lg:col-span-1" 
                  variants={itemVariants}
                  whileHover={{ scale: 1.01, y: -2 }}
                  transition={{ type: "spring", stiffness: 500, damping: 15 }}
                >
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

            {/* Discount information */}
            {property?.discountConfig && property.discountConfig[preferredPackageType] && (
              <motion.div 
                className="p-4 rounded-lg border border-border shadow-sm bg-green-50/50 backdrop-blur-sm" 
                variants={itemVariants}
                whileHover={{ scale: 1.005 }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-green-100 p-1.5 rounded-md">
                    <TrendingDown className="text-green-600 h-5 w-5" />
                  </span>
                  <h3 className="font-medium text-green-700">Available Discounts</h3>
                </div>
                <div className="text-sm bg-white/40 rounded-md p-3 border border-green-100">
                  {property.discountConfig[preferredPackageType]?.type === 'progressive' ? (
                    <div className="flex flex-col gap-1.5">
                      <p className="font-medium">
                        Progressive Discount Plan
                      </p>
                      <div className="text-green-700 bg-green-50 p-2 rounded border border-green-100 inline-flex items-center gap-2">
                        <span className="font-semibold">{property.discountConfig[preferredPackageType]?.progressiveRate ?? 0}%</span> 
                        <span>discount per additional prepaid period</span>
                      </div>
                      <p className="text-green-800 text-xs">
                        Maximum possible discount: {property.discountConfig[preferredPackageType]?.progressiveMax ?? 0}%
                      </p>
                    </div>
                  ) : property.discountConfig[preferredPackageType]?.type === 'bulkPrepay' ? (
                    <div className="flex flex-col gap-1.5">
                      <p className="font-medium">
                        Bulk Prepayment Reward
                      </p>
                      <div className="text-green-700 bg-green-50 p-2 rounded border border-green-100">
                        Prepay <span className="font-semibold">{property.discountConfig[preferredPackageType]?.periodsRequired ?? 0}</span> consecutive periods to unlock 
                        <span className="font-semibold"> {property.discountConfig[preferredPackageType]?.nextPeriodDiscount ?? 0}%</span> off your next period!
                      </div>
                    </div>
                  ) : (
                    <p>No discount configuration available for {preferredPackageType} payments.</p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Initial Payment Section */}
            <motion.div
              className="p-5 rounded-lg border border-border shadow-sm bg-card"
              variants={itemVariants}
              whileHover={{ scale: 1.005 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="bg-amber-100 p-1.5 rounded-md">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  </span>
                  <h3 className="font-medium">Initial Payment Required</h3>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href="/policies/deposit-policy" className="text-muted-foreground hover:text-primary bg-muted/30 p-1.5 rounded-full">
                      <Info className="h-4 w-4" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View our detailed deposit policy</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              <div className="bg-muted/20 rounded-lg p-4 mb-4 border border-border">
                {/* Only show the first period as per requirements */}
                {paymentBreakdown.periods.length > 0 && (
                  <motion.div className="flex justify-between text-sm mb-3" variants={itemVariants}>
                    <span className="text-muted-foreground">{paymentBreakdown.periods[0].label}</span>
                    <span className="font-medium">${paymentBreakdown.periods[0].amount.toLocaleString()}</span>
                  </motion.div>
                )}
                
                <motion.div 
                  className="flex justify-between font-semibold text-base pt-3 border-t" 
                  variants={itemVariants}
                >
                  <span>Initial Payment Due</span>
                  <span className="text-primary text-lg">${paymentBreakdown.initialPayment.toLocaleString()}</span>
                </motion.div>
              </div>

              <div className="text-sm text-muted-foreground bg-muted/10 p-3 rounded-md border border-border">
                <p className="mb-2">
                  <span className="font-medium text-foreground">Payment Policy:</span> Initial payment must be received within 24 hours to guarantee availability.
                  You'll only be charged for the first period of your selected plan.
                </p>
                <p>
                  Additional periods will be billed according to the payment schedule.
                  See the Security Deposit section for details on the fully refundable guarantee.
                </p>
              </div>
            </motion.div>

            <AnimatePresence>
              {paymentBreakdown.totalSavings > 0 && (
                <motion.div
                  className="p-5 rounded-lg border border-border shadow-sm bg-gradient-to-br from-green-50/70 to-green-100/30"
                  initial={{ opacity: 0, height: 0, y: -20 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  layout
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                >
                  <motion.div className="flex items-center gap-3 mb-3">
                    <span className="bg-green-100 p-1.5 rounded-md">
                      <TrendingDown className="text-green-600 h-5 w-5" />
                    </span>
                    <h3 className="font-medium text-green-800">Your Savings Summary</h3>
                  </motion.div>
                  
                  <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-green-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <motion.div
                      className="flex flex-col gap-2 p-3 bg-green-50 rounded-lg border border-green-100"
                      variants={discountVariants}
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    >
                      <span className="text-sm text-green-700">Total Savings</span>
                      <motion.span
                        className="font-semibold text-green-700 text-2xl"
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        ${paymentBreakdown.totalSavings.toLocaleString()}
                      </motion.span>
                      <span className="text-xs text-green-600">
                        {formatPercent(paymentBreakdown.savingsPercentage)} off standard pricing
                      </span>
                    </motion.div>
                    
                    <motion.div
                      className="flex flex-col gap-2 p-3 bg-green-50 rounded-lg border border-green-100"
                      variants={discountVariants}
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    >
                      <span className="text-sm text-green-700">Effective Daily Rate</span>
                      <span className="font-semibold text-green-700 text-2xl">
                        ${paymentBreakdown.effectiveRate.toFixed(2)}
                      </span>
                      <span className="text-xs text-green-600">
                        vs. ${DAILY_RATE} standard daily rate
                      </span>
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Payment Schedule Section */}
            <motion.div 
              className="space-y-4 p-5 rounded-lg border border-border shadow-sm bg-card" 
              variants={itemVariants}
              whileHover={{ scale: 1.005 }}
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="bg-primary/10 p-1.5 rounded-md">
                    <CalendarIcon className="h-5 w-5 text-primary" />
                  </span>
                  <h3 className="font-medium">Payment Schedule</h3>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 bg-muted/30 px-2 py-1 rounded text-xs text-muted-foreground hover:text-primary transition-colors">
                      <Info className="h-3.5 w-3.5" />
                      <span>Prepaid discounts</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      Prepay multiple payment periods to receive a discount.
                      Prepay 2+ periods for 50% off security deposit, 3+ periods for no deposit!
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              {/* Interactive payment controls */}
              <div className="flex flex-wrap gap-2 mb-4">
                <motion.button
                  type="button"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    prepayAll
                      ? 'bg-green-600 text-white'
                      : 'bg-green-50 text-green-700 hover:bg-green-100'
                  }`}
                  onClick={handlePrepayAll}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {prepayAll ? (
                    <>
                      <Check className="h-4 w-4" />
                      All Periods Prepaid
                    </>
                  ) : (
                    <>
                      <ChevronsUp className="h-4 w-4" />
                      Prepay All Periods
                    </>
                  )}
                </motion.button>
                
                {!prepayAll && selectedPeriods.length > 1 && (
                  <motion.button
                    type="button"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                    onClick={() => setSelectedPeriods([0])}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <ChevronsDown className="h-4 w-4" />
                    Reset to Required Only
                  </motion.button>
                )}
                
                {!prepayAll && paymentBreakdown.periods.length > 1 && (
                  <>
                    <motion.button
                      type="button"
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        Math.max(...selectedPeriods) < paymentBreakdown.periods.length - 1
                          ? 'bg-green-50 text-green-700 hover:bg-green-100'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                      onClick={handlePrepayNext}
                      disabled={Math.max(...selectedPeriods) >= paymentBreakdown.periods.length - 1}
                      whileHover={Math.max(...selectedPeriods) < paymentBreakdown.periods.length - 1 ? { scale: 1.03 } : {}}
                      whileTap={Math.max(...selectedPeriods) < paymentBreakdown.periods.length - 1 ? { scale: 0.97 } : {}}
                    >
                      <ArrowUp className="h-4 w-4" />
                      Add One Period
                    </motion.button>
                    
                    <motion.button
                      type="button"
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        selectedPeriods.length > 1
                          ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                      onClick={handleRemoveLastPrepaid}
                      disabled={selectedPeriods.length <= 1}
                      whileHover={selectedPeriods.length > 1 ? { scale: 1.03 } : {}}
                      whileTap={selectedPeriods.length > 1 ? { scale: 0.97 } : {}}
                    >
                      <ArrowDown className="h-4 w-4" />
                      Remove One Period
                    </motion.button>
                  </>
                )}
              </div>
              
              <div className="bg-muted/10 rounded-lg border border-border overflow-hidden">
                {paymentBreakdown.periods.map((period, index) => {
                  const isSelected = selectedPeriods.includes(index) || prepayAll;
                  const canSelect = index === 0 ||
                    selectedPeriods.includes(index - 1) ||
                    (index === 1 && period.type === preferredPackageType);

                  // Calculate the discount that would apply to this period
                  const discount = calculateDiscount(
                    index,
                    selectedPeriods,
                    preferredPackageType,
                    period
                  );
                  const discountedAmount = period.baseAmount * (1 - discount);
                  
                  // Format the date range for display
                  const startDateFormat = format(period.startDate, "MMM d");
                  const endDateFormat = format(period.endDate, "MMM d");
                  const dateDisplay = `${startDateFormat} - ${endDateFormat}`;
                  
                  // Define the discount text with more detailed information
                  let discountText = '';
                  if (discount > 0 && index > 0) {
                    // Progressive discount descriptions
                    if (index === 1) discountText = '5% discount (2nd period)';
                    else if (index === 2) discountText = '10% discount (3rd period)';
                    else if (index === 3) discountText = '15% discount (4th period)';
                    else if (index >= 4) discountText = '20% discount (5th+ period)';
                  }
                  
                  // Create the payment info text
                  const paymentInfo = index === 0 
                    ? 'Required Initial Payment' 
                    : isSelected 
                      ? 'Prepaid' 
                      : `Due by ${startDateFormat}`;

                  return (
                    <motion.div
                      key={index}
                      className={`p-4 ${index > 0 ? 'border-t border-border' : ''} ${
                        isSelected ? 'bg-primary/5' : ''
                      } ${index === 0 ? 'bg-primary/5' : ''} transition-colors`}
                      variants={itemVariants}
                      initial="hidden"
                      animate="visible"
                      whileHover={index > 0 && canSelect ? { backgroundColor: 'rgba(var(--primary), 0.03)' } : {}}
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                        <div className="flex items-start gap-3">
                          {index > 0 ? (
                            <Checkbox
                              id={`period-${index}`}
                              checked={isSelected}
                              onCheckedChange={() => handlePeriodSelect(index)}
                              disabled={!canSelect || prepayAll}
                              className="mt-1 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                            />
                          ) : (
                            <div className="w-5 h-5 flex items-center justify-center bg-primary text-primary-foreground rounded-sm mt-1">
                              <Check className="h-3.5 w-3.5" />
                            </div>
                          )}
                          <div className="space-y-1">
                            <div className="font-medium">
                              {period.label}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                              <CalendarIcon className="h-3.5 w-3.5" />
                              {dateDisplay}
                              <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground/40"></span>
                              <span className={index === 0 ? "text-primary font-medium" : ""}>
                                {paymentInfo}
                              </span>
                            </div>
                            {discount > 0 && index > 0 && (
                              <div className={`text-xs flex items-center gap-1 ${
                                isSelected ? 'text-green-600 font-medium' : 'text-muted-foreground'
                              }`}>
                                <TrendingDown className="h-3 w-3" />
                                {discountText}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          {/* Interactive arrows for moving payments */}
                          {index > 0 && (
                            <div className="flex flex-col items-center justify-center gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <motion.button
                                    type="button"
                                    className={`flex items-center justify-center p-1.5 rounded-full transition-colors ${
                                      !isSelected && canSelect 
                                        ? 'bg-green-100 hover:bg-green-200 text-green-700' 
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    }`}
                                    onClick={() => !isSelected && canSelect && handlePeriodSelect(index)}
                                    disabled={isSelected || !canSelect || prepayAll}
                                    whileHover={!isSelected && canSelect ? { scale: 1.1 } : {}}
                                    whileTap={!isSelected && canSelect ? { scale: 0.95 } : {}}
                                  >
                                    <ArrowUp className="h-4 w-4" />
                                  </motion.button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p>Add to prepaid periods</p>
                                </TooltipContent>
                              </Tooltip>
                              
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <motion.button
                                    type="button"
                                    className={`flex items-center justify-center p-1.5 rounded-full transition-colors ${
                                      isSelected && index > 0 && !prepayAll
                                        ? 'bg-amber-100 hover:bg-amber-200 text-amber-700'
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    }`}
                                    onClick={() => isSelected && index > 0 && !prepayAll && handlePeriodSelect(index)}
                                    disabled={!isSelected || index === 0 || prepayAll}
                                    whileHover={isSelected && index > 0 && !prepayAll ? { scale: 1.1 } : {}}
                                    whileTap={isSelected && index > 0 && !prepayAll ? { scale: 0.95 } : {}}
                                  >
                                    <ArrowDown className="h-4 w-4" />
                                  </motion.button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                  <p>Remove from prepaid periods</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          )}
                          
                          <div className="text-right">
                            <div className="font-medium">
                              {index === 0 ? (
                                <span className="text-primary">${period.baseAmount.toLocaleString()}</span>
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
                            <div className="text-xs text-muted-foreground mt-1">
                              {isSelected ? (
                                <span className="inline-flex items-center gap-1 text-green-600">
                                  <Check className="h-3 w-3" />
                                  Prepaid
                                </span>
                              ) : (
                                `Due by ${format(period.startDate, "MMM d")}`
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Progressive Discount Information Section */}
                <motion.div
                  className="p-4 mt-4 border-t border-border bg-gradient-to-r from-green-50 to-transparent rounded-md"
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-green-100 p-1.5 rounded-md">
                      <Percent className="text-green-600 h-4 w-4" />
                    </span>
                    <h3 className="font-medium text-foreground text-sm">Progressive Discount Rates</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                    <div className="p-2 bg-white/80 rounded border border-green-100 text-center">
                      <div className="text-sm font-medium mb-1">1st Period</div>
                      <div className="text-gray-500">Required</div>
                      <div className="text-green-600 font-bold mt-1">0%</div>
                    </div>
                    <div className="p-2 bg-white/80 rounded border border-green-100 text-center">
                      <div className="text-sm font-medium mb-1">2nd Period</div>
                      <div className="text-gray-500">Optional</div>
                      <div className="text-green-600 font-bold mt-1">5%</div>
                    </div>
                    <div className="p-2 bg-white/80 rounded border border-green-100 text-center">
                      <div className="text-sm font-medium mb-1">3rd Period</div>
                      <div className="text-gray-500">Optional</div>
                      <div className="text-green-600 font-bold mt-1">10%</div>
                    </div>
                    <div className="p-2 bg-white/80 rounded border border-green-100 text-center">
                      <div className="text-sm font-medium mb-1">4th Period</div>
                      <div className="text-gray-500">Optional</div>
                      <div className="text-green-600 font-bold mt-1">15%</div>
                    </div>
                    <div className="p-2 bg-white/80 rounded border border-green-100 text-center md:col-span-1 col-span-2">
                      <div className="text-sm font-medium mb-1">5th+ Period</div>
                      <div className="text-gray-500">Optional</div>
                      <div className="text-green-600 font-bold mt-1">20%</div>
                    </div>
                  </div>
                </motion.div>

                {/* Separate Security Deposit section */}
                <motion.div 
                  className="p-5 mt-4 border-t border-border"
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-blue-100 p-1.5 rounded-md">
                      <Info className="text-blue-600 h-5 w-5" />
                    </span>
                    <h3 className="font-medium text-foreground">Security Deposit</h3>
                  </div>
                  
                  <div className="bg-blue-50/30 rounded-lg p-4 border border-blue-100 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">Refundable Deposit</span>
                          <span className="text-sm text-blue-600 bg-blue-100/50 px-2 py-0.5 rounded-full">Returns after checkout</span>
                        </div>
                        
                        {/* Deposit status with visualization of discount */}
                        {paymentBreakdown.depositAmount === 0 ? (
                          <div className="text-green-600 text-sm mt-1 flex items-center gap-1">
                            <Check className="h-3.5 w-3.5" />
                            <span>Deposit waived (3+ prepaid periods)</span>
                          </div>
                        ) : paymentBreakdown.depositAmount < calculateDepositAmount(preferredPackageType, 0, differenceInDays(checkOut!, checkIn!)) ? (
                          <div className="text-green-600 text-sm mt-1">
                            <div className="flex items-center gap-1">
                              <TrendingDown className="h-3.5 w-3.5" />
                              <span>50% discount applied (2 prepaid periods)</span>
                            </div>
                            <div className="mt-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div 
                                className="bg-green-500 h-full rounded-full" 
                                style={{ width: '50%' }}
                              ></div>
                            </div>
                            <div className="flex justify-between text-xs mt-0.5">
                              <span>Discount: 50%</span>
                              <span>Prepaid periods: {selectedPeriods.length}/3</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-amber-600 text-sm mt-1">
                            <div className="flex items-center gap-1">
                              <Info className="h-3.5 w-3.5" />
                              <span>Prepay more periods to reduce deposit</span>
                            </div>
                            <div className="mt-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div 
                                className="bg-amber-500 h-full rounded-full" 
                                style={{ width: `${Math.min((selectedPeriods.length / 3) * 100, 100)}%` }}
                              ></div>
                            </div>
                            <div className="flex justify-between text-xs mt-0.5">
                              <span>Prepaid: {selectedPeriods.length} period{selectedPeriods.length !== 1 ? 's' : ''}</span>
                              <span>Next discount: 2 periods</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <span className="font-semibold text-xl">
                        ${paymentBreakdown.depositAmount.toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="text-xs text-muted-foreground bg-white/80 p-3 rounded border border-blue-50">
                      <p className="mb-1.5">
                        <span className="font-medium text-foreground">Important Note:</span> The security deposit is a fully refundable guarantee 
                        that will be returned to you after checkout and property inspection.
                      </p>
                      <p>
                        This amount is <strong>not</strong> part of your accommodation cost and is handled separately.
                        Prepaying multiple periods can reduce or eliminate the required deposit amount.
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Total Summary Section */}
            <motion.div
              className="p-5 rounded-lg border border-primary/20 shadow-sm bg-gradient-to-r from-primary/5 to-transparent"
              variants={itemVariants}
              whileHover={{ scale: 1.005 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-primary/10 p-1.5 rounded-md">
                  <Check className="h-5 w-5 text-primary" />
                </span>
                <h3 className="font-medium">Booking Summary</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-background/80 p-4 rounded-lg border border-border">
                  <div className="flex justify-between mb-3">
                    <span className="text-sm text-muted-foreground">Total Cost</span>
                    <span className="font-semibold text-xl">${paymentBreakdown.totalAmount.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex flex-col gap-1 text-sm">
                    <div className="flex justify-between">
                      <span>Effective nightly rate</span>
                      <span className="font-medium">${formatCurrency(paymentBreakdown.effectiveRate)}/night</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Duration</span>
                      <span className="font-medium">{differenceInDays(checkOut!, checkIn!)} nights</span>
                    </div>
                    {paymentBreakdown.savingsPercentage > 0 && (
                      <div className="flex justify-between text-green-600 mt-1">
                        <span className="flex items-center gap-1">
                          <TrendingDown className="h-3.5 w-3.5" />
                          <span>Discount applied</span>
                        </span>
                        <span className="font-medium">{formatPercent(paymentBreakdown.savingsPercentage)} off</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="bg-background/80 p-4 rounded-lg border border-border">
                  <div className="flex justify-between mb-3">
                    <span className="text-sm text-muted-foreground">Initial Payment</span>
                    <span className="font-semibold text-xl text-primary">${paymentBreakdown.initialPayment.toLocaleString()}</span>
                  </div>
                  <div className="text-sm flex flex-col gap-1">
                    <div className="flex justify-between">
                      <span>First payment period</span>
                      <span className="font-medium">${formatCurrency(paymentBreakdown.periods[0].amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Security deposit</span>
                      <span className="font-medium">${formatCurrency(paymentBreakdown.depositAmount)}</span>
                    </div>
                    <div className="border-t mt-1 pt-1 flex justify-between">
                      <span>Due now to confirm</span>
                      <span className="font-medium">${formatCurrency(paymentBreakdown.initialPayment + paymentBreakdown.depositAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground bg-muted/10 p-3 rounded-md border border-border mb-5">
                <p className="mb-1">
                  <span className="font-medium text-foreground">Payment Policy:</span> Initial payment must be received within 24 hours to guarantee your booking.
                  The selected payment plan determines your billing schedule.
                </p>
                <p>
                  <span className="font-medium text-foreground">Security deposit:</span> The deposit amount is separate from your accommodation costs and is fully refundable.
                </p>
              </div>
              
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="mt-2"
              >
                <Button
                  className="w-full py-6 text-lg font-medium shadow-sm"
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
          </motion.div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}