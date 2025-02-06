
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
import React from 'react';
import { Card } from '@/components/ui/card';

export default function GuestDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Guest Dashboard</h1>
      
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Booking Information</h2>
        <div className="space-y-2">
          <p>Booking Reference: #12345</p>
          <p>Check-in Date: 2024-02-15</p>
          <p>Check-out Date: 2024-02-20</p>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Payment Details</h2>
        <div className="space-y-2">
          <p>Total Amount: $500</p>
          <p>Paid: $200</p>
          <p>Remaining: $300</p>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Property Information</h2>
        <div className="space-y-2">
          <p>Access Code: 1234</p>
          <p>Address: 123 Main St</p>
          <p>Check-in Instructions: Please use the provided access code at the main entrance.</p>
        </div>
      </Card>
    </div>
  );
}
