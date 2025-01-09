import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Bed,
  Tv,
  Bath,
  Wind,
  Mountain,
  Home,
  Flame,
  Sofa,
  Users,
} from "lucide-react";
import { useState } from "react";
import { type DateRange } from "react-day-picker";
import type { Property } from "@db/schema";

interface PropertyCardProps {
  property: Property;
}

export default function PropertyCard({ property }: PropertyCardProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const amenities = property.amenities as Record<string, boolean>;

  const amenityIcons = {
    tv: { icon: Tv, label: "TV" },
    aircon: { icon: Wind, label: "Air Conditioning" },
    view: { icon: Mountain, label: "View" },
    balcony: { icon: Home, label: "Balcony" }, // Changed to Home icon
    fireplace: { icon: Flame, label: "Fireplace" },
    sofa: { icon: Sofa, label: "Sofa" },
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all">
      {property.imageUrl ? (
        <div className="aspect-video relative">
          <img
            src={property.imageUrl}
            alt={property.name}
            className="object-cover w-full h-full"
          />
          <Badge className="absolute top-2 right-2">{property.type}</Badge>
        </div>
      ) : (
        <div className="aspect-video bg-muted flex items-center justify-center">
          <Badge>{property.type}</Badge>
        </div>
      )}

      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{property.name}</span>
          <div className="flex items-center gap-2 text-sm font-normal">
            <Users className="h-4 w-4" />
            <span>Up to {property.capacity} guests</span>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{property.description}</p>

          {/* Key Features */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Bed className="h-4 w-4" />
              <span className="text-sm">{property.bedType} Bed</span>
            </div>
            {property.bathrooms && (
              <div className="flex items-center gap-2">
                <Bath className="h-4 w-4" />
                <span className="text-sm">
                  {property.bathrooms} Bathroom{property.bathrooms > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          {/* Amenities */}
          <div className="flex flex-wrap gap-3">
            {Object.entries(amenityIcons).map(([key, { icon: Icon, label }]) => (
              amenities[key] && (
                <div
                  key={key}
                  className="flex items-center gap-1 text-xs text-muted-foreground bg-accent/50 px-2 py-1 rounded-md"
                >
                  <Icon className="h-3 w-3" />
                  <span>{label}</span>
                </div>
              )
            ))}
          </div>

          {/* Rates */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="text-lg font-semibold">
                ${Number(property.rate).toLocaleString()}/night
              </div>
              {property.hourlyRate && (
                <div className="text-sm text-muted-foreground">
                  ${Number(property.hourlyRate).toLocaleString()}/hour
                </div>
              )}
            </div>
            <div className="space-y-1 text-right">
              {property.weeklyRate && (
                <div className="text-sm text-muted-foreground">
                  ${Number(property.weeklyRate).toLocaleString()}/week
                </div>
              )}
              {property.monthlyRate && (
                <div className="text-sm text-muted-foreground">
                  ${Number(property.monthlyRate).toLocaleString()}/month
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Availability Calendar */}
        <div className="border rounded-lg p-4">
          <h4 className="text-sm font-medium mb-2">Check Availability</h4>
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={setDateRange}
            disabled={{ before: new Date() }}
            className="rounded-md border"
          />
        </div>
      </CardContent>
    </Card>
  );
}