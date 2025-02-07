import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface PaymentDetailsProps {
  paymentId: number;
}

export default function PaymentDetails({ paymentId }: PaymentDetailsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  const { data: details, isLoading } = useQuery({
    queryKey: ['/api/payments/details', paymentId],
    queryFn: async () => {
      const response = await fetch(`/api/payments/${paymentId}/details`);
      if (!response.ok) throw new Error("Failed to fetch payment details");
      return response.json();
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append("documents", file);
      });

      const response = await fetch(`/api/payments/${paymentId}/documents`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) throw new Error("Failed to upload documents");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payments/details', paymentId] });
      toast({
        title: "Success",
        description: "Documents uploaded successfully"
      });
      setSelectedFiles(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload documents",
        variant: "destructive"
      });
    }
  });

  if (isLoading) {
    return <div>Loading payment details...</div>;
  }

  if (!details) return null;

  const { current, next, history } = details;

  return (
    <div className="space-y-6">
      {/* Current Payment Details */}
      <Card>
        <CardHeader>
          <CardTitle>Current Payment Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium">Amount</h4>
                <p className="text-2xl font-bold">${current.amount.toLocaleString()}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium">Status</h4>
                <p className={`text-lg font-medium ${
                  current.status === 'confirmed' ? 'text-green-600' : 'text-orange-600'
                }`}>
                  {current.status.charAt(0).toUpperCase() + current.status.slice(1)}
                </p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Payment Documents</h4>
              {current.documentUrls?.length > 0 ? (
                <div className="space-y-2">
                  {current.documentUrls.map((url, index) => (
                    <a
                      key={index}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-2 text-sm text-blue-600 hover:underline"
                    >
                      <FileText className="h-4 w-4" />
                      <span>Document {index + 1}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
              )}
              
              <div className="mt-4 space-y-2">
                <Input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
                  onChange={(e) => setSelectedFiles(e.target.files)}
                  className="text-sm"
                />
                <Button
                  size="sm"
                  onClick={() => selectedFiles && uploadMutation.mutate(selectedFiles)}
                  disabled={!selectedFiles || uploadMutation.isPending}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadMutation.isPending ? "Uploading..." : "Upload Documents"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next Payment */}
      {next && (
        <Card>
          <CardHeader>
            <CardTitle>Next Payment Due</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Amount Due</span>
                <span className="text-lg font-bold">${next.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Due Date</span>
                <span className="text-sm">{format(new Date(next.dueDate), "MMMM d, yyyy")}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {history.length > 0 ? (
              history.map((payment, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">
                      ${payment.amount.toLocaleString()}
                      <span className={`ml-2 text-xs ${
                        payment.status === 'confirmed' ? 'text-green-600' : 'text-orange-600'
                      }`}>
                        {payment.status}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(payment.date), "MMMM d, yyyy")}
                    </p>
                  </div>
                  {payment.documentUrls?.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(payment.documentUrls[0], '_blank')}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      View Documents
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No payment history available</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
