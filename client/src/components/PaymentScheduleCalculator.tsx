import { useState, useMemo } from "react";
import { format, differenceInDays, addDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, Calendar, PiggyBank, CheckCircle, ChevronUp, ChevronDown, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Property } from "@db/schema";

interface PaymentScheduleCalculatorProps {
  property?: Property;
  checkIn?: Date;
  checkOut?: Date;
}

interface PaymentPeriod {
  type: 'monthly' | 'weekly' | 'daily';
  startDate: Date;
  endDate: Date;
  amount: number; // The amount after any discounts
  baseAmount: number; // The original amount before discounts
  discountPercentage: number; // The discount percentage applied to this period
  isPrepaid: boolean;
  index: number;
}

// Constants for pricing
const DAILY_RATE = 70;
const WEEKLY_RATE = 420;
const MONTHLY_RATE = 1500;

function getDiscountPercentage(prepaidPeriodIndex: number): number {
  // First period (index 0) has no discount
  if (prepaidPeriodIndex <= 0) return 0;
  
  // Progressive discount structure
  // Period index is 0-based, but prepaid counting is 1-based
  switch (prepaidPeriodIndex) {
    case 1: return 5; // Second prepaid period (index 1)
    case 2: return 10; // Third prepaid period (index 2)
    case 3: return 15; // Fourth prepaid period (index 3)
    default: return 20; // Fifth+ prepaid period (index 4+)
  }
}

export default function PaymentScheduleCalculator({ property, checkIn, checkOut }: PaymentScheduleCalculatorProps) {
  const [prepaidPeriods, setPrepaidPeriods] = useState<number[]>([0]); // First period is always prepaid
  const [showAllPeriods, setShowAllPeriods] = useState(false);
  
  // Generate all payment periods based on the check-in and check-out dates
  const allPeriods = useMemo(() => {
    // Safe-guard against invalid dates
    if (!checkIn || !checkOut || isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      return [];
    }
    
    // Ensure checkOut is after checkIn
    if (checkOut <= checkIn) {
      return [];
    }
    
    const periods: PaymentPeriod[] = [];
    const totalDays = differenceInDays(checkOut, checkIn);
    let currentDate = new Date(checkIn);
    let remainingDays = totalDays;
    let periodIndex = 0;
    
    // Create weekly periods
    while (remainingDays >= 7) {
      const periodEndDate = addDays(currentDate, 7);
      
      periods.push({
        type: 'weekly',
        startDate: new Date(currentDate),
        endDate: new Date(periodEndDate),
        baseAmount: WEEKLY_RATE,
        amount: WEEKLY_RATE, // Will be recalculated with discounts
        discountPercentage: 0, // Will be recalculated
        isPrepaid: periodIndex === 0, // First period is always prepaid
        index: periodIndex
      });
      
      currentDate = new Date(periodEndDate);
      remainingDays -= 7;
      periodIndex++;
    }
    
    // Add remaining days as a daily period if needed
    if (remainingDays > 0) {
      const periodEndDate = addDays(currentDate, remainingDays);
      
      periods.push({
        type: 'daily',
        startDate: new Date(currentDate),
        endDate: new Date(periodEndDate),
        baseAmount: remainingDays * DAILY_RATE,
        amount: remainingDays * DAILY_RATE, // Will be recalculated with discounts
        discountPercentage: 0, // Will be recalculated
        isPrepaid: false,
        index: periodIndex
      });
    }
    
    return periods;
  }, [checkIn, checkOut]);
  
  // Calculate periods with applied discounts based on prepaid selection
  const periodsWithDiscounts = useMemo(() => {
    return allPeriods.map((period, index) => {
      // Check if this period is prepaid
      const isPrepaid = prepaidPeriods.includes(index);
      
      // Calculate the discount percentage for this period
      const prepaidIndex = isPrepaid ? prepaidPeriods.indexOf(index) : -1;
      const discountPercentage = isPrepaid ? getDiscountPercentage(prepaidIndex) : 0;
      
      // Calculate the discounted amount
      const discountMultiplier = (100 - discountPercentage) / 100;
      const amount = period.baseAmount * discountMultiplier;
      
      return {
        ...period,
        isPrepaid,
        discountPercentage,
        amount: Math.round(amount * 100) / 100 // Round to 2 decimal places
      };
    });
  }, [allPeriods, prepaidPeriods]);
  
  // Calculate summary data
  const summary = useMemo(() => {
    // Total base amount (without discounts)
    const totalBaseAmount = periodsWithDiscounts.reduce((sum, period) => sum + period.baseAmount, 0);
    
    // Total prepaid amount (with discounts)
    const totalPrepaidAmount = periodsWithDiscounts
      .filter(p => p.isPrepaid)
      .reduce((sum, period) => sum + period.amount, 0);
    
    // Total upcoming payments (not prepaid)
    const totalUpcomingAmount = periodsWithDiscounts
      .filter(p => !p.isPrepaid)
      .reduce((sum, period) => sum + period.amount, 0);
    
    // Total savings from discounts
    const totalSavings = periodsWithDiscounts
      .filter(p => p.isPrepaid)
      .reduce((sum, period) => sum + (period.baseAmount - period.amount), 0);
    
    // All periods prepaid?
    const allPrepaid = periodsWithDiscounts.every(p => p.isPrepaid);
    
    // Next period index that could be prepaid
    const nextPrepaidIndex = prepaidPeriods.length > 0 
      ? Math.max(...prepaidPeriods) + 1 
      : 0;
    
    // Is there a next period available to prepay?
    const hasNextPeriod = nextPrepaidIndex < periodsWithDiscounts.length;
    
    // Next discount percentage if user adds another period
    const nextDiscountPercentage = hasNextPeriod ? getDiscountPercentage(prepaidPeriods.length) : 0;
    
    return {
      totalBaseAmount,
      totalPrepaidAmount,
      totalUpcomingAmount,
      totalSavings,
      allPrepaid,
      nextPrepaidIndex,
      hasNextPeriod,
      nextDiscountPercentage
    };
  }, [periodsWithDiscounts, prepaidPeriods]);
  
  // Handler for adding a period to prepaid
  const handleAddPrepaidPeriod = () => {
    if (summary.hasNextPeriod) {
      setPrepaidPeriods(prev => [...prev, summary.nextPrepaidIndex].sort((a, b) => a - b));
    }
  };
  
  // Handler for removing the last prepaid period
  const handleRemovePrepaidPeriod = () => {
    if (prepaidPeriods.length > 1) {
      const lastIndex = Math.max(...prepaidPeriods);
      setPrepaidPeriods(prev => prev.filter(idx => idx !== lastIndex));
    }
  };
  
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1 
      }
    }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { type: "spring", stiffness: 300, damping: 24 }
    }
  };
  
  // Format currency
  const formatCurrency = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  
  // If no dates are selected, show a prompt
  if (!checkIn || !checkOut || periodsWithDiscounts.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="text-center p-8">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Select Dates to View Payment Schedule</h3>
            <p className="text-sm text-muted-foreground">
              Please select check-in and check-out dates to see available payment options.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <PiggyBank className="h-5 w-5 text-primary" />
          <span>Payment Schedule</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Prepaid Section */}
        <motion.div 
          className="space-y-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-base">To be prepaid at booking</h3>
              <Badge variant="outline" className="bg-primary/5 text-primary">
                Total: {formatCurrency(summary.totalPrepaidAmount)}
              </Badge>
            </div>
            
            <div className="space-y-2 bg-muted/30 rounded-lg p-4 border border-border">
              {periodsWithDiscounts
                .filter(period => period.isPrepaid)
                .map((period, idx) => (
                  <div 
                    key={`prepaid-${period.index}`}
                    className="flex justify-between items-center py-2 border-b border-border last:border-0"
                  >
                    <div className="space-y-1">
                      <div className="font-medium text-sm">
                        {period.type === 'weekly' ? '7-day period' : `${differenceInDays(period.endDate, period.startDate)}-day period`}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(period.startDate, "MMM d")} - {format(period.endDate, "MMM d")}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      {period.discountPercentage > 0 ? (
                        <div className="space-y-1">
                          <div className="font-medium text-green-600">
                            {formatCurrency(period.amount)}
                            <span className="ml-1 text-xs font-normal text-muted-foreground line-through">
                              {formatCurrency(period.baseAmount)}
                            </span>
                          </div>
                          <div className="text-xs text-green-600 flex items-center justify-end gap-1">
                            <TrendingDown className="h-3 w-3" />
                            {period.discountPercentage}% discount
                          </div>
                        </div>
                      ) : (
                        <div className="font-medium">
                          {formatCurrency(period.amount)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </motion.div>
          
          {/* Add/Remove Buttons */}
          <motion.div 
            className="flex justify-center gap-4 py-2" 
            variants={itemVariants}
          >
            {summary.hasNextPeriod && !summary.allPrepaid && (
              <Button 
                variant="outline" 
                className="flex items-center gap-2 group"
                onClick={handleAddPrepaidPeriod}
              >
                <Plus className="h-4 w-4 text-green-600 group-hover:scale-110 transition-transform" />
                <span>
                  Add period ({summary.nextDiscountPercentage}% off)
                </span>
              </Button>
            )}
            
            {prepaidPeriods.length > 1 && (
              <Button 
                variant="outline" 
                className="flex items-center gap-2 group"
                onClick={handleRemovePrepaidPeriod}
              >
                <Minus className="h-4 w-4 text-red-600 group-hover:scale-110 transition-transform" />
                <span>Remove period</span>
              </Button>
            )}
          </motion.div>
          
          {/* Savings Summary */}
          {summary.totalSavings > 0 && (
            <motion.div 
              className="bg-green-50 p-4 rounded-lg border border-green-100 flex justify-between items-center"
              variants={itemVariants}
            >
              <div className="text-green-800 font-medium">Total savings:</div>
              <div className="text-green-700 font-bold">{formatCurrency(summary.totalSavings)}</div>
            </motion.div>
          )}
        </motion.div>
        
        <Separator />
        
        {/* Upcoming Payments Section */}
        <motion.div 
          className="space-y-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-base">
                {summary.allPrepaid ? 'All periods prepaid!' : 'Upcoming future payments'}
              </h3>
              {!summary.allPrepaid && (
                <Badge variant="outline" className="bg-muted text-muted-foreground">
                  Remaining: {formatCurrency(summary.totalUpcomingAmount)}
                </Badge>
              )}
            </div>
            
            {summary.allPrepaid ? (
              <div className="bg-green-50 p-6 rounded-lg border border-green-100 flex flex-col items-center justify-center text-center">
                <CheckCircle className="h-10 w-10 text-green-600 mb-2" />
                <h3 className="font-medium text-green-800 mb-1">All periods prepaid!</h3>
                <p className="text-sm text-green-700">
                  You've prepaid your entire stay with a total savings of {formatCurrency(summary.totalSavings)}.
                </p>
              </div>
            ) : (
              <div className="space-y-2 bg-muted/20 rounded-lg p-4 border border-border">
                {periodsWithDiscounts
                  .filter(period => !period.isPrepaid)
                  .slice(0, showAllPeriods ? undefined : 3) // Show only first 3 unless expanded
                  .map((period) => (
                    <div 
                      key={`upcoming-${period.index}`}
                      className="flex justify-between items-center py-2 border-b border-border last:border-0"
                    >
                      <div className="space-y-1">
                        <div className="font-medium text-sm">
                          {period.type === 'weekly' ? '7-day period' : `${differenceInDays(period.endDate, period.startDate)}-day period`}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(period.startDate, "MMM d")} - {format(period.endDate, "MMM d")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Due by {format(period.startDate, "MMMM d, yyyy")}
                        </div>
                      </div>
                      
                      <div className="font-medium">
                        {formatCurrency(period.amount)}
                      </div>
                    </div>
                  ))}
                
                {/* Show more/less toggle */}
                {periodsWithDiscounts.filter(p => !p.isPrepaid).length > 3 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full mt-2 text-muted-foreground"
                    onClick={() => setShowAllPeriods(!showAllPeriods)}
                  >
                    {showAllPeriods ? (
                      <span className="flex items-center gap-1">
                        <ChevronUp className="h-4 w-4" />
                        Show less
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <ChevronDown className="h-4 w-4" />
                        Show all {periodsWithDiscounts.filter(p => !p.isPrepaid).length} payments
                      </span>
                    )}
                  </Button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      </CardContent>
      
      <CardFooter className="border-t pt-6 pb-6 flex flex-col items-start">
        <h4 className="font-medium text-sm mb-2">Progressive Discount Structure</h4>
        <div className="grid grid-cols-5 gap-2 w-full text-xs text-center">
          <div className="p-1.5 bg-muted rounded">
            <div>First period</div>
            <div className="font-semibold">0% discount</div>
          </div>
          <div className="p-1.5 bg-muted rounded">
            <div>Second period</div>
            <div className="font-semibold">5% discount</div>
          </div>
          <div className="p-1.5 bg-muted rounded">
            <div>Third period</div>
            <div className="font-semibold">10% discount</div>
          </div>
          <div className="p-1.5 bg-muted rounded">
            <div>Fourth period</div>
            <div className="font-semibold">15% discount</div>
          </div>
          <div className="p-1.5 bg-muted rounded">
            <div>Fifth+ periods</div>
            <div className="font-semibold">20% discount</div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}