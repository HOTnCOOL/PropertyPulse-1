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
  onImageCaptured: (file: File) => void;
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
      const worker = await createWorker('eng+bul');
      await worker.setParameters({
        tessedit_pageseg_mode: '3',
        preserve_interword_spaces: '1',
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯабвгдежзийклмнопрстуфхцчшщъьюя0123456789.-/',
        tessjs_create_tsv: '1',
      });

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
      console.log('Raw extracted text:', text);

      // Process the text line by line for debugging
      const lines = text.split('\n');
      console.log('Text lines:', lines);

      // Bulgarian ID specific patterns
      const extractedData = {
        firstName: extractField(text, /(?:Names?|Име|Given Names?|First Names?|Nombres?):?\s*([A-Za-zА-Яа-я\s]+)/i),
        lastName: extractField(text, /(?:Surname|Family Name|Фамилия|Last Names?|Apellidos?):?\s*([A-Za-zА-Яа-я\s]+)/i),
        dateOfBirth: extractDate(text),
        placeOfBirth: extractField(text, /(?:Place of Birth|Birth Place|Място на раждане):?\s*([A-Za-zА-Яа-я\s,]+)/i),
        idNumber: extractField(text, /(?:ЕГН|ID No|ЛНЧ|Document No|Número):?\s*([A-Z0-9]+)/i) ||
                 extractField(text, /(?:\b\d{2}\.\d{2}\.\d{4}\b.*?)(\d{10})/),  // Pattern for Bulgarian ID number after date
        homeAddress: extractAddress(text),
        idType: text.toLowerCase().includes('passport') ? 'passport' : 'national_id'
      };

      console.log('Parsed data from ID:', extractedData);
      await worker.terminate();

      if (Object.values(extractedData).some(value => value)) {
        onDataExtracted(extractedData);
        toast({
          title: "Data Extracted",
          description: `Found: ${Object.entries(extractedData)
            .filter(([_, v]) => v)
            .map(([k]) => k)
            .join(', ')}`,
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
    /(?:Date of Birth|Birth Date|DOB|Дата на раждане):?\s*(\d{1,2}[-./]\d{1,2}[-./]\d{2,4})/i,
    /(\d{1,2}[-./]\d{1,2}[-./]\d{2,4})/i,
    /(\d{2}\.\d{2}\.\d{4})/  // Bulgarian date format
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return undefined;
}

function extractAddress(text: string): string | undefined {
  const addressPatterns = [
    /(?:Address|Residence|Domicile|Адрес|Местоживеене):?\s*([A-Za-zА-Яа-я0-9\s,.-]+(?:\n[A-Za-zА-Яа-я0-9\s,.-]+)*)/i,
    /(?:гр\.|с\.)\s*([A-Za-zА-Яа-я0-9\s,.-]+)/i,  // Bulgarian city/village pattern
    /(?:Street|Ave|Road|Boulevard|ул\.|бул\.)\s*([A-Za-zА-Яа-я0-9\s,.-]+)/i
  ];

  for (const pattern of addressPatterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim().replace(/\n/g, ', ');
  }
  return undefined;
}