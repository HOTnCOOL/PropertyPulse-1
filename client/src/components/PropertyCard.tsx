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
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span>Capacity: {property.capacity}</span>
            <span className="text-right">${Number(property.rate).toLocaleString()}/night</span>
            {property.hourlyRate && (
              <span className="text-muted-foreground">${Number(property.hourlyRate).toLocaleString()}/hour</span>
            )}
            {property.weeklyRate && (
              <span className="text-right text-muted-foreground">${Number(property.weeklyRate).toLocaleString()}/week</span>
            )}
            {property.monthlyRate && (
              <span className="text-muted-foreground">${Number(property.monthlyRate).toLocaleString()}/month</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}