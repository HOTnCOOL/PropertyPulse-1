import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarIcon } from "lucide-react";
import { differenceInDays, differenceInWeeks, differenceInMonths } from "date-fns";
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

interface PaymentFormProps {
  property: any;
  booking: any;
  onSuccess?: () => void;
}

const PaymentForm = ({ property, booking, onSuccess }: PaymentFormProps) => {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentAmount, setPaymentAmount] = useState('partial');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Calculate deposit amount based on stay duration and payment type
  const calculateDepositAmount = () => {
    const stayDuration = differenceInDays(new Date(booking.checkOut), new Date(booking.checkIn));
    const isFullyPrepaid = paymentAmount === 'full';

    // No deposit for fully prepaid bookings
    if (isFullyPrepaid) return 0;

    // Calculate base deposit amount based on stay duration
    let baseDeposit = 0;
    if (stayDuration <= 3) {
      return 0; // No deposit for stays of 3 days or less
    } else if (stayDuration < 14) { // Less than 2 weeks
      baseDeposit = 90; // One daily rate deposit
    } else if (stayDuration < 60) { // Less than 2 months
      baseDeposit = 420; // One weekly rate deposit
    } else {
      baseDeposit = 1200; // One monthly rate deposit
    }

    // Check if eligible for deposit reduction (2+ packs of same type prepaid)
    const hasTwoPacksPrepaid = false; // TODO: Implement pack prepayment check
    return hasTwoPacksPrepaid ? baseDeposit / 2 : baseDeposit;
  };

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
        calculateDepositAmount();

      const response = await fetch('/api/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          method: paymentMethod,
          amount: discountedAmount,
          type: paymentAmount === 'full' ? 'full_payment' : 'deposit',
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

  const depositAmount = calculateDepositAmount();

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
            {depositAmount > 0 && (
              <SelectItem value="partial">Security Deposit (${depositAmount})</SelectItem>
            )}
            <SelectItem value="full">Full Amount (${booking.totalAmount})</SelectItem>
          </SelectContent>
        </Select>
        {depositAmount > 0 && paymentAmount === 'partial' && (
          <p className="text-sm text-muted-foreground mt-2">
            Note: Security deposit is fully refundable at checkout
          </p>
        )}
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
  property: any;
  booking: any;
}

export default function PaymentRegistration({ guestId, onSuccess, property, booking }: PaymentRegistrationProps) {
  return (
    <PaymentForm property={property} booking={booking} onSuccess={onSuccess}/>
  );
}