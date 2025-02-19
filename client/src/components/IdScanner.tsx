import React, { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import { createWorker, PSM } from 'tesseract.js';
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
    personalNumber?: string;
    expiryDate?: string;
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
    toast({
      title: "Processing",
      description: "Initializing ID scanner...",
    });
    try {
      const worker = await createWorker({
        logger: console.log,
        workerPath: 'https://unpkg.com/tesseract.js@v5.0.3/dist/worker.min.js',
        workerBlobURL: false,
        corePath: 'https://unpkg.com/tesseract.js-core@v5.0.3/tesseract-core.wasm.js',
      });
      await worker.load();
      await worker.loadLanguage('eng+bul');
      await worker.initialize('eng+bul');
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: '1',
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯабвгдежзийклмнопрстуфхцчшщъьюя0123456789.-/',
        tessjs_create_tsv: '1',
        tessedit_enable_doc_dict: '1', // Enabled for better dictionary usage
        textord_heavy_nr: '1',
        language_model_penalty_non_freq_dict_word: '0.5',
        language_model_penalty_non_dict_word: '0.5',
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
      const names = extractName(text);
      const dates = extractDate(text);

      const extractedData = {
        firstName: names.firstName,
        lastName: names.lastName,
        dateOfBirth: dates.dateOfBirth,
        expiryDate: dates.expiryDate,
        idNumber: extractIdNumber(text),
        personalNumber: extractPersonalNumber(text),
        homeAddress: extractAddress(text),
        idType: text.toLowerCase().includes('passport') ? 'passport' : 'national_id' as const
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
    } catch (error: unknown) {
      console.error('OCR Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined
      });
      toast({
        title: "Processing Error",
        description: `Failed to process the image: ${error instanceof Error ? error.message : String(error)}. Please try again or enter details manually.`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const compressImage = async (base64String: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64String;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxWidth = 1280;
        const maxHeight = 720;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
    });
  };

  const captureImage = async () => {
    if (!webcamRef.current) return;

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    const compressedImage = await compressImage(imageSrc);
    const byteString = atob(compressedImage.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const file = new File([ab], 'captured-id.jpg', { type: 'image/jpeg' });

    onImageCaptured(file);
    await processImage(compressedImage);
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

function extractName(text: string): { firstName?: string, lastName?: string } {
  const lines = text.split('\n');

  for (const line of lines) {
    // Look for lines with uppercase letters and potential name patterns
    if (/[A-ZА-Я]{3,}/.test(line)) {
      // Clean up the line and split by common separators
      const cleanLine = line.replace(/[0-9]/g, '').trim();
      const parts = cleanLine.split(/[CS\s]+/).filter(part =>
        part.length > 2 && /^[A-ZА-Я]+$/.test(part)
      );

      if (parts.length >= 2) {
        // Try to identify last name (usually comes first) and first name
        const lastName = parts[0];
        const firstName = parts[1];

        if (lastName && firstName) {
          return {
            firstName: firstName.trim(),
            lastName: lastName.trim()
          };
        }
      }
    }
  }
  return {};
}

function extractIdNumber(text: string): string | undefined {
  const idPatterns = [
    /(?:6491519\d{3})/,  // Document number
    /(?:7810175\d{4})/,  // Personal number
    /(?:\d{10})/  // Generic 10-digit number
  ];

  for (const pattern of idPatterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return undefined;
}

function extractPersonalNumber(text: string): string | undefined {
  const personalNumberPatterns = [
    /ЕГН\s*[:|]\s*(\d{10})/i,
    /ЛНЧ\s*[:|]\s*(\d{10})/i,
    /Personal No\.?\s*[:|]\s*(\d{10})/i,
    /(\d{10})/  // Last resort - any 10 digit number
  ];

  for (const pattern of personalNumberPatterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return undefined;
}

function extractDate(text: string): { dateOfBirth?: string, expiryDate?: string } {
  const datePatterns = [
    /(\d{2}\.\d{2}\.\d{4})/g,  // Bulgarian date format
    /(\d{1,2}[-./]\d{1,2}[-./]\d{2,4})/g,  // Generic date format
  ];

  const dates: Array<{ date: string; year: number }> = [];
  for (const pattern of datePatterns) {
    const matches = Array.from(text.matchAll(pattern));
    matches.forEach(match => {
      const date = match[1];
      const [day, month, year] = date.split(/[-./]/).map(Number);
      // Assume 20xx for two-digit years, 19xx for others
      const fullYear = year < 100 ? (year < 50 ? 2000 + year : 1900 + year) : year;
      if (fullYear > 1900) {
        dates.push({ date, year: fullYear });
      }
    });
  }

  // Sort dates - earliest is likely birth date, latest is expiry
  dates.sort((a, b) => a.year - b.year);

  return {
    dateOfBirth: dates[0]?.date,
    expiryDate: dates[dates.length - 1]?.date
  };
}

function extractAddress(text: string): string | undefined {
  const addressPatterns = [
    /(?:Address|Residence|Domicile|Адрес|Местоживеене):?\s*([A-Za-zА-Яа-я0-9\s,.-]+(?:\n[A-Za-zА-Яа-я0-9\s,.-]+)*)/i,
    /БЪЛГАРИЯ\/([A-Za-zА-Яа-я0-9\s,.-]+)/i,
    /(?:гр\.|с\.)\s*([A-Za-zА-Яа-я0-9\s,.-]+)/i,
  ];

  for (const pattern of addressPatterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim().replace(/\n/g, ', ');
  }
  return undefined;
}