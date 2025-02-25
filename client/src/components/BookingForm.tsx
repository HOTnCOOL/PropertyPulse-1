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
import { Card } from "@/components/ui/card";

interface BookingFormProps {
  property: Property;
  onSuccess?: () => void;
}

const bookingFormSchema = insertBookingSchema.merge(insertGuestSchema);
type BookingFormValues = z.infer<typeof bookingFormSchema>;

export default function BookingForm({ property, onSuccess }: BookingFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined
  });

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

  const handleDateSelect = (range: { from: Date; to: Date } | undefined) => {
    setDateRange({
      from: range?.from,
      to: range?.to
    });

    if (range?.from) {
      form.setValue("checkIn", range.from);
      if (range.to) {
        form.setValue("checkOut", range.to);
      }
    }
  };

  const generateBookingReference = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const createBookingAndGuest = useMutation({
    mutationFn: async (values: BookingFormValues) => {
      try {
        if (!dateRange.from || !dateRange.to) {
          throw new Error("Please select check-in and check-out dates");
        }

        // Generate booking reference
        const bookingReference = generateBookingReference();

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
            bookingReference // Add booking reference to guest
          }),
        });

        if (!guestResponse.ok) {
          throw new Error("Failed to register guest");
        }

        const guest = await guestResponse.json();

        // Then create/update the booking with dates and amount
        const totalAmount = calculateTotalAmount(dateRange.from, dateRange.to);
        const bookingData = {
          propertyId: property.id,
          guestId: guest.guest.id, // Access guest ID from the nested structure
          checkIn: dateRange.from,
          checkOut: dateRange.to,
          status: values.status,
          totalAmount: totalAmount,
          notes: values.notes || "",
          bookingReference // Add same booking reference to booking
        };

        const bookingResponse = await fetch(`/api/bookings/${guest.booking.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bookingData),
        });

        if (!bookingResponse.ok) {
          throw new Error("Failed to update booking");
        }

        const booking = await bookingResponse.json();

        // Redirect to payment page
        window.location.href = `/guest-payment?ref=${booking.bookingReference}&email=${values.email}`;

        return booking;
      } catch (error) {
        console.error('Form submission error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      form.reset();
      setDateRange({ from: undefined, to: undefined });
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
      if (!dateRange.from || !dateRange.to) {
        toast({
          title: "Error",
          description: "Please select your stay dates",
          variant: "destructive",
        });
        return;
      }


      await createBookingAndGuest.mutateAsync({
        ...values,
        checkIn: dateRange.from,
        checkOut: dateRange.to,
      });
    } catch (error) {
      console.error('Form submission error:', error);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="p-4">
          <FormField
            control={form.control}
            name="checkIn"
            render={() => (
              <FormItem className="flex flex-col">
                <FormLabel>Select Your Stay Dates</FormLabel>
                <FormControl>
                  <Calendar
                    mode="range"
                    selected={{
                      from: dateRange.from,
                      to: dateRange.to
                    }}
                    onSelect={handleDateSelect}
                    disabled={(date) => date < new Date()}
                    numberOfMonths={2}
                    className="rounded-md border"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {dateRange.from && dateRange.to && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Check-in:</span>
                <span className="font-medium">{format(dateRange.from, "MMMM d, yyyy")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Check-out:</span>
                <span className="font-medium">{format(dateRange.to, "MMMM d, yyyy")}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t">
                <span className="font-medium">Total for {Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24))} nights:</span>
                <span className="font-medium">${calculateTotalAmount(dateRange.from, dateRange.to).toLocaleString()}</span>
              </div>
            </div>
          )}
        </Card>

        {dateRange.from && dateRange.to && (
          <div className="space-y-6">
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
              {createBookingAndGuest.isPending ? "Processing..." : "Complete Booking"}
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}