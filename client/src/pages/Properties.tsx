import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Image, Plus, ChevronDown, ChevronUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { insertPropertySchema, type Property } from "@db/schema";
import PropertyCard from "../components/PropertyCard";
import * as z from 'zod';

export default function Properties() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  const form = useForm({
    resolver: zodResolver(insertPropertySchema),
    defaultValues: {
      name: "",
      description: "",
      type: "",
      capacity: undefined,
      hourlyRate: undefined,
      rate: undefined,
      weeklyRate: undefined,
      monthlyRate: undefined,
      images: [],
      bedType: "",
      bathrooms: 1,
      amenities: {
        tv: false,
        aircon: false,
        view: false,
        balcony: false,
        fireplace: false,
        sofa: false,
      },
    },
  });

  const { data: properties } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });

  const addProperty = useMutation({
    mutationFn: async (values: z.infer<typeof insertPropertySchema>) => {
      const response = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error("Failed to add property");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      form.reset();
      setIsFormOpen(false);
      toast({
        title: "Success",
        description: "Property has been added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add property",
        variant: "destructive",
      });
    },
  });

  const editProperty = useMutation({
    mutationFn: async (values: z.infer<typeof insertPropertySchema> & { id: number }) => {
      const { id, ...propertyData } = values;
      const response = await fetch(`/api/properties/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(propertyData),
      });
      if (!response.ok) throw new Error("Failed to update property");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      form.reset();
      setEditingProperty(null);
      setIsFormOpen(false);
      toast({
        title: "Success",
        description: "Property has been updated successfully",
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

  const uploadImages = useMutation({
    mutationFn: async ({ id, files }: { id: number; files: FileList }) => {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("images", file);
      });

      const response = await fetch(`/api/properties/${id}/images`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to upload images");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      toast({
        title: "Success",
        description: "Images uploaded successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload images",
        variant: "destructive",
      });
    },
  });

  function onSubmit(values: z.infer<typeof insertPropertySchema>) {
    if (editingProperty) {
      editProperty.mutate({
        ...values,
        id: editingProperty.id,
        capacity: values.capacity,
        bathrooms: Number(values.bathrooms),
        hourlyRate: values.hourlyRate ? Number(values.hourlyRate) : null,
        rate: Number(values.rate),
        weeklyRate: values.weeklyRate ? Number(values.weeklyRate) : null,
        monthlyRate: values.monthlyRate ? Number(values.monthlyRate) : null,
      });
    } else {
      addProperty.mutate({
        ...values,
        capacity: values.capacity,
        bathrooms: Number(values.bathrooms),
        hourlyRate: values.hourlyRate ? Number(values.hourlyRate) : null,
        rate: Number(values.rate),
        weeklyRate: values.weeklyRate ? Number(values.weeklyRate) : null,
        monthlyRate: values.monthlyRate ? Number(values.monthlyRate) : null,
      });
    }
  }

  // Handle editing a property
  const handleEdit = (property: Property) => {
    setEditingProperty(property);
    form.reset({
      name: property.name,
      description: property.description,
      type: property.type,
      capacity: property.capacity,
      hourlyRate: property.hourlyRate ? Number(property.hourlyRate) : undefined,
      rate: Number(property.rate),
      weeklyRate: property.weeklyRate ? Number(property.weeklyRate) : undefined,
      monthlyRate: property.monthlyRate ? Number(property.monthlyRate) : undefined,
      bedType: property.bedType || "",
      bathrooms: property.bathrooms || 1,
      amenities: property.amenities as any,
    });
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Properties</h1>
        <Button onClick={() => {
          setEditingProperty(null);
          form.reset();
          setIsFormOpen(!isFormOpen);
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Property
        </Button>
      </div>

      {/* Property Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {properties?.map((property) => (
          <PropertyCard
            key={property.id}
            property={property}
            onEdit={handleEdit}
          />
        ))}
      </div>

      {/* Add/Edit Property Form */}
      <Collapsible open={isFormOpen} onOpenChange={setIsFormOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full">
            {isFormOpen ? (
              <>
                <ChevronUp className="mr-2 h-4 w-4" />
                Hide Form
              </>
            ) : (
              <>
                <ChevronDown className="mr-2 h-4 w-4" />
                Show {editingProperty ? 'Edit' : 'Add'} Property Form
              </>
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>{editingProperty ? 'Edit' : 'Add New'} Property</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* Basic Information */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Property Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select property type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="studio">Studio</SelectItem>
                              <SelectItem value="room">Room</SelectItem>
                              <SelectItem value="floor">Floor</SelectItem>
                              <SelectItem value="house">House</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="images"
                    render={({ field: { onChange, value, ...field } }) => (
                      <FormItem>
                        <FormLabel>Property Images</FormLabel>
                        <FormControl>
                          <div className="grid gap-4">
                            <Input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  uploadImages.mutate({
                                    id: editingProperty ? editingProperty.id : 0, 
                                    files: e.target.files,
                                  });
                                }
                              }}
                              {...field}
                            />
                            <p className="text-sm text-muted-foreground">
                              Upload up to 5 images (max 5MB each). Accepted formats: JPEG, PNG, WebP
                            </p>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Features */}
                  <div className="grid md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="capacity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Capacity</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., 2 or 2+1"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bedType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bed Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select bed type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="single">Single</SelectItem>
                              <SelectItem value="double">Double</SelectItem>
                              <SelectItem value="queen">Queen</SelectItem>
                              <SelectItem value="king">King</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bathrooms"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bathrooms</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              {...field}
                              onChange={(e) => field.onChange(e.target.valueAsNumber)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Amenities */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Amenities</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {([
                        ["tv", "TV"],
                        ["aircon", "Air Conditioning"],
                        ["view", "View"],
                        ["balcony", "Balcony"],
                        ["fireplace", "Fireplace"],
                        ["sofa", "Sofa"],
                      ] as const).map(([key, label]) => (
                        <FormField
                          key={key}
                          control={form.control}
                          name={`amenities.${key}`}
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="!mt-0">{label}</FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Rates */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="hourlyRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hourly Rate ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              {...field}
                              onChange={(e) => field.onChange(Math.floor(e.target.valueAsNumber))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="rate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nightly Rate ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              {...field}
                              onChange={(e) => field.onChange(Math.floor(e.target.valueAsNumber))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="weeklyRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Weekly Rate ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              {...field}
                              onChange={(e) => field.onChange(Math.floor(e.target.valueAsNumber))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="monthlyRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Monthly Rate ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              {...field}
                              onChange={(e) => field.onChange(Math.floor(e.target.valueAsNumber))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    {editingProperty ? 'Update Property' : 'Add Property'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}