import { useState } from "react";
import { 
  MapPin, 
  Clock, 
  Store, 
  Coffee, 
  Camera, 
  Search,
  Heart,
  Navigation,
  ShieldAlert
} from "lucide-react";

// Simple static component that doesn't depend on any other code
export default function GuestInfo() {
  const [activeTab, setActiveTab] = useState("overview");

  // Static data
  const locationInfo = {
    address: "123 Ocean Drive, Beachside, CA 90210",
    directions: [
      "From the airport, take the Airport Express Bus to Central Station",
      "From Central Station, you can take a taxi directly to our property",
      "If driving, follow GPS directions to '123 Ocean Drive' and look for our blue entrance"
    ],
    parkingInfo: "Free parking available on premises. Please park only in designated spots.",
    publicTransport: "Bus routes 10, 15, and 22 stop within a 5-minute walk from our property."
  };

  const checkInOutInfo = {
    checkInTime: "3:00 PM - 8:00 PM",
    checkOutTime: "11:00 AM",
    procedures: [
      "Please have your ID and booking confirmation ready upon arrival",
      "Our staff will provide keys/access codes and a brief orientation of the property",
      "For contactless check-in, download our mobile app or request the door code in advance"
    ]
  };

  const emergencyContacts = [
    { name: "Property Manager", phone: "555-123-4567" },
    { name: "Maintenance", phone: "555-765-4321" },
    { name: "Emergency Services", phone: "911" }
  ];

  const attractions = {
    restaurants: [
      { name: "Oceanview Grill", distance: "0.3 miles", description: "Seafood restaurant with stunning views" },
      { name: "Luigi's Pizzeria", distance: "0.5 miles", description: "Authentic Italian pizza and pasta" },
      { name: "The Green Cafe", distance: "0.2 miles", description: "Vegan and vegetarian options" }
    ],
    shops: [
      { name: "Beachside Market", distance: "0.1 miles", description: "Convenience store with essentials" },
      { name: "Ocean Mall", distance: "1.2 miles", description: "Shopping center with various stores" }
    ],
    activities: [
      { name: "Sunset Beach", distance: "0.4 miles", description: "Beautiful beach with surfing and swimming" },
      { name: "City Museum", distance: "1.5 miles", description: "Historical and art exhibits" }
    ]
  };

  // Render appropriate content based on active tab
  const renderTabContent = () => {
    switch(activeTab) {
      case "overview":
        return (
          <div className="space-y-6">
            <div className="p-6 bg-white rounded-lg shadow-sm border">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <MapPin className="w-5 h-5 mr-2" /> Location
              </h2>
              <p className="mb-2">{locationInfo.address}</p>
              <button 
                className="px-4 py-2 bg-blue-600 text-white rounded-md"
                onClick={() => setActiveTab("location")}
              >
                View Map & Directions
              </button>
            </div>

            <div className="p-6 bg-white rounded-lg shadow-sm border">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Clock className="w-5 h-5 mr-2" /> Check-in & Check-out
              </h2>
              <div className="flex justify-between mb-4">
                <div>
                  <h3 className="font-medium">Check-in</h3>
                  <p className="text-lg font-bold">{checkInOutInfo.checkInTime}</p>
                </div>
                <div>
                  <h3 className="font-medium">Check-out</h3>
                  <p className="text-lg font-bold">{checkInOutInfo.checkOutTime}</p>
                </div>
              </div>
              <button 
                className="px-4 py-2 border border-gray-300 rounded-md w-full"
                onClick={() => setActiveTab("policies")}
              >
                View Full Policies
              </button>
            </div>

            <div className="p-6 bg-white rounded-lg shadow-sm border">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Search className="w-5 h-5 mr-2" /> Explore Nearby
              </h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 border rounded-lg text-center">
                  <Coffee className="h-6 w-6 mx-auto mb-1" />
                  <p className="text-sm font-medium">{attractions.restaurants.length} Restaurants</p>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <Store className="h-6 w-6 mx-auto mb-1" />
                  <p className="text-sm font-medium">{attractions.shops.length} Shops</p>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <Camera className="h-6 w-6 mx-auto mb-1" />
                  <p className="text-sm font-medium">{attractions.activities.length} Activities</p>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <Heart className="h-6 w-6 mx-auto mb-1" />
                  <p className="text-sm font-medium">3 Services</p>
                </div>
              </div>
              <button 
                className="px-4 py-2 bg-blue-600 text-white rounded-md w-full"
                onClick={() => setActiveTab("nearby")}
              >
                View All Nearby Places
              </button>
            </div>

            <div className="p-6 bg-white rounded-lg shadow-sm border">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <ShieldAlert className="w-5 h-5 mr-2" /> Emergency Contacts
              </h2>
              <div className="space-y-2">
                {emergencyContacts.map((contact, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="font-medium">{contact.name}:</span>
                    <span>{contact.phone}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
        
      case "location":
        return (
          <div className="p-6 bg-white rounded-lg shadow-sm border">
            <h2 className="text-xl font-semibold mb-4">Location & Directions</h2>
            <div>
              <h3 className="text-lg font-medium mb-2">Our Address</h3>
              <p className="text-lg font-semibold">{locationInfo.address}</p>
              <div className="mt-4 h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <Navigation className="h-12 w-12 mb-2 mx-auto text-blue-600" />
                  <p>Interactive map would be displayed here</p>
                  <button className="mt-2 px-4 py-2 border border-gray-300 rounded-md flex items-center mx-auto">
                    <MapPin className="h-4 w-4 mr-2" />
                    Get Directions
                  </button>
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">Directions</h3>
              <ul className="space-y-2 list-disc pl-6">
                {locationInfo.directions.map((direction, idx) => (
                  <li key={idx}>{direction}</li>
                ))}
              </ul>
            </div>
            
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">Parking Information</h3>
              <p>{locationInfo.parkingInfo}</p>
            </div>
            
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">Public Transport</h3>
              <p>{locationInfo.publicTransport}</p>
            </div>
          </div>
        );
        
      case "policies":
        return (
          <div className="p-6 bg-white rounded-lg shadow-sm border">
            <h2 className="text-xl font-semibold mb-4">Check-in & Check-out Policies</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold">Check-in Time</h3>
                <div className="text-2xl font-bold mt-2">{checkInOutInfo.checkInTime}</div>
                <p className="mt-2 text-sm text-gray-600">
                  <span className="font-medium">Early check-in:</span> Early check-in may be available based on availability for an additional fee.
                </p>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold">Check-out Time</h3>
                <div className="text-2xl font-bold mt-2">{checkInOutInfo.checkOutTime}</div>
                <p className="mt-2 text-sm text-gray-600">
                  <span className="font-medium">Late check-out:</span> Late checkout may be available for an additional fee.
                </p>
              </div>
            </div>
            
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-3">Check-in Procedures</h3>
              <ul className="space-y-2 pl-6 list-disc">
                {checkInOutInfo.procedures.map((procedure, idx) => (
                  <li key={idx}>{procedure}</li>
                ))}
              </ul>
            </div>
            
            <div className="mt-6 bg-gray-100 p-4 rounded-lg">
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
          </div>
        );
        
      case "nearby":
        return (
          <div className="p-6 bg-white rounded-lg shadow-sm border">
            <h2 className="text-xl font-semibold mb-4">Nearby Attractions</h2>
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
                      <div className="text-sm text-gray-500">{item.distance}</div>
                      <div className="text-sm mt-1">{item.description}</div>
                    </div>
                  ))}
                </div>
              </div>
              
              <hr className="my-4" />
              
              <div>
                <h3 className="text-lg font-medium flex items-center gap-2 mb-3">
                  <Store className="h-5 w-5" />
                  Shops
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {attractions.shops.map((item, index) => (
                    <div key={index} className="p-3 rounded-lg border">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-gray-500">{item.distance}</div>
                      <div className="text-sm mt-1">{item.description}</div>
                    </div>
                  ))}
                </div>
              </div>
              
              <hr className="my-4" />
              
              <div>
                <h3 className="text-lg font-medium flex items-center gap-2 mb-3">
                  <Camera className="h-5 w-5" />
                  Activities
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {attractions.activities.map((item, index) => (
                    <div key={index} className="p-3 rounded-lg border">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-gray-500">{item.distance}</div>
                      <div className="text-sm mt-1">{item.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return <div>Select a tab to view information</div>;
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Guest Information</h1>
        <p className="text-gray-600">Welcome to our property information portal. Here you'll find details about our location, policies, and nearby attractions.</p>
      </div>

      <div className="mb-8 flex border-b">
        <button 
          className={`px-4 py-2 font-medium ${activeTab === "overview" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button 
          className={`px-4 py-2 font-medium ${activeTab === "location" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}
          onClick={() => setActiveTab("location")}
        >
          Location
        </button>
        <button 
          className={`px-4 py-2 font-medium ${activeTab === "policies" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}
          onClick={() => setActiveTab("policies")}
        >
          Check-in/out
        </button>
        <button 
          className={`px-4 py-2 font-medium ${activeTab === "nearby" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}
          onClick={() => setActiveTab("nearby")}
        >
          Nearby
        </button>
      </div>
      
      {renderTabContent()}
    </div>
  );
}