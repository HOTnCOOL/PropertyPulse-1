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
  ShieldAlert,
  Calendar,
  CreditCard,
  MessageSquare,
  Bell,
  History,
  Package,
  AlarmClock,
  User,
  Key
} from "lucide-react";

// Enhanced guest dashboard with more features
export default function GuestInfo() {
  const [activeTab, setActiveTab] = useState("overview");

  // User info - would normally come from API
  const userInfo = {
    name: "Alex Johnson",
    email: "alex.johnson@example.com",
    phone: "+1 (555) 123-4567",
    bookingReference: "BK12345678",
    checkInDate: "2025-03-10",
    checkOutDate: "2025-03-17",
    room: "Luxury Ocean View Suite",
    roomNumber: "301",
    guestCount: 2
  };

  // Static data - would normally be loaded from API
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

  // Payment history
  const paymentHistory = [
    { id: 1, date: "2025-01-15", amount: "$1200.00", type: "Deposit", status: "Paid" },
    { id: 2, date: "2025-02-15", amount: "$800.00", type: "First Payment", status: "Paid" },
    { id: 3, date: "2025-03-15", amount: "$800.00", type: "Final Payment", status: "Due" }
  ];

  // Upcoming payments
  const upcomingPayments = [
    { id: 3, dueDate: "2025-03-15", amount: "$800.00", description: "Final Payment" }
  ];

  // Booking history
  const bookingHistory = [
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
  ];

  // Messages
  const messages = [
    { 
      id: 1, 
      date: "2025-02-20", 
      sender: "System", 
      subject: "Booking Confirmation", 
      content: "Your booking #BK12345678 has been confirmed for March 10-17, 2025."
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
  ];

  // Additional services
  const additionalServices = [
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
  ];

  // Render appropriate content based on active tab
  const renderTabContent = () => {
    switch(activeTab) {
      case "overview":
        return (
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
                  <button className="p-3 text-sm flex flex-col items-center justify-center border rounded-lg hover:bg-gray-50">
                    <CreditCard className="w-5 h-5 mb-1 text-blue-500" />
                    Make Payment
                  </button>
                  <button className="p-3 text-sm flex flex-col items-center justify-center border rounded-lg hover:bg-gray-50">
                    <MessageSquare className="w-5 h-5 mb-1 text-blue-500" />
                    Contact Support
                  </button>
                  <button className="p-3 text-sm flex flex-col items-center justify-center border rounded-lg hover:bg-gray-50">
                    <Package className="w-5 h-5 mb-1 text-blue-500" />
                    Book Services
                  </button>
                  <button className="p-3 text-sm flex flex-col items-center justify-center border rounded-lg hover:bg-gray-50">
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
                    <button className="w-full py-2 mt-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                      Pay Now
                    </button>
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

      case "bookings":
        return (
          <div className="p-6 bg-white rounded-lg shadow-sm border">
            <h2 className="text-xl font-semibold mb-6">Booking History</h2>
            <div className="space-y-5">
              {bookingHistory.map(booking => (
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
                      <button className="text-sm px-3 py-1 border border-blue-300 text-blue-600 rounded hover:bg-blue-50">
                        View Details
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "payments":
        return (
          <div className="space-y-6">
            <div className="p-6 bg-white rounded-lg shadow-sm border">
              <h2 className="text-xl font-semibold mb-5">Upcoming Payments</h2>
              {upcomingPayments.length > 0 ? (
                <div>
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
                              <button className="text-sm px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                                Pay Now
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-center py-4 text-gray-500">No upcoming payments</p>
              )}
            </div>

            <div className="p-6 bg-white rounded-lg shadow-sm border">
              <h2 className="text-xl font-semibold mb-5">Payment History</h2>
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
                    {paymentHistory.map(payment => (
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
            </div>
          </div>
        );

      case "messages":
        return (
          <div className="p-6 bg-white rounded-lg shadow-sm border">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-semibold">Messages</h2>
              <button className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
                New Message
              </button>
            </div>
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
          </div>
        );

      case "services":
        return (
          <div className="p-6 bg-white rounded-lg shadow-sm border">
            <h2 className="text-xl font-semibold mb-5">Additional Services</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {additionalServices.map(service => (
                <div key={service.id} className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-1">{service.name}</h3>
                  <p className="text-sm text-gray-600 mb-3">{service.description}</p>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{service.price}</span>
                    <button className="px-3 py-1 border border-blue-300 text-blue-600 rounded-md hover:bg-blue-50">
                      Add to Booking
                    </button>
                  </div>
                </div>
              ))}
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
        <h1 className="text-3xl font-bold mb-2">Guest Dashboard</h1>
        <p className="text-gray-600">Welcome to your personalized guest portal. Manage your booking, explore the area, and find everything you need for your stay.</p>
      </div>

      <div className="mb-8 flex border-b overflow-x-auto">
        <button 
          className={`px-4 py-2 font-medium whitespace-nowrap ${activeTab === "overview" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button 
          className={`px-4 py-2 font-medium whitespace-nowrap ${activeTab === "bookings" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}
          onClick={() => setActiveTab("bookings")}
        >
          Bookings
        </button>
        <button 
          className={`px-4 py-2 font-medium whitespace-nowrap ${activeTab === "payments" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}
          onClick={() => setActiveTab("payments")}
        >
          Payments
        </button>
        <button 
          className={`px-4 py-2 font-medium whitespace-nowrap ${activeTab === "messages" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}
          onClick={() => setActiveTab("messages")}
        >
          Messages
        </button>
        <button 
          className={`px-4 py-2 font-medium whitespace-nowrap ${activeTab === "services" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}
          onClick={() => setActiveTab("services")}
        >
          Additional Services
        </button>
        <button 
          className={`px-4 py-2 font-medium whitespace-nowrap ${activeTab === "location" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}
          onClick={() => setActiveTab("location")}
        >
          Location
        </button>
        <button 
          className={`px-4 py-2 font-medium whitespace-nowrap ${activeTab === "policies" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}
          onClick={() => setActiveTab("policies")}
        >
          Policies
        </button>
        <button 
          className={`px-4 py-2 font-medium whitespace-nowrap ${activeTab === "nearby" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}
          onClick={() => setActiveTab("nearby")}
        >
          Nearby
        </button>
      </div>
      
      {renderTabContent()}
    </div>
  );
}