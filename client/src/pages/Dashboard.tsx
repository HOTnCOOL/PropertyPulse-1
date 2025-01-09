import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, DollarSign } from "lucide-react";
import GuestList from "../components/GuestList";
import PropertyCard from "../components/PropertyCard";
import PaymentHistory from "../components/PaymentHistory";
import type { Property, Guest, Payment } from "@db/schema";

export default function Dashboard() {
  const { data: properties } = useQuery<Property[]>({ queryKey: ["/api/properties"] });
  const { data: guests } = useQuery<Guest[]>({ queryKey: ["/api/guests"] });
  const { data: payments } = useQuery<Payment[]>({ queryKey: ["/api/payments"] });

  const totalRevenue = payments?.reduce((sum, payment) => 
    sum + Number(payment.amount), 0) || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Properties</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{properties?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Guests</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{guests?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalRevenue.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Guests</CardTitle>
          </CardHeader>
          <CardContent>
            <GuestList guests={guests?.slice(0, 5) || []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentHistory payments={payments?.slice(0, 5) || []} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
