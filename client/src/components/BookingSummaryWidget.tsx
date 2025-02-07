import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, PiggyBank } from "lucide-react";
import type { Service } from "./AdditionalServices";

interface BookingSummaryWidgetProps {
  baseAmount: number;
  selectedServices: Service[];
  onProceedToPayment: () => void;
  minimumPayment: number;
}

export default function BookingSummaryWidget({
  baseAmount,
  selectedServices,
  onProceedToPayment,
  minimumPayment
}: BookingSummaryWidgetProps) {
  const totalServicesCost = useMemo(() => 
    selectedServices.reduce((sum, service) => sum + service.price, 0),
    [selectedServices]
  );

  const totalAmount = baseAmount + totalServicesCost;
  const maxDiscount = totalAmount * 0.5; // 50% maximum discount
  const potentialSavings = maxDiscount;

  return (
    <Card className="fixed bottom-4 right-4 w-80 shadow-lg border-2">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span>Base Stay Amount</span>
            <span>${baseAmount.toLocaleString()}</span>
          </div>
          
          {selectedServices.length > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span>Additional Services</span>
              <span>${totalServicesCost.toLocaleString()}</span>
            </div>
          )}

          <div className="border-t pt-2">
            <div className="flex justify-between items-center font-medium">
              <span>Total Amount</span>
              <span>${totalAmount.toLocaleString()}</span>
            </div>
            
            <div className="mt-2 p-2 bg-green-50 rounded-md">
              <div className="flex items-center text-green-700 text-sm">
                <PiggyBank className="h-4 w-4 mr-2" />
                <span>Save up to ${potentialSavings.toLocaleString()} if prepaid today!</span>
              </div>
            </div>

            <div className="mt-2 text-sm text-muted-foreground">
              Minimum payment required: ${minimumPayment.toLocaleString()}
            </div>
          </div>

          <Button 
            className="w-full" 
            onClick={onProceedToPayment}
          >
            Proceed to Payment
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
