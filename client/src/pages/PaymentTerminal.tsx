import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parseISO } from "date-fns";
import { 
  CreditCard, 
  Building, 
  Send, 
  DollarSign, 
  Upload, 
  CheckCircle, 
  Camera, 
  ChevronRight,
  AlertCircle,
  Loader2
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

// Form schema
const paymentFormSchema = z.object({
  paymentMethod: z.enum(["credit_card", "bank_transfer", "paypal", "revolut", "cash"]),
  paymentReference: z.string().optional(),
  cardNumber: z.string().optional(),
  cardExpiry: z.string().optional(),
  cardCvc: z.string().optional(),
  cardholderName: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankName: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

export default function PaymentTerminal() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const webcamRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedDocuments, setCapturedDocuments] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const isMobile = useIsMobile();

  // Parse URL parameters
  const params = new URLSearchParams(window.location.search);
  const guestId = params.get('guestId') ? parseInt(params.get('guestId') as string) : undefined;
  const prepaidAmount = params.get('prepaidAmount') ? parseFloat(params.get('prepaidAmount')) : 0;
  const depositAmount = params.get('depositAmount') ? parseFloat(params.get('depositAmount')) : 0;
  const checkIn = params.get('checkIn') ? parseISO(params.get('checkIn') as string) : new Date();
  const checkOut = params.get('checkOut') ? parseISO(params.get('checkOut') as string) : new Date();
  const planType = (params.get('planType') || 'weekly') as 'monthly' | 'weekly' | 'daily';
  const totalSavings = params.get('totalSavings') ? parseFloat(params.get('totalSavings')) : 0;
  const bookingReference = params.get('bookingReference') || `BK-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
  const propertyId = params.get('propertyId') ? parseInt(params.get('propertyId') as string) : 1;
  const propertyName = params.get('propertyName') || 'Property';
  const prepaidPeriods = params.get('prepaidPeriods') ? 
    (params.get('prepaidPeriods') as string).split(',').map(p => parseInt(p)) : 
    [0];

  // Total amount to pay
  const totalPaymentAmount = prepaidAmount + depositAmount;

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      paymentMethod: "credit_card",
      cardNumber: "",
      cardExpiry: "",
      cardCvc: "",
      cardholderName: "",
      bankAccountName: "",
      bankAccountNumber: "",
      bankName: "",
      paymentReference: "",
      notes: "",
    },
  });

  const watchPaymentMethod = form.watch("paymentMethod");

  // Generate invoice
  const generateInvoice = () => {
    // In a real application, this would create a real invoice
    // For this demo, we'll just create a simple object
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    const today = new Date();
    
    const invoice = {
      invoiceNumber,
      bookingReference,
      date: format(today, "yyyy-MM-dd"),
      dueDate: format(today, "yyyy-MM-dd"),
      customerInfo: {
        id: guestId,
        propertyId,
        propertyName,
      },
      items: [
        {
          description: `${planType.charAt(0).toUpperCase() + planType.slice(1)} booking (${format(checkIn, "MMM d, yyyy")} - ${format(checkOut, "MMM d, yyyy")})`,
          quantity: 1,
          unitPrice: prepaidAmount,
          total: prepaidAmount
        },
        {
          description: "Security Deposit",
          quantity: 1,
          unitPrice: depositAmount,
          total: depositAmount
        }
      ],
      subtotal: prepaidAmount + depositAmount,
      discount: totalSavings,
      total: prepaidAmount + depositAmount,
      paymentMethod: form.getValues().paymentMethod,
      paymentReference: form.getValues().paymentReference || "",
      notes: form.getValues().notes || "",
      status: "PAID"
    };
    
    // In a real application, we would save this to a database
    console.log("Generated invoice:", invoice);
    
    // Return the invoice number for reference
    return invoiceNumber;
  };

  // Process payment
  const handlePayment = async (values: PaymentFormValues) => {
    setIsSubmitting(true);
    setPaymentStatus('processing');
    
    try {
      // In a real implementation, this would connect to a payment processor
      // For now, we'll just simulate a payment success
      
      // Create form data for document uploads
      const formData = new FormData();
      
      // Add payment information
      formData.append('guestId', guestId?.toString() || '');
      formData.append('paymentMethod', values.paymentMethod);
      formData.append('amount', totalPaymentAmount.toString());
      formData.append('checkIn', checkIn.toISOString());
      formData.append('checkOut', checkOut.toISOString());
      formData.append('planType', planType);
      formData.append('bookingReference', bookingReference);
      formData.append('propertyId', propertyId.toString());
      formData.append('propertyName', propertyName);
      formData.append('prepaidPeriods', JSON.stringify(prepaidPeriods));
      formData.append('paymentReference', values.paymentReference || '');
      formData.append('notes', values.notes || '');
      
      // Add payment proof documents
      capturedDocuments.forEach((file, index) => {
        formData.append('documents', file);
      });
      
      // Generate invoice
      const invoiceNumber = generateInvoice();
      formData.append('invoiceNumber', invoiceNumber);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setPaymentStatus('success');
      toast({
        title: "Payment successful!",
        description: `Your payment for booking ${bookingReference} has been processed successfully. Invoice #${invoiceNumber} has been generated.`,
      });
      
      // Redirect to success page or dashboard after 30 seconds
      // Longer delay allows users to view and copy the invoice details
      setTimeout(() => {
        if (guestId) {
          setLocation(`/guest-dashboard?guestId=${guestId}`);
        } else {
          setLocation('/');
        }
      }, 3000); // 3 seconds delay for testing (changed from 30 seconds)
    } catch (error) {
      console.error("Payment error:", error);
      setPaymentStatus('error');
      toast({
        title: "Payment failed",
        description: "There was an error processing your payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setCapturedDocuments(prev => [...prev, ...newFiles]);
    }
  };

  // Initialize camera
  const startCamera = async () => {
    try {
      setCameraActive(true);
      
      if (webcamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: isMobile ? "environment" : "user" } 
        });
        webcamRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive",
      });
      setCameraActive(false);
    }
  };

  // Capture image from camera
  const captureImage = () => {
    if (webcamRef.current && canvasRef.current) {
      const videoEl = webcamRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas dimensions to match video
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      
      // Draw video frame on canvas
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        
        // Convert to file
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File(
              [blob], 
              `payment-document-${Date.now()}.jpg`, 
              { type: 'image/jpeg' }
            );
            setCapturedDocuments(prev => [...prev, file]);
          }
        }, 'image/jpeg', 0.95);
      }
      
      // Stop camera
      stopCamera();
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (webcamRef.current && webcamRef.current.srcObject) {
      const stream = webcamRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      
      tracks.forEach(track => track.stop());
      webcamRef.current.srcObject = null;
    }
    
    setCameraActive(false);
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (webcamRef.current && webcamRef.current.srcObject) {
        const stream = webcamRef.current.srcObject as MediaStream;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  // Render different payment form based on the selected method
  const renderPaymentMethodForm = () => {
    switch (watchPaymentMethod) {
      case "credit_card":
        return (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="cardholderName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cardholder Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="cardNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Card Number</FormLabel>
                  <FormControl>
                    <Input placeholder="4242 4242 4242 4242" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cardExpiry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiration Date</FormLabel>
                    <FormControl>
                      <Input placeholder="MM/YY" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="cardCvc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CVC</FormLabel>
                    <FormControl>
                      <Input placeholder="123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        );
        
      case "bank_transfer":
        return (
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-md mb-4">
              <h4 className="font-medium mb-2">Bank Account Details</h4>
              <p className="text-sm text-muted-foreground mb-2">Please transfer to the following account:</p>
              <div className="text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="font-medium">Account Name:</div>
                  <div>Property Rentals Inc.</div>
                  <div className="font-medium">Account Number:</div>
                  <div>1234567890</div>
                  <div className="font-medium">Bank Name:</div>
                  <div>International Bank</div>
                  <div className="font-medium">SWIFT/BIC:</div>
                  <div>INTLBANK123</div>
                  <div className="font-medium">Reference:</div>
                  <div>BOOKING-{guestId || "NEW"}</div>
                </div>
              </div>
            </div>
            
            <FormField
              control={form.control}
              name="paymentReference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Reference Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter transaction reference" {...field} />
                  </FormControl>
                  <FormDescription>
                    Enter the reference number from your bank transaction
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="bankName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Bank Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Bank name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );
        
      case "paypal":
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-md mb-4 border border-blue-100">
              <h4 className="font-medium mb-2 flex items-center text-blue-700">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5 mr-2 fill-blue-600">
                  <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013 .075-.02.15-.033.224-.983 5.049-4.349 6.796-8.647 6.796h-2.19c-.524 0-.968.383-1.05.901l-1.12 7.106-.259 1.644h2.99l.697-4.43.143-.144c.276-.276.649-.43 1.04-.43h2.164c3.52 0 6.308-1.43 7.133-5.557.34-1.705.147-3.132-.6-4.135a3.242 3.242 0 0 0-.661-.434z"/>
                </svg>
                PayPal Payment Instructions
              </h4>
              <p className="text-sm text-blue-600 mb-2">Please send your payment to the following PayPal account:</p>
              <div className="text-sm text-blue-800 font-medium">
                payments@propertyrentals.com
              </div>
              <p className="text-xs text-blue-600 mt-3">Important: Include your booking reference BOOKING-{guestId || "NEW"} in the notes.</p>
            </div>
            
            <FormField
              control={form.control}
              name="paymentReference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PayPal Transaction ID</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. 5RT43628V2194174L" {...field} />
                  </FormControl>
                  <FormDescription>
                    Enter the transaction ID from your PayPal receipt
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );
        
      case "revolut":
        return (
          <div className="space-y-4">
            <div className="bg-purple-50 p-4 rounded-md mb-4 border border-purple-100">
              <h4 className="font-medium mb-2 flex items-center text-purple-700">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5 mr-2 fill-purple-600">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1.66 19.05h-4.8V4.95h4.8c4.15 0 7.695 2.775 7.695 7.05s-3.545 7.05-7.695 7.05z"/>
                </svg>
                Revolut Payment Instructions
              </h4>
              <p className="text-sm text-purple-600 mb-2">Please send your payment to the following Revolut account:</p>
              <div className="text-sm text-purple-800 font-medium">@propertyrentals</div>
              <p className="text-xs text-purple-600 mt-3">Important: Include your booking reference BOOKING-{guestId || "NEW"} in the notes.</p>
            </div>
            
            <FormField
              control={form.control}
              name="paymentReference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Revolut Payment Reference</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. REV-12345678" {...field} />
                  </FormControl>
                  <FormDescription>
                    Enter the reference number from your Revolut transaction
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );
        
      case "cash":
        return (
          <div className="space-y-4">
            <div className="bg-green-50 p-4 rounded-md mb-4 border border-green-100">
              <h4 className="font-medium mb-2 flex items-center text-green-700">
                <DollarSign className="h-5 w-5 text-green-600 mr-2" />
                Cash Payment Instructions
              </h4>
              <p className="text-sm text-green-600">
                Please prepare the exact amount of {totalPaymentAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} in cash.
              </p>
              <p className="text-sm text-green-600 mt-2">
                You can pay in person at our office location:
              </p>
              <div className="text-sm text-green-800 font-medium mt-1">
                123 Main Street, Suite 101<br />
                San Francisco, CA 94105
              </div>
              <p className="text-xs text-green-600 mt-3">Office hours: Monday-Friday 9am-5pm, Saturday 10am-3pm</p>
            </div>
            
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add any additional information about your cash payment" 
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );
    }
  };

  // Generate a reference for the success state
  const [invoiceRef, setInvoiceRef] = useState<string>("");
  const [redirectCountdown, setRedirectCountdown] = useState<number>(30);
  
  useEffect(() => {
    if (paymentStatus === 'success' && !invoiceRef) {
      // Generate a reference for the payment
      setInvoiceRef(`INV-${Date.now().toString().slice(-6)}`);
      
      // Setup countdown timer
      const timer = setInterval(() => {
        setRedirectCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [paymentStatus, invoiceRef]);

  // If payment is successful, show success page
  if (paymentStatus === 'success') {
    return (
      <div className="container mx-auto py-16 px-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-md mx-auto text-center"
        >
          <div className="rounded-full bg-green-100 p-6 w-24 h-24 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-4">Payment Successful!</h1>
          <div className="bg-green-50 border border-green-100 rounded-md p-4 mb-6">
            <div className="text-sm text-green-800 mb-2">
              <div className="font-medium">Booking Reference:</div>
              <div className="text-lg select-all cursor-pointer">{bookingReference}</div>
            </div>
            <div className="text-sm text-green-800">
              <div className="font-medium">Invoice Number:</div>
              <div className="text-lg select-all cursor-pointer">{invoiceRef}</div>
            </div>
          </div>
          <p className="text-muted-foreground mb-4">
            Your payment of {totalPaymentAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} has been received. 
            A receipt has been generated and will be sent to your email address.
          </p>
          
          {/* Redirect countdown */}
          <div className="text-xs text-muted-foreground mb-6">
            Redirecting to dashboard in {redirectCountdown} seconds...
          </div>
          
          <Button onClick={() => guestId ? setLocation(`/guest-dashboard?guestId=${guestId}`) : setLocation('/')}>
            Continue to Dashboard
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Payment Terminal</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Payment Summary */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Payment Summary</CardTitle>
            <CardDescription>
              Review your booking details
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-medium">Booking Details</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Booking Reference:</div>
                <div className="font-medium text-primary">{bookingReference}</div>
                <div className="text-muted-foreground">Check-in:</div>
                <div>{format(checkIn, "MMM d, yyyy")}</div>
                <div className="text-muted-foreground">Check-out:</div>
                <div>{format(checkOut, "MMM d, yyyy")}</div>
                <div className="text-muted-foreground">Plan Type:</div>
                <div className="capitalize">{planType} Plan</div>
                <div className="text-muted-foreground">Property:</div>
                <div className="truncate">{propertyName}</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium">Payment Details</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Prepaid Amount:</span>
                  <span>${prepaidAmount.toFixed(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Security Deposit:</span>
                  <span>${depositAmount.toFixed(0)}</span>
                </div>
                {totalSavings > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Savings:</span>
                    <span>-${totalSavings.toFixed(0)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold pt-2 border-t">
                  <span>Total Due Now:</span>
                  <span>${totalPaymentAmount.toFixed(0)}</span>
                </div>
              </div>
            </div>
            
            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              <p>A receipt will be emailed to you after your payment is processed.</p>
            </div>
          </CardContent>
        </Card>
        
        {/* Payment Form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Payment Method</CardTitle>
            <CardDescription>
              Choose your preferred payment method
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handlePayment)} className="space-y-6">
                <Tabs defaultValue="credit_card" onValueChange={(value) => form.setValue("paymentMethod", value as any)}>
                  <TabsList className="grid grid-cols-5 w-full">
                    <TabsTrigger value="credit_card" className="flex flex-col items-center py-2 h-auto">
                      <CreditCard className="h-4 w-4 mb-1" />
                      <span className="text-xs">Card</span>
                    </TabsTrigger>
                    <TabsTrigger value="bank_transfer" className="flex flex-col items-center py-2 h-auto">
                      <Building className="h-4 w-4 mb-1" />
                      <span className="text-xs">Bank</span>
                    </TabsTrigger>
                    <TabsTrigger value="paypal" className="flex flex-col items-center py-2 h-auto">
                      <Send className="h-4 w-4 mb-1" />
                      <span className="text-xs">PayPal</span>
                    </TabsTrigger>
                    <TabsTrigger value="revolut" className="flex flex-col items-center py-2 h-auto">
                      <Send className="h-4 w-4 mb-1" />
                      <span className="text-xs">Revolut</span>
                    </TabsTrigger>
                    <TabsTrigger value="cash" className="flex flex-col items-center py-2 h-auto">
                      <DollarSign className="h-4 w-4 mb-1" />
                      <span className="text-xs">Cash</span>
                    </TabsTrigger>
                  </TabsList>
                  
                  <div className="mt-6">
                    {renderPaymentMethodForm()}
                  </div>
                </Tabs>
                
                {/* Payment Proof/Documentation Section */}
                <div className="border-t pt-6 mt-6">
                  <h3 className="font-medium mb-4">Payment Documentation</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Please upload payment receipts, transfer confirmations, or other proof of payment
                  </p>
                  
                  {/* Document Capture/Upload */}
                  <div className="space-y-4">
                    {/* Captured documents */}
                    {capturedDocuments.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Uploaded Documents</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {capturedDocuments.map((doc, index) => (
                            <div 
                              key={index} 
                              className="border rounded-md p-2 text-xs flex flex-col"
                            >
                              <div className="truncate mb-1">{doc.name}</div>
                              <div className="text-muted-foreground">{Math.round(doc.size / 1024)} KB</div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="mt-1"
                                onClick={() => setCapturedDocuments(capturedDocuments.filter((_, i) => i !== index))}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Upload options */}
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex items-center gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        Upload Document
                      </Button>
                      
                      <Button 
                        type="button"
                        variant="outline"
                        onClick={startCamera}
                        disabled={cameraActive}
                        className="flex items-center gap-2"
                      >
                        <Camera className="h-4 w-4" />
                        Capture with Camera
                      </Button>
                      
                      <input 
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileUpload}
                        accept="image/*,.pdf"
                        multiple
                      />
                    </div>
                    
                    {/* Camera view */}
                    {cameraActive && (
                      <div className="relative mt-4 border rounded-md overflow-hidden">
                        <video 
                          ref={webcamRef}
                          autoPlay
                          playsInline
                          className="w-full h-auto"
                        />
                        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
                          <Button
                            type="button"
                            onClick={captureImage}
                            className="bg-white text-black hover:bg-gray-100"
                          >
                            Capture
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={stopCamera}
                            className="bg-white text-black hover:bg-gray-100"
                          >
                            Cancel
                          </Button>
                        </div>
                        <canvas ref={canvasRef} className="hidden" />
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex flex-col-reverse sm:flex-row gap-4 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => window.history.back()}
                    disabled={isSubmitting}
                  >
                    Back
                  </Button>
                  
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Complete Payment
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}