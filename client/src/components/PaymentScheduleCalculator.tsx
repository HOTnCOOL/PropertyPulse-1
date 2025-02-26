import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  format,
  differenceInDays,
  addDays,
  isSameDay
} from "date-fns";
import { 
  AlertTriangle, 
  Info, 
  TrendingDown, 
  Calendar as CalendarIcon, 
  Check,
  ArrowUp,
  ArrowDown,
  Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";

interface PaymentScheduleCalculatorProps {
  totalNights: number;
  planType: 'daily' | 'weekly' | 'monthly';
  planRate: number;
  standardNightlyRate: number;
  startDate: Date;
}

interface PaymentPeriod {
  type: 'daily' | 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  amount: number;
  baseAmount: number;
  label: string;
  isPrepaid: boolean;
  index: number;
  discountPercentage: number;
}

interface PaymentBreakdown {
  periods: PaymentPeriod[];
  totalAmount: number;
  prepaidAmount: number;
  remainingAmount: number;
  totalSavings: number;
  savingsPercentage: number;
  nextDiscountPercentage: number;
  isFullyPrepaid: boolean;
}

// Animation variants
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

export default function PaymentScheduleCalculator({
  totalNights,
  planType,
  planRate,
  standardNightlyRate,
  startDate
}: PaymentScheduleCalculatorProps) {
  const [prepaidPeriods, setPrepaidPeriods] = useState<number[]>([0]);
  
  // Calculate number of periods based on plan type
  const calculatePeriods = useMemo(() => {
    const periods: PaymentPeriod[] = [];
    let currentDate = startDate;
    const endDate = addDays(startDate, totalNights);
    
    let periodLength = 1; // days in a single period
    if (planType === 'weekly') periodLength = 7;
    if (planType === 'monthly') periodLength = 30;
    
    let remainingNights = totalNights;
    let index = 0;
    
    // Create periods
    while (remainingNights > 0) {
      // For the last period, handle partial periods
      const periodNights = Math.min(periodLength, remainingNights);
      const periodEndDate = addDays(currentDate, periodNights);
      
      // Calculate base amount for this period
      const periodRatio = periodNights / periodLength;
      const baseAmount = planRate * periodRatio;
      
      // Create the period
      periods.push({
        type: planType,
        startDate: currentDate,
        endDate: periodEndDate,
        baseAmount: baseAmount,
        amount: baseAmount, // Will be adjusted later for discounts
        label: index === 0 ? 
          `First ${planType} period (Required)` : 
          periodNights === periodLength ? 
            `1 ${planType} period` : 
            `${periodNights} days (partial ${planType} period)`,
        isPrepaid: index === 0, // First period is always prepaid
        index,
        discountPercentage: 0 // Initial value, will be calculated later
      });
      
      // Move to next period
      currentDate = periodEndDate;
      remainingNights -= periodNights;
      index++;
    }
    
    return periods;
  }, [totalNights, planType, planRate, startDate]);
  
  // Calculate discount percentage based on prepaid period position
  function getDiscountPercentage(periodIndex: number): number {
    // First prepaid period: regular price (0% discount)
    // Second prepaid period: 5% discount
    // Third prepaid period: 10% discount
    // Fourth prepaid period: 15% discount
    // Fifth+ prepaid period: 20% discount
    if (periodIndex <= 0) return 0;
    if (periodIndex === 1) return 5;
    if (periodIndex === 2) return 10;
    if (periodIndex === 3) return 15;
    return 20; // Fifth+ period
  }
  
  // Calculate payment breakdown including discounts
  const paymentBreakdown = useMemo(() => {
    const periods = [...calculatePeriods];
    
    // Mark prepaid periods
    prepaidPeriods.forEach(index => {
      if (index < periods.length) {
        periods[index].isPrepaid = true;
      }
    });
    
    // Apply discounts to prepaid periods
    periods.forEach((period, index) => {
      if (period.isPrepaid) {
        const discountPercentage = getDiscountPercentage(index);
        period.discountPercentage = discountPercentage;
        period.amount = period.baseAmount * (1 - discountPercentage / 100);
      }
    });
    
    // Calculate totals
    const totalAmount = periods.reduce((sum, period) => sum + period.amount, 0);
    const prepaidAmount = periods
      .filter(period => period.isPrepaid)
      .reduce((sum, period) => sum + period.amount, 0);
    const remainingAmount = totalAmount - prepaidAmount;
    
    // Calculate savings
    const totalBaseAmount = periods.reduce((sum, period) => sum + period.baseAmount, 0);
    const totalSavings = totalBaseAmount - totalAmount;
    const savingsPercentage = (totalSavings / totalBaseAmount) * 100;
    
    // Calculate next discount percentage
    const nextPeriodIndex = Math.max(...prepaidPeriods) + 1;
    const nextDiscountPercentage = nextPeriodIndex < periods.length ? 
      getDiscountPercentage(nextPeriodIndex) : 0;
    
    // Check if all periods are prepaid
    const isFullyPrepaid = periods.every(period => period.isPrepaid);
    
    return {
      periods,
      totalAmount,
      prepaidAmount,
      remainingAmount,
      totalSavings,
      savingsPercentage,
      nextDiscountPercentage,
      isFullyPrepaid
    };
  }, [calculatePeriods, prepaidPeriods]);
  
  // Add one more period to prepaid (the "+" button functionality)
  const handleAddPrepaidPeriod = () => {
    const nextPeriodIndex = Math.max(...prepaidPeriods) + 1;
    
    if (nextPeriodIndex < paymentBreakdown.periods.length) {
      setPrepaidPeriods(prev => [...prev, nextPeriodIndex].sort((a, b) => a - b));
    }
  };
  
  // Remove the last prepaid period (the "-" button functionality)
  const handleRemovePrepaidPeriod = () => {
    if (prepaidPeriods.length <= 1) return; // Always keep at least the first period
    
    const lastPrepaidIndex = Math.max(...prepaidPeriods);
    setPrepaidPeriods(prev => prev.filter(idx => idx !== lastPrepaidIndex));
  };
  
  // Formatting helpers
  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };
  
  const formatDateRange = (start: Date, end: Date) => {
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d')}`;
  };
  
  return (
    <TooltipProvider>
      <Card className="border shadow-sm w-full max-w-full">
        <CardHeader className="bg-muted/30">
          <CardTitle className="flex items-center text-xl">
            <span className="bg-primary/10 p-1.5 rounded-md mr-2">
              <TrendingDown className="h-5 w-5 text-primary" />
            </span>
            Payment Schedule Calculator
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <motion.div
            className="space-y-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* To be prepaid at booking section */}
            <motion.div
              className="p-5 rounded-lg border shadow-sm bg-primary/5"
              variants={itemVariants}
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-primary/10 p-1.5 rounded-md">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                </span>
                <h3 className="font-medium">To be prepaid at booking</h3>
              </div>
              
              <div className="space-y-3">
                {paymentBreakdown.periods
                  .filter(period => period.isPrepaid)
                  .map((period, index) => (
                    <div 
                      key={period.index} 
                      className="flex justify-between items-center bg-white/80 p-3 rounded-md border"
                    >
                      <div>
                        <div className="font-medium">
                          {period.index === 0 ? 'First period (Required)' : `Period ${period.index + 1}`}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <CalendarIcon className="h-3.5 w-3.5" />
                          {formatDateRange(period.startDate, period.endDate)}
                        </div>
                        {period.discountPercentage > 0 && (
                          <div className="text-xs flex items-center gap-1 text-green-600 mt-1">
                            <TrendingDown className="h-3 w-3" />
                            {period.discountPercentage}% discount applied
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right">
                        <div className="font-medium">
                          {period.discountPercentage > 0 ? (
                            <>
                              <span className="text-green-600">
                                {formatCurrency(period.amount)}
                              </span>
                              <span className="text-muted-foreground line-through text-xs ml-1">
                                {formatCurrency(period.baseAmount)}
                              </span>
                            </>
                          ) : (
                            <span>{formatCurrency(period.amount)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                
                {/* Prepaid total */}
                <div className="flex justify-between items-center bg-primary/10 p-3 rounded-md border mt-3">
                  <div className="font-medium">Total Prepaid Amount</div>
                  <div className="font-bold text-lg">{formatCurrency(paymentBreakdown.prepaidAmount)}</div>
                </div>
                
                {paymentBreakdown.totalSavings > 0 && (
                  <div className="flex justify-between items-center bg-green-50 p-3 rounded-md border mt-1">
                    <div className="text-green-700 flex items-center gap-1">
                      <TrendingDown className="h-4 w-4" />
                      <span>Total Savings</span>
                    </div>
                    <div className="font-medium text-green-700">
                      {formatCurrency(paymentBreakdown.totalSavings)} 
                      <span className="text-xs ml-1">
                        ({paymentBreakdown.savingsPercentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
            
            {/* Button section with discount information */}
            <motion.div 
              className="flex flex-col sm:flex-row gap-3 items-center justify-center py-4"
              variants={itemVariants}
            >
              {!paymentBreakdown.isFullyPrepaid ? (
                <>
                  <motion.div className="flex items-center gap-2" whileHover={{ scale: 1.02 }}>
                    <Button
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                      onClick={handleAddPrepaidPeriod}
                    >
                      <ArrowUp className="h-4 w-4" />
                      Add Next Period
                    </Button>
                    
                    {/* Discount info for next prepaid period */}
                    {!paymentBreakdown.isFullyPrepaid && (
                      <div className="bg-green-50 p-2 rounded-md border border-green-100 text-sm text-green-700">
                        <span className="font-medium">
                          {paymentBreakdown.nextDiscountPercentage}% discount
                        </span> on next period
                      </div>
                    )}
                  </motion.div>
                  
                  {prepaidPeriods.length > 1 && (
                    <Button
                      variant="outline"
                      className="flex items-center gap-2 border-amber-500 text-amber-700 hover:bg-amber-50"
                      onClick={handleRemovePrepaidPeriod}
                    >
                      <ArrowDown className="h-4 w-4" />
                      Remove Last Period
                    </Button>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 bg-green-100 p-3 rounded-md border border-green-200 text-green-800">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">All periods prepaid with maximum savings!</span>
                </div>
              )}
            </motion.div>
            
            {/* Upcoming future payments section */}
            {!paymentBreakdown.isFullyPrepaid && (
              <motion.div
                className="p-5 rounded-lg border shadow-sm bg-card"
                variants={itemVariants}
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-amber-100 p-1.5 rounded-md">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  </span>
                  <h3 className="font-medium">Upcoming Future Payments</h3>
                </div>
                
                <div className="space-y-3">
                  {paymentBreakdown.periods
                    .filter(period => !period.isPrepaid)
                    .map((period) => (
                      <div 
                        key={period.index} 
                        className="flex justify-between items-center bg-muted/10 p-3 rounded-md border"
                      >
                        <div>
                          <div className="font-medium">
                            {`Period ${period.index + 1}`}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <CalendarIcon className="h-3.5 w-3.5" />
                            {formatDateRange(period.startDate, period.endDate)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Due by {format(period.startDate, "MMM d")}
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="font-medium">
                            {formatCurrency(period.amount)}
                          </div>
                          {paymentBreakdown.nextDiscountPercentage > 0 && period.index === Math.max(...prepaidPeriods) + 1 && (
                            <div className="text-xs text-amber-600 flex items-center gap-1 justify-end mt-1">
                              <TrendingDown className="h-3 w-3" />
                              <span>Click + to get {paymentBreakdown.nextDiscountPercentage}% off</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    
                  {/* Remaining total */}
                  <div className="flex justify-between items-center bg-amber-50 p-3 rounded-md border mt-3">
                    <div className="font-medium">Remaining Payments Total</div>
                    <div className="font-bold text-amber-700">
                      {formatCurrency(paymentBreakdown.remainingAmount)}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            
            {/* Progressive Discount Information */}
            <motion.div
              className="p-4 mt-4 border rounded-lg bg-gradient-to-r from-green-50 to-transparent"
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
          </motion.div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}