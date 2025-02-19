import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Booking, Guest } from "@db/schema";

export default function PaymentPlanSelection() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const params = new URLSearchParams(window.location.search);
  const bookingRef = params.get('ref');
  const guestEmail = params.get('email');

  const { data: booking } = useQuery<Booking>({
    queryKey: ["/api/bookings/guest", bookingRef, guestEmail],
    queryFn: async () => {
      if (!bookingRef || !guestEmail) throw new Error("Missing booking reference or email");
      const response = await fetch(`/api/bookings/guest?ref=${bookingRef}&email=${guestEmail}`);
      if (!response.ok) throw new Error("Failed to fetch booking");
      return response.json();
    },
    enabled: !!bookingRef && !!guestEmail,
  });

  const handlePlanSelection = (plan: 'full' | 'deposit') => {
    if (!booking) return;

    const amount = plan === 'full' ? Number(booking.totalAmount) : Number(booking.totalAmount) * 0.3;
    setLocation(`/payment?ref=${bookingRef}&email=${guestEmail}&amount=${amount}&plan=${plan}`);
  };

  if (!booking) return null;

  const depositAmount = Number(booking.totalAmount) * 0.3;

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Select Payment Plan</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Full Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-2xl font-bold">${Number(booking.totalAmount).toFixed(2)}</p>
              <p className="text-muted-foreground">Pay the full amount now and complete your booking</p>
              <Button 
                className="w-full"
                onClick={() => handlePlanSelection('full')}
              >
                Pay Full Amount
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deposit Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-2xl font-bold">${depositAmount.toFixed(2)}</p>
              <p className="text-muted-foreground">Pay 30% deposit now and the rest upon arrival</p>
              <Button 
                className="w-full"
                onClick={() => handlePlanSelection('deposit')}
              >
                Pay Deposit
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}