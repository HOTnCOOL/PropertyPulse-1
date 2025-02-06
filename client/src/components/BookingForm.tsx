import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { type Property, insertBookingSchema } from "@db/schema";
import * as z from "zod";

interface BookingFormProps {
  property: Property;
  onSuccess?: () => void;
}

export default function BookingForm({ property, onSuccess }: BookingFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDates, setSelectedDates] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });

  const form = useForm<z.infer<typeof insertBookingSchema>>({
    resolver: zodResolver(insertBookingSchema),
    defaultValues: {
      propertyId: property.id,
      notes: "",
      status: "pending",
      totalAmount: 0,
    },
  });

  const { data: availabilityData } = useQuery({
    queryKey: [
      `/api/properties/${property.id}/availability`,
      selectedDates?.from?.toISOString(),
      selectedDates?.to?.toISOString(),
    ],
    queryFn: async () => {
      if (!selectedDates?.from || !selectedDates?.to) return null;
      try {
        const response = await fetch(
          `/api/properties/${property.id}/availability?start=${selectedDates.from.toISOString()}&end=${selectedDates.to.toISOString()}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch availability");
        }
        return response.json();
      } catch (error) {
        console.error('Error fetching availability:', error);
        throw error;
      }
    },
    enabled: !!selectedDates?.from && !!selectedDates?.to,
  });

  const createBooking = useMutation({
    mutationFn: async (values: z.infer<typeof insertBookingSchema>) => {
      try {
        if (!selectedDates.from || !selectedDates.to) {
          throw new Error("Please select check-in and check-out dates");
        }

        const bookingData = {
          propertyId: property.id,
          checkIn: selectedDates.from.toISOString(),
          checkOut: selectedDates.to.toISOString(),
          status: "pending",
          totalAmount: calculateTotalAmount(selectedDates.from, selectedDates.to),
          notes: values.notes || "",
        };

        console.log('Submitting booking data:', bookingData);

        const response = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bookingData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to create booking");
        }

        return response.json();
      } catch (error) {
        console.error('Booking submission error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      form.reset();
      setSelectedDates({ from: undefined, to: undefined });
      toast({
        title: "Success",
        description: "Booking request submitted successfully",
      });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Booking Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function calculateTotalAmount(from: Date, to: Date) {
    const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    return days * Number(property.rate);
  }

  async function onSubmit(values: z.infer<typeof insertBookingSchema>) {
    try {
      await createBooking.mutateAsync(values);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="checkIn"
          render={() => (
            <FormItem>
              <FormLabel>Select Dates</FormLabel>
              <FormControl>
                <Calendar
                  mode="range"
                  selected={{
                    from: selectedDates.from,
                    to: selectedDates.to,
                  }}
                  onSelect={(range) => {
                    setSelectedDates({
                      from: range?.from,
                      to: range?.to,
                    });
                  }}
                  disabled={(date) => {
                    if (date < new Date()) return true;
                    if (availabilityData) {
                      const dateStr = date.toISOString().split('T')[0];
                      const dateInfo = availabilityData.find((d: any) =>
                        d.date.startsWith(dateStr)
                      );
                      return dateInfo ? !dateInfo.available : false;
                    }
                    return false;
                  }}
                  className="rounded-md border"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedDates?.from && selectedDates?.to && (
          <>
            <div className="text-sm">
              <p>Check-in: {format(selectedDates.from, "MMM dd, yyyy")}</p>
              <p>Check-out: {format(selectedDates.to, "MMM dd, yyyy")}</p>
              <p className="font-semibold mt-2">
                Total: ${calculateTotalAmount(selectedDates.from, selectedDates.to)}
              </p>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Any special requests?" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={createBooking.isPending}
            >
              {createBooking.isPending ? "Submitting..." : "Request Booking"}
            </Button>
          </>
        )}
      </form>
    </Form>
  );
}
