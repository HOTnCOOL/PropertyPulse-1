import React, { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import { createWorker, type Worker } from 'tesseract.js';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

interface IdScannerProps {
  onDataExtracted: (data: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    placeOfBirth?: string;
    idNumber?: string;
    homeAddress?: string;
    idType?: 'passport' | 'national_id';
  }) => void;
  onImageCaptured: (imageFile: File) => void;
}

export default function IdScanner({ onDataExtracted, onImageCaptured }: IdScannerProps) {
  const { toast } = useToast();
  const webcamRef = useRef<Webcam>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');

  const processImage = async (imageSource: string | File) => {
    setIsProcessing(true);
    try {
      const worker = await createWorker('eng');
      let result;

      if (typeof imageSource === 'string') {
        result = await worker.recognize(imageSource);
      } else {
        // Convert File to base64
        const reader = new FileReader();
        const base64String = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(imageSource);
        });
        result = await worker.recognize(base64String);
      }

      const text = result.data.text;
      console.log('Extracted text:', text);

      // Simple pattern matching for common ID/passport fields
      const extractedData = {
        firstName: extractField(text, /Given Names?:?\s*([A-Za-z\s]+)/i),
        lastName: extractField(text, /Surname:?\s*([A-Za-z\s]+)/i),
        dateOfBirth: extractDate(text),
        placeOfBirth: extractField(text, /Place of Birth:?\s*([A-Za-z\s,]+)/i),
        idNumber: extractField(text, /Passport No:?\s*([A-Z0-9]+)/i) || 
                 extractField(text, /ID No:?\s*([A-Z0-9]+)/i),
        homeAddress: extractAddress(text),
      };

      await worker.terminate();
      onDataExtracted(extractedData);
      toast({
        title: "Data Extracted",
        description: "ID/Passport information has been processed successfully.",
      });
    } catch (error) {
      console.error('OCR Error:', error);
      toast({
        title: "Processing Error",
        description: "Failed to process the image. Please try again or enter details manually.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const captureImage = async () => {
    if (!webcamRef.current) return;

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    // Convert base64 to File object
    const byteString = atob(imageSrc.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const file = new File([ab], 'captured-id.jpg', { type: 'image/jpeg' });

    onImageCaptured(file);
    await processImage(imageSrc);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    onImageCaptured(file);
    await processImage(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scan ID/Passport</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload Image</TabsTrigger>
            <TabsTrigger value="camera">Use Camera</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <Input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              disabled={isProcessing}
            />
          </TabsContent>

          <TabsContent value="camera">
            <div className="space-y-4">
              <Webcam
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                className="w-full rounded-lg"
              />
              <Button 
                onClick={captureImage}
                disabled={isProcessing}
                className="w-full"
              >
                Capture
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {isProcessing && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Processing image... Please wait.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper functions for text extraction
function extractField(text: string, pattern: RegExp): string | undefined {
  const match = text.match(pattern);
  return match?.[1]?.trim();
}

function extractDate(text: string): string | undefined {
  const datePattern = /(?:Date of Birth|Birth Date|DOB):?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i;
  const match = text.match(datePattern);
  if (!match) return undefined;
  return match[1];
}

function extractAddress(text: string): string | undefined {
  const addressPattern = /(?:Address|Residence):?\s*([A-Za-z0-9\s,.-]+)/i;
  const match = text.match(addressPattern);
  return match?.[1]?.trim();
}