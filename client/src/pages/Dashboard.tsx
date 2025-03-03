import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, DollarSign, Home, RefreshCcw } from "lucide-react";
import GuestList from "../components/GuestList";
import PropertyCard from "../components/PropertyCard";
import PaymentHistory from "../components/PaymentHistory";
import TodoList from "../components/TodoList";
import type { Property, Guest, Payment, Todo } from "@db/schema";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "../hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";

export default function Dashboard() {
  const { toast } = useToast();
  
  const { 
    data: properties, 
    isLoading: propertiesLoading, 
    isError: propertiesError,
    refetch: refetchProperties 
  } = useQuery<Property[]>({ 
    queryKey: ["/api/properties"],
    retry: 2,
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to load properties data",
        variant: "destructive"
      });
    }
  });

  const { 
    data: todayGuests, 
    isLoading: guestsLoading, 
    isError: guestsError,
    refetch: refetchGuests
  } = useQuery<{
    checkIns: Guest[];
    checkOuts: Guest[];
    date: string;
  }>({ 
    queryKey: ["/api/guests/today"],
    retry: 2,
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to load today's guest activity",
        variant: "destructive"
      });
    }
  });

  const { 
    data: payments, 
    isLoading: paymentsLoading, 
    isError: paymentsError,
    refetch: refetchPayments
  } = useQuery<Payment[]>({ 
    queryKey: ["/api/payments", { status: "pending" }],
    retry: 2,
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to load payment data",
        variant: "destructive"
      });
    }
  });

  const { 
    data: todos, 
    isLoading: todosLoading, 
    isError: todosError,
    refetch: refetchTodos
  } = useQuery<Todo[]>({ 
    queryKey: ["/api/todos"],
    retry: 2,
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to load todo items",
        variant: "destructive"
      });
    }
  });

  const occupiedUnits = properties?.filter(p => p.isOccupied).length || 0;
  const freeUnits = (properties?.length || 0) - occupiedUnits;

  const totalPendingAmount = payments?.reduce((sum, payment) => 
    sum + Number(payment.amount), 0) || 0;
    
  const refreshAllData = () => {
    refetchProperties();
    refetchGuests();
    refetchPayments();
    refetchTodos();
    toast({
      title: "Refreshed",
      description: "Dashboard data has been refreshed",
    });
  };

  // Extract guest information from bookings for today's check-ins/check-outs
  const formatGuestFromBooking = (booking: any): Guest => {
    if (!booking || !booking.guest) {
      return {
        id: 0,
        name: "Unknown Guest",
        email: "",
        phone: "",
        createdAt: new Date(),
      } as Guest;
    }
    
    return {
      ...booking.guest,
      property: booking.property?.name || "Unknown Property",
      roomNumber: booking.roomNumber || "Not assigned",
    };
  };

  const checkInGuests = todayGuests?.checkIns?.map(formatGuestFromBooking) || [];
  const checkOutGuests = todayGuests?.checkOuts?.map(formatGuestFromBooking) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={refreshAllData} 
          className="flex items-center gap-1"
        >
          <RefreshCcw className="h-4 w-4 mr-1" /> Refresh Data
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Free Units</CardTitle>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {propertiesLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{freeUnits}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Occupied Units</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {propertiesLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{occupiedUnits}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Activity</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {guestsLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {(checkInGuests?.length || 0) + (checkOutGuests?.length || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {checkInGuests?.length || 0} Check-ins · {checkOutGuests?.length || 0} Check-outs
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {paymentsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold text-orange-500">
                  ${totalPendingAmount.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {payments?.length || 0} pending payments
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Today's Check-ins</CardTitle>
          </CardHeader>
          <CardContent>
            {guestsLoading ? (
              <div className="flex justify-center p-4">
                <Spinner size="md" />
              </div>
            ) : guestsError ? (
              <p className="text-center text-muted-foreground py-4">
                Failed to load check-ins
              </p>
            ) : checkInGuests.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No check-ins scheduled for today
              </p>
            ) : (
              <GuestList guests={checkInGuests} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today's Check-outs</CardTitle>
          </CardHeader>
          <CardContent>
            {guestsLoading ? (
              <div className="flex justify-center p-4">
                <Spinner size="md" />
              </div>
            ) : guestsError ? (
              <p className="text-center text-muted-foreground py-4">
                Failed to load check-outs
              </p>
            ) : checkOutGuests.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No check-outs scheduled for today
              </p>
            ) : (
              <GuestList guests={checkOutGuests} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentsLoading ? (
              <div className="flex justify-center p-4">
                <Spinner size="md" />
              </div>
            ) : paymentsError ? (
              <p className="text-center text-muted-foreground py-4">
                Failed to load payments
              </p>
            ) : payments?.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No pending payments
              </p>
            ) : (
              <PaymentHistory payments={payments || []} showActions={true} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>To-do List</CardTitle>
          </CardHeader>
          <CardContent>
            {todosLoading ? (
              <div className="flex justify-center p-4">
                <Spinner size="md" />
              </div>
            ) : todosError ? (
              <p className="text-center text-muted-foreground py-4">
                Failed to load todo items
              </p>
            ) : (
              <TodoList todos={todos || []} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}