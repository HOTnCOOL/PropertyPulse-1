import { useState, useMemo, useCallback } from "react";
import { createWorker } from 'tesseract.js';
import { Upload } from "lucide-react";
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
import cn from 'classnames';


export default function GuestRegistration() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [activeGuest, setActiveGuest] = useState<Guest | null>(null);
  const [isProcessingDocument, setIsProcessingDocument] = useState(false);
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);

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

  const form = useForm({
    resolver: zodResolver(insertGuestSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      dateOfBirth: undefined,
      placeOfBirth: "",
      address: "",
      documentNumber: "",
      documentType: "passport",
      documentImageUrl: "",
      propertyId: preSelectedPropertyId ? Number(preSelectedPropertyId) : undefined as unknown as number,
      checkIn: undefined,
      checkOut: undefined,
    },
  });

  const processDocument = useCallback(async (file: File) => {
    try {
      setIsProcessingDocument(true);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setDocumentPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload to S3
      const formData = new FormData();
      formData.append('file', file);
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const { url } = await uploadResponse.json();
      form.setValue('documentImageUrl', url);

      // Process with Tesseract
      const worker = await createWorker();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();

      // Extract information from OCR text
      const extractInfo = (text: string) => {
        const lines = text.split('\n');
        let info = {
          documentNumber: '',
          name: '',
          dateOfBirth: '',
          placeOfBirth: '',
        };

        lines.forEach(line => {
          // Document number (various formats)
          const docMatch = line.match(/[A-Z0-9]{6,}/);
          if (docMatch) {
            info.documentNumber = docMatch[0];
          }
          
          // Name (assuming format: "Name: John Doe" or just "John Doe")
          const nameMatch = line.match(/(?:Name:|^)\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/);
          if (nameMatch) {
            info.name = nameMatch[1];
            const [firstName, lastName] = nameMatch[1].split(' ');
            form.setValue('firstName', firstName);
            form.setValue('lastName', lastName);
          }
          
          // Date of birth (various formats)
          const dobMatch = line.match(/(?:DOB|Date of Birth|Born):\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i) ||
                          line.match(/(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/);
          if (dobMatch) {
            info.dateOfBirth = dobMatch[1];
            try {
              const date = new Date(dobMatch[1]);
              if (!isNaN(date.getTime())) {
                form.setValue('dateOfBirth', date);
              }
            } catch (e) {
              console.error('Failed to parse date:', e);
            }
          }
          
          // Place of birth
          const pobMatch = line.match(/(?:Place of Birth|Born in):\s*(.+)/i);
          if (pobMatch) {
            info.placeOfBirth = pobMatch[1];
            form.setValue('placeOfBirth', pobMatch[1]);
          }
        });

        return info;
      };

      const extractedInfo = extractInfo(text);

      // Update form with extracted information
      if (extractedInfo.documentNumber) {
        form.setValue('documentNumber', extractedInfo.documentNumber);
      }
      if (extractedInfo.dateOfBirth) {
        form.setValue('dateOfBirth', new Date(extractedInfo.dateOfBirth));
      }

      toast({
        title: "Document Processed",
        description: "Information has been extracted from the document",
      });
    } catch (error) {
      console.error('Document processing error:', error);
      toast({
        title: "Error",
        description: "Failed to process document",
        variant: "destructive",
      });
    } finally {
      setIsProcessingDocument(false);
    }
  }, [form, toast]);

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
    mutationFn: async (values: typeof insertGuestSchema._type) => {
      console.log('Registering guest with values:', values);
      const response = await fetch("/api/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error("Failed to register guest");
      const data = await response.json();
      console.log('Registration response:', data);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/guests"] });
      form.reset();
      setSelectedDates({from: undefined, to: undefined});
      toast({
        title: "Success",
        description: "Guest has been registered successfully",
      });

      // Redirect to payment page with the booking reference and email
      if (data.booking?.bookingReference && data.guest?.email) {
        console.log('Redirecting to payment page with:', data);
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
    try {
      if (!selectedDates.from || !selectedDates.to) {
        toast({
          title: "Error",
          description: "Please select your stay dates",
          variant: "destructive",
        });
        return;
      }

      // Update form values with selected dates
      form.setValue("checkIn", selectedDates.from);
      form.setValue("checkOut", selectedDates.to);

      await registerGuest.mutateAsync({
        ...values,
        checkIn: selectedDates.from,
        checkOut: selectedDates.to,
      });
    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: "Error",
        description: "Failed to register guest",
        variant: "destructive",
      });
    }
  }

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
                {/* Document Upload Section */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="documentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Document Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select document type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="passport">Passport</SelectItem>
                            <SelectItem value="id">ID Card</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <FormLabel>Upload Document</FormLabel>
                    <div className="flex items-center gap-4">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            processDocument(file);
                          }
                        }}
                        className="hidden"
                        id="document-upload"
                      />
                      <label
                        htmlFor="document-upload"
                        className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-accent"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Upload Document</span>
                      </label>
                      {isProcessingDocument && <span className="text-sm text-muted-foreground">Processing...</span>}
                    </div>
                    {documentPreview && (
                      <div className="mt-4">
                        <img
                          src={documentPreview}
                          alt="Document preview"
                          className="max-w-full h-auto rounded-md"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Document Information */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="documentNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Document Number</FormLabel>
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
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
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
                                onSelect={field.onChange}
                                disabled={(date) =>
                                  date > new Date() || date < new Date("1900-01-01")
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

                <FormField
                  control={form.control}
                  name="checkIn"
                  render={() => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Stay Dates</FormLabel>
                      <FormControl>
                        <Calendar
                          mode="range"
                          selected={selectedDates}
                          onSelect={(range) => {
                            setSelectedDates(range ?? { from: undefined, to: undefined });
                            if (range?.from) {
                              form.setValue("checkIn", range.from);
                              if (range.to) {
                                form.setValue("checkOut", range.to);
                              }
                            }
                          }}
                          disabled={(date) => date < new Date()}
                          numberOfMonths={2}
                          className="rounded-md border"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedDates.from && selectedDates.to && (
                  <div className="space-y-2 p-4 bg-muted rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Check-in:</span>
                      <span className="font-medium">
                        {format(selectedDates.from, "MMMM d, yyyy")}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Check-out:</span>
                      <span className="font-medium">
                        {format(selectedDates.to, "MMMM d, yyyy")}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t">
                      <span className="font-medium">
                        Total nights:
                      </span>
                      <span className="font-medium">
                        {Math.ceil((selectedDates.to.getTime() - selectedDates.from.getTime()) / (1000 * 60 * 60 * 24))}
                      </span>
                    </div>
                  </div>
                )}

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

                <Button type="submit" className="w-full">
                  Register Guest
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

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
    </div>
  );
}