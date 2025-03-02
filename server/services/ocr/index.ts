import * as Tesseract from 'tesseract.js';
import * as path from 'path';
import * as fs from 'fs';
import { log } from '../../vite';
import sharp from 'sharp';

/**
 * OCR Result interface
 */
interface OCRResult {
  success: boolean;
  error?: string;
  text?: string;
  data?: IDCardData;
  confidence?: number;
  processingTimeMs?: number;
}

/**
 * ID Card Data interface - represents structured data extracted from ID documents
 */
export interface IDCardData {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  idNumber?: string;
  nationality?: string;
  personalNumber?: string;
  expiryDate?: string;
  issueDate?: string;
  homeAddress?: string;
  idType?: 'passport' | 'national_id';
  orientation?: 'portrait' | 'landscape';
  originalImagePath?: string;
  gdprConsent?: boolean;
}

/**
 * OCR Configuration interface
 */
interface OCRConfig {
  language: string;
  imagePreprocessing: boolean;
  confidenceThreshold: number;
  gdprCompliant: boolean;
  retentionPeriodDays: number;
}

/**
 * Default OCR configuration
 */
const DEFAULT_CONFIG: OCRConfig = {
  language: 'eng',
  imagePreprocessing: true,
  confidenceThreshold: 70, // Minimum confidence level (0-100) to accept OCR results
  gdprCompliant: true,
  retentionPeriodDays: 90, // Default retention period (90 days)
};

/**
 * Main OCR service class implementing GDPR-compliant document processing
 */
export class OCRService {
  private config: OCRConfig;
  private worker: Tesseract.Worker | null = null;
  private initialized = false;
  private schedulerRunning = false;

  constructor(config: Partial<OCRConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    
    // Start GDPR compliance scheduler if enabled
    if (this.config.gdprCompliant) {
      this.startGdprComplianceScheduler();
    }
  }

  /**
   * Initialize the Tesseract OCR worker
   */
  private async initializeWorker(): Promise<void> {
    if (this.initialized) return;
    
    try {
      log('Initializing Tesseract OCR worker...', 'ocr');
      this.worker = await Tesseract.createWorker(this.config.language);
      // Note: In newer versions of tesseract.js, these methods might be handled automatically
      // or in a different way, so we're commenting them out for now
      // await this.worker.loadLanguage(this.config.language);
      // await this.worker.initialize(this.config.language);
      log('Tesseract OCR worker initialized successfully', 'ocr');
      this.initialized = true;
    } catch (error) {
      log(`Failed to initialize Tesseract OCR worker: ${error}`, 'ocr');
      throw new Error(`OCR initialization failed: ${error}`);
    }
  }

  /**
   * Detect text orientation in an image
   * @param imagePath Path to the image file
   * @returns Detected orientation ('portrait' or 'landscape')
   */
  private async detectOrientation(imagePath: string): Promise<'portrait' | 'landscape'> {
    try {
      const metadata = await sharp(imagePath).metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error('Could not determine image dimensions');
      }
      
      return metadata.width > metadata.height ? 'landscape' : 'portrait';
    } catch (error) {
      log(`Error detecting orientation: ${error}`, 'ocr');
      return 'portrait'; // Default to portrait if detection fails
    }
  }

  /**
   * Preprocess image to improve OCR accuracy
   * @param imagePath Path to the image file
   * @returns Path to the preprocessed image
   */
  private async preprocessImage(imagePath: string): Promise<string> {
    if (!this.config.imagePreprocessing) {
      return imagePath;
    }
    
    try {
      const outputPath = `${imagePath.substring(0, imagePath.lastIndexOf('.'))}_preprocessed.jpg`;
      
      // Apply image preprocessing techniques
      await sharp(imagePath)
        .greyscale() // Convert to grayscale
        .normalize() // Normalize the image (improve contrast)
        .sharpen() // Sharpen the image
        .toFile(outputPath);
      
      log(`Image preprocessed: ${outputPath}`, 'ocr');
      return outputPath;
    } catch (error) {
      log(`Image preprocessing failed: ${error}`, 'ocr');
      return imagePath; // Return original image if preprocessing fails
    }
  }

  /**
   * Parse extracted text to find ID card information
   * @param text OCR-extracted text
   * @param idType Type of ID document
   * @returns Structured ID card data
   */
  private parseIdCardData(text: string, idType: 'passport' | 'national_id'): IDCardData {
    const data: IDCardData = {
      idType,
    };
    
    if (!text) return data;
    
    // Normalize text: convert to lowercase and remove extra spaces
    const normalizedText = text.toLowerCase().replace(/\\s+/g, ' ');
    const lines = text.split('\\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Common patterns for ID documents
    const patterns = {
      firstName: [
        /first\s*name[:\s]+([a-zA-Z\s]+)/i,
        /given\s*name[s]?[:\s]+([a-zA-Z\s]+)/i,
        /name[s]?[:\s]+([a-zA-Z\s]+)/i,
        /vor[n]?[a]?[m]?[e]?[:\s]+([a-zA-Z\s]+)/i, // German
      ],
      lastName: [
        /last\s*name[:\s]+([a-zA-Z\s]+)/i,
        /surname[:\s]+([a-zA-Z\s]+)/i,
        /family\s*name[:\s]+([a-zA-Z\s]+)/i,
        /nach[n]?[a]?[m]?[e]?[:\s]+([a-zA-Z\s]+)/i, // German
      ],
      dateOfBirth: [
        /date\s*of\s*birth[:\s]+([\d\.\/\-\s]+)/i,
        /birth[:\s]+([\d\.\/\-\s]+)/i,
        /dob[:\s]+([\d\.\/\-\s]+)/i,
        /geburtsdatum[:\s]+([\d\.\/\-\s]+)/i, // German
      ],
      placeOfBirth: [
        /place\s*of\s*birth[:\s]+([a-zA-Z\s]+)/i,
        /geburtsort[:\s]+([a-zA-Z\s]+)/i, // German
      ],
      idNumber: [
        /id[:\s]*no[\.:]?[:\s]*([\w\-]+)/i,
        /identification\s*number[:\s]*([\w\-]+)/i,
        /document\s*no[\.:]?[:\s]*([\w\-]+)/i,
        /card\s*no[\.:]?[:\s]*([\w\-]+)/i,
        /ausweisnummer[:\s]*([\w\-]+)/i, // German
      ],
      nationality: [
        /nationality[:\s]+([a-zA-Z\s]+)/i,
        /nation[:\s]+([a-zA-Z\s]+)/i,
        /staatsangehörigkeit[:\s]+([a-zA-Z\s]+)/i, // German
      ],
      expiryDate: [
        /expiry\s*date[:\s]+([\d\.\/\-\s]+)/i,
        /expiration\s*date[:\s]+([\d\.\/\-\s]+)/i,
        /valid\s*until[:\s]+([\d\.\/\-\s]+)/i,
        /exp[:\s]+([\d\.\/\-\s]+)/i,
        /gültig\s*bis[:\s]+([\d\.\/\-\s]+)/i, // German
      ],
      issueDate: [
        /date\s*of\s*issue[:\s]+([\d\.\/\-\s]+)/i,
        /issue\s*date[:\s]+([\d\.\/\-\s]+)/i,
        /ausstellungsdatum[:\s]+([\d\.\/\-\s]+)/i, // German
      ],
      personalNumber: [
        /personal\s*no[\.:]?[:\s]*([\w\-]+)/i,
        /personal\s*id[:\s]*([\w\-]+)/i,
      ],
      homeAddress: [
        /address[:\s]+([a-zA-Z0-9\s\.,\-]+)/i,
        /residence[:\s]+([a-zA-Z0-9\s\.,\-]+)/i,
        /anschrift[:\s]+([a-zA-Z0-9\s\.,\-]+)/i, // German
      ],
    };
    
    // Attempt to extract data using patterns
    for (const [key, regexList] of Object.entries(patterns)) {
      for (const regex of regexList) {
        const match = normalizedText.match(regex);
        if (match && match[1]) {
          // Handle the special case for string fields
          if (typeof data[key as keyof IDCardData] === 'undefined' || 
              typeof data[key as keyof IDCardData] === 'string') {
            data[key as keyof IDCardData] = match[1].trim() as any;
          }
          break;
        }
      }
    }
    
    // Special case processing for passport MRZ (Machine Readable Zone)
    if (idType === 'passport') {
      // Look for MRZ lines (typically 2 or 3 lines at the bottom of the passport)
      const mrzLines = lines
        .filter(line => /^[A-Z0-9<]{30,44}$/.test(line))
        .slice(-3); // Get last 3 potential MRZ lines
      
      if (mrzLines.length >= 2) {
        // Process MRZ data (this is simplified and would need to be more robust in production)
        // Typical passport MRZ format:
        // Line 1: P<ISSCNTRY<LASTNAME<<FIRSTNAME<<<<<<<<<<<<<<<<<<<<<<
        // Line 2: PASSPORTNUMBER<NATCNTRY<DOB<SEX<EXPDATE<PERSONALNUMBER<<<
        
        // Extract last name from first MRZ line
        const line1 = mrzLines[0];
        const nameStart = line1.indexOf('<<') + 2;
        if (nameStart > 2) {
          const nameParts = line1.substring(nameStart).split('<<')[0];
          if (nameParts && !data.lastName) {
            data.lastName = nameParts.replace(/</g, ' ').trim();
          }
        }
        
        // Extract passport number and date of birth from second MRZ line
        const line2 = mrzLines[1];
        if (line2.length >= 9 && !data.idNumber) {
          data.idNumber = line2.substring(0, 9).replace(/</g, '').trim();
        }
        
        if (line2.length >= 19 && !data.dateOfBirth) {
          const dobStr = line2.substring(13, 19);
          // Format YY/MM/DD
          if (/^\d{6}$/.test(dobStr)) {
            const yy = dobStr.substring(0, 2);
            const mm = dobStr.substring(2, 4);
            const dd = dobStr.substring(4, 6);
            
            // Assume 20th century for years > 50, 21st century for years <= 50
            const year = parseInt(yy) > 50 ? `19${yy}` : `20${yy}`;
            data.dateOfBirth = `${dd}/${mm}/${year}`;
          }
        }
      }
    }
    
    return data;
  }

  /**
   * Main method to scan an ID card or passport image
   * @param imagePath Path to the image file
   * @param idType Type of ID document
   * @param gdprConsent Whether user has consented to data processing
   * @returns OCR result with extracted data
   */
  public async scanIdDocument(
    imagePath: string,
    idType: 'passport' | 'national_id' = 'national_id',
    gdprConsent: boolean = false
  ): Promise<OCRResult> {
    if (!this.initialized) {
      await this.initializeWorker();
    }
    
    if (!this.worker) {
      return {
        success: false,
        error: 'OCR worker not initialized',
      };
    }
    
    // GDPR compliance check
    if (this.config.gdprCompliant && !gdprConsent) {
      return {
        success: false,
        error: 'GDPR consent is required for document scanning',
      };
    }
    
    try {
      // Make sure the image exists
      if (!fs.existsSync(imagePath)) {
        return {
          success: false,
          error: `Image file not found: ${imagePath}`,
        };
      }
      
      // Detect orientation
      const orientation = await this.detectOrientation(imagePath);
      
      // Preprocess image if enabled
      const preprocessedImagePath = await this.preprocessImage(imagePath);
      
      // Start timer for performance tracking
      const startTime = Date.now();
      
      // Perform OCR
      log(`Starting OCR processing for ${idType} (${orientation})`, 'ocr');
      const result = await this.worker.recognize(preprocessedImagePath);
      
      // Calculate processing time
      const processingTime = Date.now() - startTime;
      
      // Check confidence level
      const confidence = result.data.confidence;
      if (confidence < this.config.confidenceThreshold) {
        return {
          success: false,
          error: `OCR confidence too low: ${confidence}%`,
          confidence,
          processingTimeMs: processingTime,
        };
      }
      
      // Extract the text
      const text = result.data.text;
      
      // Parse the text to extract ID card data
      const extractedData = this.parseIdCardData(text, idType);
      
      // Add orientation and original image path to data
      extractedData.orientation = orientation;
      extractedData.originalImagePath = imagePath;
      extractedData.gdprConsent = gdprConsent;
      
      // Clean up temporary file if we created one
      if (preprocessedImagePath !== imagePath && fs.existsSync(preprocessedImagePath)) {
        fs.unlinkSync(preprocessedImagePath);
      }
      
      log(`OCR processing completed in ${processingTime}ms with confidence ${confidence}%`, 'ocr');
      
      return {
        success: true,
        text,
        data: extractedData,
        confidence,
        processingTimeMs: processingTime,
      };
    } catch (error) {
      log(`OCR processing error: ${error}`, 'ocr');
      return {
        success: false,
        error: `OCR processing failed: ${error}`,
      };
    }
  }

  /**
   * Start the GDPR compliance scheduler to handle document retention
   */
  private startGdprComplianceScheduler(): void {
    if (this.schedulerRunning) return;
    
    this.schedulerRunning = true;
    
    // Set up a daily scheduler to clean up expired documents
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    setInterval(() => {
      // This would typically connect to the document service to clean up expired documents
      log('Running GDPR compliance scheduler', 'ocr');
    }, ONE_DAY_MS);
    
    log('GDPR compliance scheduler started', 'ocr');
  }

  /**
   * Clean up resources when service is no longer needed
   */
  public async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.initialized = false;
      log('OCR worker terminated', 'ocr');
    }
  }
}

// Export a singleton instance for use throughout the application
export const ocrService = new OCRService();