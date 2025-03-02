import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  MapPin, 
  Key, 
  Calendar, 
  Info, 
  DollarSign, 
  Clock, 
  Store, 
  Coffee, 
  Camera, 
  MessageSquare, 
  Zap, 
  ShieldAlert, 
  Phone,
  Heart,
  Search,
  Navigation,
  User,
  CreditCard,
  Package,
  History,
  AlarmClock
} from "lucide-react";
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

// Define TypeScript interfaces for our data structures
interface Coordinates {
  lat: number;
  lng: number;
}

interface LocationInfo {
  title: string;
  address: string;
  coordinates: Coordinates;
  directions: string[];
  parkingInfo: string;
  publicTransport: string;
}

interface CheckInOutInfo {
  checkInTime: string;
  checkOutTime: string;
  lateCheckIn: string;
  earlyCheckIn: string;
  lateCheckOut: string;
  procedures: string[];
  specialRequests: string;
}

interface PlaceInfo {
  name: string;
  distance: string;
  description: string;
}

interface NearbyAttractionsInfo {
  restaurants: PlaceInfo[];
  shops: PlaceInfo[];
  attractions: PlaceInfo[];
  services: PlaceInfo[];
}

interface EmergencyContact {
  name: string;
  phone: string;
}

interface HouseRulesInfo {
  generalRules: string[];
  emergencyContacts: EmergencyContact[];
}

interface GuestInfoType {
  location: LocationInfo;
  checkInOutInfo: CheckInOutInfo;
  nearbyAttractions: NearbyAttractionsInfo;
  houseRules: HouseRulesInfo;
}

interface MessageType {
  id: number;
  sender: string;
  content: string;
  timestamp: string;
}

// Example static guest info for development
const guestInfo: GuestInfoType = {
  location: {
    title: "Our Location",
    address: "123 Ocean Drive, Beachside, CA 90210",
    coordinates: { lat: 34.0522, lng: -118.2437 },
    directions: [
      "From the airport, take the Airport Express Bus to Central Station",
      "From Central Station, you can take a taxi directly to our property",
      "If driving, follow GPS directions to '123 Ocean Drive' and look for our blue entrance"
    ],
    parkingInfo: "Free parking available on premises. Please park only in designated spots.",
    publicTransport: "Bus routes 10, 15, and 22 stop within a 5-minute walk from our property."
  },
  checkInOutInfo: {
    checkInTime: "3:00 PM - 8:00 PM",
    checkOutTime: "11:00 AM",
    lateCheckIn: "Late check-in after 8:00 PM is available with prior arrangement. Additional $25 fee applies.",
    earlyCheckIn: "Early check-in (from 1:00 PM) is subject to availability for an additional $20 fee.",
    lateCheckOut: "Late checkout (until 1:00 PM) can be arranged for an additional $20 fee, subject to availability.",
    procedures: [
      "Please have your ID and booking confirmation ready upon arrival",
      "Our staff will provide keys/access codes and a brief orientation of the property",
      "For contactless check-in, download our mobile app or request the door code in advance"
    ],
    specialRequests: "Please inform us of any special requirements at least 48 hours in advance."
  },
  nearbyAttractions: {
    restaurants: [
      { name: "Oceanview Grill", distance: "0.3 miles", description: "Seafood restaurant with stunning views" },
      { name: "Luigi's Pizzeria", distance: "0.5 miles", description: "Authentic Italian pizza and pasta" },
      { name: "The Green Cafe", distance: "0.2 miles", description: "Vegan and vegetarian options" }
    ],
    shops: [
      { name: "Beachside Market", distance: "0.1 miles", description: "Convenience store with essentials" },
      { name: "Ocean Mall", distance: "1.2 miles", description: "Shopping center with various stores" },
      { name: "Farmers Market", distance: "0.8 miles", description: "Local produce, open Wednesdays & Saturdays" }
    ],
    attractions: [
      { name: "Sunset Beach", distance: "0.4 miles", description: "Beautiful beach with surfing and swimming" },
      { name: "City Museum", distance: "1.5 miles", description: "Historical and art exhibits" },
      { name: "Hillside Park", distance: "0.7 miles", description: "Hiking trails and picnic areas" }
    ],
    services: [
      { name: "City Hospital", distance: "2.1 miles", description: "24/7 emergency services" },
      { name: "Pharmacy", distance: "0.3 miles", description: "Open daily 8 AM - 10 PM" },
      { name: "Police Station", distance: "1.0 mile", description: "Local police department" }
    ]
  },
  houseRules: {
    generalRules: [
      "No smoking inside the property",
      "No parties or events without prior approval",
      "Quiet hours from 10:00 PM to 8:00 AM",
      "Pets allowed only in designated pet-friendly units with prior approval"
    ],
    emergencyContacts: [
      { name: "Property Manager", phone: "555-123-4567" },
      { name: "Maintenance", phone: "555-765-4321" },
      { name: "Emergency Services", phone: "911" }
    ]
  }
};

// Component for the message board
function MessageBoard() {
  const [message, setMessage] = useState("");
  
  // Sample messages for demo
  const messages: MessageType[] = [
    { id: 1, sender: "Property Manager", content: "Welcome to your stay! Let us know if you need anything.", timestamp: "2023-03-01T14:30:00" },
    { id: 2, sender: "Maintenance", content: "The pool will be closed for cleaning tomorrow from 10am-12pm.", timestamp: "2023-03-01T16:45:00" },
    { id: 3, sender: "Reception", content: "We've left a welcome basket at your door. Enjoy!", timestamp: "2023-03-02T09:15:00" },
  ];
  
  const sendMessage = () => {
    if (message.trim().length > 0) {
      alert("Message functionality would send: " + message);
      setMessage("");
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto mb-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className="p-3 rounded-lg bg-muted">
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium">{msg.sender}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(msg.timestamp).toLocaleString()}
              </span>
            </div>
            <p>{msg.content}</p>
          </div>
        ))}
      </div>
      
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Type your message..."
          className="flex-1 px-3 py-2 border rounded-md"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <Button onClick={sendMessage}>Send</Button>
      </div>
    </div>
  );
}

// Nearby attractions component
interface NearbyAttractionsProps {
  attractions: NearbyAttractionsInfo;
}

function NearbyAttractions({ attractions }: NearbyAttractionsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium flex items-center gap-2 mb-3">
          <Coffee className="h-5 w-5" />
          Restaurants
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {attractions.restaurants.map((item: PlaceInfo, index: number) => (
            <div key={index} className="p-3 rounded-lg border">
              <div className="font-medium">{item.name}</div>
              <div className="text-sm text-muted-foreground">{item.distance}</div>
              <div className="text-sm mt-1">{item.description}</div>
            </div>
          ))}
        </div>
      </div>
      
      <Separator />
      
      <div>
        <h3 className="text-lg font-medium flex items-center gap-2 mb-3">
          <Store className="h-5 w-5" />
          Shops
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {attractions.shops.map((item: PlaceInfo, index: number) => (
            <div key={index} className="p-3 rounded-lg border">
              <div className="font-medium">{item.name}</div>
              <div className="text-sm text-muted-foreground">{item.distance}</div>
              <div className="text-sm mt-1">{item.description}</div>
            </div>
          ))}
        </div>
      </div>
      
      <Separator />
      
      <div>
        <h3 className="text-lg font-medium flex items-center gap-2 mb-3">
          <Camera className="h-5 w-5" />
          Attractions
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {attractions.attractions.map((item: PlaceInfo, index: number) => (
            <div key={index} className="p-3 rounded-lg border">
              <div className="font-medium">{item.name}</div>
              <div className="text-sm text-muted-foreground">{item.distance}</div>
              <div className="text-sm mt-1">{item.description}</div>
            </div>
          ))}
        </div>
      </div>
      
      <Separator />
      
      <div>
        <h3 className="text-lg font-medium flex items-center gap-2 mb-3">
          <Heart className="h-5 w-5" />
          Services
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {attractions.services.map((item: PlaceInfo, index: number) => (
            <div key={index} className="p-3 rounded-lg border">
              <div className="font-medium">{item.name}</div>
              <div className="text-sm text-muted-foreground">{item.distance}</div>
              <div className="text-sm mt-1">{item.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Location component
interface LocationInfoProps {
  location: LocationInfo;
}

function LocationInfo({ location }: LocationInfoProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Our Address</h3>
        <p className="text-lg font-semibold">{location.address}</p>
        <div className="mt-4 h-64 bg-muted rounded-lg flex items-center justify-center">
          <div className="text-center">
            <Navigation className="h-12 w-12 mb-2 mx-auto text-primary" />
            <p>Interactive map would be displayed here</p>
            <Button variant="outline" className="mt-2">
              <MapPin className="h-4 w-4 mr-2" />
              Get Directions
            </Button>
          </div>
        </div>
      </div>
      
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="directions">
          <AccordionTrigger>Directions</AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-2 list-disc pl-6">
              {location.directions.map((direction: string, idx: number) => (
                <li key={idx}>{direction}</li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="parking">
          <AccordionTrigger>Parking Information</AccordionTrigger>
          <AccordionContent>
            <p>{location.parkingInfo}</p>
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="transport">
          <AccordionTrigger>Public Transport</AccordionTrigger>
          <AccordionContent>
            <p>{location.publicTransport}</p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

// Check-in/check-out policies component
interface CheckInOutPoliciesProps {
  policies: CheckInOutInfo;
}

function CheckInOutPolicies({ policies }: CheckInOutPoliciesProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Check-in Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{policies.checkInTime}</div>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium">Early check-in:</span> {policies.earlyCheckIn}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium">Late check-in:</span> {policies.lateCheckIn}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Check-out Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{policies.checkOutTime}</div>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium">Late check-out:</span> {policies.lateCheckOut}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Please leave keys in the drop box if checking out early.
            </p>
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-6">
        <h3 className="text-lg font-medium mb-3">Check-in Procedures</h3>
        <ul className="space-y-2 pl-6 list-disc">
          {policies.procedures.map((procedure: string, idx: number) => (
            <li key={idx}>{procedure}</li>
          ))}
        </ul>
      </div>
      
      <div className="mt-6">
        <h3 className="text-lg font-medium mb-3">Special Requests</h3>
        <p>{policies.specialRequests}</p>
      </div>
      
      <div className="mt-6 bg-muted p-4 rounded-lg">
        <h3 className="font-medium flex items-center">
          <ShieldAlert className="h-5 w-5 mr-2 text-orange-500" />
          House Rules
        </h3>
        <ul className="mt-2 space-y-1 text-sm">
          <li>No smoking inside the property</li>
          <li>No parties or events without prior approval</li>
          <li>Quiet hours from 10:00 PM to 8:00 AM</li>
          <li>Pets allowed only in designated pet-friendly units</li>
        </ul>
      </div>
      
      <div className="mt-6">
        <h3 className="text-lg font-medium mb-3 flex items-center">
          <Phone className="h-5 w-5 mr-2" />
          Emergency Contacts
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardContent className="p-4">
              <div className="font-medium">Property Manager</div>
              <div className="text-lg mt-1">555-123-4567</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="font-medium">Maintenance</div>
              <div className="text-lg mt-1">555-765-4321</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="font-medium">Emergency Services</div>
              <div className="text-lg mt-1">911</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Types for personalized guest data
interface UserInfo {
  name: string;
  email: string;
  phone: string;
  bookingReference: string;
  checkInDate: string;
  checkOutDate: string;
  roomName: string;
  roomNumber: string;
  guestCount: number;
}

interface PaymentInfo {
  id: number;
  date: string;
  amount: string;
  type: string;
  status: string;
}

interface BookingInfo {
  id: number;
  checkIn: string;
  checkOut: string;
  property: string;
  status: string;
  totalAmount: string;
}

interface MessageInfo {
  id: number;
  date: string;
  sender: string;
  subject: string;
  content: string;
}

interface AdditionalServiceInfo {
  id: number;
  name: string;
  description: string;
  price: string;
}

// Main Guest Dashboard component
export default function GuestDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Parse URL parameters to get guest info
  const params = new URLSearchParams(window.location.search);
  const bookingRef = params.get('ref');
  const email = params.get('email');
  
  // Mock function to fetch guest data based on booking reference and email
  // In a real app, this would make an API call to the server
  const fetchGuestData = () => {
    // This is just mock data for demonstration
    return {
      userInfo: {
        name: "Alex Johnson",
        email: email || "alex.johnson@example.com",
        phone: "+1 (555) 123-4567",
        bookingReference: bookingRef || "BK12345678",
        checkInDate: "2025-03-10",
        checkOutDate: "2025-03-17",
        roomName: "Luxury Ocean View Suite",
        roomNumber: "301",
        guestCount: 2
      },
      payments: [
        { id: 1, date: "2025-01-15", amount: "$1200.00", type: "Deposit", status: "Paid" },
        { id: 2, date: "2025-02-15", amount: "$800.00", type: "First Payment", status: "Paid" },
        { id: 3, date: "2025-03-15", amount: "$800.00", type: "Final Payment", status: "Due" }
      ],
      upcomingPayments: [
        { id: 3, dueDate: "2025-03-15", amount: "$800.00", description: "Final Payment" }
      ],
      bookings: [
        { 
          id: 1, 
          checkIn: "2024-10-05", 
          checkOut: "2024-10-12", 
          property: "Mountain Retreat Suite", 
          status: "Completed", 
          totalAmount: "$1800.00" 
        },
        { 
          id: 2, 
          checkIn: "2025-03-10", 
          checkOut: "2025-03-17", 
          property: "Luxury Ocean View Suite", 
          status: "Upcoming", 
          totalAmount: "$2800.00" 
        }
      ],
      messages: [
        { 
          id: 1, 
          date: "2025-02-20", 
          sender: "System", 
          subject: "Booking Confirmation", 
          content: "Your booking #" + (bookingRef || "BK12345678") + " has been confirmed for March 10-17, 2025."
        },
        { 
          id: 2, 
          date: "2025-02-25", 
          sender: "Property Manager", 
          subject: "Welcome Message", 
          content: "We're looking forward to hosting you next month! Please let us know if you have any special requests."
        },
        { 
          id: 3, 
          date: "2025-03-01", 
          sender: "System", 
          subject: "Payment Reminder", 
          content: "This is a friendly reminder that your final payment of $800 is due on March 15, 2025."
        }
      ],
      additionalServices: [
        { 
          id: 1, 
          name: "Airport Pickup", 
          description: "Transportation from the airport to the property", 
          price: "$75.00" 
        },
        { 
          id: 2, 
          name: "Breakfast Package", 
          description: "Daily breakfast delivered to your room", 
          price: "$25.00/day" 
        },
        { 
          id: 3, 
          name: "Spa Session", 
          description: "60-minute massage treatment", 
          price: "$120.00" 
        },
        { 
          id: 4, 
          name: "Late Checkout", 
          description: "Extended checkout until 3:00 PM", 
          price: "$50.00" 
        }
      ]
    };
  };
  
  // Use react-query to fetch and cache the guest data
  const { data, isLoading, error } = useQuery({
    queryKey: ['guestData', bookingRef, email],
    queryFn: fetchGuestData,
    enabled: !!bookingRef && !!email, // Only run the query if we have both parameters
  });
  
  // If we don't have the necessary URL parameters, show a warning
  useEffect(() => {
    if (!bookingRef || !email) {
      toast({
        title: "Missing information",
        description: "Please log in to view your personalized dashboard.",
        variant: "destructive"
      });
      
      // Redirect back to login after a short delay
      setTimeout(() => {
        setLocation("/auth");
      }, 3000);
    }
  }, [bookingRef, email, toast, setLocation]);
  
  // Handle loading and error states
  if (isLoading) {
    return (
      <div className="container mx-auto py-20 text-center">
        <div className="animate-spin h-10 w-10 border-4 border-blue-600 rounded-full border-t-transparent mx-auto mb-4"></div>
        <p className="text-lg">Loading your personalized dashboard...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto py-20 text-center">
        <div className="text-red-500 text-lg mb-4">
          <ShieldAlert className="h-16 w-16 mx-auto mb-2" />
          <p>There was an error loading your information.</p>
        </div>
        <Button onClick={() => setLocation("/auth")}>
          Return to Login
        </Button>
      </div>
    );
  }
  
  // If we don't have data despite not having loading or error states,
  // something went wrong with our fetch logic
  if (!data) {
    return (
      <div className="container mx-auto py-20 text-center">
        <p className="text-lg mb-4">No guest information available. Please log in again.</p>
        <Button onClick={() => setLocation("/auth")}>
          Return to Login
        </Button>
      </div>
    );
  }
  
  // Extract the guest data for easier referencing
  const { userInfo, payments, upcomingPayments, bookings, messages, additionalServices } = data;

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Guest Dashboard</h1>
        <p className="text-muted-foreground">Welcome to your personalized guest portal. Manage your booking, explore property details, and find everything you need for your stay.</p>
      </div>

      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex overflow-x-auto mb-8 whitespace-nowrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="services">Additional Services</TabsTrigger>
          <TabsTrigger value="location">Location</TabsTrigger>
          <TabsTrigger value="policies">Check-in/out</TabsTrigger>
          <TabsTrigger value="nearby">Nearby</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <div className="space-y-6">
            {/* User welcome card */}
            <div className="p-6 bg-white rounded-lg shadow-sm border border-blue-100 bg-blue-50">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{userInfo.name}</h2>
                  <p className="text-gray-700">Booking #{userInfo.bookingReference}</p>
                  <div className="mt-1 flex gap-3">
                    <span className="inline-flex items-center text-sm text-gray-600">
                      <Calendar className="w-4 h-4 mr-1 text-blue-500" />
                      {new Date(userInfo.checkInDate).toLocaleDateString()} - {new Date(userInfo.checkOutDate).toLocaleDateString()}
                    </span>
                    <span className="inline-flex items-center text-sm text-gray-600">
                      <Key className="w-4 h-4 mr-1 text-blue-500" />
                      Room {userInfo.roomNumber}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Quick actions */}
              <div className="p-5 bg-white rounded-lg shadow-sm border">
                <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    className="p-3 text-sm flex flex-col items-center justify-center border rounded-lg hover:bg-gray-50"
                    onClick={() => setActiveTab("payments")}
                  >
                    <CreditCard className="w-5 h-5 mb-1 text-blue-500" />
                    Make Payment
                  </button>
                  <button 
                    className="p-3 text-sm flex flex-col items-center justify-center border rounded-lg hover:bg-gray-50"
                    onClick={() => setActiveTab("messages")}
                  >
                    <MessageSquare className="w-5 h-5 mb-1 text-blue-500" />
                    Contact Support
                  </button>
                  <button 
                    className="p-3 text-sm flex flex-col items-center justify-center border rounded-lg hover:bg-gray-50"
                    onClick={() => setActiveTab("services")}
                  >
                    <Package className="w-5 h-5 mb-1 text-blue-500" />
                    Book Services
                  </button>
                  <button 
                    className="p-3 text-sm flex flex-col items-center justify-center border rounded-lg hover:bg-gray-50"
                    onClick={() => setActiveTab("policies")}
                  >
                    <AlarmClock className="w-5 h-5 mb-1 text-blue-500" />
                    Request Late Checkout
                  </button>
                </div>
              </div>

              {/* Upcoming payment */}
              <div className="p-5 bg-white rounded-lg shadow-sm border">
                <h2 className="text-lg font-semibold mb-3">Upcoming Payment</h2>
                {upcomingPayments.length > 0 ? (
                  <div className="border rounded-lg p-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">Due Date</span>
                      <span className="font-semibold">{new Date(upcomingPayments[0].dueDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between mb-3">
                      <span className="text-gray-600">Amount</span>
                      <span className="font-semibold">{upcomingPayments[0].amount}</span>
                    </div>
                    <Button 
                      onClick={() => setActiveTab("payments")}
                      className="w-full py-2 mt-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Pay Now
                    </Button>
                  </div>
                ) : (
                  <p className="text-center py-4 text-gray-500">No upcoming payments</p>
                )}
              </div>
            </div>

            {/* Messages preview */}
            <div className="p-5 bg-white rounded-lg shadow-sm border">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-semibold">Recent Messages</h2>
                <button 
                  className="text-sm text-blue-600 hover:underline"
                  onClick={() => setActiveTab("messages")}
                >
                  View All
                </button>
              </div>
              <div className="space-y-3">
                {messages.slice(0, 2).map(message => (
                  <div key={message.id} className="border-b last:border-0 pb-3">
                    <div className="flex justify-between text-sm text-gray-500 mb-1">
                      <span>{message.sender}</span>
                      <span>{new Date(message.date).toLocaleDateString()}</span>
                    </div>
                    <h3 className="font-medium">{message.subject}</h3>
                    <p className="text-sm text-gray-600 line-clamp-1">{message.content}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Property info preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Our Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg mb-4">{guestInfo.location.address}</p>
                <Button className="mb-4" onClick={() => setActiveTab("location")}>
                  View Map & Directions
                </Button>
                
                <Accordion type="single" collapsible>
                  <AccordionItem value="parking">
                    <AccordionTrigger>
                      Parking Information
                    </AccordionTrigger>
                    <AccordionContent>
                      <p>{guestInfo.location.parkingInfo}</p>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Check-in & Check-out 
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between mb-4">
                  <div>
                    <h3 className="font-medium">Check-in</h3>
                    <p className="text-lg font-bold">{guestInfo.checkInOutInfo.checkInTime}</p>
                  </div>
                  <div className="text-right">
                    <h3 className="font-medium">Check-out</h3>
                    <p className="text-lg font-bold">{guestInfo.checkInOutInfo.checkOutTime}</p>
                  </div>
                </div>
                
                <Button variant="outline" className="w-full" onClick={() => setActiveTab("policies")}>
                  View Full Policies
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" />
                  Emergency Contacts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {guestInfo.houseRules.emergencyContacts.map((contact: EmergencyContact, idx: number) => (
                    <div key={idx} className="flex justify-between">
                      <span className="font-medium">{contact.name}:</span>
                      <span>{contact.phone}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="location">
          <Card>
            <CardHeader>
              <CardTitle>Location & Directions</CardTitle>
            </CardHeader>
            <CardContent>
              <LocationInfo location={guestInfo.location} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="policies">
          <Card>
            <CardHeader>
              <CardTitle>Check-in & Check-out Policies</CardTitle>
            </CardHeader>
            <CardContent>
              <CheckInOutPolicies policies={guestInfo.checkInOutInfo} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="nearby">
          <Card>
            <CardHeader>
              <CardTitle>Nearby Attractions</CardTitle>
            </CardHeader>
            <CardContent>
              <NearbyAttractions attractions={guestInfo.nearbyAttractions} />
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Bookings Tab */}
        <TabsContent value="bookings">
          <Card>
            <CardHeader>
              <CardTitle>Your Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                {bookings.map(booking => (
                  <div key={booking.id} className={`border rounded-lg p-4 ${booking.status === 'Upcoming' ? 'border-blue-200 bg-blue-50' : ''}`}>
                    <div className="flex justify-between mb-2">
                      <h3 className="font-semibold">{booking.property}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        booking.status === 'Completed' ? 'bg-green-100 text-green-800' : 
                        booking.status === 'Upcoming' ? 'bg-blue-100 text-blue-800' : 
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {booking.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mb-3">
                      {new Date(booking.checkIn).toLocaleDateString()} to {new Date(booking.checkOut).toLocaleDateString()}
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="text-sm">
                        <span className="text-gray-500">Total:</span> 
                        <span className="font-semibold ml-1">{booking.totalAmount}</span>
                      </div>
                      {booking.status === 'Upcoming' && (
                        <Button variant="outline" size="sm" className="text-sm px-3 py-1 border border-blue-300 text-blue-600 rounded hover:bg-blue-50">
                          View Details
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Payments Tab */}
        <TabsContent value="payments">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Payments</CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingPayments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="text-sm bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-3 text-left text-gray-600">Due Date</th>
                          <th className="px-3 py-3 text-left text-gray-600">Description</th>
                          <th className="px-3 py-3 text-right text-gray-600">Amount</th>
                          <th className="px-3 py-3 text-right text-gray-600">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {upcomingPayments.map(payment => (
                          <tr key={payment.id}>
                            <td className="px-3 py-4">{new Date(payment.dueDate).toLocaleDateString()}</td>
                            <td className="px-3 py-4">{payment.description}</td>
                            <td className="px-3 py-4 text-right font-medium">{payment.amount}</td>
                            <td className="px-3 py-4 text-right">
                              <Button size="sm" className="text-sm px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                                Pay Now
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center py-4 text-gray-500">No upcoming payments</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="text-sm bg-gray-50 border-b">
                      <tr>
                        <th className="px-3 py-3 text-left text-gray-600">Date</th>
                        <th className="px-3 py-3 text-left text-gray-600">Type</th>
                        <th className="px-3 py-3 text-right text-gray-600">Amount</th>
                        <th className="px-3 py-3 text-right text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {payments.map(payment => (
                        <tr key={payment.id}>
                          <td className="px-3 py-4">{new Date(payment.date).toLocaleDateString()}</td>
                          <td className="px-3 py-4">{payment.type}</td>
                          <td className="px-3 py-4 text-right font-medium">{payment.amount}</td>
                          <td className="px-3 py-4 text-right">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              payment.status === 'Paid' ? 'bg-green-100 text-green-800' : 
                              payment.status === 'Due' ? 'bg-yellow-100 text-yellow-800' : 
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {payment.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Messages Tab */}
        <TabsContent value="messages">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Messages</CardTitle>
              <Button size="sm" className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
                New Message
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {messages.map(message => (
                  <div key={message.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between text-sm text-gray-500 mb-1">
                      <span className="font-medium">{message.sender}</span>
                      <span>{new Date(message.date).toLocaleDateString()}</span>
                    </div>
                    <h3 className="font-semibold mb-1">{message.subject}</h3>
                    <p className="text-gray-600">{message.content}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Additional Services Tab */}
        <TabsContent value="services">
          <Card>
            <CardHeader>
              <CardTitle>Additional Services</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {additionalServices.map(service => (
                  <div key={service.id} className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-1">{service.name}</h3>
                    <p className="text-sm text-gray-600 mb-3">{service.description}</p>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{service.price}</span>
                      <Button variant="outline" size="sm" className="px-3 py-1 border border-blue-300 text-blue-600 rounded-md hover:bg-blue-50">
                        Add to Booking
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}