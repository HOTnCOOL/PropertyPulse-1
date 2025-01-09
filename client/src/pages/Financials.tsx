import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import PaymentHistory from "../components/PaymentHistory";
import type { Payment } from "@db/schema";

export default function Financials() {
  const [dateRange, setDateRange] = useState<{
    from?: Date;
    to?: Date;
  }>({});

  const { data: payments } = useQuery<Payment[]>({
    queryKey: [
      "/api/payments",
      dateRange.from && dateRange.to
        ? `?startDate=${dateRange.from.toISOString()}&endDate=${dateRange.to.toISOString()}`
        : "",
    ],
  });

  const chartData = payments?.reduce((acc: any[], payment) => {
    const date = format(new Date(payment.date), "MMM dd");
    const existing = acc.find((item) => item.date === date);
    
    if (existing) {
      existing.amount += Number(payment.amount);
    } else {
      acc.push({
        date,
        amount: Number(payment.amount),
      });
    }
    
    return acc;
  }, []) || [];

  const totalRevenue = payments?.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0
  ) || 0;

  const pendingPayments = payments?.filter(
    (payment) => payment.status === "pending"
  );

  const totalPending = pendingPayments?.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0
  ) || 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Financial Overview</h1>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[300px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "LLL dd, y")} -{" "}
                    {format(dateRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(dateRange.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange.from}
              selected={{
                from: dateRange.from,
                to: dateRange.to,
              }}
              onSelect={setDateRange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${totalRevenue.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-500">
              ${totalPending.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">
              {pendingPayments?.length} pending transactions
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <BarChart
              width={800}
              height={300}
              data={chartData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="amount"
                name="Revenue"
                fill="hsl(var(--primary))"
              />
            </BarChart>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentHistory payments={payments || []} />
        </CardContent>
      </Card>
    </div>
  );
}
