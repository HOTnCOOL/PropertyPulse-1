import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: string;
}

const AVAILABLE_SERVICES: Service[] = [
  {
    id: "jacuzzi",
    name: "Jacuzzi Pack",
    description: "Private jacuzzi access with complimentary refreshments",
    price: 50,
    duration: "per day"
  },
  {
    id: "sauna",
    name: "Sauna Pack",
    description: "Access to private sauna sessions",
    price: 40,
    duration: "per day"
  },
  {
    id: "massage",
    name: "Private Massage",
    description: "Professional massage service in your room",
    price: 80,
    duration: "per session"
  },
  {
    id: "guide",
    name: "Personal City Guide",
    description: "Experienced local guide for city tours and nightlife",
    price: 120,
    duration: "per day"
  },
  {
    id: "gym",
    name: "Gym Pack",
    description: "Access to premium fitness facilities",
    price: 25,
    duration: "per day"
  }
];

interface AdditionalServicesProps {
  onServicesChange: (services: Service[]) => void;
}

export default function AdditionalServices({ onServicesChange }: AdditionalServicesProps) {
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const handleServiceToggle = (serviceId: string) => {
    setSelectedServices(prev => {
      const newSelection = prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId];
      
      onServicesChange(
        AVAILABLE_SERVICES.filter(service => 
          newSelection.includes(service.id)
        )
      );
      
      return newSelection;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Additional Services</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {AVAILABLE_SERVICES.map((service) => (
            <div key={service.id} className="flex items-center space-x-4">
              <Checkbox
                id={service.id}
                checked={selectedServices.includes(service.id)}
                onCheckedChange={() => handleServiceToggle(service.id)}
              />
              <div className="flex-1">
                <label
                  htmlFor={service.id}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {service.name}
                </label>
                <p className="text-sm text-muted-foreground">
                  ${service.price} {service.duration}
                </p>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Info className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{service.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
