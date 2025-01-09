import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Payment } from "@db/schema";
import { format } from "date-fns";

interface PaymentHistoryProps {
  payments: Payment[];
}

export default function PaymentHistory({ payments }: PaymentHistoryProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell>{format(new Date(payment.date), 'MMM dd, yyyy')}</TableCell>
            <TableCell>${Number(payment.amount).toLocaleString()}</TableCell>
            <TableCell className="capitalize">{payment.type}</TableCell>
            <TableCell>
              <Badge
                variant={
                  payment.status === 'paid' ? 'default' :
                  payment.status === 'pending' ? 'secondary' : 'destructive'
                }
              >
                {payment.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
