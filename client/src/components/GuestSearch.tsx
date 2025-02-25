import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import type { Guest } from "@db/schema";

interface GuestSearchProps {
  onGuestSelect: (guest: Guest) => void;
}

export function GuestSearch({ onGuestSelect }: GuestSearchProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const { data: searchResults, error, isLoading } = useQuery({
    queryKey: ['/api/guests/search', searchValue],
    queryFn: async () => {
      if (!searchValue || searchValue.length < 2) return [];

      try {
        const response = await fetch(`/api/guests/search?query=${encodeURIComponent(searchValue)}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to search guests');
        }
        return response.json() as Promise<Guest[]>;
      } catch (error) {
        console.error('Search error:', error);
        throw error;
      }
    },
    enabled: searchValue.length >= 2,
    retry: false,
    staleTime: 1000, // Cache results for 1 second
  });

  const formattedResults = useMemo(() => {
    if (!searchResults) return [];
    return searchResults.map((guest: Guest) => ({
      value: guest.id.toString(),
      label: `${guest.firstName} ${guest.lastName}`,
      details: `${guest.email} | ${guest.phone} ${guest.idNumber ? `| ID: ${guest.idNumber}` : ''}`,
      guest
    }));
  }, [searchResults]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {searchValue || "Search existing guests..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput 
            placeholder="Type at least 2 characters to search..." 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          {error ? (
            <CommandEmpty>
              Error: {error instanceof Error ? error.message : 'Failed to search'}
            </CommandEmpty>
          ) : isLoading ? (
            <CommandEmpty>Searching...</CommandEmpty>
          ) : searchValue.length < 2 ? (
            <CommandEmpty>Type at least 2 characters to start searching...</CommandEmpty>
          ) : formattedResults.length === 0 ? (
            <CommandEmpty>No guests found.</CommandEmpty>
          ) : (
            <CommandGroup>
              {formattedResults.map((result) => (
                <CommandItem
                  key={result.value}
                  value={result.value}
                  onSelect={() => {
                    onGuestSelect(result.guest);
                    setOpen(false);
                    setSearchValue(result.label);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      searchValue === result.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{result.label}</span>
                    <span className="text-sm text-muted-foreground">
                      {result.details}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}