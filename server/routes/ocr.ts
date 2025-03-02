import { Request, Response } from 'express';
import { Express } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { ocrService, IDCardData } from '../services/ocr';
import { documentService } from '../services/documents';
import { log } from '../vite';
import { db } from '../../db';
import { documents, guests } from '../../db/schema';
import { eq } from 'drizzle-orm';

// Setup multer for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept only images
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

// Register OCR API routes
export function registerOCRRoutes(app: Express): void {
  // Create temporary directory for uploads if it doesn't exist
  const uploadDir = path.join(process.cwd(), 'uploads', 'id-images');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  // Simple test endpoint to verify the OCR routes are registered
  app.get('/api/ocr/status', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'operational',
      message: 'OCR service is up and running',
      version: '1.0'
    });
  });

  /**
   * Scan an ID card or passport using OCR
   * POST /api/ocr/scan-id
   */
  app.post('/api/ocr/scan-id', upload.single('image'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No image file provided',
        });
      }

      // Extract parameters
      const idType = req.body.idType === 'passport' ? 'passport' : 'national_id';
      const guestId = req.body.guestId ? parseInt(req.body.guestId) : undefined;
      const bookingId = req.body.bookingId ? parseInt(req.body.bookingId) : undefined;
      const gdprConsent = req.body.gdprConsent === 'true' || req.body.gdprConsent === true;

      // Save the image to a temporary file
      const timestamp = Date.now();
      const filename = `id-${timestamp}-${Math.floor(Math.random() * 1000000000)}.jpg`;
      const imagePath = path.join(uploadDir, filename);
      fs.writeFileSync(imagePath, req.file.buffer);

      // Process the image with OCR
      log(`OCR scanning ${idType} document for guest ID: ${guestId || 'unknown'}`, 'ocr-api');
      const scanResult = await ocrService.scanIdDocument(imagePath, idType, gdprConsent);

      if (!scanResult.success) {
        return res.status(400).json({
          success: false,
          error: scanResult.error || 'OCR scanning failed',
          confidence: scanResult.confidence,
        });
      }

      // Store the document and extracted data
      const documentData = await documentService.saveDocument(
        {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        },
        {
          guestId,
          bookingId,
          type: idType === 'passport' ? 'passport' : 'id_card',
          gdprConsent,
        },
        scanResult.data
      );

      // Update guest record with extracted data if we have a guest ID
      if (guestId && scanResult.data) {
        await updateGuestWithExtractedData(guestId, scanResult.data);
      }

      // Return the processed data
      return res.status(200).json({
        success: true,
        data: scanResult.data,
        documentId: documentData.id,
        confidence: scanResult.confidence,
        processingTimeMs: scanResult.processingTimeMs,
      });
    } catch (error) {
      log(`OCR API error: ${error}`, 'ocr-api');
      return res.status(500).json({
        success: false,
        error: `Server error: ${error}`,
      });
    }
  });

  /**
   * Get all documents for a guest
   * GET /api/documents/guest/:guestId
   */
  app.get('/api/documents/guest/:guestId', async (req: Request, res: Response) => {
    try {
      const guestId = parseInt(req.params.guestId);
      if (isNaN(guestId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid guest ID',
        });
      }

      const guestDocs = await documentService.getDocumentsByGuestId(guestId);
      return res.status(200).json({
        success: true,
        documents: guestDocs,
      });
    } catch (error) {
      log(`Document API error: ${error}`, 'document-api');
      return res.status(500).json({
        success: false,
        error: `Server error: ${error}`,
      });
    }
  });

  /**
   * Request document deletion (GDPR right to be forgotten)
   * DELETE /api/documents/:documentId
   */
  app.delete('/api/documents/:documentId', async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.documentId);
      if (isNaN(documentId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid document ID',
        });
      }

      const success = await documentService.markDocumentForDeletion(documentId);
      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Document not found',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Document marked for deletion. It will be permanently deleted within 30 days.',
      });
    } catch (error) {
      log(`Document deletion error: ${error}`, 'document-api');
      return res.status(500).json({
        success: false,
        error: `Server error: ${error}`,
      });
    }
  });
}

/**
 * Update a guest record with data extracted from their ID
 * @param guestId The guest ID
 * @param extractedData Data extracted from the ID
 */
async function updateGuestWithExtractedData(guestId: number, extractedData: IDCardData): Promise<void> {
  try {
    // Get current guest data
    const [guest] = await db.select().from(guests).where(eq(guests.id, guestId));
    if (!guest) {
      throw new Error(`Guest with ID ${guestId} not found`);
    }

    // Prepare update data
    const updateData: Record<string, any> = {};

    // Only update fields that are empty or if the extracted data has better values
    if (extractedData.firstName && (!guest.firstName || guest.firstName === '')) {
      updateData.firstName = extractedData.firstName;
    }

    if (extractedData.lastName && (!guest.lastName || guest.lastName === '')) {
      updateData.lastName = extractedData.lastName;
    }

    if (extractedData.dateOfBirth && (!guest.dateOfBirth)) {
      // Parse date string to Date object if needed
      try {
        // Try to handle different date formats
        const dateStr = extractedData.dateOfBirth;
        const dateParts = dateStr.split(/[-./\\s]/);
        if (dateParts.length === 3) {
          let day, month, year;
          
          // Try to determine date format
          // Check if the first part is likely a year (4 digits)
          if (dateParts[0].length === 4) {
            // Format: YYYY-MM-DD
            year = parseInt(dateParts[0]);
            month = parseInt(dateParts[1]) - 1;
            day = parseInt(dateParts[2]);
          } else {
            // Format: DD-MM-YYYY or MM-DD-YYYY
            // In most ID cards, the format is DD-MM-YYYY
            day = parseInt(dateParts[0]);
            month = parseInt(dateParts[1]) - 1;
            year = parseInt(dateParts[2]);
            
            // Add century prefix if needed
            if (year < 100) {
              year = year < 50 ? 2000 + year : 1900 + year;
            }
          }
          
          const date = new Date(year, month, day);
          updateData.dateOfBirth = date;
        }
      } catch (error) {
        log(`Error parsing date of birth: ${error}`, 'ocr-api');
      }
    }

    if (extractedData.placeOfBirth && (!guest.placeOfBirth || guest.placeOfBirth === '')) {
      updateData.placeOfBirth = extractedData.placeOfBirth;
    }

    if (extractedData.idNumber && (!guest.idNumber || guest.idNumber === '')) {
      updateData.idNumber = extractedData.idNumber;
    }

    if (extractedData.idType) {
      updateData.idType = extractedData.idType;
    }

    if (extractedData.homeAddress && (!guest.homeAddress || guest.homeAddress === '')) {
      updateData.homeAddress = extractedData.homeAddress;
    }

    // Update the guest record if we have data to update
    if (Object.keys(updateData).length > 0) {
      await db.update(guests).set(updateData).where(eq(guests.id, guestId));
      log(`Updated guest ${guestId} with OCR extracted data`, 'ocr-api');
    }
  } catch (error) {
    log(`Error updating guest with extracted data: ${error}`, 'ocr-api');
    throw error;
  }
}