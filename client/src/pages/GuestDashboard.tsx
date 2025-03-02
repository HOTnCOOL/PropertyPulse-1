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
  Navigation
} from "lucide-react";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";

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

// Main Guest Dashboard component
export default function GuestDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Guest Information</h1>
        <p className="text-muted-foreground">Welcome to our property information portal. Here you'll find details about our location, policies, and nearby attractions.</p>
      </div>

      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 mb-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="location">Location</TabsTrigger>
          <TabsTrigger value="policies">Check-in/out</TabsTrigger>
          <TabsTrigger value="nearby">Nearby</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
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
      </Tabs>
    </div>
  );
}