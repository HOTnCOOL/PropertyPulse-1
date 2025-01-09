import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { Guest } from "@db/schema";
import { format } from "date-fns";

interface GuestListProps {
  guests: Guest[];
  onSelectGuest?: (guest: Guest) => void;
  selectedGuestId?: number;
}

export default function GuestList({ guests, onSelectGuest, selectedGuestId }: GuestListProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Check In</TableHead>
          <TableHead>Check Out</TableHead>
          <TableHead>Status</TableHead>
          {onSelectGuest && <TableHead>Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {guests.map((guest) => (
          <TableRow 
            key={guest.id}
            className={selectedGuestId === guest.id ? "bg-accent" : undefined}
          >
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
            {onSelectGuest && (
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectGuest(guest)}
                >
                  View Payments
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}