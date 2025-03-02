import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import PaymentHistory from "../components/PaymentHistory";
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
  ChevronDown,
  Heart,
  Search,
  Navigation
} from "lucide-react";
import type { Booking, Guest, Property, Payment } from "@db/schema";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

// Extended type to include relations
interface BookingWithRelations extends Booking {
  guest: Guest | null;
  property: Property | null;
  payments: Payment[];
}

interface GuestInfoType {
  location: {
    title: string;
    address: string;
    coordinates: { lat: number; lng: number };
    directions: string[];
    parkingInfo: string;
    publicTransport: string;
  };
  checkInOutInfo: {
    checkInTime: string;
    checkOutTime: string;
    lateCheckIn: string;
    earlyCheckIn: string;
    lateCheckOut: string;
    procedures: string[];
    specialRequests: string;
  };
  nearbyAttractions: {
    restaurants: Array<{ name: string; distance: string; description: string }>;
    shops: Array<{ name: string; distance: string; description: string }>;
    attractions: Array<{ name: string; distance: string; description: string }>;
    services: Array<{ name: string; distance: string; description: string }>;
  };
  houseRules: {
    generalRules: string[];
    emergencyContacts: Array<{ name: string; phone: string }>;
  };
}

// Component for the message board
function MessageBoard() {
  const [message, setMessage] = useState("");
  
  // In a real implementation, this would fetch and display messages from the backend
  const messages = [
    { id: 1, sender: "Property Manager", content: "Welcome to your stay! Let us know if you need anything.", timestamp: "2023-03-01T14:30:00" },
    { id: 2, sender: "Maintenance", content: "The pool will be closed for cleaning tomorrow from 10am-12pm.", timestamp: "2023-03-01T16:45:00" },
    { id: 3, sender: "Reception", content: "We've left a welcome basket at your door. Enjoy!", timestamp: "2023-03-02T09:15:00" },
  ];
  
  const sendMessage = () => {
    if (message.trim().length > 0) {
      // In a real implementation, this would send the message to the backend
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
function NearbyAttractions({ attractions }: { attractions: GuestInfoType['nearbyAttractions'] }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium flex items-center gap-2 mb-3">
          <Coffee className="h-5 w-5" />
          Restaurants
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {attractions.restaurants.map((item, index) => (
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
          {attractions.shops.map((item, index) => (
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
          {attractions.attractions.map((item, index) => (
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
          {attractions.services.map((item, index) => (
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
function LocationInfo({ location }: { location: GuestInfoType['location'] }) {
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
              {location.directions.map((direction, idx) => (
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
function CheckInOutPolicies({ policies }: { policies: GuestInfoType['checkInOutInfo'] }) {
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
          {policies.procedures.map((procedure, idx) => (
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

// Main Guest Dashboard component
export default function GuestDashboard() {
  const { toast } = useToast();
  const bookingRef = new URLSearchParams(window.location.search).get('ref');
  const email = new URLSearchParams(window.location.search).get('email');
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch booking info
  const { data: booking, isLoading: bookingLoading } = useQuery<BookingWithRelations>({
    queryKey: ['/api/bookings/guest', bookingRef, email],
    queryFn: async () => {
      const response = await fetch(`/api/bookings/guest?ref=${bookingRef}&email=${email}`);
      if (!response.ok) {
        throw new Error('Failed to fetch booking details');
      }
      return response.json();
    },
    enabled: !!bookingRef && !!email,
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load booking details",
        variant: "destructive",
      });
    },
  });

  // Fetch general guest info (does not require authentication)
  const { data: guestInfo, isLoading: infoLoading } = useQuery<GuestInfoType>({
    queryKey: ['/api/guest-info'],
    queryFn: async () => {
      const response = await fetch('/api/guest-info');
      if (!response.ok) {
        throw new Error('Failed to fetch guest information');
      }
      return response.json();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load property information",
        variant: "destructive",
      });
    },
  });

  if (bookingLoading || infoLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-lg">Loading your dashboard...</p>
      </div>
    );
  }

  if (!guestInfo) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h1 className="text-2xl font-semibold mb-4">Information Not Available</h1>
        <p>Unable to load property information. Please try again later.</p>
      </div>
    );
  }

  // If we have a booking, show personalized dashboard
  // If not, show general information for anonymous visitors
  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      {booking && booking.guest ? (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">Welcome, {booking.guest.firstName}!</h1>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Booking Reference</p>
              <p className="font-medium">{booking.bookingReference}</p>
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <CardContent className="p-4 flex flex-col h-full justify-between">
                <div className="flex items-center mb-2">
                  <Calendar className="h-5 w-5 mr-2 text-primary" />
                  <h3 className="font-medium">Your Stay</h3>
                </div>
                <div>
                  <p className="text-sm">Check-in: <span className="font-medium">{new Date(booking.checkIn).toLocaleDateString()}</span></p>
                  <p className="text-sm">Check-out: <span className="font-medium">{new Date(booking.checkOut).toLocaleDateString()}</span></p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 flex flex-col h-full justify-between">
                <div className="flex items-center mb-2">
                  <MapPin className="h-5 w-5 mr-2 text-primary" />
                  <h3 className="font-medium">Your Property</h3>
                </div>
                <div>
                  <p className="text-sm font-medium">{booking.property?.name || 'N/A'}</p>
                  <p className="text-sm text-muted-foreground">{booking.property?.type || 'N/A'}</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 flex flex-col h-full justify-between">
                <div className="flex items-center mb-2">
                  <DollarSign className="h-5 w-5 mr-2 text-primary" />
                  <h3 className="font-medium">Payment Status</h3>
                </div>
                <div>
                  <p className="text-sm">Total: <span className="font-medium">${booking.totalAmount}</span></p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {booking.payments.filter(p => p.status === 'paid').length} Paid
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {booking.payments.filter(p => p.status === 'pending').length} Pending
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Guest Information</h1>
          <p className="text-muted-foreground">Welcome to our property information portal. Here you'll find details about our location, policies, and nearby attractions.</p>
        </div>
      )}

      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-5 mb-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="location">Location</TabsTrigger>
          <TabsTrigger value="policies">Check-in/out</TabsTrigger>
          <TabsTrigger value="nearby">Nearby</TabsTrigger>
          {booking && booking.guest && (
            <TabsTrigger value="messages">Messages</TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          {booking && booking.guest ? (
            <>
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Stay Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-medium">Check-in</h3>
                          <p className="text-muted-foreground">
                            {new Date(booking.checkIn).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <h3 className="font-medium">Check-out</h3>
                          <p className="text-muted-foreground">
                            {new Date(booking.checkOut).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div>
                        <h3 className="font-medium">Length of Stay</h3>
                        <p className="text-muted-foreground">
                          {Math.ceil((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24))} nights
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="h-5 w-5" />
                      Access Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {booking.guest.accessCode && (
                        <div>
                          <h3 className="font-medium">Door Code</h3>
                          <p className="text-muted-foreground font-mono">{booking.guest.accessCode}</p>
                        </div>
                      )}
                      <div>
                        <h3 className="font-medium">Important Note</h3>
                        <p className="text-muted-foreground">
                          Please keep your booking reference and access code safe. You'll need these for check-in.
                        </p>
                      </div>
                      <div>
                        <h3 className="font-medium">Check-in Time</h3>
                        <p className="text-muted-foreground">{guestInfo.checkInOutInfo.checkInTime}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {booking.property && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        Property Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-medium">Property Name</h3>
                          <p className="text-muted-foreground">{booking.property.name}</p>
                        </div>
                        <div>
                          <h3 className="font-medium">Property Type</h3>
                          <p className="text-muted-foreground">{booking.property.type}</p>
                        </div>
                        <div>
                          <h3 className="font-medium">Amenities</h3>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {Object.entries(booking.property.amenities as Record<string, boolean>)
                              .filter(([_, value]) => value)
                              .map(([key]) => (
                                <span key={key} className="text-sm text-muted-foreground capitalize">
                                  {key}
                                </span>
                              ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Info className="h-5 w-5" />
                      Payment Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium">Total Amount</h3>
                        <p className="text-xl font-semibold">${booking.totalAmount}</p>
                      </div>
                      <div>
                        <h3 className="font-medium mb-2">Payment History</h3>
                        <PaymentHistory payments={booking.payments} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Quick links section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Quick Links
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    <Button variant="outline" className="flex flex-col h-20 items-center justify-center" onClick={() => setActiveTab("location")}>
                      <MapPin className="h-5 w-5 mb-1" />
                      <span className="text-sm">Location</span>
                    </Button>
                    <Button variant="outline" className="flex flex-col h-20 items-center justify-center" onClick={() => setActiveTab("policies")}>
                      <Clock className="h-5 w-5 mb-1" />
                      <span className="text-sm">Policies</span>
                    </Button>
                    <Button variant="outline" className="flex flex-col h-20 items-center justify-center" onClick={() => setActiveTab("nearby")}>
                      <Coffee className="h-5 w-5 mb-1" />
                      <span className="text-sm">Attractions</span>
                    </Button>
                    <Button variant="outline" className="flex flex-col h-20 items-center justify-center" onClick={() => setActiveTab("messages")}>
                      <MessageSquare className="h-5 w-5 mb-1" />
                      <span className="text-sm">Messages</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="space-y-6">
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
                    <Search className="h-5 w-5" />
                    Explore Nearby
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="p-3 border rounded-lg text-center">
                      <Coffee className="h-6 w-6 mx-auto mb-1" />
                      <p className="text-sm font-medium">{guestInfo.nearbyAttractions.restaurants.length} Restaurants</p>
                    </div>
                    <div className="p-3 border rounded-lg text-center">
                      <Store className="h-6 w-6 mx-auto mb-1" />
                      <p className="text-sm font-medium">{guestInfo.nearbyAttractions.shops.length} Shops</p>
                    </div>
                    <div className="p-3 border rounded-lg text-center">
                      <Camera className="h-6 w-6 mx-auto mb-1" />
                      <p className="text-sm font-medium">{guestInfo.nearbyAttractions.attractions.length} Attractions</p>
                    </div>
                    <div className="p-3 border rounded-lg text-center">
                      <Heart className="h-6 w-6 mx-auto mb-1" />
                      <p className="text-sm font-medium">{guestInfo.nearbyAttractions.services.length} Services</p>
                    </div>
                  </div>
                  
                  <Button className="w-full" onClick={() => setActiveTab("nearby")}>
                    View All Nearby Places
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
                    {guestInfo.houseRules.emergencyContacts.map((contact, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="font-medium">{contact.name}:</span>
                        <span>{contact.phone}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
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
        
        {booking && booking.guest && (
          <TabsContent value="messages">
            <Card>
              <CardHeader>
                <CardTitle>Message Board</CardTitle>
                <p className="text-muted-foreground">Contact property management or view important announcements</p>
              </CardHeader>
              <CardContent className="h-[500px]">
                <MessageBoard />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}