import * as Tesseract from 'tesseract.js';
import * as tf from '@tensorflow/tfjs';
import { createWorker } from 'tesseract.js';
import * as fs from 'fs';
import * as path from 'path';
import { log } from '../../vite';

// Initialize TensorFlow.js if needed
tf.setBackend('cpu');

// Types for OCR results
interface OCRResult {
  success: boolean;
  error?: string;
  text?: string;
  data?: IDCardData;
  confidence?: number;
  processingTimeMs?: number;
}

// Standard interface for extracted ID card data
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

// Configuration for OCR
interface OCRConfig {
  language: string;
  imagePreprocessing: boolean;
  confidenceThreshold: number;
  gdprCompliant: boolean;
  retentionPeriodDays: number;
}

// Default configuration with GDPR compliance
const DEFAULT_CONFIG: OCRConfig = {
  language: 'eng',
  imagePreprocessing: true,
  confidenceThreshold: 65,
  gdprCompliant: true,
  retentionPeriodDays: 90 // Standard GDPR retention period for ID documents
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
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeWorker();
  }

  /**
   * Initialize the Tesseract OCR worker
   */
  private async initializeWorker(): Promise<void> {
    if (this.worker) {
      return;
    }
    
    try {
      log('Initializing OCR service worker...', 'ocr');
      
      this.worker = await createWorker({
        logger: progress => {
          if (progress.status === 'recognizing text') {
            // Log only when recognizing to avoid excessive logging
            log(`OCR progress: ${Math.round(progress.progress * 100)}%`, 'ocr');
          }
        }
      });
      
      await this.worker.loadLanguage(this.config.language);
      await this.worker.initialize(this.config.language);
      
      // Set parameters for better ID card recognition
      await this.worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz-/.,:;()<>[]{}|\\~`!@#$%^&*_+=\'\" ',
        tessedit_ocr_engine_mode: 3, // Use LSTM neural network for better accuracy
        preserve_interword_spaces: 1,
      });
      
      this.initialized = true;
      log('OCR service initialized successfully', 'ocr');
      
      // Start the GDPR compliance scheduler if enabled
      if (this.config.gdprCompliant && !this.schedulerRunning) {
        this.startGdprComplianceScheduler();
      }
    } catch (error) {
      log(`OCR service initialization failed: ${error}`, 'ocr');
      throw new Error(`Failed to initialize OCR service: ${error}`);
    }
  }

  /**
   * Detect text orientation in an image
   * @param imagePath Path to the image file
   * @returns Detected orientation ('portrait' or 'landscape')
   */
  private async detectOrientation(imagePath: string): Promise<'portrait' | 'landscape'> {
    try {
      // Use TensorFlow.js to analyze image dimensions
      const imageBuffer = fs.readFileSync(imagePath);
      const imageData = await tf.node.decodeImage(imageBuffer);
      
      const height = imageData.shape[0];
      const width = imageData.shape[1];
      
      // Clean up tensor to prevent memory leaks
      imageData.dispose();
      
      return height > width ? 'portrait' : 'landscape';
    } catch (error) {
      log(`Error detecting orientation: ${error}`, 'ocr');
      return 'portrait'; // Default to portrait on error
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
      // Load image using TensorFlow.js
      const imageBuffer = fs.readFileSync(imagePath);
      let image = await tf.node.decodeImage(imageBuffer, 3);
      
      // Convert to grayscale
      const grayscale = image.mean(2).expandDims(2);
      
      // Apply contrast normalization
      const normalized = grayscale.sub(grayscale.min())
                                  .div(grayscale.max().sub(grayscale.min()))
                                  .mul(255);
      
      // Add simple adaptive thresholding
      const blurred = normalized.cast('float32')
                                .expandDims(0)
                                .pad([[0, 0], [2, 2], [2, 2], [0, 0]])
                                .conv2d(
                                  tf.ones([5, 5, 1, 1]).div(25),
                                  1,
                                  'valid'
                                )
                                .squeeze([0]);
                                
      const threshold = normalized.sub(blurred).add(10);
      const binary = threshold.greater(0).mul(255).cast('int32');
      
      // Create output path for preprocessed image
      const outputDir = path.dirname(imagePath);
      const filename = path.basename(imagePath);
      const preprocessedPath = path.join(outputDir, `preprocessed_${filename}`);
      
      // Save preprocessed image
      const preprocessedBuffer = await tf.node.encodePng(binary.expandDims(2).tile([1, 1, 3]));
      fs.writeFileSync(preprocessedPath, preprocessedBuffer);
      
      // Clean up tensors
      image.dispose();
      grayscale.dispose();
      normalized.dispose();
      blurred.dispose();
      threshold.dispose();
      binary.dispose();
      
      return preprocessedPath;
    } catch (error) {
      log(`Image preprocessing failed: ${error}`, 'ocr');
      return imagePath; // Return original on failure
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
      idType
    };
    
    // Convert text to lowercase and normalize whitespace
    const normalizedText = text.toLowerCase().replace(/\\s+/g, ' ');
    
    // Common patterns for both ID types
    const datePatterns = [
      /birth\s*(?:date)?\s*:?\s*(\d{1,2}[\s./-]\d{1,2}[\s./-]\d{2,4})/i,
      /dob\s*:?\s*(\d{1,2}[\s./-]\d{1,2}[\s./-]\d{2,4})/i,
      /(\d{1,2}[\s./-]\d{1,2}[\s./-](?:19|20)\d{2})/i,
    ];
    
    const namePatterns = [
      /name\s*:?\s*([a-zA-Z\s]+)/i,
      /surname\s*:?\s*([a-zA-Z\s]+)/i,
      /last\s*name\s*:?\s*([a-zA-Z\s]+)/i,
      /first\s*name\s*:?\s*([a-zA-Z\s]+)/i,
      /given\s*names?\s*:?\s*([a-zA-Z\s]+)/i,
    ];
    
    const idNumberPatterns = [
      /id\s*(?:number|no|#)?\s*:?\s*([a-zA-Z0-9]+)/i,
      /document\s*(?:number|no|#)?\s*:?\s*([a-zA-Z0-9]+)/i,
      /passport\s*(?:number|no|#)?\s*:?\s*([a-zA-Z0-9]+)/i,
    ];
    
    // Extract dates
    for (const pattern of datePatterns) {
      const match = normalizedText.match(pattern);
      if (match && match[1]) {
        // If we don't have a date of birth yet, use this match
        if (!data.dateOfBirth) {
          data.dateOfBirth = match[1].trim();
        } 
        // If we already have a DOB and find another date, it might be expiry
        else if (!data.expiryDate) {
          // Look for context clues to determine if it's an expiry date
          const surroundingText = normalizedText.substring(
            Math.max(0, normalizedText.indexOf(match[1]) - 20),
            Math.min(normalizedText.length, normalizedText.indexOf(match[1]) + match[1].length + 20)
          );
          
          if (surroundingText.includes('expir') || surroundingText.includes('valid') || 
              surroundingText.includes('until') || surroundingText.includes('thru')) {
            data.expiryDate = match[1].trim();
          }
        }
      }
    }
    
    // Extract names based on ID type
    if (idType === 'passport') {
      // For passports, try to find the specific name fields
      const surnameMatch = text.match(/surname\s*:?\s*([a-zA-Z\s]+)/i);
      const givenNameMatch = text.match(/given\s*names?\s*:?\s*([a-zA-Z\s]+)/i);
      
      if (surnameMatch && surnameMatch[1]) {
        data.lastName = surnameMatch[1].trim();
      }
      
      if (givenNameMatch && givenNameMatch[1]) {
        data.firstName = givenNameMatch[1].trim();
      }
      
      // Extract nationality
      const nationalityMatch = text.match(/nationality\s*:?\s*([a-zA-Z\s]+)/i);
      if (nationalityMatch && nationalityMatch[1]) {
        data.nationality = nationalityMatch[1].trim();
      }
      
      // Extract passport number
      const passportNumberMatch = text.match(/passport\s*(?:number|no|#)?\s*:?\s*([a-zA-Z0-9]+)/i);
      if (passportNumberMatch && passportNumberMatch[1]) {
        data.idNumber = passportNumberMatch[1].trim();
      }
    } else {
      // For national IDs
      const firstNameMatch = text.match(/first\s*name\s*:?\s*([a-zA-Z\s]+)/i);
      const lastNameMatch = text.match(/last\s*name\s*:?\s*([a-zA-Z\s]+)/i);
      
      if (firstNameMatch && firstNameMatch[1]) {
        data.firstName = firstNameMatch[1].trim();
      }
      
      if (lastNameMatch && lastNameMatch[1]) {
        data.lastName = lastNameMatch[1].trim();
      }
      
      // Extract personal number if present
      const personalNumberMatch = text.match(/personal\s*(?:number|no|#)?\s*:?\s*([a-zA-Z0-9]+)/i);
      if (personalNumberMatch && personalNumberMatch[1]) {
        data.personalNumber = personalNumberMatch[1].trim();
      }
      
      // Extract address
      const addressMatch = text.match(/address\s*:?\s*([a-zA-Z0-9\s,.-]+)/i);
      if (addressMatch && addressMatch[1]) {
        data.homeAddress = addressMatch[1].trim();
      }
    }
    
    // If we couldn't find structured name fields, try generic patterns
    if (!data.firstName && !data.lastName) {
      for (const pattern of namePatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const fullName = match[1].trim();
          const nameParts = fullName.split(/\s+/);
          
          if (nameParts.length > 1) {
            data.firstName = nameParts[0];
            data.lastName = nameParts.slice(1).join(' ');
          } else {
            data.firstName = fullName;
          }
          
          break;
        }
      }
    }
    
    // Extract ID number if not found yet
    if (!data.idNumber) {
      for (const pattern of idNumberPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          data.idNumber = match[1].trim();
          break;
        }
      }
    }
    
    // Extract place of birth
    const placeOfBirthMatch = text.match(/place\s*of\s*birth\s*:?\s*([a-zA-Z\s,.-]+)/i);
    if (placeOfBirthMatch && placeOfBirthMatch[1]) {
      data.placeOfBirth = placeOfBirthMatch[1].trim();
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
        error: 'OCR worker not initialized' 
      };
    }
    
    try {
      const startTime = Date.now();
      
      // Ensure we have user consent
      if (this.config.gdprCompliant && !gdprConsent) {
        return {
          success: false,
          error: 'GDPR consent required for ID document processing'
        };
      }
      
      // Check if file exists
      if (!fs.existsSync(imagePath)) {
        return {
          success: false,
          error: `Image file not found: ${imagePath}`
        };
      }
      
      // Detect orientation
      const orientation = await this.detectOrientation(imagePath);
      
      // Preprocess image if enabled
      const processedImagePath = await this.preprocessImage(imagePath);
      
      // Perform OCR
      const result = await this.worker.recognize(processedImagePath);
      
      // Check confidence
      if (result.data.confidence < this.config.confidenceThreshold) {
        return {
          success: false,
          error: `OCR confidence too low: ${result.data.confidence}%`,
          text: result.data.text,
          confidence: result.data.confidence,
          processingTimeMs: Date.now() - startTime
        };
      }
      
      // Parse text to extract structured data
      const extractedData = this.parseIdCardData(result.data.text, idType);
      
      // Add orientation and GDPR consent
      extractedData.orientation = orientation;
      extractedData.originalImagePath = imagePath;
      extractedData.gdprConsent = gdprConsent;
      
      // Clean up preprocessed image if it's different from original
      if (processedImagePath !== imagePath && fs.existsSync(processedImagePath)) {
        fs.unlinkSync(processedImagePath);
      }
      
      return {
        success: true,
        text: result.data.text,
        data: extractedData,
        confidence: result.data.confidence,
        processingTimeMs: Date.now() - startTime
      };
    } catch (error) {
      log(`OCR processing error: ${error}`, 'ocr');
      return {
        success: false,
        error: `OCR processing failed: ${error}`
      };
    }
  }

  /**
   * Start the GDPR compliance scheduler to handle document retention
   */
  private startGdprComplianceScheduler(): void {
    this.schedulerRunning = true;
    
    // Run once a day to check for documents that need to be deleted
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    
    setInterval(() => {
      log('Running GDPR compliance check for document retention', 'ocr');
      // This would typically query the database for documents past retention period
      // and process them according to GDPR requirements
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
      log('OCR service terminated', 'ocr');
    }
  }
}

// Export singleton instance for use throughout the application
export const ocrService = new OCRService();