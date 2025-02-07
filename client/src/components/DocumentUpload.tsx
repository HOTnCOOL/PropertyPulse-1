import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { createWorker, Worker, RecognizeResult } from 'tesseract.js';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileCheck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DocumentUploadProps {
  onUpload: (files: File[]) => void;
  uploadedFiles: File[];
}

export default function DocumentUpload({ onUpload, uploadedFiles }: DocumentUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const processOCR = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      return null;
    }

    const worker = await createWorker();
    try {
      await worker.loadLanguage('eng');
      await worker.initialize('eng');

      const imageUrl = URL.createObjectURL(file);
      const result = await worker.recognize(imageUrl);

      URL.revokeObjectURL(imageUrl);
      await worker.terminate();

      return result.data.text;
    } catch (error) {
      console.error('OCR processing error:', error);
      return null;
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsProcessing(true);
    try {
      const results = await Promise.all(
        acceptedFiles.map(async (file) => {
          const ocrText = await processOCR(file);
          if (ocrText) {
            // Extract relevant information (you can enhance this based on your needs)
            const lines = ocrText.split('\n');
            let extractedInfo = {
              documentType: lines.find(line => line.toLowerCase().includes('passport') || line.toLowerCase().includes('identity'))?.trim(),
              documentNumber: lines.find(line => /^[A-Z0-9]{6,}$/)?.trim(),
              name: lines.find(line => /^[A-Z\s]{2,}$/)?.trim(),
            };

            toast({
              title: "Document Processed",
              description: `Successfully extracted information from ${file.name}`,
            });

            console.log('Extracted information:', extractedInfo);
          }
          return file;
        })
      );

      onUpload(results);
    } catch (error) {
      console.error('File processing error:', error);
      toast({
        title: "Error",
        description: "Failed to process document",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [onUpload, toast]);

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
          {isProcessing ? (
            <div className="flex flex-col items-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Processing document...</p>
            </div>
          ) : (
            <>
              <Upload className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                {isDragActive ? (
                  "Drop your documents here"
                ) : (
                  "Drag & drop passport or ID (both sides), or click to select"
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports automatic information extraction
              </p>
            </>
          )}
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