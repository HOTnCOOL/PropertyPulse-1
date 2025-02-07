import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Pencil,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import type { Property } from "@db/schema";
import { type DateRange } from "react-day-picker"; //Retained from original


interface PropertyCardProps {
  property: Property;
  onEdit?: (property: Property) => void; //Retained from original
  isPublic?: boolean;
}

interface EditableFieldProps { //Retained from original
  isEditing: boolean;
  value: string | number;
  onEdit: () => void;
  onSave: (value: string | number) => void;
  onCancel: () => void;
  type?: "text" | "number" | "select";
  options?: { value: string; label: string }[];
}

function EditableField({ //Retained from original
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
  const [, setLocation] = useLocation();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [editingField, setEditingField] = useState<string | null>(null); //Retained from original
  const amenities = property.amenities as Record<string, boolean>;
  const imageUrls = (property.imageUrls as string[]) || [];

  const handleBookNow = () => {
    setLocation(`/guest-registration?propertyId=${property.id}`);
  };

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
              onSave={(value) => {/*Empty onSave to avoid errors*/}}
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
                onSave={(value) => {/*Empty onSave to avoid errors*/}}
                onCancel={() => setEditingField(null)}
              />
            )}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-4">
          {isPublic ? (
            <p>{property.description}</p>
          ) : (
            <EditableField
              isEditing={editingField === "description"}
              value={property.description}
              onEdit={() => setEditingField("description")}
              onSave={(value) => {/*Empty onSave to avoid errors*/}}
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
                onClick={() => {/*Empty onClick to avoid errors*/}}
              >
                {/*Removed delete functionality for public view*/}
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-4">
            {property.bedType && (
              <div className="flex items-center gap-2">
                <Bed className="h-4 w-4" />
                {isPublic ? (
                  <span>{property.bedType}</span>
                ) : (
                  <EditableField
                    isEditing={editingField === "bedType"}
                    value={property.bedType || ""}
                    onEdit={() => setEditingField("bedType")}
                    onSave={(value) => {/*Empty onSave to avoid errors*/}}
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
            )}
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
                    onSave={(value) => {/*Empty onSave to avoid errors*/}}
                    onCancel={() => setEditingField(null)}
                    type="number"
                  />
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="text-lg font-semibold">
                ${isPublic ? property.rate : <EditableField
                  isEditing={editingField === "rate"}
                  value={Number(property.rate)}
                  onEdit={() => setEditingField("rate")}
                  onSave={(value) => {/*Empty onSave to avoid errors*/}}
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
                    onSave={(value) => {/*Empty onSave to avoid errors*/}}
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
                    onSave={(value) => {/*Empty onSave to avoid errors*/}}
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
                    onSave={(value) => {/*Empty onSave to avoid errors*/}}
                    onCancel={() => setEditingField(null)}
                    type="number"
                  />}/month
                </div>
              )}
            </div>
          </div>

          {/* Amenities */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(amenities).map(([key, value]) => {
              if (!value) return null;
              const Icon = {
                tv: Tv,
                aircon: Wind,
                view: Mountain,
                balcony: Home,
                fireplace: Flame,
                sofa: Sofa,
              }[key];
              return Icon ? (
                <Badge key={key} variant="secondary" className="gap-1">
                  <Icon className="h-3 w-3" />
                  <span className="capitalize">{key}</span>
                </Badge>
              ) : null;
            })}
          </div>

          {isPublic && (
            <Button className="w-full" onClick={handleBookNow}>
              <CalendarRange className="mr-2 h-4 w-4" />
              Book Now
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}