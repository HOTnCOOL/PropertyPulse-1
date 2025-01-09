import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, DollarSign, Home } from "lucide-react";
import GuestList from "../components/GuestList";
import PropertyCard from "../components/PropertyCard";
import PaymentHistory from "../components/PaymentHistory";
import TodoList from "../components/TodoList";
import type { Property, Guest, Payment, Todo } from "@db/schema";

export default function Dashboard() {
  const { data: properties } = useQuery<Property[]>({ 
    queryKey: ["/api/properties"] 
  });

  const { data: todayGuests } = useQuery<{
    checkIns: Guest[];
    checkOuts: Guest[];
  }>({ 
    queryKey: ["/api/guests/today"] 
  });

  const { data: payments } = useQuery<Payment[]>({ 
    queryKey: ["/api/payments?status=pending"] 
  });

  const { data: todos } = useQuery<Todo[]>({ 
    queryKey: ["/api/todos"] 
  });

  const occupiedUnits = properties?.filter(p => p.isOccupied).length || 0;
  const freeUnits = (properties?.length || 0) - occupiedUnits;

  const totalPendingAmount = payments?.reduce((sum, payment) => 
    sum + Number(payment.amount), 0) || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Free Units</CardTitle>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{freeUnits}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Occupied Units</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{occupiedUnits}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Activity</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(todayGuests?.checkIns.length || 0) + (todayGuests?.checkOuts.length || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {todayGuests?.checkIns.length || 0} Check-ins · {todayGuests?.checkOuts.length || 0} Check-outs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              ${totalPendingAmount.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {payments?.length || 0} pending payments
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Today's Check-ins</CardTitle>
          </CardHeader>
          <CardContent>
            <GuestList guests={todayGuests?.checkIns || []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today's Check-outs</CardTitle>
          </CardHeader>
          <CardContent>
            <GuestList guests={todayGuests?.checkOuts || []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentHistory payments={payments || []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>To-do List</CardTitle>
          </CardHeader>
          <CardContent>
            <TodoList todos={todos || []} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}