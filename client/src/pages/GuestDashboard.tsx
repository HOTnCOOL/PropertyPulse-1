import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import PaymentHistory from "../components/PaymentHistory";
import { MapPin, Key, Calendar, Info } from "lucide-react";

export default function GuestDashboard() {
  const { toast } = useToast();
  const bookingRef = new URLSearchParams(window.location.search).get('ref');
  const email = new URLSearchParams(window.location.search).get('email');

  const { data: booking } = useQuery({
    queryKey: ['/api/bookings/guest', bookingRef, email],
    enabled: !!bookingRef && !!email,
  });

  if (!booking) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Welcome, {booking.guest.firstName}!</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Booking Reference</h3>
                <p className="text-muted-foreground">{booking.reference}</p>
              </div>
              <div>
                <h3 className="font-medium">Property</h3>
                <p className="text-muted-foreground">{booking.property.name}</p>
              </div>
              <div className="flex gap-4">
                <div>
                  <h3 className="font-medium">Check-in</h3>
                  <p className="text-muted-foreground">
                    {new Date(booking.checkIn).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <h3 className="font-medium">Check-out</h3>
                  <p className="text-muted-foreground">
                    {new Date(booking.checkOut).toLocaleDateString()}
                  </p>
                </div>
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
              <div>
                <h3 className="font-medium">Door Code</h3>
                <p className="text-muted-foreground">{booking.property.doorCode}</p>
              </div>
              <div>
                <h3 className="font-medium">Check-in Instructions</h3>
                <p className="text-muted-foreground">{booking.property.checkInInstructions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location & Directions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Address</h3>
                <p className="text-muted-foreground">{booking.property.address}</p>
              </div>
              <div>
                <h3 className="font-medium">How to Reach</h3>
                <p className="text-muted-foreground">{booking.property.directions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentHistory payments={booking.payments} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}