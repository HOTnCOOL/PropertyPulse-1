import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Heart, Star, MapPin, Users, Bed, Bath, Wifi, Calendar, Coffee, ParkingCircle } from "lucide-react";

// Define our own Property type to match the DB schema 
interface Property {
  id: number;
  name: string;
  description?: string;
  type?: string;
  capacity?: string;
  rate: string;
  weeklyRate?: string | null;
  monthlyRate?: string | null;
  hourlyRate?: string | null;
  isOccupied?: boolean | null;
  address?: string;
  imageUrls?: string[] | string;
  amenities?: string;
  status?: string;
  bedType?: string;
  bathrooms?: number;
  isActive?: boolean;
  reservedDates?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

interface PropertyRecommendationsProps {
  currentPropertyId?: number;
  guestPreferences?: {
    amenities?: string[];
    priceRange?: { min: number; max: number };
    propertyType?: string;
    bedType?: string;
    location?: string;
    stayDuration?: number;
  };
  onPropertySelect?: (property: Property) => void;
}

export default function PropertyRecommendations({
  currentPropertyId,
  guestPreferences,
  onPropertySelect
}: PropertyRecommendationsProps) {
  const [recommendedProperties, setRecommendedProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Fetch all properties
  useEffect(() => {
    const fetchProperties = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/properties');
        if (!response.ok) {
          throw new Error('Failed to fetch properties');
        }
        
        const data = await response.json();
        
        // Filter out the current property
        const filteredProperties = currentPropertyId 
          ? data.filter((property: Property) => property.id !== currentPropertyId) 
          : data;
          
        // Apply smart recommendation algorithm
        const recommendations = applyRecommendationAlgorithm(filteredProperties, guestPreferences);
        
        setRecommendedProperties(recommendations);
      } catch (error) {
        console.error('Error fetching property recommendations:', error);
        toast({
          title: "Error",
          description: "Failed to load property recommendations",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProperties();
  }, [currentPropertyId, guestPreferences, toast]);

  // Apply recommendation algorithm based on guest preferences
  const applyRecommendationAlgorithm = (properties: Property[], preferences?: PropertyRecommendationsProps['guestPreferences']) => {
    if (!preferences || Object.keys(preferences).length === 0) {
      // If no preferences, just return properties sorted by rating
      return [...properties].sort((a, b) => 
        (parseInt(b.rate) || 0) - (parseInt(a.rate) || 0)
      );
    }

    // Calculate a score for each property based on how well it matches the preferences
    const scoredProperties = properties.map(property => {
      let score = 0;
      
      // Score based on price range match
      if (preferences.priceRange) {
        const rate = parseInt(property.rate) || 0;
        if (rate >= preferences.priceRange.min && rate <= preferences.priceRange.max) {
          score += 5; // Perfect price match
        } else {
          // Partial score for close prices
          const minDiff = Math.abs(rate - preferences.priceRange.min);
          const maxDiff = Math.abs(rate - preferences.priceRange.max);
          const minScore = Math.max(0, 5 - (minDiff / 50)); // Deduct points based on distance
          const maxScore = Math.max(0, 5 - (maxDiff / 50));
          score += Math.max(minScore, maxScore);
        }
      }
      
      // Score based on property type match
      if (preferences.propertyType && property.type) {
        if (property.type.toLowerCase() === preferences.propertyType.toLowerCase()) {
          score += 5;
        }
      }
      
      // Score based on bed type match
      if (preferences.bedType && property.bedType) {
        if (property.bedType.toLowerCase() === preferences.bedType.toLowerCase()) {
          score += 4;
        }
      }
      
      // Score based on location match
      if (preferences.location && property.address) {
        if (property.address.toLowerCase().includes(preferences.location.toLowerCase())) {
          score += 5;
        }
      }
      
      // Score based on amenities matches
      if (preferences.amenities && preferences.amenities.length > 0 && property.amenities) {
        const propertyAmenities = property.amenities.toLowerCase().split(',').map((a: string) => a.trim());
        
        for (const amenity of preferences.amenities) {
          if (propertyAmenities.some((a: string) => a.includes(amenity.toLowerCase()))) {
            score += 3; // Add points for each matching amenity
          }
        }
      }
      
      // Apply a small boost for availability during the preferred stay duration
      if (preferences.stayDuration && !property.isOccupied) {
        score += 3;
      }
      
      return { property, score };
    });

    // Sort by score in descending order
    return scoredProperties
      .sort((a, b) => b.score - a.score)
      .map(item => item.property);
  };

  // Parse amenities string to array of amenity objects
  const parseAmenities = (amenitiesStr?: string) => {
    if (!amenitiesStr) return [];
    
    return amenitiesStr.split(',').map(amenity => {
      const name = amenity.trim();
      let icon = null;
      
      // Map amenities to icons
      switch (name.toLowerCase()) {
        case 'wifi':
          icon = <Wifi className="h-4 w-4" />;
          break;
        case 'kitchen':
          icon = <Coffee className="h-4 w-4" />;
          break;
        case 'parking':
          icon = <ParkingCircle className="h-4 w-4" />;
          break;
        default:
          icon = null;
      }
      
      return { name, icon };
    });
  };

  if (isLoading) {
    return (
      <div className="w-full p-6 flex justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (recommendedProperties.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Similar Properties</CardTitle>
          <CardDescription>Properties you might also like</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">No similar properties found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Similar Properties</CardTitle>
        <CardDescription>Properties you might also like based on your preferences</CardDescription>
      </CardHeader>
      <CardContent>
        <Carousel className="w-full">
          <CarouselContent>
            {recommendedProperties.slice(0, 5).map((property) => (
              <CarouselItem key={property.id} className="md:basis-1/2 lg:basis-1/3">
                <Card className="h-full">
                  <div className="relative h-48 w-full overflow-hidden rounded-t-lg">
                    {property.imageUrls && 
                     (Array.isArray(property.imageUrls) ? property.imageUrls.length > 0 : property.imageUrls) ? (
                      <img 
                        src={Array.isArray(property.imageUrls) ? property.imageUrls[0] : property.imageUrls}
                        alt={property.name}
                        className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                    ) : (
                      <div className="bg-muted h-full w-full flex items-center justify-center">
                        <p className="text-muted-foreground">No image available</p>
                      </div>
                    )}
                    <Badge variant="secondary" className="absolute top-2 right-2">
                      ${property.rate}/night
                    </Badge>
                  </div>
                  <CardHeader className="p-4">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{property.name}</CardTitle>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Heart className="h-4 w-4" />
                      </Button>
                    </div>
                    {property.address && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 mr-1" />
                        <span className="truncate">{property.address}</span>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {property.type && (
                        <Badge variant="outline" className="text-xs">
                          {property.type}
                        </Badge>
                      )}
                      {property.bedType && (
                        <Badge variant="outline" className="text-xs">
                          {property.bedType} Bed
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        {property.capacity || "2"}
                      </Badge>
                      {property.bathrooms && (
                        <Badge variant="outline" className="text-xs">
                          <Bath className="h-3 w-3 mr-1" />
                          {property.bathrooms}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {property.amenities && parseAmenities(property.amenities).slice(0, 3).map((amenity, index) => (
                        <Badge key={index} variant="secondary" className="text-xs flex items-center">
                          {amenity.icon && <span className="mr-1">{amenity.icon}</span>}
                          {amenity.name}
                        </Badge>
                      ))}
                      {property.amenities && property.amenities.split(',').length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{property.amenities.split(',').length - 3} more
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="p-4 pt-0 flex justify-between items-center">
                    <div className="flex items-center">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 mr-1" />
                      <span className="text-sm font-medium">{4.8}</span>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => onPropertySelect && onPropertySelect(property)}
                    >
                      View Details
                    </Button>
                  </CardFooter>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-0" />
          <CarouselNext className="right-0" />
        </Carousel>
      </CardContent>
    </Card>
  );
}