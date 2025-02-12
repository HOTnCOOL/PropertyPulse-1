import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { insertPaymentSchema } from "@db/schema";
import * as z from "zod";

const PaymentForm = ({ property, booking, onSuccess }) => {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentAmount, setPaymentAmount] = useState('partial');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handlePayment = async () => {
    try {
      // Validate sequential payment rule
      const unpaidPeriods = await fetch(`/api/payments/unpaid-periods?bookingId=${booking.id}`).then(r => r.json());
      
      if (unpaidPeriods.hasPriorUnpaid) {
        toast({
          title: "Payment Error",
          description: "You must pay for all prior periods before making this payment",
          variant: "destructive"
        });
        return;
      }

      // Calculate prepayment discount
      const periodIndex = unpaidPeriods.paidPeriodsCount;
      const discount = Math.min(periodIndex * 10, 50);
      const discountedAmount = paymentAmount === 'full' ? 
        booking.totalAmount * (1 - discount/100) : 
        booking.depositAmount;
      const response = await fetch('/api/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          method: paymentMethod,
          amount: paymentAmount === 'full' ? booking.totalAmount : booking.depositAmount,
          status: 'confirmed'
        })
      });

      if (!response.ok) throw new Error('Payment failed');

      const result = await response.json();
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      toast({
        title: 'Success',
        description: 'Payment processed successfully'
      });
      window.location.href = `/guest-dashboard?ref=${booking.reference}&email=${booking.guest.email}`;
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Payment processing failed',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-2">Payment Method</h3>
        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="bank">Bank Transfer</SelectItem>
            <SelectItem value="card">Credit Card</SelectItem>
            <SelectItem value="stripe">Stripe</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Payment Amount</h3>
        <Select value={paymentAmount} onValueChange={setPaymentAmount}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="partial">Deposit Only (${booking.depositAmount})</SelectItem>
            <SelectItem value="full">Full Amount (${booking.totalAmount})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button onClick={handlePayment} className="w-full">
        Process Payment
      </Button>
    </div>
  );
};


interface PaymentRegistrationProps {
  guestId: number;
  onSuccess?: () => void;
  property: any; //Added property prop
  booking: any; //Added booking prop
}

export default function PaymentRegistration({ guestId, onSuccess, property, booking }: PaymentRegistrationProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  //Removed existing form and mutation logic

  return (
    <PaymentForm property={property} booking={booking} onSuccess={onSuccess}/>
  );
}