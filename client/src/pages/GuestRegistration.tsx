import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { insertGuestSchema, type Property, type Guest, type Payment } from "@db/schema";
import * as z from "zod";
import GuestList from "../components/GuestList";
import PaymentEstimator from "../components/PaymentEstimator";
import PaymentHistory from "../components/PaymentHistory";
import IdScanner from "../components/IdScanner";

type FormData = z.infer<typeof insertGuestSchema>;

export default function GuestRegistration() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [selectedDates, setSelectedDates] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined
  });

  // Get propertyId from URL if it exists
  const params = new URLSearchParams(window.location.search);
  const preSelectedPropertyId = params.get('propertyId');

  const form = useForm<FormData>({
    resolver: zodResolver(insertGuestSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      propertyId: preSelectedPropertyId ? Number(preSelectedPropertyId) : undefined,
      address: "", // Add default value for required address field
      checkIn: undefined,
      checkOut: undefined,
      dateOfBirth: undefined,
      placeOfBirth: "",
      homeAddress: "",
      idNumber: "",
      idType: undefined,
      idImageUrl: "",
    },
  });

  const { data: properties } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
    queryFn: async () => {
      const response = await fetch("/api/properties");
      if (!response.ok) throw new Error("Failed to fetch properties");
      return response.json();
    }
  });

  const { data: guests = [] } = useQuery<Guest[]>({
    queryKey: ["/api/guests"],
    queryFn: async () => {
      const response = await fetch("/api/guests");
      if (!response.ok) throw new Error("Failed to fetch guests");
      return response.json();
    }
  });

  const [activeGuest, setActiveGuest] = useState<Guest | null>(null);
  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["/api/payments", activeGuest?.id],
    queryFn: async () => {
      if (!activeGuest?.id) return [];
      const response = await fetch(`/api/payments?guestId=${activeGuest.id}`);
      if (!response.ok) throw new Error("Failed to fetch payments");
      return response.json();
    },
    enabled: !!activeGuest
  });

  const selectedProperty = useMemo(() => {
    if (!properties || !form.getValues("propertyId")) return undefined;
    return properties.find(p => p.id === form.getValues("propertyId"));
  }, [properties, form.watch("propertyId")]);

  const registerGuest = useMutation({
    mutationFn: async (values: FormData) => {
      console.log('Starting guest registration with values:', values);

      if (!selectedDates.from || !selectedDates.to) {
        throw new Error("Please select your stay dates");
      }

      const formattedValues = {
        ...values,
        checkIn: selectedDates.from.toISOString(),
        checkOut: selectedDates.to.toISOString(),
        dateOfBirth: values.dateOfBirth ? new Date(values.dateOfBirth).toISOString() : null,
      };

      console.log('Sending formatted values to API:', formattedValues);

      const response = await fetch("/api/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formattedValues),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Server response error:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(errorData.message || 'Failed to register guest');
      }

      return response.json();
    },
    onSuccess: (data) => {
      console.log('Registration successful:', data);
      queryClient.invalidateQueries({ queryKey: ["/api/guests"] });
      form.reset();
      setSelectedDates({ from: undefined, to: undefined });
      toast({
        title: "Success",
        description: "Guest has been registered successfully",
      });

      // Update the redirect to go to payment plan selection page
      if (data.booking?.bookingReference && data.guest?.email) {
        setLocation(`/payment-plan?ref=${data.booking.bookingReference}&email=${data.guest.email}`);
      }
    },
    onError: (error) => {
      console.error('Form submission error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to register guest",
        variant: "destructive",
      });
    },
  });

  const handleDateSelect = (range: { from: Date | undefined; to: Date | undefined } | undefined) => {
    if (!range) {
      setSelectedDates({ from: undefined, to: undefined });
      form.setValue("checkIn", undefined);
      form.setValue("checkOut", undefined);
      return;
    }

    setSelectedDates({
      from: range.from,
      to: range.to
    });

    if (range.from) {
      form.setValue("checkIn", range.from);
    }
    if (range.to) {
      form.setValue("checkOut", range.to);
    }
  };

  async function onSubmit(values: FormData) {
    try {
      console.log('Form submission started with values:', values);

      if (!selectedDates.from || !selectedDates.to) {
        toast({
          title: "Error",
          description: "Please select your stay dates",
          variant: "destructive",
        });
        return;
      }

      if (!values.propertyId) {
        toast({
          title: "Error",
          description: "Please select a property",
          variant: "destructive",
        });
        return;
      }

      await registerGuest.mutateAsync(values);
    } catch (error) {
      console.error('Form submission error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to register guest",
        variant: "destructive",
      });
    }
  }

  const uploadIdImage = async (file: File) => {
    const formData = new FormData();
    formData.append("idImage", file);

    const response = await fetch("/api/upload/id-image", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) throw new Error("Failed to upload ID image");
    const data = await response.json();
    return data.url;
  };

  const handleExtractedData = (data: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    placeOfBirth?: string;
    idNumber?: string;
    homeAddress?: string;
    idType?: 'passport' | 'national_id';
  }) => {
    console.log('Received extracted data:', data);

    // Helper function to safely set form values
    const setFormValue = (key: keyof FormData, value: any) => {
      if (value) {
        console.log(`Setting ${key}:`, value);
        if (key === 'dateOfBirth' && typeof value === 'string') {
          // Parse the date string to a Date object
          try {
            const [day, month, year] = value.split(/[-./]/).map(Number);
            // Assume 20xx for two-digit years, 19xx for others
            const fullYear = year < 100 ? (year < 50 ? 2000 + year : 1900 + year) : year;
            const date = new Date(fullYear, month - 1, day);
            if (!isNaN(date.getTime())) {
              form.setValue(key, date);
            }
          } catch (error) {
            console.error('Failed to parse date:', value, error);
          }
        } else {
          form.setValue(key, value);
        }
      }
    };

    // Set each field individually
    setFormValue('firstName', data.firstName);
    setFormValue('lastName', data.lastName);
    setFormValue('dateOfBirth', data.dateOfBirth);
    setFormValue('placeOfBirth', data.placeOfBirth);
    setFormValue('idNumber', data.idNumber);
    setFormValue('homeAddress', data.homeAddress);
    setFormValue('idType', data.idType);

    // Force form validation after setting values
    form.trigger();
  };

  const handleIdImageCaptured = async (file: File) => {
    try {
      const imageUrl = await uploadIdImage(file);
      form.setValue("idImageUrl", imageUrl);
    } catch (error) {
      console.error('Failed to upload ID image:', error);
      toast({
        title: "Error",
        description: "Failed to upload ID image",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Guest Registration</h1>

      <Card>
        <CardHeader>
          <CardTitle>Register New Guest</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Date Selection */}
              <FormField
                control={form.control}
                name="checkIn"
                render={() => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Stay Dates</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={`w-full pl-3 text-left font-normal ${
                              !selectedDates.from && "text-muted-foreground"
                            }`}
                          >
                            {selectedDates.from ? (
                              selectedDates.to ? (
                                <>
                                  {format(selectedDates.from, "LLL dd, y")} -{" "}
                                  {format(selectedDates.to, "LLL dd, y")}
                                </>
                              ) : (
                                format(selectedDates.from, "LLL dd, y")
                              )
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="range"
                          selected={{
                            from: selectedDates.from,
                            to: selectedDates.to
                          }}
                          onSelect={handleDateSelect}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Personal Information</h3>

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
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Address</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* ID/Passport Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">ID/Passport Information</h3>

                <FormField
                  control={form.control}
                  name="idType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select ID type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="passport">Passport</SelectItem>
                          <SelectItem value="national_id">National ID</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="idNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID/Passport Number</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={field.value ? format(new Date(field.value), 'yyyy-MM-dd') : ''}
                            onChange={e => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="placeOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Place of Birth</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="homeAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Home Address</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Property Selection */}
              <FormField
                control={form.control}
                name="propertyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(Number(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a property" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {properties?.map((property) => (
                          <SelectItem
                            key={property.id}
                            value={property.id.toString()}
                          >
                            {property.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Add ID Scanner */}
              <div className="mb-6">
                <IdScanner
                  onDataExtracted={handleExtractedData}
                  onImageCaptured={handleIdImageCaptured}
                />
              </div>


              <Button 
                type="submit" 
                className="w-full"
                disabled={registerGuest.isPending}
              >
                {registerGuest.isPending ? "Registering..." : "Register Guest"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      <div className="grid gap-6 md:grid-cols-2">

        {selectedProperty && (
          <PaymentEstimator
            property={selectedProperty}
            checkIn={selectedDates.from}
            checkOut={selectedDates.to}
          />
        )}

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Recent Registrations & Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Recent Guests</h3>
                <GuestList
                  guests={guests}
                  onSelectGuest={setActiveGuest}
                  selectedGuestId={activeGuest?.id}
                />
              </div>

              {activeGuest && selectedProperty && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">
                      Payments for {activeGuest.firstName} {activeGuest.lastName}
                    </h3>
                    <Button
                      variant="outline"
                      onClick={() => setActiveGuest(null)}
                    >
                      Clear Selection
                    </Button>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Payment History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium mb-2">Pending Payments</h4>
                          <PaymentHistory
                            payments={payments.filter(p => p.status === 'pending')}
                            showActions
                          />
                        </div>

                        <div>
                          <h4 className="font-medium mb-2">Payment History</h4>
                          <PaymentHistory
                            payments={payments.filter(p => p.status !== 'pending')}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}