import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, differenceInDays, differenceInMonths, differenceInWeeks } from "date-fns";
import type { Property } from "@db/schema";

interface PaymentEstimatorProps {
  property?: Property;
  checkIn?: Date;
  checkOut?: Date;
}

export default function PaymentEstimator({ property, checkIn, checkOut }: PaymentEstimatorProps) {
  const estimates = useMemo(() => {
    if (!property || !checkIn || !checkOut) return null;

    const days = differenceInDays(checkOut, checkIn);
    const weeks = differenceInWeeks(checkOut, checkIn);
    const months = differenceInMonths(checkOut, checkIn);

    let totalAmount = 0;
    const breakdown = [];

    // Calculate based on the most cost-effective rate
    if (months > 0 && property.monthlyRate) {
      const monthlyAmount = Number(property.monthlyRate) * months;
      totalAmount += monthlyAmount;
      breakdown.push({
        description: `Monthly Rate (${months} months)`,
        amount: monthlyAmount,
      });

      const remainingDays = days - (months * 30);
      if (remainingDays > 0) {
        const dailyAmount = Number(property.rate) * remainingDays;
        totalAmount += dailyAmount;
        breakdown.push({
          description: `Daily Rate (${remainingDays} days)`,
          amount: dailyAmount,
        });
      }
    } else if (weeks > 0 && property.weeklyRate) {
      const weeklyAmount = Number(property.weeklyRate) * weeks;
      totalAmount += weeklyAmount;
      breakdown.push({
        description: `Weekly Rate (${weeks} weeks)`,
        amount: weeklyAmount,
      });

      const remainingDays = days - (weeks * 7);
      if (remainingDays > 0) {
        const dailyAmount = Number(property.rate) * remainingDays;
        totalAmount += dailyAmount;
        breakdown.push({
          description: `Daily Rate (${remainingDays} days)`,
          amount: dailyAmount,
        });
      }
    } else {
      const dailyAmount = Number(property.rate) * days;
      totalAmount += dailyAmount;
      breakdown.push({
        description: `Daily Rate (${days} days)`,
        amount: dailyAmount,
      });
    }

    // Add security deposit (assumed as one month's rent or weekly rate)
    const deposit = property.monthlyRate 
      ? Number(property.monthlyRate)
      : property.weeklyRate 
        ? Number(property.weeklyRate)
        : Number(property.rate) * 7;
    
    totalAmount += deposit;
    breakdown.push({
      description: "Security Deposit (refundable)",
      amount: deposit,
    });

    return {
      breakdown,
      total: totalAmount,
    };
  }, [property, checkIn, checkOut]);

  if (!estimates) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Estimation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            {estimates.breakdown.map((item, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span>{item.description}</span>
                <span className="font-medium">${item.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
          
          <div className="pt-4 border-t">
            <div className="flex justify-between font-semibold">
              <span>Total Amount</span>
              <span>${estimates.total.toLocaleString()}</span>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            <p>Payment Schedule:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Security Deposit: Due at booking</li>
              <li>First Month/Week: Due before check-in</li>
              <li>Subsequent payments: Due on the 1st of each period</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
