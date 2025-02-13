import React, { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import { createWorker } from 'tesseract.js';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CameraIcon, FlipHorizontal } from 'lucide-react';

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
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const processImage = async (imageSource: string | File) => {
    setIsProcessing(true);
    try {
      const worker = await createWorker('eng');
      let result;

      if (typeof imageSource === 'string') {
        result = await worker.recognize(imageSource);
      } else {
        const reader = new FileReader();
        const base64String = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(imageSource);
        });
        result = await worker.recognize(base64String);
      }

      const text = result.data.text;
      console.log('Extracted text:', text);

      const extractedData = {
        firstName: extractField(text, /(?:Given Names?|First Names?|Nombres?):?\s*([A-Za-z\s]+)/i),
        lastName: extractField(text, /(?:Surname|Last Names?|Family Names?|Apellidos?):?\s*([A-Za-z\s]+)/i),
        dateOfBirth: extractDate(text),
        placeOfBirth: extractField(text, /(?:Place of Birth|Birth Place|Lugar de Nacimiento):?\s*([A-Za-z\s,]+)/i),
        idNumber: extractField(text, /(?:Passport No|ID No|Document No|Número):?\s*([A-Z0-9]+)/i),
        homeAddress: extractAddress(text),
        idType: text.toLowerCase().includes('passport') ? 'passport' : 'national_id'
      };

      console.log('Extracted data:', extractedData);
      await worker.terminate();

      if (Object.values(extractedData).some(value => value)) {
        onDataExtracted(extractedData);
        toast({
          title: "Data Extracted",
          description: "ID/Passport information has been processed successfully.",
        });
      } else {
        toast({
          title: "Extraction Warning",
          description: "Could not extract data from the image. Please try again or enter details manually.",
          variant: "destructive",
        });
      }
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

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
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
              <div className="relative">
                <Webcam
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  className="w-full rounded-lg"
                  videoConstraints={{
                    facingMode,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                  }}
                />
                <Button
                  size="icon"
                  variant="outline"
                  className="absolute top-2 right-2"
                  onClick={toggleCamera}
                >
                  <FlipHorizontal className="h-4 w-4" />
                </Button>
              </div>
              <Button 
                onClick={captureImage}
                disabled={isProcessing}
                className="w-full"
              >
                <CameraIcon className="mr-2 h-4 w-4" />
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

function extractField(text: string, pattern: RegExp): string | undefined {
  const match = text.match(pattern);
  return match?.[1]?.trim();
}

function extractDate(text: string): string | undefined {
  const datePatterns = [
    /(?:Date of Birth|Birth Date|DOB):?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i,
    /(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i  
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return undefined;
}

function extractAddress(text: string): string | undefined {
  const addressPatterns = [
    /(?:Address|Residence|Domicile):?\s*([A-Za-z0-9\s,.-]+(?:\n[A-Za-z0-9\s,.-]+)*)/i,
    /(?:Street|Ave|Road|Boulevard).*?([A-Za-z0-9\s,.-]+)/i
  ];

  for (const pattern of addressPatterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim().replace(/\n/g, ', ');
  }
  return undefined;
}