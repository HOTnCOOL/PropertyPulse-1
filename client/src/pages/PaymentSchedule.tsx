import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { addDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PaymentScheduleCalculator from "@/components/PaymentScheduleCalculator";
import { useQuery } from "@tanstack/react-query";

export default function PaymentSchedule() {
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  // Parse query params manually since we don't have useQueryParams
  const [location] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const guestId = params.get('guestId') ? parseInt(params.get('guestId') as string) : undefined;
  
  // Set default dates for the calculator
  const today = new Date();
  const [selectedDates, setSelectedDates] = useState<{
    from: Date;
    to: Date;
  }>({
    from: today,
    to: addDays(today, 23) // 23-night stay as default
  });

  // Example property data matching expected schema
  const exampleProperty = {
    id: 1,
    name: "Modern Downtown Apartment",
    description: "A beautiful apartment in the heart of downtown",
    type: "Apartment",
    capacity: "4",
    rate: "70",
    weeklyRate: "420",
    monthlyRate: "1500",
    hourlyRate: null,
    isOccupied: false,
    address: "123 Main St, San Francisco, CA 94105",
    imageUrls: [],
    amenities: "WiFi, Kitchen, Parking",
    status: "active",
    bedType: "Queen",
    bathrooms: "2",
    isActive: true,
    reservedDates: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    discountConfig: {
      monthly: {
        type: 'progressive',
        progressiveRate: 5,
        progressiveMax: 20
      },
      weekly: {
        type: 'progressive',
        progressiveRate: 5,
        progressiveMax: 20
      },
      daily: {
        type: 'progressive',
        progressiveRate: 5,
        progressiveMax: 20
      }
    }
  };

  // Fetch guest data if guestId is provided
  const { data: guest, isLoading: isGuestLoading } = useQuery({
    queryKey: ["guest", guestId],
    queryFn: async () => {
      if (!guestId) return null;
      const response = await fetch(`/api/guests/${guestId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch guest");
      }
      return response.json();
    },
    enabled: !!guestId,
  });

  useEffect(() => {
    if (guest) {
      toast({
        title: "Guest Information Loaded",
        description: `Welcome ${guest.firstName} ${guest.lastName}`,
        duration: 3000,
      });
    }
  }, [guest, toast]);

  return (
    <div className="container mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-bold">Payment Schedule</h1>
      
      {isGuestLoading ? (
        <div className="flex justify-center items-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading guest information...</span>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-8">
          {/* Guest information if available */}
          {guest && (
            <Card className="w-full md:w-1/3">
              <CardHeader>
                <CardTitle>Guest Information</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Name</dt>
                    <dd className="font-medium">{guest.firstName} {guest.lastName}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Email</dt>
                    <dd>{guest.email}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Phone</dt>
                    <dd>{guest.phone || "Not provided"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">ID/Passport</dt>
                    <dd>{guest.idNumber || "Not provided"}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}
          
          {/* Date selection card */}
          <Card className="w-full md:w-1/3">
            <CardHeader>
              <CardTitle>Select Dates</CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="range"
                selected={{
                  from: selectedDates.from,
                  to: selectedDates.to
                }}
                onSelect={(range: any) => {
                  if (range?.from && range?.to) {
                    setSelectedDates({
                      from: range.from,
                      to: range.to
                    });
                  }
                }}
                numberOfMonths={2}
              />
            </CardContent>
          </Card>
          
          {/* Payment calculator card */}
          <div className="w-full md:w-2/3">
            <PaymentScheduleCalculator 
              property={exampleProperty}
              checkIn={selectedDates.from}
              checkOut={selectedDates.to}
            />
          </div>
        </div>
      )}
    </div>
  );
}