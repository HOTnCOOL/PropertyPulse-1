import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileCheck } from "lucide-react";

interface DocumentUploadProps {
  onUpload: (files: File[]) => void;
  uploadedFiles: File[];
}

export default function DocumentUpload({ onUpload, uploadedFiles }: DocumentUploadProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onUpload(acceptedFiles);
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 2,
    maxSize: 5000000, // 5MB
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Identity Documents</CardTitle>
      </CardHeader>
      <CardContent>
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
            ${isDragActive ? 'border-primary bg-accent/50' : 'border-muted-foreground/25'}`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            {isDragActive ? (
              "Drop your documents here"
            ) : (
              "Drag & drop passport or ID (both sides), or click to select"
            )}
          </p>
        </div>

        {uploadedFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            {uploadedFiles.map((file, index) => (
              <div key={index} className="flex items-center text-sm text-muted-foreground">
                <FileCheck className="h-4 w-4 mr-2 text-green-500" />
                <span>{file.name}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}