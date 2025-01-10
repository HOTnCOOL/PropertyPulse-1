import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
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
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { type DateRange } from "react-day-picker";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Property } from "@db/schema";

interface PropertyCardProps {
  property: Property;
  onEdit?: (property: Property) => void;
}

export default function PropertyCard({ property, onEdit }: PropertyCardProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const amenities = property.amenities as Record<string, boolean>;
  const imageUrls = (property.imageUrls as string[]) || [];

  const amenityIcons = {
    tv: { icon: Tv, label: "TV" },
    aircon: { icon: Wind, label: "Air Conditioning" },
    view: { icon: Mountain, label: "View" },
    balcony: { icon: Home, label: "Balcony" },
    fireplace: { icon: Flame, label: "Fireplace" },
    sofa: { icon: Sofa, label: "Sofa" },
  };

  const deleteProperty = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/properties/${property.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete property");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      toast({
        title: "Success",
        description: "Property has been deleted",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete property",
        variant: "destructive",
      });
    },
  });

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % imageUrls.length);
  };

  const previousImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + imageUrls.length) % imageUrls.length);
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all">
      {imageUrls.length > 0 ? (
        <div className="aspect-video relative">
          <img
            src={imageUrls[currentImageIndex]}
            alt={`${property.name} - Image ${currentImageIndex + 1}`}
            className="object-cover w-full h-full"
          />
          {imageUrls.length > 1 && (
            <>
              <button
                onClick={previousImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white px-2 py-1 rounded-full text-sm">
                {currentImageIndex + 1} / {imageUrls.length}
              </div>
            </>
          )}
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
          <div className="flex justify-between items-start">
            <p className="text-sm text-muted-foreground">{property.description}</p>
            <div className="flex gap-2">
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(property)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm("Are you sure you want to delete this property?")) {
                    deleteProperty.mutate();
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

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