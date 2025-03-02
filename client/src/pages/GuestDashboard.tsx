import { useState } from "react";
import { 
  MapPin, 
  Key, 
  Calendar, 
  Clock, 
  Store, 
  Coffee, 
  Camera, 
  MessageSquare, 
  ShieldAlert, 
  Phone,
  Heart,
  User,
  CreditCard,
  Package,
  AlarmClock
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

// Main Guest Dashboard component
export default function GuestDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();
  
  // Add state for interactive elements
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [serviceAdded, setServiceAdded] = useState<number | null>(null);
  
  // Mock user data
  const userInfo = {
    name: "Alex Johnson",
    email: "alex.johnson@example.com",
    phone: "+1 (555) 123-4567",
    bookingReference: "BK12345678",
    checkInDate: "2025-03-10",
    checkOutDate: "2025-03-17",
    roomName: "Luxury Ocean View Suite",
    roomNumber: "301",
    guestCount: 2
  };
  
  // Mock payment data
  const payments = [
    { id: 1, date: "2025-01-15", amount: "$1200.00", type: "Deposit", status: "Paid" },
    { id: 2, date: "2025-02-15", amount: "$800.00", type: "First Payment", status: "Paid" },
    { id: 3, date: "2025-03-15", amount: "$800.00", type: "Final Payment", status: "Due" }
  ];
  
  // Mock upcoming payments
  const upcomingPayments = [
    { id: 3, dueDate: "2025-03-15", amount: "$800.00", description: "Final Payment" }
  ];
  
  // Mock bookings data
  const bookings = [
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
  
  // Mock messages
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
  
  // Mock additional services
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
  
  // Static property info
  const propertyInfo = {
    address: "123 Ocean Drive, Beachside, CA 90210",
    checkInTime: "3:00 PM - 8:00 PM",
    checkOutTime: "11:00 AM",
    emergencyContacts: [
      { name: "Property Manager", phone: "555-123-4567" },
      { name: "Maintenance", phone: "555-765-4321" },
      { name: "Emergency Services", phone: "911" }
    ],
    nearbyAttractions: {
      restaurants: 5,
      shops: 3,
      attractions: 4,
      services: 3
    }
  };
  
  // Handle payment submission
  const handlePayNow = () => {
    setShowPaymentModal(true);
  };
  
  const handlePaymentSubmit = () => {
    toast({
      title: "Payment Processed",
      description: "Your payment has been successfully processed.",
      variant: "default"
    });
    setShowPaymentModal(false);
  };
  
  // Handle message submission
  const handleSendMessage = () => {
    if (newMessage.trim()) {
      toast({
        title: "Message Sent",
        description: "Your message has been sent to the property manager.",
        variant: "default"
      });
      setNewMessage("");
      setShowMessageForm(false);
    }
  };
  
  // Handle service booking
  const handleAddService = (serviceId: number) => {
    setServiceAdded(serviceId);
    toast({
      title: "Service Added",
      description: "The selected service has been added to your booking.",
      variant: "default"
    });
    
    // Reset after a few seconds for demo purposes
    setTimeout(() => {
      setServiceAdded(null);
    }, 3000);
  };

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
        </TabsList>
        
        {/* Overview Tab */}
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
                    onClick={() => setShowMessageForm(true)}
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
                      onClick={handlePayNow}
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
                <p className="text-lg mb-4">{propertyInfo.address}</p>
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
                    <p className="text-lg font-bold">{propertyInfo.checkInTime}</p>
                  </div>
                  <div className="text-right">
                    <h3 className="font-medium">Check-out</h3>
                    <p className="text-lg font-bold">{propertyInfo.checkOutTime}</p>
                  </div>
                </div>
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
                  {propertyInfo.emergencyContacts.map((contact, idx) => (
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
                              <Button 
                                size="sm" 
                                className="text-sm px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                onClick={handlePayNow}
                              >
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
              <Button 
                size="sm" 
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                onClick={() => setShowMessageForm(true)}
              >
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
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="px-3 py-1 border border-blue-300 text-blue-600 rounded-md hover:bg-blue-50"
                        onClick={() => handleAddService(service.id)}
                        disabled={serviceAdded === service.id}
                      >
                        {serviceAdded === service.id ? 'Added ✓' : 'Add to Booking'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Make a Payment</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Payment Amount</label>
                <input 
                  type="text" 
                  className="w-full p-2 border rounded-md" 
                  value={upcomingPayments[0]?.amount || "$0.00"} 
                  readOnly 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Card Number</label>
                <input 
                  type="text" 
                  className="w-full p-2 border rounded-md" 
                  placeholder="**** **** **** ****" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Expiry Date</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border rounded-md" 
                    placeholder="MM/YY" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">CVV</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border rounded-md" 
                    placeholder="***" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Name on Card</label>
                <input 
                  type="text" 
                  className="w-full p-2 border rounded-md" 
                  placeholder="Enter name on card" 
                />
              </div>
              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowPaymentModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handlePaymentSubmit}
                >
                  Pay Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Message Form */}
      {showMessageForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Send a Message</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <input 
                  type="text" 
                  className="w-full p-2 border rounded-md" 
                  placeholder="Enter subject" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Message</label>
                <textarea 
                  className="w-full p-2 border rounded-md h-32" 
                  placeholder="Type your message here..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                ></textarea>
              </div>
              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowMessageForm(false);
                    setNewMessage("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSendMessage}
                >
                  Send Message
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}