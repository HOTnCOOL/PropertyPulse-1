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
import { type Property, insertBookingSchema, insertGuestSchema } from "@db/schema";
import * as z from "zod";

interface BookingFormProps {
  property: Property;
  onSuccess?: () => void;
}

const bookingFormSchema = insertBookingSchema.merge(insertGuestSchema);
type BookingFormValues = z.infer<typeof bookingFormSchema>;

export default function BookingForm({ property, onSuccess }: BookingFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDates, setSelectedDates] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      propertyId: property.id,
      notes: "",
      status: "pending",
      totalAmount: 0,
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      checkIn: undefined,
      checkOut: undefined,
    },
  });

  const createBookingAndGuest = useMutation({
    mutationFn: async (values: BookingFormValues) => {
      try {
        if (!selectedDates.from || !selectedDates.to) {
          throw new Error("Please select check-in and check-out dates");
        }

        // First create the guest
        const guestResponse = await fetch("/api/guests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: values.firstName,
            lastName: values.lastName,
            email: values.email,
            phone: values.phone,
            propertyId: property.id,
            checkIn: selectedDates.from,
            checkOut: selectedDates.to,
          }),
        });

        if (!guestResponse.ok) {
          throw new Error("Failed to register guest");
        }

        const guest = await guestResponse.json();

        // Then create the booking with the guest ID
        const bookingData = {
          propertyId: property.id,
          guestId: guest.id,
          checkIn: selectedDates.from,
          checkOut: selectedDates.to,
          status: values.status,
          totalAmount: calculateTotalAmount(selectedDates.from, selectedDates.to),
          notes: values.notes || "",
        };

        const bookingResponse = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bookingData),
        });

        if (!bookingResponse.ok) {
          throw new Error("Failed to create booking");
        }

        return bookingResponse.json();
      } catch (error) {
        console.error('Form submission error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      form.reset();
      setSelectedDates({ from: undefined, to: undefined });
      toast({
        title: "Success",
        description: "Booking and guest registration completed successfully",
      });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function calculateTotalAmount(from: Date, to: Date) {
    const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    return days * Number(property.rate);
  }

  async function onSubmit(values: BookingFormValues) {
    try {
      if (!selectedDates.from || !selectedDates.to) {
        toast({
          title: "Error",
          description: "Please select check-in and check-out dates",
          variant: "destructive",
        });
        return;
      }

      // Set the dates in the form values
      form.setValue("checkIn", selectedDates.from);
      form.setValue("checkOut", selectedDates.to);

      await createBookingAndGuest.mutateAsync({
        ...values,
        checkIn: selectedDates.from,
        checkOut: selectedDates.to,
      });
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
                    // Update form values when dates are selected
                    if (range?.from) {
                      form.setValue("checkIn", range.from);
                      if (range.to) {
                        form.setValue("checkOut", range.to);
                      }
                    }
                  }}
                  disabled={(date) => date < new Date()}
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

            {/* Guest Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Guest Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input type="tel" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
              disabled={createBookingAndGuest.isPending}
            >
              {createBookingAndGuest.isPending ? "Submitting..." : "Complete Booking"}
            </Button>
          </>
        )}
      </form>
    </Form>
  );
}