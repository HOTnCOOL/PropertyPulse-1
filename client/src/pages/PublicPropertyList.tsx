import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import PropertyCard from "@/components/PropertyCard";
import PropertyRecommendations from "@/components/PropertyRecommendations"; 
import { Property } from "@db/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { LogIn, Search, Filter, Calendar } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function PublicPropertyList() {
  const [, setLocation] = useLocation();
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [guestPreferences, setGuestPreferences] = useState({
    amenities: ["wifi", "parking"],
    priceRange: { min: 50, max: 300 },
    propertyType: "Apartment"
  });

  const { data: properties, isLoading } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
    queryFn: async () => {
      const response = await fetch("/api/properties");
      if (!response.ok) throw new Error("Failed to fetch properties");
      return response.json();
    },
  });

  // Filter properties based on search and filter criteria
  const filteredProperties = properties?.filter(property => {
    // Apply search filter
    const matchesSearch = !searchTerm || 
      property.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      property.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      property.address?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Apply type filter
    const matchesType = !filterType || property.type === filterType;
    
    return matchesSearch && matchesType;
  });

  const handlePropertySelect = (property: Property) => {
    setSelectedPropertyId(property.id);
    // Scroll to the property card
    const element = document.getElementById(`property-${property.id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add a highlight effect
      element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
      }, 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <div className="text-center flex-1">
            <h1 className="text-4xl font-bold mb-4">Find Your Perfect Stay</h1>
            <p className="text-lg text-muted-foreground">
              Browse our selection of premium properties and book your next getaway
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setLocation("/payment-demo")}>
              Payment Calculator Demo
            </Button>
            <Button variant="outline" onClick={() => setLocation("/auth")}>
              <LogIn className="mr-2 h-4 w-4" />
              Sign In
            </Button>
          </div>
        </div>
        <div className="mb-8">
          <Skeleton className="h-12 w-full rounded-lg mb-4" />
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-[500px] w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div className="text-center flex-1">
          <h1 className="text-4xl font-bold mb-4">Find Your Perfect Stay</h1>
          <p className="text-lg text-muted-foreground">
            Browse our selection of premium properties and book your next getaway
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLocation("/payment-demo")}>
            Payment Calculator Demo
          </Button>
          <Button variant="outline" onClick={() => setLocation("/auth")}>
            <LogIn className="mr-2 h-4 w-4" />
            Sign In
          </Button>
        </div>
      </div>

      {/* Search and Filter Section */}
      <Card className="mb-8">
        <CardContent className="p-4">
          <Tabs defaultValue="search" className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="search" className="flex items-center gap-1">
                <Search className="h-4 w-4" />
                <span>Search</span>
              </TabsTrigger>
              <TabsTrigger value="filter" className="flex items-center gap-1">
                <Filter className="h-4 w-4" />
                <span>Filter</span>
              </TabsTrigger>
              <TabsTrigger value="dates" className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Dates</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="search" className="p-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search properties by name, description, or location..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Button>Search</Button>
              </div>
            </TabsContent>
            <TabsContent value="filter" className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Property Type</label>
                  <Select
                    value={filterType || ""}
                    onValueChange={(value) => setFilterType(value || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All types</SelectItem>
                      <SelectItem value="Apartment">Apartment</SelectItem>
                      <SelectItem value="House">House</SelectItem>
                      <SelectItem value="Villa">Villa</SelectItem>
                      <SelectItem value="Hotel">Hotel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Price Range</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Any price" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="budget">Budget ($0-$100)</SelectItem>
                      <SelectItem value="moderate">Moderate ($100-$200)</SelectItem>
                      <SelectItem value="luxury">Luxury ($200+)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Amenities</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select amenities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wifi">WiFi</SelectItem>
                      <SelectItem value="kitchen">Kitchen</SelectItem>
                      <SelectItem value="parking">Parking</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="dates" className="p-4">
              <p className="text-center text-muted-foreground">
                Date selection functionality will be implemented in a future update.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Smart Recommendations Section */}
      <div className="mb-12">
        <PropertyRecommendations
          guestPreferences={guestPreferences}
          onPropertySelect={handlePropertySelect}
        />
      </div>

      {/* Property Listings */}
      <h2 className="text-2xl font-bold mb-6">Available Properties</h2>
      {filteredProperties && filteredProperties.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProperties.map((property) => (
            <div 
              id={`property-${property.id}`} 
              key={property.id}
              className="transition-all duration-300"
            >
              <PropertyCard
                property={property}
                isPublic
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground">No properties found matching your criteria.</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => {
              setSearchTerm("");
              setFilterType(null);
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}