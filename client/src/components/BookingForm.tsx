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
import { type Property, insertBookingSchema, type NewBooking } from "@db/schema";
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

  const form = useForm<NewBooking>({
    resolver: zodResolver(insertBookingSchema),
    defaultValues: {
      propertyId: property.id,
      notes: "",
      status: "pending",
      totalAmount: 0,
    },
  });

  const { data: availabilityData, isError: availabilityError } = useQuery({
    queryKey: [
      `/api/properties/${property.id}/availability`,
      selectedDates?.from?.toISOString(),
      selectedDates?.to?.toISOString(),
    ],
    queryFn: async () => {
      if (!selectedDates?.from || !selectedDates?.to) return null;
      const response = await fetch(
        `/api/properties/${property.id}/availability?start=${selectedDates.from.toISOString()}&end=${selectedDates.to.toISOString()}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch availability");
      }
      return response.json();
    },
    enabled: !!selectedDates?.from && !!selectedDates?.to,
    retry: false,
  });

  const createBooking = useMutation({
    mutationFn: async (values: NewBooking) => {
      try {
        const response = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Failed to create booking");
        }

        return response.json();
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(error.message);
        }
        throw new Error("An unexpected error occurred");
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
        description: error.message || "Failed to create booking. Please try again.",
        variant: "destructive",
      });
    },
  });

  function calculateTotalAmount(from: Date, to: Date) {
    const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    return days * Number(property.rate);
  }

  async function onSubmit(values: NewBooking) {
    if (!selectedDates?.from || !selectedDates?.to) {
      toast({
        title: "Error",
        description: "Please select check-in and check-out dates",
        variant: "destructive",
      });
      return;
    }

    if (availabilityError) {
      toast({
        title: "Error",
        description: "Failed to verify availability. Please try again.",
        variant: "destructive",
      });
      return;
    }

    const hasUnavailableDates = availabilityData?.some(
      (date: { available: boolean }) => !date.available
    );

    if (hasUnavailableDates) {
      toast({
        title: "Error",
        description: "Selected dates are not available",
        variant: "destructive",
      });
      return;
    }

    try {
      await createBooking.mutateAsync({
        ...values,
        checkIn: selectedDates.from,
        checkOut: selectedDates.to,
        totalAmount: calculateTotalAmount(selectedDates.from, selectedDates.to),
      });
    } catch (error) {
      // Error is handled by mutation's onError callback
      console.error('Booking submission error:', error);
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
                    if (range?.from) {
                      setSelectedDates({
                        from: range.from,
                        to: range.to,
                      });
                      form.setValue("checkIn", range.from);
                      if (range.to) {
                        form.setValue("checkOut", range.to);
                      }
                    }
                  }}
                  disabled={{
                    before: new Date(),
                    dates: availabilityData
                      ?.filter((date: { available: boolean }) => !date.available)
                      .map((date: { date: string }) => new Date(date.date)),
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