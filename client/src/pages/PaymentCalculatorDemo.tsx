import { useState } from 'react';
import { format, addDays } from 'date-fns';
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PaymentScheduleCalculator from '@/components/PaymentScheduleCalculator';

export default function PaymentCalculatorDemo() {
  const today = new Date();
  
  // Default values as per requirements
  const [totalNights, setTotalNights] = useState<number>(23);
  const [startDate, setStartDate] = useState<Date>(new Date(today.getFullYear(), 4, 1)); // May 1st
  const [planType, setPlanType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  
  // Default rates as per requirements
  const planRates = {
    daily: 70,
    weekly: 420, // $60 per day equivalent
    monthly: 1800, // $60 per day equivalent
  };
  
  // Handler functions
  const handleNightsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setTotalNights(value);
    }
  };
  
  const handlePlanTypeChange = (value: 'daily' | 'weekly' | 'monthly') => {
    setPlanType(value);
  };
  
  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setStartDate(date);
    }
  };
  
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8 text-center">Interactive Payment Schedule Calculator</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="space-y-6 bg-card p-6 rounded-lg border shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Adjust Parameters</h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="totalNights">Total Nights</Label>
                <Input 
                  id="totalNights" 
                  type="number" 
                  min="1" 
                  value={totalNights} 
                  onChange={handleNightsChange}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="planType">Plan Type</Label>
                <Select value={planType} onValueChange={handlePlanTypeChange as (value: string) => void}>
                  <SelectTrigger id="planType">
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily (1-day plan)</SelectItem>
                    <SelectItem value="weekly">Weekly (7-day plan)</SelectItem>
                    <SelectItem value="monthly">Monthly (30-day plan)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Start Date</Label>
              <div className="bg-white rounded-md border shadow-sm p-3">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={handleDateChange}
                  className="rounded-md mx-auto"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Selected date: {format(startDate, 'PPP')}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted/20 rounded-md">
                <div className="text-sm text-muted-foreground">Plan Rate</div>
                <div className="font-semibold">${planRates[planType]}</div>
              </div>
              
              <div className="p-3 bg-muted/20 rounded-md">
                <div className="text-sm text-muted-foreground">Standard Nightly Rate</div>
                <div className="font-semibold">$70</div>
              </div>
            </div>
            
            <div className="p-3 bg-green-50 rounded-md border border-green-100">
              <p className="text-sm text-green-700">
                <strong>Example scenario:</strong> {totalNights}-night stay starting {format(startDate, 'MMM d')}, 
                with {planType} plan at ${planRates[planType]} per {planType === 'daily' ? 'day' : planType === 'weekly' ? 'week' : 'month'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Stay Summary</h2>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-primary/5 rounded-md">
              <span className="font-medium">Check-in Date:</span>
              <span>{format(startDate, 'PPPP')}</span>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-primary/5 rounded-md">
              <span className="font-medium">Check-out Date:</span>
              <span>{format(addDays(startDate, totalNights), 'PPPP')}</span>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-primary/5 rounded-md">
              <span className="font-medium">Total Nights:</span>
              <span>{totalNights} nights</span>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-primary/5 rounded-md">
              <span className="font-medium">Selected Plan:</span>
              <span className="capitalize">{planType} Plan (${planRates[planType]})</span>
            </div>
            
            <div className="p-3 bg-orange-50 rounded-md border border-orange-100 text-sm text-orange-800">
              <p>Use the calculator below to see payment options and potential savings with prepayment discounts.</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Payment Schedule Calculator Component */}
      <PaymentScheduleCalculator 
        totalNights={totalNights}
        planType={planType}
        planRate={planRates[planType]}
        standardNightlyRate={70}
        startDate={startDate}
      />
      
      <div className="mt-8 p-4 bg-muted/20 rounded-lg border text-sm text-center text-muted-foreground">
        <p>This calculator demonstrates the progressive discount system where prepaying multiple periods offers increased savings.</p>
        <p className="mt-2">Discount rates: 2nd period: 5%, 3rd period: 10%, 4th period: 15%, 5th+ period: 20%</p>
      </div>
    </div>
  );
}