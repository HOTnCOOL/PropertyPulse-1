import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, CreditCard, Banknote, Building2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Payment } from "@db/schema";
import { format } from "date-fns";

interface PaymentHistoryProps {
  payments: Payment[];
  showActions?: boolean;
}

export default function PaymentHistory({ payments, showActions = false }: PaymentHistoryProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const confirmPayment = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/payments/${id}/confirm`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmedBy: "Manager" }), // TODO: Add actual manager name
      });
      if (!response.ok) throw new Error("Failed to confirm payment");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({
        title: "Success",
        description: "Payment has been confirmed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to confirm payment",
        variant: "destructive",
      });
    },
  });

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'card':
        return <CreditCard className="h-4 w-4" />;
      case 'cash':
        return <Banknote className="h-4 w-4" />;
      case 'bank':
        return <Building2 className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Method</TableHead>
          <TableHead>Status</TableHead>
          {showActions && <TableHead>Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell>{format(new Date(payment.date), 'MMM dd, yyyy')}</TableCell>
            <TableCell>${Number(payment.amount).toLocaleString()}</TableCell>
            <TableCell className="capitalize">{payment.type}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {getMethodIcon(payment.method)}
                <span className="capitalize">{payment.method}</span>
                {payment.reference && (
                  <span className="text-xs text-muted-foreground">
                    ({payment.reference})
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Badge
                variant={
                  payment.status === 'confirmed' ? 'default' :
                  payment.status === 'pending' ? 'secondary' : 'destructive'
                }
              >
                {payment.status}
              </Badge>
            </TableCell>
            {showActions && (
              <TableCell>
                {payment.status === 'pending' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => confirmPayment.mutate(payment.id)}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Confirm
                  </Button>
                )}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}