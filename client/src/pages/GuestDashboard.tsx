import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import PaymentHistory from "../components/PaymentHistory";
import { MapPin, Key, Calendar, Info } from "lucide-react";
import type { Booking, Guest, Property, Payment } from "@db/schema";

// Extended type to include relations
interface BookingWithRelations extends Booking {
  guest: Guest | null;
  property: Property | null;
  payments: Payment[];
}

export default function GuestDashboard() {
  const { toast } = useToast();
  const bookingRef = new URLSearchParams(window.location.search).get('ref');
  const email = new URLSearchParams(window.location.search).get('email');

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
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load booking details",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-lg">Loading your booking details...</p>
      </div>
    );
  }

  if (!booking || !booking.guest) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h1 className="text-2xl font-semibold mb-4">Booking Not Found</h1>
        <p>Please check your booking reference and email address.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Welcome, {booking.guest.firstName}!</h1>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Booking Reference</p>
          <p className="font-medium">{booking.bookingReference}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Stay Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium">Check-in</h3>
                  <p className="text-muted-foreground">
                    {new Date(booking.checkIn).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <h3 className="font-medium">Check-out</h3>
                  <p className="text-muted-foreground">
                    {new Date(booking.checkOut).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div>
                <h3 className="font-medium">Length of Stay</h3>
                <p className="text-muted-foreground">
                  {Math.ceil((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24))} nights
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Access Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {booking.guest.accessCode && (
                <div>
                  <h3 className="font-medium">Door Code</h3>
                  <p className="text-muted-foreground font-mono">{booking.guest.accessCode}</p>
                </div>
              )}
              <div>
                <h3 className="font-medium">Important Note</h3>
                <p className="text-muted-foreground">
                  Please keep your booking reference and access code safe. You'll need these for check-in.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {booking.property && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Property Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium">Property Name</h3>
                  <p className="text-muted-foreground">{booking.property.name}</p>
                </div>
                <div>
                  <h3 className="font-medium">Property Type</h3>
                  <p className="text-muted-foreground">{booking.property.type}</p>
                </div>
                <div>
                  <h3 className="font-medium">Amenities</h3>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {Object.entries(booking.property.amenities as Record<string, boolean>)
                      .filter(([_, value]) => value)
                      .map(([key]) => (
                        <span key={key} className="text-sm text-muted-foreground capitalize">
                          {key}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Payment Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">Total Amount</h3>
                <p className="text-xl font-semibold">${booking.totalAmount}</p>
              </div>
              <div>
                <h3 className="font-medium mb-2">Payment History</h3>
                <PaymentHistory payments={booking.payments} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}