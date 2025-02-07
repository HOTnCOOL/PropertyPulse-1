import { useQuery } from "@tanstack/react-query";
import PropertyCard from "@/components/PropertyCard";
import { Property } from "@db/schema";
import { Skeleton } from "@/components/ui/skeleton";

export function PublicPropertyList() {
  const { data: properties, isLoading } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
    queryFn: async () => {
      const response = await fetch("/api/properties");
      if (!response.ok) throw new Error("Failed to fetch properties");
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Find Your Perfect Stay</h1>
          <p className="text-lg text-muted-foreground">
            Browse our selection of premium properties and book your next getaway
          </p>
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
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Find Your Perfect Stay</h1>
        <p className="text-lg text-muted-foreground">
          Browse our selection of premium properties and book your next getaway
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {properties?.map((property) => (
          <PropertyCard
            key={property.id}
            property={property}
            isPublic
          />
        ))}
      </div>
    </div>
  );
}