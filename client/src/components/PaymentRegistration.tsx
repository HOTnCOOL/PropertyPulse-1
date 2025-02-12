import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { differenceInDays, differenceInWeeks, differenceInMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { insertPaymentSchema } from "@db/schema";
import * as z from "zod";
import { Link } from "wouter";

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

    console.log('Calculating deposit for stay duration:', stayDuration, 'days');
    console.log('Payment type:', isFullyPrepaid ? 'Full prepayment' : 'Partial payment');

    // No deposit for fully prepaid bookings
    if (isFullyPrepaid) {
      console.log('No deposit required - booking is fully prepaid');
      return 0;
    }

    // Calculate base deposit amount based on stay duration
    let baseDeposit = 0;
    if (stayDuration <= 3) {
      console.log('Stay duration ≤ 3 days - no deposit required');
      return 0;
    } else if (stayDuration < 14) { // Less than 2 weeks
      baseDeposit = 90; // One daily rate deposit
      console.log('Stay duration < 2 weeks - daily rate deposit:', baseDeposit);
    } else if (stayDuration < 60) { // Less than 2 months
      baseDeposit = 420; // One weekly rate deposit
      console.log('Stay duration < 2 months - weekly rate deposit:', baseDeposit);
    } else {
      baseDeposit = 1200; // One monthly rate deposit
      console.log('Stay duration ≥ 2 months - monthly rate deposit:', baseDeposit);
    }

    // Check if eligible for deposit reduction (2+ packs of same type prepaid)
    const hasTwoPacksPrepaid = false; // TODO: Implement pack prepayment check
    const finalDeposit = hasTwoPacksPrepaid ? baseDeposit / 2 : baseDeposit;
    console.log('Final deposit amount:', finalDeposit, hasTwoPacksPrepaid ? '(50% reduction applied)' : '(no reduction)');
    return finalDeposit;
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

      console.log('Processing payment:', {
        bookingId: booking.id,
        method: paymentMethod,
        amount: discountedAmount,
        type: paymentAmount === 'full' ? 'full_payment' : 'deposit'
      });

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
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Payment error:', error);
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
          <div className="mt-2">
            <p className="text-sm text-muted-foreground">
              Note: Security deposit is fully refundable at checkout
            </p>
            <Link href="/deposit-policy" className="text-sm text-primary hover:underline">
              View Deposit Policy
            </Link>
          </div>
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