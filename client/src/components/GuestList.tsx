import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Guest } from "@db/schema";
import { format } from "date-fns";

interface GuestListProps {
  guests: Guest[];
}

export default function GuestList({ guests }: GuestListProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Check In</TableHead>
          <TableHead>Check Out</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {guests.map((guest) => (
          <TableRow key={guest.id}>
            <TableCell>{guest.firstName} {guest.lastName}</TableCell>
            <TableCell>{format(new Date(guest.checkIn), 'MMM dd, yyyy')}</TableCell>
            <TableCell>{format(new Date(guest.checkOut), 'MMM dd, yyyy')}</TableCell>
            <TableCell>
              {new Date(guest.checkOut) > new Date() ? (
                <span className="text-green-600">Active</span>
              ) : (
                <span className="text-gray-500">Completed</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
