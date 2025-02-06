import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Check,
  X,
  Pencil,
} from "lucide-react";
import { useState } from "react";
import { type DateRange } from "react-day-picker";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Property } from "@db/schema";
import BookingForm from "./BookingForm";

interface PropertyCardProps {
  property: Property;
  onEdit?: (property: Property) => void;
  isPublic?: boolean;
}

interface EditableFieldProps {
  isEditing: boolean;
  value: string | number;
  onEdit: () => void;
  onSave: (value: string | number) => void;
  onCancel: () => void;
  type?: "text" | "number" | "select";
  options?: { value: string; label: string }[];
}

function EditableField({
  isEditing,
  value,
  onEdit,
  onSave,
  onCancel,
  type = "text",
  options = [],
}: EditableFieldProps) {
  const [editValue, setEditValue] = useState(value);

  if (!isEditing) {
    return (
      <div className="group flex items-center gap-2">
        <span>{value}</span>
        <button
          onClick={onEdit}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Pencil className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {type === "select" ? (
        <Select
          value={String(editValue)}
          onValueChange={(value) => setEditValue(value)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          type={type}
          value={editValue}
          onChange={(e) =>
            setEditValue(type === "number" ? Number(e.target.value) : e.target.value)
          }
          className="w-[180px]"
        />
      )}
      <Button size="sm" variant="ghost" onClick={() => onSave(editValue)}>
        <Check className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function PropertyCard({ property, onEdit, isPublic = false }: PropertyCardProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [editingField, setEditingField] = useState<string | null>(null);
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

  const updateField = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: any }) => {
      const response = await fetch(`/api/properties/${property.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!response.ok) throw new Error("Failed to update property");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      setEditingField(null);
      toast({
        title: "Success",
        description: "Property has been updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update property",
        variant: "destructive",
      });
    },
  });

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
          {isPublic ? (
            <span>{property.name}</span>
          ) : (
            <EditableField
              isEditing={editingField === "name"}
              value={property.name}
              onEdit={() => setEditingField("name")}
              onSave={(value) => updateField.mutate({ field: "name", value })}
              onCancel={() => setEditingField(null)}
            />
          )}
          <div className="flex items-center gap-2 text-sm font-normal">
            <Users className="h-4 w-4" />
            {isPublic ? (
              <span>{property.capacity}</span>
            ) : (
              <EditableField
                isEditing={editingField === "capacity"}
                value={property.capacity}
                onEdit={() => setEditingField("capacity")}
                onSave={(value) => updateField.mutate({ field: "capacity", value })}
                onCancel={() => setEditingField(null)}
              />
            )}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex justify-between items-start">
            {isPublic ? (
              <p>{property.description}</p>
            ) : (
              <EditableField
                isEditing={editingField === "description"}
                value={property.description}
                onEdit={() => setEditingField("description")}
                onSave={(value) => updateField.mutate({ field: "description", value })}
                onCancel={() => setEditingField(null)}
              />
            )}
            {!isPublic && (
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
            )}
          </div>

          {/* Key Features */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Bed className="h-4 w-4" />
              {isPublic ? (
                <span>{property.bedType}</span>
              ) : (
                <EditableField
                  isEditing={editingField === "bedType"}
                  value={property.bedType || ""}
                  onEdit={() => setEditingField("bedType")}
                  onSave={(value) => updateField.mutate({ field: "bedType", value })}
                  onCancel={() => setEditingField(null)}
                  type="select"
                  options={[
                    { value: "single", label: "Single" },
                    { value: "double", label: "Double" },
                    { value: "queen", label: "Queen" },
                    { value: "king", label: "King" },
                  ]}
                />
              )}
            </div>
            {property.bathrooms && (
              <div className="flex items-center gap-2">
                <Bath className="h-4 w-4" />
                {isPublic ? (
                  <span>{property.bathrooms}</span>
                ) : (
                  <EditableField
                    isEditing={editingField === "bathrooms"}
                    value={property.bathrooms}
                    onEdit={() => setEditingField("bathrooms")}
                    onSave={(value) =>
                      updateField.mutate({ field: "bathrooms", value: Number(value) })
                    }
                    onCancel={() => setEditingField(null)}
                    type="number"
                  />
                )}
              </div>
            )}
          </div>

          {/* Rates */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="text-lg font-semibold">
                ${isPublic ? property.rate : <EditableField
                  isEditing={editingField === "rate"}
                  value={Number(property.rate)}
                  onEdit={() => setEditingField("rate")}
                  onSave={(value) =>
                    updateField.mutate({ field: "rate", value: Number(value) })
                  }
                  onCancel={() => setEditingField(null)}
                  type="number"
                />}/night
              </div>
              {property.hourlyRate && (
                <div className="text-sm text-muted-foreground">
                  ${isPublic ? property.hourlyRate : <EditableField
                    isEditing={editingField === "hourlyRate"}
                    value={Number(property.hourlyRate)}
                    onEdit={() => setEditingField("hourlyRate")}
                    onSave={(value) =>
                      updateField.mutate({ field: "hourlyRate", value: Number(value) })
                    }
                    onCancel={() => setEditingField(null)}
                    type="number"
                  />}/hour
                </div>
              )}
            </div>
            <div className="space-y-1 text-right">
              {property.weeklyRate && (
                <div className="text-sm text-muted-foreground">
                  ${isPublic ? property.weeklyRate : <EditableField
                    isEditing={editingField === "weeklyRate"}
                    value={Number(property.weeklyRate)}
                    onEdit={() => setEditingField("weeklyRate")}
                    onSave={(value) =>
                      updateField.mutate({ field: "weeklyRate", value: Number(value) })
                    }
                    onCancel={() => setEditingField(null)}
                    type="number"
                  />}/week
                </div>
              )}
              {property.monthlyRate && (
                <div className="text-sm text-muted-foreground">
                  ${isPublic ? property.monthlyRate : <EditableField
                    isEditing={editingField === "monthlyRate"}
                    value={Number(property.monthlyRate)}
                    onEdit={() => setEditingField("monthlyRate")}
                    onSave={(value) =>
                      updateField.mutate({ field: "monthlyRate", value: Number(value) })
                    }
                    onCancel={() => setEditingField(null)}
                    type="number"
                  />}/month
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Booking Form */}
        <div className="border rounded-lg p-4">
          <h4 className="text-sm font-medium mb-2">Book this Property</h4>
          <BookingForm
            property={property}
            onSuccess={() => {
              toast({
                title: "Success",
                description: "Booking request submitted successfully",
              });
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}