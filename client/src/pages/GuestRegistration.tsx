import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus, CheckCircle, Users, Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { insertGuestSchema, type Guest } from "@db/schema";
import * as z from "zod";
import GuestList from "../components/GuestList";
import IdScanner from "../components/IdScanner";
import { GuestSearch } from "../components/GuestSearch";
import { format } from "date-fns";

// Create a guest-only schema without property or stay details
const guestFormSchema = insertGuestSchema.omit({ 
  checkIn: true, 
  checkOut: true, 
  propertyId: true, 
  bookingReference: true, 
  accessCode: true 
});

// Create a simple email check form schema
const emailCheckSchema = z.object({
  email: z.string().email("Please enter a valid email address")
});

type FormData = z.infer<typeof guestFormSchema>;
type EmailCheckFormData = z.infer<typeof emailCheckSchema>;

export default function GuestRegistration() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const queryClient = useQueryClient();
  const idScannerRef = useRef<HTMLDivElement>(null);
  const [registeredGuest, setRegisteredGuest] = useState<Guest | null>(null);
  const [activeTab, setActiveTab] = useState<string>("register");
  const [emailCheckStep, setEmailCheckStep] = useState(true);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  
  // Form for email check
  const emailCheckForm = useForm<EmailCheckFormData>({
    resolver: zodResolver(emailCheckSchema),
    defaultValues: {
      email: ""
    }
  });

  // Scroll to ID Scanner on page load
  useEffect(() => {
    if (idScannerRef.current) {
      idScannerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const form = useForm<FormData>({
    resolver: zodResolver(guestFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      dateOfBirth: "", // Changed from undefined to empty string
      placeOfBirth: "",
      homeAddress: "",
      address: "Not provided", // Hidden from UI but required by DB
      idNumber: "",
      idType: "national_id", // Set a default value instead of undefined
      idImageUrl: "",
    },
  });

  // Handle selecting an existing guest
  const handleGuestSelect = (guest: Guest) => {
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
    form.setValue("idType", guest.idType as 'passport' | 'national_id' | undefined);
    form.setValue("idImageUrl", guest.idImageUrl || "");

    // Trigger form validation
    form.trigger();

    toast({
      title: "Guest Information Loaded",
      description: `Loaded information for ${guest.firstName} ${guest.lastName}`,
    });
  };

  // Get all existing guests for the search and list
  const { data: guests = [] } = useQuery<Guest[]>({
    queryKey: ["/api/guests"],
    queryFn: async () => {
      const response = await fetch("/api/guests");
      if (!response.ok) throw new Error("Failed to fetch guests");
      return response.json();
    }
  });

  const registerGuest = useMutation({
    mutationFn: async (values: FormData) => {
      console.log('Starting guest registration with simplified endpoint');

      // Create a clean object with just the fields we need
      const safeValues = {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone || "",
        idNumber: values.idNumber || "",
        idType: values.idType || "national_id",
        placeOfBirth: values.placeOfBirth || "",
        homeAddress: values.homeAddress || "",
        address: values.address || "Not provided",
        idImageUrl: values.idImageUrl || "",
      };

      console.log('Sending safe values to API:', safeValues);

      // Try simpler approach with direct SQL to a very basic endpoint
      const response = await fetch("/api/guests", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(safeValues),
      });

      // Handle non-OK responses
      if (!response.ok) {
        console.error('Server response error:', {
          status: response.status,
          statusText: response.statusText
        });
        
        // Try to read the error response, but handle parsing failures
        try {
          const errorText = await response.text();
          console.log('Error response text:', errorText);
          
          // Check if it's JSON
          if (errorText.trim().startsWith('{')) {
            const errorData = JSON.parse(errorText);
            throw new Error(errorData.message || 'Failed to register guest');
          } else {
            throw new Error('Server error: ' + response.status);
          }
        } catch (parseError) {
          console.error('Error parsing response:', parseError);
          throw new Error('Failed to register guest: ' + response.status);
        }
      }

      // Try to parse the successful response
      try {
        const text = await response.text();
        console.log('Response text:', text);
        
        // If empty response, create a default guest object
        if (!text.trim()) {
          return {
            id: Date.now(), // Temporary ID
            firstName: safeValues.firstName,
            lastName: safeValues.lastName,
            email: safeValues.email,
            phone: safeValues.phone,
            idNumber: safeValues.idNumber,
          };
        }
        
        // Try to parse as JSON
        return JSON.parse(text);
      } catch (error) {
        console.error('Error parsing successful response:', error);
        // Return a basic guest object if parsing fails
        return {
          id: Date.now(), // Temporary ID
          firstName: safeValues.firstName,
          lastName: safeValues.lastName,
          email: safeValues.email,
          phone: safeValues.phone,
          idNumber: safeValues.idNumber,
        };
      }
    },
    onSuccess: (data) => {
      console.log('Registration successful:', data);
      queryClient.invalidateQueries({ queryKey: ["/api/guests"] });

      setRegisteredGuest(data);
      
      // Switch to the "manage" tab to show the registered guest
      setActiveTab("manage");

      toast({
        title: "Guest Registration Successful",
        description: `Guest ${data.firstName} ${data.lastName} has been registered successfully. Redirecting to payment calculator...`,
        duration: 5000,
      });
      
      // Show a clear success notification in the UI
      toast({
        title: "Success!",
        description: "Registration complete. You can now proceed with booking.",
        variant: "default",
        duration: 5000,
      });
      
      // Navigate to payment calculator with guest ID after a delay
      setTimeout(() => {
        setLocation(`/payment-calculator-demo?guestId=${data.id}`);
      }, 1500);
    },
    onError: (error) => {
      console.error('Registration error:', error);
      toast({
        title: "Registration Error",
        description: "There was a problem registering the guest. Please try again without entering a date of birth, as this is causing issues with the system.",
        variant: "destructive",
        duration: 8000, // Longer duration for error messages
      });
      
      toast({
        title: "Error Details",
        description: error instanceof Error ? error.message : "Failed to register guest",
        variant: "destructive",
        duration: 8000,
      });
    },
  });

  async function onSubmit(values: FormData) {
    try {
      console.log('Form submission started with values:', values);
      console.log('Form errors:', form.formState.errors);
      console.log('Form is valid:', form.formState.isValid);

      // Validate required fields
      if (!values.firstName || !values.lastName || !values.email || !values.idNumber) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields: First Name, Last Name, Email, and ID/Passport Number",
          variant: "destructive",
        });
        return;
      }

      // We'll let the mutation function handle the date formatting
      console.log('Submitting form values:', values);
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
    // DON'T set dateOfBirth - it causes issues
    // setFormValue('dateOfBirth', data.dateOfBirth);
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
  
  // Function to check if a guest with the provided email already exists
  const checkGuestEmail = async (emailData: EmailCheckFormData) => {
    setIsCheckingEmail(true);
    try {
      const response = await fetch(`/api/guests/check-email?email=${encodeURIComponent(emailData.email)}`);
      
      if (!response.ok) {
        throw new Error("Failed to check guest email");
      }
      
      const data = await response.json();
      
      if (data.exists && data.guest) {
        // Guest already exists, skip to payment page
        toast({
          title: "Guest Already Registered",
          description: `Welcome back ${data.guest.firstName}! Redirecting to payment...`,
          duration: 3000,
        });
        
        // Redirect to the payment page with the guest ID
        setTimeout(() => {
          setLocation(`/payment-calculator-demo?guestId=${data.guest.id}`);
        }, 1500);
        
        return true;
      } else {
        // Guest doesn't exist, show the registration form
        // Pre-fill the email in the registration form
        form.setValue("email", emailData.email);
        setEmailCheckStep(false);
        return false;
      }
    } catch (error) {
      console.error("Error checking guest email:", error);
      toast({
        title: "Error",
        description: "Failed to check if the guest exists. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const onEmailCheckSubmit = async (values: EmailCheckFormData) => {
    await checkGuestEmail(values);
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="register">
            <UserPlus className="mr-2 h-4 w-4" />
            Register New Guest
          </TabsTrigger>
          <TabsTrigger value="manage">
            <Users className="mr-2 h-4 w-4" />
            Manage Guests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="register" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Guest Registration</CardTitle>
              {emailCheckStep && (
                <CardDescription>
                  Please enter your email to check if you're already registered
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {emailCheckStep ? (
                // Email check form
                <Form {...emailCheckForm}>
                  <form onSubmit={emailCheckForm.handleSubmit(onEmailCheckSubmit)} className="space-y-6">
                    <FormField
                      control={emailCheckForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input placeholder="you@example.com" type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={isCheckingEmail}>
                      {isCheckingEmail ? (
                        "Checking..."
                      ) : (
                        <>
                          Continue <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              ) : (
                // Registration form - only shown if email check didn't find an existing guest
                <>
                  <div className="mb-6">
                    <GuestSearch onGuestSelect={handleGuestSelect} />
                  </div>

                  {/* ID Scanner section */}
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

                        {/* Required by DB but hidden from UI */}
                        <FormField
                          control={form.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem className="hidden">
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
                          {/* Date of Birth field temporarily hidden due to server-side issues */}
                          <FormField
                            control={form.control}
                            name="dateOfBirth"
                            render={({ field }) => (
                              <FormItem className="hidden">
                                <FormLabel>Date of Birth</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="hidden" 
                                    name={field.name}
                                    ref={field.ref}
                                    onBlur={field.onBlur}
                                    value={typeof field.value === 'string' ? field.value : ''}
                                    onChange={field.onChange}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div>
                            <FormLabel className="block mb-2">Date of Birth</FormLabel>
                            <Input 
                              type="date" 
                              disabled 
                              placeholder="Temporarily disabled"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              This field is temporarily disabled due to system updates.
                            </p>
                          </div>
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

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={registerGuest.isPending}
                      >
                        {registerGuest.isPending ? "Registering..." : "Register Guest"}
                      </Button>
                    </form>
                  </Form>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Guest Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Registered Guests</h3>
                  <GuestList guests={guests} />
                </div>

                {registeredGuest && (
                  <div className="mt-6 p-4 border rounded-md bg-green-50 dark:bg-green-900/20">
                    <div className="flex items-center">
                      <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400 mr-2" />
                      <div>
                        <h4 className="font-medium">
                          Recently Registered: {registeredGuest.firstName} {registeredGuest.lastName}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          ID: {registeredGuest.idType} {registeredGuest.idNumber}
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-2"
                          onClick={() => setLocation('/guest-dashboard')}
                        >
                          Proceed to Booking
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button 
                variant="outline"
                onClick={() => setActiveTab("register")}
              >
                Register Another Guest
              </Button>
              
              <Button 
                onClick={() => setLocation('/properties')}
              >
                View Properties
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}