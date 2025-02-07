import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import PaymentHistory from "../components/PaymentHistory";
import { Calendar, DollarSign, CreditCard, AlertCircle } from "lucide-react";
import type { Booking, Guest, Property, Payment } from "@db/schema";

// Extended type to include relations
interface BookingWithRelations extends Booking {
  guest: Guest | null;
  property: Property | null;
  payments: Payment[];
}

export default function GuestPayment() {
  const [location] = useLocation();
  const { toast } = useToast();

  // Get booking reference and email from URL parameters
  const params = new URLSearchParams(window.location.search);
  const bookingRef = params.get('ref');
  const email = params.get('email');

  const { data: booking, isLoading } = useQuery<BookingWithRelations>({
    queryKey: ['/api/bookings/guest', bookingRef, email],
    queryFn: async () => {
      const response = await fetch(`/api/bookings/guest?ref=${bookingRef}&email=${email}`);
      if (!response.ok) {
        throw new Error('Failed to fetch booking details');
      }
      return response.json();
    },
    enabled: !!bookingRef && !!email,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-8">
              <p className="text-center">Loading payment details...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!booking || !booking.guest) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-8">
              <p className="text-center">Booking not found. Please check your booking reference.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Calculate remaining balance
  const totalPaid = booking.payments
    .filter(p => p.status === 'confirmed')
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const remainingBalance = Number(booking.totalAmount) - totalPaid;

  // Get upcoming payments (payments with status 'pending')
  const upcomingPayments = booking.payments
    .filter(p => p.status === 'pending')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Payment Details</h1>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Booking Reference</p>
            <p className="font-medium">{booking.bookingReference}</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Payment Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="font-medium">${booking.totalAmount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Amount Paid</span>
                  <span className="font-medium text-green-600">${totalPaid}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Remaining Balance</span>
                  <span className="font-medium text-orange-600">${remainingBalance}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Stay Period
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Check-in</p>
                    <p className="font-medium">
                      {new Date(booking.checkIn).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Check-out</p>
                    <p className="font-medium">
                      {new Date(booking.checkOut).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {booking.property && (
                  <div>
                    <p className="text-sm text-muted-foreground">Property</p>
                    <p className="font-medium">{booking.property.name}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {upcomingPayments.length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Upcoming Payments
                </CardTitle>
                <CardDescription>
                  You have {upcomingPayments.length} upcoming payment{upcomingPayments.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {upcomingPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div>
                        <p className="font-medium">${payment.amount}</p>
                        <p className="text-sm text-muted-foreground">
                          Due on {new Date(payment.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                      <Button variant="outline" onClick={() => {
                        // TODO: Implement payment processing
                        toast({
                          title: "Coming Soon",
                          description: "Payment processing will be available soon.",
                        });
                      }}>
                        <CreditCard className="h-4 w-4 mr-2" />
                        Pay Now
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentHistory payments={booking.payments} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}