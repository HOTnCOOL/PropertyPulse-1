import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Property } from "@db/schema";

interface PropertyCardProps {
  property: Property;
}

export default function PropertyCard({ property }: PropertyCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{property.name}</span>
          <Badge>{property.type}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{property.description}</p>
          <div className="flex justify-between text-sm">
            <span>Capacity: {property.capacity}</span>
            <span>${Number(property.rate).toLocaleString()}/night</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}