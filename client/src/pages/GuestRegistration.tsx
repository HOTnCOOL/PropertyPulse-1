import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { insertGuestSchema, type Guest, type Payment, type Property } from "@db/schema";
import * as z from "zod";
import GuestList from "../components/GuestList";
import PaymentHistory from "../components/PaymentHistory";
import IdScanner from "../components/IdScanner";
import { GuestSearch } from "../components/GuestSearch";

// Modify the form data type to not require check-in/check-out
type FormData = Omit<z.infer<typeof insertGuestSchema>, 'checkIn' | 'checkOut'>;

export default function GuestRegistration() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const idScannerRef = useRef<HTMLDivElement>(null);
  const [selectedDates, setSelectedDates] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined
  });

  const [showStayDates, setShowStayDates] = useState(false);
  const [registeredGuest, setRegisteredGuest] = useState<any>(null);

  const params = new URLSearchParams(window.location.search);
  const preSelectedPropertyId = params.get('propertyId');

  const form = useForm<FormData>({
    resolver: zodResolver(insertGuestSchema.omit({ checkIn: true, checkOut: true })),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      propertyId: preSelectedPropertyId ? Number(preSelectedPropertyId) : undefined,
      dateOfBirth: undefined,
      placeOfBirth: "",
      homeAddress: "",
      // Default value for address (hidden from UI but required by DB)
      address: "Not provided", 
      idNumber: "",
      idType: undefined,
      idImageUrl: "",
    },
  });

  // Scroll to ID Scanner on page load
  useEffect(() => {
    if (idScannerRef.current) {
      idScannerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Handle selecting an existing guest
  const handleGuestSelect = (guest: any) => {
    // Populate the form with the selected guest's information
    form.setValue("firstName", guest.firstName);
    form.setValue("lastName", guest.lastName);
    form.setValue("email", guest.email);
    form.setValue("phone", guest.phone || "");
    form.setValue("dateOfBirth", guest.dateOfBirth ? new Date(guest.dateOfBirth) : undefined);
    form.setValue("placeOfBirth", guest.placeOfBirth || "");
    form.setValue("homeAddress", guest.homeAddress || "");
    form.setValue("address", guest.address || "Not provided");
    form.setValue("idNumber", guest.idNumber || "");
    form.setValue("idType", guest.idType);
    form.setValue("idImageUrl", guest.idImageUrl || "");

    // Trigger form validation
    form.trigger();

    toast({
      title: "Guest Information Loaded",
      description: `Loaded information for ${guest.firstName} ${guest.lastName}`,
    });
  };

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

      // Handle dateOfBirth safely with validation
      let dateOfBirthISO = null;
      if (values.dateOfBirth) {
        try {
          const date = new Date(values.dateOfBirth);
          if (!isNaN(date.getTime())) {
            dateOfBirthISO = date.toISOString();
          }
        } catch (error) {
          console.error('Error parsing date of birth:', error);
        }
      }

      const formattedValues = {
        ...values,
        dateOfBirth: dateOfBirthISO,
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

      setRegisteredGuest(data);

      toast({
        title: "Guest Registration Successful",
        description: `Guest ${data.firstName} ${data.lastName} has been registered successfully.
                     Booking reference: ${data.bookingReference}
                     Please proceed to select stay dates below.`,
        duration: 7000,
      });

      setShowStayDates(true);

      setTimeout(() => {
        const stayDatesSection = document.querySelector('#stay-dates-section');
        if (stayDatesSection) {
          stayDatesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    },
    onError: (error) => {
      console.error('Registration error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to register guest",
        variant: "destructive",
      });
    },
  });

  async function onSubmit(values: FormData) {
    try {
      console.log('Form submission started with values:', values);
      console.log('Form errors:', form.formState.errors);
      console.log('Form is valid:', form.formState.isValid);

      // Validate required fields
      if (!values.firstName || !values.lastName || !values.email || !values.idNumber || !values.propertyId) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields: First Name, Last Name, Email, ID/Passport, and Property",
          variant: "destructive",
        });
        return;
      }

      // Create the guest registration payload with safe date handling
      let dateOfBirthISO = null;
      if (values.dateOfBirth) {
        try {
          const date = new Date(values.dateOfBirth);
          if (!isNaN(date.getTime())) {
            dateOfBirthISO = date.toISOString();
          }
        } catch (error) {
          console.error('Error parsing dateOfBirth:', error);
        }
      }
      
      const guestData = {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone || "",
        propertyId: values.propertyId,
        dateOfBirth: dateOfBirthISO,
        placeOfBirth: values.placeOfBirth || "",
        homeAddress: values.homeAddress || "",
        // Include address field for database compatibility
        address: values.address || "Not provided", 
        idNumber: values.idNumber,
        idType: values.idType || undefined,
        idImageUrl: values.idImageUrl || "",
      };

      console.log('Submitting guest data:', guestData);

      await registerGuest.mutateAsync(guestData);
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
    personalNumber?: string;
    nationality?: string;
    idType?: 'passport' | 'national_id';
    expiryDate?: string;
  }) => {
    console.log('Received extracted data from OCR:', data);

    const setFormValue = (key: keyof FormData, value: any) => {
      if (!value) return;
      
      console.log(`Setting ${key}:`, value);
      
      if (key === 'dateOfBirth' && typeof value === 'string') {
        try {
          // Handle multiple date formats - try to detect and normalize
          let date;
          
          // Check if date has ISO format
          if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
            date = new Date(value);
          } 
          // Check for DD.MM.YYYY format
          else if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) {
            const [day, month, year] = value.split('.').map(Number);
            date = new Date(year, month - 1, day);
          }
          // Check for DD/MM/YYYY format
          else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
            const [day, month, year] = value.split('/').map(Number);
            date = new Date(year, month - 1, day);
          }
          // Check for DD-MM-YYYY format
          else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(value)) {
            const [day, month, year] = value.split('-').map(Number);
            date = new Date(year, month - 1, day);
          }
          // Other formats - try generic parsing
          else {
            const parts = value.split(/[-./]/).map(Number);
            if (parts.length >= 3) {
              // Try both DMY and MDY formats
              let dateFormats = [];
              
              // Try Day-Month-Year
              const dmyDate = new Date(parts[2], parts[1] - 1, parts[0]);
              if (!isNaN(dmyDate.getTime())) {
                dateFormats.push(dmyDate);
              }
              
              // Try Month-Day-Year
              const mdyDate = new Date(parts[2], parts[0] - 1, parts[1]);
              if (!isNaN(mdyDate.getTime())) {
                dateFormats.push(mdyDate);
              }
              
              // Try Year-Month-Day (if year is first)
              if (parts[0] > 1900) {
                const ymdDate = new Date(parts[0], parts[1] - 1, parts[2]);
                if (!isNaN(ymdDate.getTime())) {
                  dateFormats.push(ymdDate);
                }
              }
              
              // Use the most likely date (prefer not future dates)
              if (dateFormats.length > 0) {
                const now = new Date();
                // Filter out future dates and dates more than 100 years in the past
                const validDates = dateFormats.filter(d => 
                  d <= now && d >= new Date(now.getFullYear() - 100, now.getMonth(), now.getDate())
                );
                
                if (validDates.length > 0) {
                  date = validDates[0]; // Use the first valid date
                } else {
                  date = dateFormats[0]; // Fallback to first parsed date
                }
              }
            }
          }
          
          if (date && !isNaN(date.getTime())) {
            form.setValue(key, date);
          } else {
            console.error('Failed to parse date with any format:', value);
          }
        } catch (error) {
          console.error('Failed to parse date:', value, error);
        }
      } else {
        form.setValue(key, value);
      }
    };

    // Check if we have any data to set
    const hasData = Object.values(data).some(value => value !== undefined && value !== null && value !== '');
    
    if (!hasData) {
      toast({
        title: "No Data Extracted",
        description: "Could not extract any data from the ID document. Please try again with a clearer image or enter details manually.",
        variant: "destructive"
      });
      return;
    }

    // Set all the extracted data to form fields
    setFormValue('firstName', data.firstName);
    setFormValue('lastName', data.lastName);
    setFormValue('dateOfBirth', data.dateOfBirth);
    setFormValue('placeOfBirth', data.placeOfBirth);
    setFormValue('idNumber', data.idNumber);
    setFormValue('homeAddress', data.homeAddress);
    
    // Set ID type with validation
    if (data.idType) {
      const normalizedIdType = data.idType.toLowerCase() === 'passport' ? 'passport' : 'national_id';
      setFormValue('idType', normalizedIdType);
    }
    
    // Handle Personal Number field (which might not be in the form schema but is in the UI)
    if (data.personalNumber) {
      const personalNumberField = document.querySelector('input[placeholder="Enter personal number"]') as HTMLInputElement;
      if (personalNumberField) {
        personalNumberField.value = data.personalNumber;
      }
      
      // Also store in a custom field or localStorage for later use if needed
      localStorage.setItem('lastPersonalNumber', data.personalNumber);
    }
    
    // Display nationality as a notification if available
    if (data.nationality) {
      toast({
        title: "Nationality Detected",
        description: `Detected nationality: ${data.nationality}`,
      });
      // Store for later reference
      localStorage.setItem('lastNationality', data.nationality);
    }
    
    // Display expiry date as a notification if available
    if (data.expiryDate) {
      toast({
        title: "Document Expiry Date",
        description: `ID/Passport expires: ${data.expiryDate}`,
      });
      
      // Store for later reference
      localStorage.setItem('lastExpiryDate', data.expiryDate);
    }

    // Validate the form after setting values
    form.trigger();
    
    // Show summary of extracted data
    toast({
      title: "Data Extracted Successfully",
      description: `Found data for: ${Object.entries(data)
        .filter(([_, v]) => v)
        .map(([k]) => k)
        .join(', ')}`,
      duration: 5000,
    });
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

  // Fixed type error with the date range handler for Calendar component
  const handleDateSelect = (range: any) => {
    if (!range) {
      setSelectedDates({ from: undefined, to: undefined });
      return;
    }

    setSelectedDates({
      from: range.from ? new Date(range.from) : undefined,
      to: range.to ? new Date(range.to) : undefined
    });
  };


  return (
    <div className="space-y-6">
      {/* Registration Section */}
      <div className={`transition-opacity duration-300 ${showStayDates ? 'opacity-50' : 'opacity-100'}`}>
        <h1 className="text-3xl font-bold">Guest Registration</h1>

        <Card>
          <CardHeader>
            <CardTitle>Register New Guest</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <GuestSearch onGuestSelect={handleGuestSelect} />
            </div>

            {/* ID Scanner section - Moved to the top */}
            <div className="mb-6" ref={idScannerRef}>
              <h3 className="text-lg font-medium mb-3">Scan ID/Passport</h3>
              <IdScanner
                onDataExtracted={handleExtractedData}
                onImageCaptured={handleIdImageCaptured}
              />
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Personal Information</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name *</FormLabel>
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
                          <FormLabel>Last Name *</FormLabel>
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
                          <FormLabel>Email *</FormLabel>
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

                  {/* Personal Number field - Added */}
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem className="hidden">
                        {/* Hidden address field - required by DB but hidden from UI */}
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Personal Number field - just UI, not connected to DB yet */}
                  <FormItem>
                    <FormLabel>Personal Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter personal number" />
                    </FormControl>
                  </FormItem>
                </div>

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
                        <FormLabel>ID/Passport Number *</FormLabel>
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

                <FormField
                  control={form.control}
                  name="propertyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Property *</FormLabel>
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
      </div>

      {/* Stay Dates Section */}
      <div
        id="stay-dates-section"
        className={`transition-all duration-300 ${
          showStayDates ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform -translate-y-4 pointer-events-none'
        }`}
      >
        <Card>
          <CardHeader>
            <CardTitle>Stay Dates</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="space-y-4">
                <FormItem className="flex flex-col">
                  <FormLabel>Select Your Stay Dates</FormLabel>
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
                      {/* @ts-ignore - type mismatch between Calendar and our range handler */}
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
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="grid gap-6 mt-6 w-full">
          {selectedProperty && (
            <div className="payment-schedule-calculator w-full md:col-span-2">
              <PaymentScheduleCalculator
                property={selectedProperty}
                checkIn={selectedDates.from}
                checkOut={selectedDates.to}
              />
            </div>
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
    </div>
  );
}