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
import { AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface PaymentBreakdown {
  type: 'monthly' | 'weekly' | 'daily';
  periods: Array<{
    startDate: Date;
    endDate: Date;
    amount: number;
  }>;
  totalAmount: number;
  depositAmount: number;
  initialPayment: number;
}

const calculatePaymentBreakdown = (
  property: Property,
  checkIn: Date,
  checkOut: Date,
  packageType: 'monthly' | 'weekly' | 'daily'
): PaymentBreakdown => {
  const periods: Array<{ startDate: Date; endDate: Date; amount: number }> = [];
  let currentDate = startOfDay(new Date(checkIn));
  const endDate = startOfDay(new Date(checkOut));

  // Calculate periods based on package type
  while (currentDate < endDate) {
    if (packageType === 'monthly' && property.monthlyRate && differenceInCalendarMonths(endDate, currentDate) >= 1) {
      const monthlyEnd = addMonths(currentDate, 1);
      periods.push({
        startDate: currentDate,
        endDate: monthlyEnd,
        amount: Number(property.monthlyRate)
      });
      currentDate = monthlyEnd;
    } else if (packageType === 'weekly' && property.weeklyRate && differenceInDays(endDate, currentDate) >= 7) {
      const weeklyEnd = addWeeks(currentDate, 1);
      periods.push({
        startDate: currentDate,
        endDate: weeklyEnd,
        amount: Number(property.weeklyRate)
      });
      currentDate = weeklyEnd;
    } else {
      const remainingDays = differenceInDays(endDate, currentDate);
      if (remainingDays > 0) {
        periods.push({
          startDate: currentDate,
          endDate: endDate,
          amount: Number(property.rate) * remainingDays
        });
        currentDate = endDate;
      }
    }
  }

  const totalAmount = periods.reduce((sum, period) => sum + period.amount, 0);
  const depositAmount = packageType === 'monthly' ? Number(property.monthlyRate) :
                       packageType === 'weekly' ? Number(property.weeklyRate) :
                       Number(property.rate) * 7; // One week worth of daily rate as deposit

  return {
    type: packageType,
    periods,
    totalAmount,
    depositAmount,
    initialPayment: periods[0]?.amount + depositAmount || 0
  };
};

export default function PaymentEstimator({ property, checkIn, checkOut }: PaymentEstimatorProps) {
  const [, setLocation] = useLocation();
  const [selectedPackageType, setSelectedPackageType] = useState<'monthly' | 'weekly' | 'daily'>('monthly');

  // Calculate all payment scenarios
  const paymentBreakdowns = useMemo(() => {
    if (!property || !checkIn || !checkOut) return null;

    const breakdowns = {
      monthly: property.monthlyRate ? calculatePaymentBreakdown(property, checkIn, checkOut, 'monthly') : null,
      weekly: property.weeklyRate ? calculatePaymentBreakdown(property, checkIn, checkOut, 'weekly') : null,
      daily: calculatePaymentBreakdown(property, checkIn, checkOut, 'daily')
    };

    return breakdowns;
  }, [property, checkIn, checkOut]);

  if (!paymentBreakdowns || !property) return null;

  const selectedBreakdown = paymentBreakdowns[selectedPackageType];
  if (!selectedBreakdown) return null;

  const handleConfirm = () => {
    setLocation(`/payment?propertyId=${property.id}&packageType=${selectedPackageType}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Plan Selection</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Standard Rates */}
          <div className="p-4 bg-primary/5 rounded-lg space-y-4">
            <h3 className="font-semibold">Available Payment Plans</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {property.monthlyRate && (
                <div 
                  className={`p-3 bg-white rounded border cursor-pointer transition-colors ${
                    selectedPackageType === 'monthly' ? 'border-primary' : ''
                  }`}
                  onClick={() => setSelectedPackageType('monthly')}
                >
                  <div className="text-sm font-medium">Monthly Plan</div>
                  <div className="text-2xl font-bold">${Number(property.monthlyRate).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">per month</div>
                </div>
              )}
              {property.weeklyRate && (
                <div 
                  className={`p-3 bg-white rounded border cursor-pointer transition-colors ${
                    selectedPackageType === 'weekly' ? 'border-primary' : ''
                  }`}
                  onClick={() => setSelectedPackageType('weekly')}
                >
                  <div className="text-sm font-medium">Weekly Plan</div>
                  <div className="text-2xl font-bold">${Number(property.weeklyRate).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">per week</div>
                </div>
              )}
              <div 
                className={`p-3 bg-white rounded border cursor-pointer transition-colors ${
                  selectedPackageType === 'daily' ? 'border-primary' : ''
                }`}
                onClick={() => setSelectedPackageType('daily')}
              >
                <div className="text-sm font-medium">Daily Rate</div>
                <div className="text-2xl font-bold">${Number(property.rate).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">per day</div>
              </div>
            </div>
          </div>

          {/* Payment Schedule */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Payment Schedule</h3>
            <div className="divide-y">
              {selectedBreakdown.periods.map((period, index) => (
                <div key={index} className="py-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="font-medium">
                        {selectedPackageType === 'monthly' && `Month ${index + 1}`}
                        {selectedPackageType === 'weekly' && `Week ${index + 1}`}
                        {selectedPackageType === 'daily' && `${differenceInDays(period.endDate, period.startDate)} Days`}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(period.startDate, "MMM d")} - {format(period.endDate, "MMM d")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        ${period.amount.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Due {index === 0 ? 'at booking' : `by ${format(period.startDate, "MMM d")}`}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security Deposit */}
          <div className="p-4 bg-primary/5 rounded-lg space-y-2">
            <h3 className="font-semibold">Security Deposit</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Required Deposit Amount</span>
                <span>${selectedBreakdown.depositAmount.toLocaleString()}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Fully refundable after stay completion and property inspection
              </p>
            </div>
          </div>

          {/* Total Summary */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span>Total Stay Cost</span>
              <span>${selectedBreakdown.totalAmount.toLocaleString()}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span>Security Deposit (Refundable)</span>
              <span>+${selectedBreakdown.depositAmount.toLocaleString()}</span>
            </div>

            <div className="flex justify-between font-semibold text-lg pt-2 border-t">
              <span>Initial Payment Required</span>
              <span>${selectedBreakdown.initialPayment.toLocaleString()}</span>
            </div>

            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-700">
                Initial payment includes your first {selectedPackageType} payment plus security deposit. 
                Payment must be received within 24 hours to guarantee availability.
              </p>
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