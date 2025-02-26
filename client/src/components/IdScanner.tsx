import React, { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CameraIcon, FlipHorizontal, Trash, UploadIcon, Plus } from 'lucide-react';

interface IdScannerProps {
  onDataExtracted: (data: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    placeOfBirth?: string;
    idNumber?: string;
    homeAddress?: string;
    personalNumber?: string;
    nationality?: string; 
    idType?: 'passport' | 'national_id';
    expiryDate?: string;
  }) => void;
  onImageCaptured: (file: File) => void;
}

interface CapturedImage {
  file: File;
  preview: string;
}

export default function IdScanner({ onDataExtracted, onImageCaptured }: IdScannerProps) {
  const { toast } = useToast();
  const webcamRef = useRef<Webcam>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImages = async () => {
    if (capturedImages.length === 0) {
      toast({
        title: "No Images",
        description: "Please capture or upload at least one image of your ID/Passport.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      // First, upload each image to get URLs
      const imageUrls: string[] = [];
      
      for (const capturedImage of capturedImages) {
        const formData = new FormData();
        formData.append("idImage", capturedImage.file);
        
        const response = await fetch("/api/upload/id-image", {
          method: "POST",
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error("Failed to upload image");
        }
        
        const data = await response.json();
        imageUrls.push(window.location.origin + data.url);
      }
      
      // Generate a unique session ID for this scan if not already created
      const sessionId = localStorage.getItem('ocr_session_id') || 
                        `ocr_session_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      
      // Store the session ID for future requests
      localStorage.setItem('ocr_session_id', sessionId);
      
      toast({
        title: "Processing Images",
        description: "Analyzing ID document with OCR. This may take a few moments...",
      });
      
      // Now, send images to the document analysis endpoint with session ID for model rotation
      const response = await fetch("/api/analyze-id-documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrls,
          sessionId
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to analyze ID document");
      }
      
      const result = await response.json();
      console.log('AI Analysis result:', result);
      
      if (!result.data) {
        throw new Error("No data returned from analysis");
      }
      
      // Direct mapping from API response to our component's expected format
      // The API returns data in the correct structure, so we can mostly pass it directly through
      const extractedData = result.data;
      console.log('Processing extracted data:', extractedData);
      
      // Process the data to handle any variations in format
      const processedData = processExtractedData(extractedData);
      console.log('Processed data:', processedData);
      
      if (Object.values(processedData).some(value => value)) {
        // Pass the processed data to the parent component
        onDataExtracted(processedData);
        
        // Show success message with a summary of the fields found
        const foundFields = Object.entries(processedData)
          .filter(([_, v]) => v)
          .map(([k]) => k);
          
        toast({
          title: "Data Extracted Successfully",
          description: `Found: ${foundFields.join(', ')}${result.modelUsed ? ` (using ${result.modelUsed})` : ''}`,
        });
      } else {
        toast({
          title: "Extraction Warning",
          description: "Could not extract data from the images. Please try again with clearer images or enter details manually.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Analysis Error:', error);
      toast({
        title: "Processing Error",
        description: `Failed to process the image: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or enter details manually.`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Process the data extracted from OCR API
  const processExtractedData = (data: any) => {
    console.log('Processing extracted data:', data);
    
    // Initialize with empty values
    const result: Record<string, string | undefined> = {
      firstName: undefined,
      lastName: undefined,
      dateOfBirth: undefined,
      placeOfBirth: undefined,
      idNumber: undefined,
      personalNumber: undefined,
      homeAddress: undefined,
      nationality: undefined,
      idType: undefined,
      expiryDate: undefined
    };
    
    // Clean string values to avoid issues with "null" or "undefined" strings
    const cleanValue = (value: any): string | undefined => {
      if (value === null || value === undefined || value === "null" || value === "undefined") {
        return undefined;
      }
      return String(value).trim();
    };
    
    // Helper function to extract Latin part from dual-language fields
    const extractLatinPart = (value: string): string => {
      if (!value) return '';
      // If the value contains a slash, take the part after the slash (Latin alphabet)
      if (value.includes('/')) {
        const parts = value.split('/');
        return parts[parts.length - 1].trim(); // Return the last part (Latin)
      }
      return value.trim();
    };
    
    // Direct mapping from server response
    const firstName = cleanValue(data.firstName);
    if (firstName) {
      result.firstName = extractLatinPart(firstName);
    }
    
    const lastName = cleanValue(data.lastName);
    if (lastName) {
      result.lastName = extractLatinPart(lastName);
    }
    
    const dateOfBirth = cleanValue(data.dateOfBirth);
    if (dateOfBirth) {
      result.dateOfBirth = dateOfBirth;
    }
    
    const placeOfBirth = cleanValue(data.placeOfBirth);
    if (placeOfBirth) {
      result.placeOfBirth = extractLatinPart(placeOfBirth);
    }
    
    const idNumber = cleanValue(data.idNumber) || cleanValue(data.documentNumber);
    if (idNumber) {
      result.idNumber = idNumber;
    }
    
    const personalNumber = cleanValue(data.personalNumber);
    if (personalNumber) {
      result.personalNumber = personalNumber;
    }
    
    const homeAddress = cleanValue(data.homeAddress);
    if (homeAddress) {
      result.homeAddress = homeAddress;
    }
    
    const nationality = cleanValue(data.nationality);
    if (nationality) {
      result.nationality = extractLatinPart(nationality);
    }
    
    const idType = cleanValue(data.idType);
    if (idType) {
      result.idType = idType.toLowerCase() === 'passport' ? 'passport' : 'national_id';
    } else {
      // Default to national_id if not specified
      result.idType = 'national_id';
    }
    
    const expiryDate = cleanValue(data.expiryDate);
    if (expiryDate) {
      result.expiryDate = expiryDate;
    }
    
    // Fallback to nested formats that might come from the LLM
    if (!result.firstName || !result.lastName) {
      // Extract names - handle the Gemini format with nested structures
      if (data.names && (data.names.surname || data.names.given_names)) {
        // Handle nested names object
        if (data.names.given_names && !result.firstName) {
          const givenNames = extractLatinPart(data.names.given_names);
          const nameParts = givenNames.split(' ');
          result.firstName = nameParts[0]; // First part of given_names
        }
        
        if (data.names.surname && !result.lastName) {
          result.lastName = extractLatinPart(data.names.surname);
        }
      } else if (data.surname || data.given_names) {
        // Handle the direct format (not nested)
        if (data.given_names && !result.firstName) {
          const givenNames = extractLatinPart(data.given_names);
          const nameParts = givenNames.split(' ');
          result.firstName = nameParts[0];
        }
        
        if (data.surname && !result.lastName) {
          result.lastName = extractLatinPart(data.surname);
        }
      } else if (data.Names) {
        const names = data.Names.split(' ');
        if (names.length >= 2) {
          if (!result.firstName) result.firstName = names[0];
          if (!result.lastName) result.lastName = names[names.length - 1];
        } else if (names.length === 1 && !result.firstName) {
          result.firstName = names[0];
        }
      } else if (data.name) {
        const names = data.name.split(' ');
        if (names.length >= 2) {
          if (!result.firstName) result.firstName = names[0];
          if (!result.lastName) result.lastName = names[names.length - 1];
        } else if (!result.firstName) {
          result.firstName = names[0];
        }
      }
    }
    
    // Additional fallbacks for date of birth
    if (!result.dateOfBirth) {
      const dobFromSnakeCase = cleanValue(data.date_of_birth);
      const dobFromSpacedCase = cleanValue(data['date of birth']);
      const dobFromDob = cleanValue(data.dob);
      
      if (dobFromSnakeCase) {
        result.dateOfBirth = dobFromSnakeCase;
      } else if (dobFromSpacedCase) {
        result.dateOfBirth = dobFromSpacedCase;
      } else if (dobFromDob) {
        result.dateOfBirth = dobFromDob;
      }
    }
    
    // Additional fallbacks for place of birth
    if (!result.placeOfBirth) {
      const pobFromSnakeCase = cleanValue(data.place_of_birth);
      const pobFromSpacedCase = cleanValue(data['place of birth']);
      const pobFromPob = cleanValue(data.pob);
      
      if (pobFromSnakeCase) {
        result.placeOfBirth = extractLatinPart(pobFromSnakeCase);
      } else if (pobFromSpacedCase) {
        result.placeOfBirth = extractLatinPart(pobFromSpacedCase);
      } else if (pobFromPob) {
        result.placeOfBirth = extractLatinPart(pobFromPob);
      }
    }
    
    // Additional fallbacks for ID number
    if (!result.idNumber) {
      const idFromDocNumber = cleanValue(data.document_number);
      const idFromCapDocNumber = cleanValue(data['Document Number']);
      const idFromIdNum = cleanValue(data.id_number);
      
      if (idFromDocNumber) {
        result.idNumber = idFromDocNumber;
      } else if (idFromCapDocNumber) {
        result.idNumber = idFromCapDocNumber;
      } else if (idFromIdNum) {
        result.idNumber = idFromIdNum;
      }
    }
    
    // Additional fallbacks for personal number
    if (!result.personalNumber) {
      const personalNumFromSnakeCase = cleanValue(data.personal_number);
      const personalNumFromCapCase = cleanValue(data['Personal Number']);
      const personalNumFromPersonalId = cleanValue(data.personal_id);
      
      if (personalNumFromSnakeCase) {
        result.personalNumber = personalNumFromSnakeCase;
      } else if (personalNumFromCapCase) {
        result.personalNumber = personalNumFromCapCase;
      } else if (personalNumFromPersonalId) {
        result.personalNumber = personalNumFromPersonalId;
      }
    }
    
    // Additional fallbacks for address
    if (!result.homeAddress) {
      const addressFromHomeAddress = cleanValue(data.home_address);
      const addressFromAddress = cleanValue(data.address);
      const addressFromSpacedCase = cleanValue(data['home address']);
      
      if (addressFromHomeAddress) {
        result.homeAddress = addressFromHomeAddress;
      } else if (addressFromAddress) {
        result.homeAddress = addressFromAddress;
      } else if (addressFromSpacedCase) {
        result.homeAddress = addressFromSpacedCase;
      }
    }
    
    // Additional fallbacks for expiry date
    if (!result.expiryDate) {
      const expiryFromDateOfExpiry = cleanValue(data.date_of_expiry);
      const expiryFromLowerCase = cleanValue(data['expiry date']);
      const expiryFromCapCase = cleanValue(data['Expiry Date']);
      const expiryFromExpiration = cleanValue(data.expiration_date);
      
      if (expiryFromDateOfExpiry) {
        result.expiryDate = expiryFromDateOfExpiry;
      } else if (expiryFromLowerCase) {
        result.expiryDate = expiryFromLowerCase;
      } else if (expiryFromCapCase) {
        result.expiryDate = expiryFromCapCase;
      } else if (expiryFromExpiration) {
        result.expiryDate = expiryFromExpiration;
      }
    }
    
    console.log('Processed data for form:', result);
    return result;
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

    try {
      const compressedImage = await compressImage(imageSrc);
      const byteString = atob(compressedImage.split(',')[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      
      const fileName = `captured-id-${Date.now()}.jpg`;
      const file = new File([ab], fileName, { type: 'image/jpeg' });

      // Add to our captured images
      setCapturedImages(prev => [
        ...prev, 
        { file, preview: compressedImage }
      ]);
      
      // Notify parent component
      onImageCaptured(file);
      
      toast({
        title: "Image Captured",
        description: `${capturedImages.length + 1} of 2 images captured.`,
      });
    } catch (error) {
      console.error('Capture error:', error);
      toast({
        title: "Capture Error",
        description: "Failed to capture image.",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      const newImages: CapturedImage[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        
        const preview = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        
        newImages.push({ file, preview });
        onImageCaptured(file);
      }
      
      setCapturedImages(prev => [...prev, ...newImages]);
      
      toast({
        title: "Images Uploaded",
        description: `${newImages.length} image(s) added.`,
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Error",
        description: "Failed to upload image(s).",
        variant: "destructive",
      });
    } finally {
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index));
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scan ID/Passport</CardTitle>
        <CardDescription>
          Provide front and back images of your ID or passport for automatic data extraction
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            {capturedImages.length > 0 ? (
              capturedImages.map((image, index) => (
                <div key={index} className="relative">
                  <img 
                    src={image.preview} 
                    alt={`Captured ID ${index + 1}`} 
                    className="w-full h-40 object-cover rounded-md"
                  />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={() => removeImage(index)}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              ))
            ) : (
              <div className="col-span-2 border-2 border-dashed rounded-md p-8 text-center">
                <div className="flex flex-col items-center">
                  <UploadIcon className="h-8 w-8 mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No images added yet. Use camera or upload button.
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {capturedImages.length < 2 && (
            <div className="flex justify-center gap-4">
              <Button 
                variant="outline" 
                onClick={triggerFileInput}
                disabled={isProcessing}
              >
                <Plus className="mr-2 h-4 w-4" />
                Upload Image
              </Button>
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="hidden"
                multiple={capturedImages.length === 0}
              />
              
              <Button
                variant="outline"
                onClick={() => setActiveTab('camera')}
                disabled={isProcessing}
              >
                <CameraIcon className="mr-2 h-4 w-4" />
                Use Camera
              </Button>
            </div>
          )}
          
          <div className="mt-4">
            <Button 
              onClick={processImages} 
              disabled={isProcessing || capturedImages.length === 0}
              className="w-full"
            >
              {isProcessing ? "Processing..." : "Extract Data from Images"}
            </Button>
          </div>
        </div>
        
        {activeTab === 'camera' && (
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
            <div className="flex justify-between">
              <Button 
                variant="outline"
                onClick={() => setActiveTab('upload')}
              >
                Back
              </Button>
              <Button 
                onClick={captureImage}
                disabled={isProcessing || capturedImages.length >= 2}
                variant="default"
              >
                <CameraIcon className="mr-2 h-4 w-4" />
                Capture Image
              </Button>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Processing images with AI... Please wait.
          </div>
        )}
      </CardContent>
    </Card>
  );
}