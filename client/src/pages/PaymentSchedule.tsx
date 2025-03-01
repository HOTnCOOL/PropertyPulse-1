import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { 
  addDays, 
  format, 
  differenceInDays, 
  differenceInCalendarMonths, 
  addMonths,
  startOfDay,
  getDate
} from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Loader2, 
  Plus, 
  Minus, 
  Calendar as CalendarIcon,
  PiggyBank, 
  CheckCircle, 
  ChevronUp, 
  ChevronDown, 
  TrendingDown,
  AlertTriangle,
  Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

// Constants for pricing
const DAILY_RATE = 70;
const WEEKLY_RATE = 420;
const MONTHLY_RATE = 1500;

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

// Check if stay duration meets plan eligibility
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

export default function PaymentSchedule() {
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  // Parse query params manually
  const params = new URLSearchParams(window.location.search);
  const guestId = params.get('guestId') ? parseInt(params.get('guestId') as string) : undefined;
  
  // Set default dates for the calculator
  const today = new Date();
  const [selectedDates, setSelectedDates] = useState<{
    from: Date;
    to: Date;
  }>({
    from: today,
    to: addDays(today, 23) // 23-night stay as default
  });

  // Payment calculation state
  const [preferredPackageType, setPreferredPackageType] = useState<'monthly' | 'weekly' | 'daily'>('weekly');
  const [prepaidPeriods, setPrepaidPeriods] = useState<number[]>([0]); // First period is always prepaid
  const [showAllPeriods, setShowAllPeriods] = useState(false);

  // Property data
  const exampleProperty = {
    id: 1,
    name: "Modern Downtown Apartment",
    description: "A beautiful apartment in the heart of downtown",
    type: "Apartment",
    capacity: "4",
    rate: "70",
    weeklyRate: "420",
    monthlyRate: "1500",
    hourlyRate: null,
    isOccupied: false,
    address: "123 Main St, San Francisco, CA 94105",
    imageUrls: [],
    amenities: "WiFi, Kitchen, Parking",
    status: "active",
    bedType: "Queen",
    bathrooms: 2,
    isActive: true,
    reservedDates: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    discountConfig: {
      monthly: {
        type: 'progressive',
        progressiveRate: 5,
        progressiveMax: 20
      },
      weekly: {
        type: 'progressive',
        progressiveRate: 5,
        progressiveMax: 20
      },
      daily: {
        type: 'progressive',
        progressiveRate: 5,
        progressiveMax: 20
      }
    }
  };

  // Fetch guest data if guestId is provided
  const { data: guest, isLoading: isGuestLoading } = useQuery({
    queryKey: ["guest", guestId],
    queryFn: async () => {
      if (!guestId) return null;
      const response = await fetch(`/api/guests/${guestId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch guest");
      }
      return response.json();
    },
    enabled: !!guestId,
  });

  useEffect(() => {
    if (guest) {
      toast({
        title: "Guest Information Loaded",
        description: `Welcome ${guest.firstName} ${guest.lastName}`,
        duration: 3000,
      });
    }
  }, [guest, toast]);

  // Check plan eligibility based on the selected dates
  const eligibility = useMemo(() => {
    if (!selectedDates.from || !selectedDates.to) {
      return { monthly: false, weekly: false, daily: true };
    }
    return {
      monthly: isEligibleForMonthlyPlan(selectedDates.from, selectedDates.to),
      weekly: isEligibleForWeeklyPlan(selectedDates.from, selectedDates.to),
      daily: true // Always eligible for daily
    };
  }, [selectedDates]);

  // Update preferred package type based on eligibility if current selection becomes ineligible
  useEffect(() => {
    if (!eligibility[preferredPackageType]) {
      if (eligibility.monthly) setPreferredPackageType('monthly');
      else if (eligibility.weekly) setPreferredPackageType('weekly');
      else setPreferredPackageType('daily');
    }
  }, [eligibility, preferredPackageType]);
  
  // Generate all payment periods based on the check-in and check-out dates
  const allPeriods = useMemo(() => {
    // Safe-guard against invalid dates
    if (!selectedDates.from || !selectedDates.to || 
        isNaN(selectedDates.from.getTime()) || 
        isNaN(selectedDates.to.getTime())) {
      return [];
    }
    
    // Ensure checkOut is after checkIn
    if (selectedDates.to <= selectedDates.from) {
      return [];
    }
    
    const periods: PaymentPeriod[] = [];
    const totalDays = differenceInDays(selectedDates.to, selectedDates.from);
    let currentDate = new Date(selectedDates.from);
    let remainingDays = totalDays;
    let periodIndex = 0;
    
    // Create periods based on selected plan type
    if (preferredPackageType === 'monthly' && eligibility.monthly) {
      // Create monthly periods
      while (remainingDays >= 30) {
        const periodEndDate = addMonths(currentDate, 1);
        
        periods.push({
          type: 'monthly',
          startDate: new Date(currentDate),
          endDate: new Date(periodEndDate),
          baseAmount: MONTHLY_RATE,
          amount: MONTHLY_RATE, // Will be recalculated with discounts
          discountPercentage: 0, // Will be recalculated
          isPrepaid: periodIndex === 0, // First period is always prepaid
          index: periodIndex
        });
        
        currentDate = new Date(periodEndDate);
        remainingDays -= 30; // Approximation for a month
        periodIndex++;
      }
    } else if (preferredPackageType === 'weekly' && eligibility.weekly) {
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
    }
    
    // Add remaining days as a daily period if needed
    if (remainingDays > 0) {
      const periodEndDate = addDays(currentDate, remainingDays);
      const dailyRate = preferredPackageType === 'monthly' ? 
                       MONTHLY_RATE / 30 : 
                       preferredPackageType === 'weekly' ? 
                       WEEKLY_RATE / 7 : 
                       DAILY_RATE;
      
      periods.push({
        type: 'daily',
        startDate: new Date(currentDate),
        endDate: new Date(periodEndDate),
        baseAmount: remainingDays * dailyRate,
        amount: remainingDays * dailyRate, // Will be recalculated with discounts
        discountPercentage: 0, // Will be recalculated
        isPrepaid: false,
        index: periodIndex
      });
    }
    
    return periods;
  }, [selectedDates, preferredPackageType, eligibility]);
  
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
    
    // Calculate deposit amount based on stay duration and number of prepaid periods
    const totalDays = selectedDates.from && selectedDates.to ? 
                      differenceInDays(selectedDates.to, selectedDates.from) : 0;
    const depositAmount = calculateDepositAmount(
      preferredPackageType, 
      periodsWithDiscounts.filter(p => p.isPrepaid && p.type === preferredPackageType).length, 
      totalDays
    );
    
    // Calculate the percentage savings compared to standard price
    const standardPrice = totalDays * DAILY_RATE;
    const savingsPercentage = ((standardPrice - (totalPrepaidAmount + totalUpcomingAmount)) / standardPrice) * 100;
    
    // Calculate effective nightly rate
    const effectiveRate = totalDays > 0 ? 
                         (totalPrepaidAmount + totalUpcomingAmount) / totalDays : 
                         0;
    
    return {
      totalBaseAmount,
      totalPrepaidAmount,
      totalUpcomingAmount,
      totalSavings,
      allPrepaid,
      nextPrepaidIndex,
      hasNextPeriod,
      nextDiscountPercentage,
      depositAmount,
      savingsPercentage: savingsPercentage > 0 ? savingsPercentage : 0,
      effectiveRate
    };
  }, [periodsWithDiscounts, prepaidPeriods, preferredPackageType, selectedDates]);
  
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
  
  // Format currency
  const formatCurrency = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="container mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-bold">Payment Schedule</h1>
      
      {isGuestLoading ? (
        <div className="flex justify-center items-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading guest information...</span>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="w-full lg:w-1/3 space-y-6">
            {/* Guest information if available */}
            {guest && (
              <Card>
                <CardHeader>
                  <CardTitle>Guest Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-4">
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Name</dt>
                      <dd className="font-medium">{guest.firstName} {guest.lastName}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Email</dt>
                      <dd>{guest.email}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Phone</dt>
                      <dd>{guest.phone || "Not provided"}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">ID/Passport</dt>
                      <dd>{guest.idNumber || "Not provided"}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            )}
            
            {/* Date selection card */}
            <Card>
              <CardHeader>
                <CardTitle>Select Dates</CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="range"
                  selected={{
                    from: selectedDates.from,
                    to: selectedDates.to
                  }}
                  onSelect={(range: any) => {
                    if (range?.from && range?.to) {
                      setSelectedDates({
                        from: range.from,
                        to: range.to
                      });
                    }
                  }}
                  numberOfMonths={2}
                />
              </CardContent>
            </Card>
            
            {/* Plan Selection Card */}
            <Card>
              <CardHeader>
                <CardTitle>Choose Payment Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4">
                  {/* Monthly Plan */}
                  <Button 
                    variant={preferredPackageType === 'monthly' ? "default" : "outline"}
                    disabled={!eligibility.monthly}
                    onClick={() => setPreferredPackageType('monthly')}
                    className="justify-between h-auto py-3"
                  >
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      <span>Monthly Plan</span>
                    </div>
                    <div className="text-sm">
                      ${MONTHLY_RATE/30}/night
                    </div>
                  </Button>
                  
                  {/* Weekly Plan */}
                  <Button 
                    variant={preferredPackageType === 'weekly' ? "default" : "outline"}
                    disabled={!eligibility.weekly}
                    onClick={() => setPreferredPackageType('weekly')}
                    className="justify-between h-auto py-3"
                  >
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      <span>Weekly Plan</span>
                    </div>
                    <div className="text-sm">
                      ${WEEKLY_RATE/7}/night
                    </div>
                  </Button>
                  
                  {/* Daily Plan */}
                  <Button 
                    variant={preferredPackageType === 'daily' ? "default" : "outline"}
                    onClick={() => setPreferredPackageType('daily')}
                    className="justify-between h-auto py-3"
                  >
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      <span>Daily Plan</span>
                    </div>
                    <div className="text-sm">
                      ${DAILY_RATE}/night
                    </div>
                  </Button>
                </div>
                
                {!eligibility.monthly && (
                  <div className="mt-3 text-xs flex items-start gap-2 text-amber-700 bg-amber-50 p-2 rounded-md">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>Monthly plan requires a 30+ day stay.</span>
                  </div>
                )}
                
                {!eligibility.weekly && (
                  <div className="mt-3 text-xs flex items-start gap-2 text-amber-700 bg-amber-50 p-2 rounded-md">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>Weekly plan requires a 7+ day stay.</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Payment schedule calculator card */}
          <div className="w-full lg:w-2/3">
            {(!selectedDates.from || !selectedDates.to || periodsWithDiscounts.length === 0) ? (
              <Card className="w-full">
                <CardContent className="pt-6">
                  <div className="text-center p-8">
                    <CalendarIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Select Dates to View Payment Schedule</h3>
                    <p className="text-sm text-muted-foreground">
                      Please select check-in and check-out dates to see available payment options.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="w-full">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <PiggyBank className="h-5 w-5 text-primary" />
                    <span>Payment Schedule</span>
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  {/* Stay Summary */}
                  <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="text-sm font-medium">Stay Duration:</div>
                      <div className="text-sm">
                        {differenceInDays(selectedDates.to, selectedDates.from)} nights 
                        ({format(selectedDates.from, "MMM d, yyyy")} - {format(selectedDates.to, "MMM d, yyyy")})
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="text-sm font-medium">Selected Plan:</div>
                      <div className="text-sm capitalize">{preferredPackageType} Plan</div>
                    </div>
                    {summary.effectiveRate > 0 && (
                      <div className="flex justify-between items-center">
                        <div className="text-sm font-medium">Effective Rate:</div>
                        <div className="text-sm">{formatCurrency(summary.effectiveRate)}/night</div>
                      </div>
                    )}
                    {summary.savingsPercentage > 0 && (
                      <div className="flex justify-between items-center">
                        <div className="text-sm font-medium">Total Savings:</div>
                        <div className="text-sm text-green-600">{summary.savingsPercentage.toFixed(1)}% off standard rate</div>
                      </div>
                    )}
                  </div>
                
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
                                  {period.type === 'monthly' ? '30-day period' : 
                                   period.type === 'weekly' ? '7-day period' : 
                                   `${differenceInDays(period.endDate, period.startDate)}-day period`}
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <CalendarIcon className="h-3 w-3" />
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
                    
                    {/* Deposit Information */}
                    <motion.div 
                      className="bg-muted/20 p-4 rounded-lg border border-border space-y-2"
                      variants={itemVariants}
                    >
                      <div className="flex justify-between items-center text-sm">
                        <div className="font-medium flex items-center gap-1">
                          <Info className="h-4 w-4 text-muted-foreground" />
                          Security Deposit:
                        </div>
                        <div>
                          {summary.depositAmount > 0 ? formatCurrency(summary.depositAmount) : 'No deposit required'}
                        </div>
                      </div>
                      {summary.depositAmount > 0 && prepaidPeriods.length < 3 && (
                        <div className="text-xs text-muted-foreground">
                          Prepay 3 or more periods to waive the security deposit requirement.
                        </div>
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
                                    {period.type === 'monthly' ? '30-day period' : 
                                     period.type === 'weekly' ? '7-day period' : 
                                     `${differenceInDays(period.endDate, period.startDate)}-day period`}
                                  </div>
                                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <CalendarIcon className="h-3 w-3" />
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
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 w-full text-xs text-center">
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}