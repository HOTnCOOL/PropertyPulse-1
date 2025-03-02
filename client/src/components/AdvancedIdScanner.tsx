import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Camera, Upload, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface IdScanResult {
  success: boolean;
  data?: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    idNumber?: string;
    expiryDate?: string;
    nationality?: string;
    homeAddress?: string;
    personalNumber?: string;
    idType?: 'passport' | 'national_id';
    orientation?: 'portrait' | 'landscape';
  };
  documentId?: number;
  confidence?: number;
  error?: string;
}

interface AdvancedIdScannerProps {
  onDataExtracted: (data: IdScanResult['data'] | undefined) => void;
  onImageCaptured: (file: File, documentId?: number) => void;
  guestId?: number;
  bookingId?: number;
}

export default function AdvancedIdScanner({ 
  onDataExtracted, 
  onImageCaptured,
  guestId,
  bookingId
}: AdvancedIdScannerProps): JSX.Element {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFilePreview, setUploadedFilePreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('camera');
  const [idType, setIdType] = useState<'passport' | 'national_id'>('national_id');
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResult, setScanResult] = useState<IdScanResult | null>(null);
  const [gdprConsent, setGdprConsent] = useState(true);
  
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Handle webcam capture
  const captureImage = useCallback(() => {
    setIsCapturing(true);
    
    try {
      const imageSrc = webcamRef.current?.getScreenshot();
      if (imageSrc) {
        setCapturedImage(imageSrc);
        
        // Convert base64 to file
        fetch(imageSrc)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], `webcam-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
            setUploadedFile(file);
          })
          .catch(err => {
            toast({
              title: "Image capture failed",
              description: `Error: ${err.message}`,
              variant: "destructive"
            });
          })
          .finally(() => {
            setIsCapturing(false);
          });
      } else {
        setIsCapturing(false);
        toast({
          title: "Capture failed",
          description: "Please make sure your camera is enabled and try again.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      setIsCapturing(false);
      toast({
        title: "Camera error",
        description: `Could not access camera: ${error.message}`,
        variant: "destructive"
      });
    }
  }, [toast]);

  // Handle file upload
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB",
        variant: "destructive"
      });
      return;
    }

    // Check file type
    const fileType = file.type;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(fileType)) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (JPEG, PNG, WEBP, GIF)",
        variant: "destructive"
      });
      return;
    }

    setUploadedFile(file);
    
    // Create preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setUploadedFilePreview(e.target.result as string);
        setCapturedImage(null); // Clear webcam capture if any
      }
    };
    reader.readAsDataURL(file);
  };

  // Trigger file input click
  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  // Process the image with OCR
  const processImage = async (): Promise<void> => {
    if (!uploadedFile && !capturedImage) {
      toast({
        title: "No image to process",
        description: "Please capture or upload an image first",
        variant: "destructive"
      });
      return;
    }

    if (!gdprConsent) {
      toast({
        title: "GDPR Consent Required",
        description: "Please consent to data processing to continue",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setScanProgress(0);
    setScanResult(null);

    // Create form data
    const formData = new FormData();
    if (uploadedFile) {
      formData.append('image', uploadedFile);
    }
    formData.append('idType', idType);
    formData.append('gdprConsent', gdprConsent.toString());
    
    if (guestId) {
      formData.append('guestId', guestId.toString());
    }
    
    if (bookingId) {
      formData.append('bookingId', bookingId.toString());
    }

    // Simulate progress
    const interval = setInterval(() => {
      setScanProgress(prev => {
        const newProgress = prev + Math.random() * 10;
        return newProgress >= 90 ? 90 : newProgress;
      });
    }, 200);
    
    // First test if the OCR service is available
    let statusCheck = false;
    
    try {
      // Check the OCR service status
      try {
        const statusResponse = await fetch('/api/ocr/status');
        statusCheck = statusResponse.ok;
        console.log('OCR status check:', statusCheck);
      } catch (error) {
        console.error('Error checking OCR status:', error);
        statusCheck = false;
      }
      
      if (!statusCheck) {
        clearInterval(interval);
        setScanProgress(100);
        setScanResult({
          success: false,
          error: 'OCR service is not available. Please try again later.'
        });
        
        toast({
          title: "OCR Service Unavailable",
          description: "The document scanning service is currently unavailable. Please try again later or enter your information manually.",
          variant: "destructive"
        });
        setIsProcessing(false);
        return;
      }

      console.log('Sending OCR request with form data:', formData);
      
      // Send the scan request
      const response = await fetch('/api/ocr/scan-id', {
        method: 'POST',
        body: formData,
      });
      
      clearInterval(interval);

      if (!response.ok) {
        let errorMessage = 'Failed to process image';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `Error ${response.status}: ${response.statusText || errorMessage}`;
        }
        
        setScanProgress(100);
        setScanResult({
          success: false,
          error: errorMessage
        });
        
        toast({
          title: "ID Scanning Failed",
          description: errorMessage,
          variant: "destructive"
        });
      } else {
        setScanProgress(100);
        const data = await response.json();
        setScanResult(data);
        
        if (data.success && data.data) {
          onDataExtracted(data.data);
          
          if (uploadedFile && data.documentId) {
            onImageCaptured(uploadedFile, data.documentId);
          }
          
          toast({
            title: "ID Scanned Successfully",
            description: `Scanned with ${Math.round(data.confidence || 0)}% confidence`,
            variant: "default"
          });
        } else {
          toast({
            title: "Scan Completed",
            description: "Could not extract all data, please verify manually",
            variant: "default"
          });
        }
      }
    } catch (error: any) {
      clearInterval(interval);
      setScanProgress(100);
      setScanResult({
        success: false,
        error: error.message || 'An error occurred during processing'
      });
      
      toast({
        title: "Processing Error",
        description: error.message || 'An error occurred during processing',
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset the scanner
  const resetScanner = () => {
    setCapturedImage(null);
    setUploadedFile(null);
    setUploadedFilePreview(null);
    setScanResult(null);
    setScanProgress(0);
  };

  return (
    <Card className="w-full max-w-xl mx-auto">
      <CardHeader>
        <CardTitle>ID Document Scanner</CardTitle>
        <CardDescription>
          Scan your ID card or passport to automatically extract information.
          Data is securely processed following GDPR guidelines.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-4">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="camera" disabled={isProcessing}>Camera</TabsTrigger>
            <TabsTrigger value="upload" disabled={isProcessing}>Upload</TabsTrigger>
          </TabsList>

          <TabsContent value="camera">
            <div className="rounded-md overflow-hidden border border-gray-200 mb-4">
              {capturedImage ? (
                <img 
                  src={capturedImage} 
                  alt="Captured ID" 
                  className="w-full object-contain max-h-64"
                />
              ) : (
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  className="w-full"
                  videoConstraints={{
                    width: 720,
                    height: 480,
                    facingMode: "user"
                  }}
                />
              )}
            </div>
            
            <div className="flex justify-center space-x-2 mt-2">
              {capturedImage ? (
                <Button variant="outline" onClick={resetScanner} disabled={isProcessing}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retake
                </Button>
              ) : (
                <Button onClick={captureImage} disabled={isCapturing || isProcessing}>
                  {isCapturing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4 mr-2" />
                  )}
                  Capture
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="upload">
            <div 
              className="rounded-md border-2 border-dashed border-gray-200 p-6 text-center cursor-pointer mb-4"
              onClick={triggerFileUpload}
            >
              {uploadedFilePreview ? (
                <img 
                  src={uploadedFilePreview} 
                  alt="Uploaded ID" 
                  className="w-full object-contain max-h-64"
                />
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-gray-400" />
                  <div className="text-sm">
                    Click to select file or drag and drop<br />
                    <span className="text-xs text-gray-500">JPG, PNG, WEBP or GIF (max 10MB)</span>
                  </div>
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
                disabled={isProcessing}
              />
            </div>

            {uploadedFile && (
              <div className="flex justify-center space-x-2 mt-2">
                <Button variant="outline" onClick={resetScanner} disabled={isProcessing}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Document Type</div>
              <div className="text-xs text-gray-500">Select the type of document you're scanning</div>
            </div>
            <div className="flex space-x-2">
              <Button 
                size="sm" 
                variant={idType === 'national_id' ? 'default' : 'outline'} 
                onClick={() => setIdType('national_id')}
                disabled={isProcessing}
              >
                ID Card
              </Button>
              <Button 
                size="sm" 
                variant={idType === 'passport' ? 'default' : 'outline'} 
                onClick={() => setIdType('passport')}
                disabled={isProcessing}
              >
                Passport
              </Button>
            </div>
          </div>

          {/* GDPR Consent Switch */}
          <div className="flex items-center space-x-2">
            <Switch 
              id="gdpr-consent" 
              checked={gdprConsent} 
              onCheckedChange={setGdprConsent}
              disabled={isProcessing}
            />
            <Label htmlFor="gdpr-consent" className="text-sm">
              I consent to processing this document in accordance with GDPR
            </Label>
          </div>

          {/* Scan Result */}
          {scanResult && (
            <div className={`p-3 rounded-md ${scanResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-center mb-2">
                {scanResult.success ? (
                  <Check className="h-5 w-5 text-green-600 mr-2" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                )}
                <div className="text-sm font-medium">
                  {scanResult.success ? 'Scan Successful' : 'Scan Failed'}
                </div>
                {scanResult.confidence && (
                  <Badge variant="outline" className="ml-auto">
                    {Math.round(scanResult.confidence)}% confidence
                  </Badge>
                )}
              </div>
              
              {scanResult.success && scanResult.data && (
                <div className="text-xs space-y-1 text-gray-700">
                  {scanResult.data.firstName && (
                    <div><span className="font-medium">First name:</span> {scanResult.data.firstName}</div>
                  )}
                  {scanResult.data.lastName && (
                    <div><span className="font-medium">Last name:</span> {scanResult.data.lastName}</div>
                  )}
                  {scanResult.data.dateOfBirth && (
                    <div><span className="font-medium">Date of birth:</span> {scanResult.data.dateOfBirth}</div>
                  )}
                  {scanResult.data.idNumber && (
                    <div><span className="font-medium">ID number:</span> {scanResult.data.idNumber}</div>
                  )}
                  {scanResult.data.expiryDate && (
                    <div><span className="font-medium">Expiry date:</span> {scanResult.data.expiryDate}</div>
                  )}
                </div>
              )}
              
              {scanResult.error && (
                <div className="text-xs text-red-600 mt-1">{scanResult.error}</div>
              )}
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="flex flex-col space-y-4">
        {isProcessing && (
          <div className="w-full space-y-2">
            <Progress value={scanProgress} className="w-full" />
            <div className="text-xs text-gray-500 text-center">
              Processing document... {Math.round(scanProgress)}%
            </div>
          </div>
        )}
        
        <div className="flex justify-center w-full">
          <Button 
            disabled={(!uploadedFile && !capturedImage) || isProcessing} 
            onClick={processImage}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Scan Document'
            )}
          </Button>
        </div>
        
        <div className="text-xs text-gray-500 text-center mt-2">
          Scanning is GDPR compliant. Documents are securely processed and stored for 90 days.
        </div>
      </CardFooter>
    </Card>
  );
}