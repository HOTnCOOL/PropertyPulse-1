import { useState } from "react";
import { addDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import PaymentScheduleCalculator from "@/components/PaymentScheduleCalculator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PaymentCalculatorDemo() {
  // Example property data
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

  // Set default dates for the demo (today and today + 23 days)
  const today = new Date();
  const [selectedDates, setSelectedDates] = useState<{
    from: Date;
    to: Date;
  }>({
    from: today,
    to: addDays(today, 23) // 23-night stay for the example
  });

  // For comparison, show both the original and new calculator
  return (
    <div className="container mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-bold">Payment Calculator Demo</h1>
      
      <div className="flex flex-col md:flex-row gap-8">
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
    </div>
  );
}