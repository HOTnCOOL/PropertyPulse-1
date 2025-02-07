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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { insertGuestSchema, type Property, type Guest, type Payment } from "@db/schema";
import GuestList from "../components/GuestList";
import PaymentEstimator from "../components/PaymentEstimator";
import PaymentHistory from "../components/PaymentHistory";
import PaymentRegistration from "../components/PaymentRegistration";
import DocumentUpload from "../components/DocumentUpload";
import AdditionalServices from "../components/AdditionalServices";
import BookingSummaryWidget from "../components/BookingSummaryWidget";
import type { Service } from "../components/AdditionalServices";

// Add type for accompanying guest
interface AccompanyingGuest {
  firstName: string;
  lastName: string;
  documentFiles: File[];
}

export default function GuestRegistration() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [selectedDates, setSelectedDates] = useState<{
    checkIn?: Date;
    checkOut?: Date;
  }>({});
  const [activeGuest, setActiveGuest] = useState<Guest | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [showAccompanying, setShowAccompanying] = useState(false);
  const [accompanyingGuests, setAccompanyingGuests] = useState<AccompanyingGuest[]>([{
    firstName: "",
    lastName: "",
    documentFiles: [] as File[]
  }]);

  // Get propertyId from URL if it exists
  const params = new URLSearchParams(window.location.search);
  const preSelectedPropertyId = params.get('propertyId');

  const form = useForm<typeof insertGuestSchema._type>({
    resolver: zodResolver(insertGuestSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      propertyId: preSelectedPropertyId ? Number(preSelectedPropertyId) : undefined,
      checkIn: undefined as unknown as Date,
      checkOut: undefined as unknown as Date,
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

  const selectedProperty = useMemo(() => {
    if (!properties || !form.getValues("propertyId")) return undefined;
    return properties.find(p => p.id === form.getValues("propertyId"));
  }, [properties, form.watch("propertyId")]);

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ['/api/payments', activeGuest?.id],
    queryFn: async () => {
      if (!activeGuest?.id) return [];
      const response = await fetch(`/api/payments?guestId=${activeGuest.id}`);
      if (!response.ok) throw new Error("Failed to fetch payments");
      return response.json();
    },
    enabled: !!activeGuest,
  });

  const registerGuest = useMutation({
    mutationFn: async (values: FormData) => {
      const response = await fetch("/api/guests", {
        method: "POST",
        body: values,
      });
      if (!response.ok) throw new Error("Failed to register guest");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/guests"] });
      form.reset();
      setSelectedDates({});
      toast({
        title: "Success",
        description: "Guest has been registered successfully",
      });

      // Redirect to payment page with the booking reference and email
      if (data.booking?.bookingReference && data.guest?.email) {
        setLocation(`/payment?ref=${data.booking.bookingReference}&email=${data.guest.email}`);
      } else {
        console.error('Missing booking reference or email in response:', data);
      }
    },
    onError: (error) => {
      console.error('Registration error:', error);
      toast({
        title: "Error",
        description: "Failed to register guest",
        variant: "destructive",
      });
    },
  });

  async function onSubmit(values: typeof insertGuestSchema._type) {
    const formData = new FormData();

    // Convert form values to appropriate string format
    Object.entries(values).forEach(([key, value]) => {
      if (value instanceof Date) {
        formData.append(key, value.toISOString());
      } else if (typeof value === 'number') {
        formData.append(key, value.toString());
      } else if (value) {
        formData.append(key, value);
      }
    });

    // Append main guest documents
    uploadedFiles.forEach(file => {
      formData.append('documents', file);
    });

    // Append accompanying guests data and documents
    if (showAccompanying) {
      accompanyingGuests.forEach((guest, index) => {
        formData.append(`accompanyingGuests[${index}][firstName]`, guest.firstName);
        formData.append(`accompanyingGuests[${index}][lastName]`, guest.lastName);
        guest.documentFiles.forEach(file => {
          formData.append(`accompanyingGuests[${index}][documents]`, file);
        });
      });
    }

    // Append selected services
    formData.append('services', JSON.stringify(selectedServices));

    registerGuest.mutate(formData);
  }

  const { data: estimates } = useQuery({
    queryKey: ["/api/estimates", selectedProperty?.id, form.watch("checkIn"), form.watch("checkOut")],
    queryFn: async () => {
      if (!selectedProperty?.id || !form.watch("checkIn") || !form.watch("checkOut")) {
        return null
      }
      const response = await fetch(`/api/estimates?propertyId=${selectedProperty.id}&checkIn=${form.watch("checkIn")}&checkOut=${form.watch("checkOut")}`);
      if (!response.ok) throw new Error("Failed to fetch estimates");
      return response.json();
    },
    enabled: !!selectedProperty && !!form.watch("checkIn") && !!form.watch("checkOut"),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Guest Registration</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Register New Guest</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

                <FormField
                  control={form.control}
                  name="propertyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Property</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(Number(value))}
                        value={field.value?.toString() || ""}
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="checkIn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Check In</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={`w-full pl-3 text-left font-normal ${
                                  !field.value && "text-muted-foreground"
                                }`}
                              >
                                {field.value ? (
                                  format(field.value, "PP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(date) => {
                                field.onChange(date);
                                setSelectedDates((prev) => ({
                                  ...prev,
                                  checkIn: date,
                                }));
                              }}
                              disabled={(date) =>
                                date < new Date() ||
                                (selectedDates.checkOut
                                  ? date > selectedDates.checkOut
                                  : false)
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="checkOut"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Check Out</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={`w-full pl-3 text-left font-normal ${
                                  !field.value && "text-muted-foreground"
                                }`}
                              >
                                {field.value ? (
                                  format(field.value, "PP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(date) => {
                                field.onChange(date);
                                setSelectedDates((prev) => ({
                                  ...prev,
                                  checkOut: date,
                                }));
                              }}
                              disabled={(date) =>
                                (selectedDates.checkIn
                                  ? date < selectedDates.checkIn
                                  : date < new Date())
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" className="w-full">
                  Register Guest
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <DocumentUpload
          onUpload={setUploadedFiles}
          uploadedFiles={uploadedFiles}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Accompanying Guests</span>
              <Button
                variant="outline"
                onClick={() => setShowAccompanying(!showAccompanying)}
              >
                {showAccompanying ? "Hide" : "Add"} Accompanying Guests
              </Button>
            </CardTitle>
          </CardHeader>
          {showAccompanying && (
            <CardContent>
              {accompanyingGuests.map((guest, index) => (
                <div key={index} className="space-y-4 mb-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <FormLabel>First Name</FormLabel>
                      <Input
                        value={guest.firstName}
                        onChange={(e) => {
                          const newGuests = [...accompanyingGuests];
                          newGuests[index].firstName = e.target.value;
                          setAccompanyingGuests(newGuests);
                        }}
                      />
                    </div>
                    <div>
                      <FormLabel>Last Name</FormLabel>
                      <Input
                        value={guest.lastName}
                        onChange={(e) => {
                          const newGuests = [...accompanyingGuests];
                          newGuests[index].lastName = e.target.value;
                          setAccompanyingGuests(newGuests);
                        }}
                      />
                    </div>
                  </div>
                  <DocumentUpload
                    onUpload={(files) => {
                      const newGuests = [...accompanyingGuests];
                      newGuests[index].documentFiles = files;
                      setAccompanyingGuests(newGuests);
                    }}
                    uploadedFiles={guest.documentFiles}
                  />
                </div>
              ))}
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setAccompanyingGuests([...accompanyingGuests, {
                  firstName: "",
                  lastName: "",
                  documentFiles: []
                }])}
              >
                Add Another Guest
              </Button>
            </CardContent>
          )}
        </Card>

        <div className="md:col-span-2">
          <AdditionalServices onServicesChange={setSelectedServices} />
        </div>

        <BookingSummaryWidget
          baseAmount={estimates?.finalAmount || 0}
          selectedServices={selectedServices}
          onProceedToPayment={() => {
            if (form.formState.isValid) {
              form.handleSubmit(onSubmit)();
            }
          }}
          minimumPayment={estimates?.periods[0]?.amount || 0}
        />
      </div>

      {selectedProperty && (
        <PaymentEstimator
          property={selectedProperty}
          checkIn={form.watch("checkIn")}
          checkOut={form.watch("checkOut")}
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
                guests={guests.slice(0, 5)}
                onSelectGuest={(guest) => setActiveGuest(guest)}
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
                    <CardTitle>Register New Payment</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PaymentRegistration
                      guestId={activeGuest.id}
                      property={selectedProperty}
                      booking={null}
                      onSuccess={() => {
                        queryClient.invalidateQueries({
                          queryKey: ['/api/payments', activeGuest.id]
                        });
                      }}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Payment History & Pending Payments</CardTitle>
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
  );
}