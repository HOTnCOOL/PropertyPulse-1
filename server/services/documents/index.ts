import { db } from '../../../db';
import { documents, insertDocumentSchema, NewDocument, Document } from '../../../db/schema';
import * as fs from 'fs';
import * as path from 'path';
import { eq, and, isNull } from 'drizzle-orm';
import { log } from '../../vite';
import { IDCardData } from '../ocr';

/**
 * Document Service - Manages document storage and retrieval with GDPR compliance
 */
export class DocumentService {
  private readonly uploadDir: string;
  private readonly retentionPeriodDays: number;

  constructor(options: { uploadDir?: string; retentionPeriodDays?: number } = {}) {
    // Set default upload directory and retention period
    this.uploadDir = options.uploadDir || path.join(process.cwd(), 'uploads', 'documents');
    this.retentionPeriodDays = options.retentionPeriodDays || 90; // Default 90 days retention
    
    // Ensure upload directory exists
    this.ensureUploadDirExists();
  }

  /**
   * Ensure the upload directory exists
   */
  private ensureUploadDirExists(): void {
    try {
      if (!fs.existsSync(this.uploadDir)) {
        fs.mkdirSync(this.uploadDir, { recursive: true });
        log(`Created document upload directory: ${this.uploadDir}`, 'documents');
      }
    } catch (error) {
      log(`Error creating document upload directory: ${error}`, 'documents');
      throw new Error(`Failed to create document upload directory: ${error}`);
    }
  }

  /**
   * Save a document to storage and database with GDPR compliance
   * 
   * @param file File object containing buffer and metadata
   * @param documentData Document metadata
   * @param extractedData Optional OCR-extracted data
   * @returns The saved document record
   */
  public async saveDocument(
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    documentData: {
      guestId?: number;
      bookingId?: number;
      paymentId?: number;
      type: 'id_card' | 'passport' | 'residence_permit' | 'invoice' | 'payment_receipt' | 'booking_confirmation';
      uploadedBy?: string;
      gdprConsent: boolean;
    },
    extractedData?: IDCardData
  ): Promise<Document> {
    try {
      // Generate a unique filename
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 15);
      const fileExt = path.extname(file.originalname);
      const filename = `${documentData.type}_${timestamp}_${randomStr}${fileExt}`;
      const filePath = path.join(this.uploadDir, filename);
      
      // Create file
      fs.writeFileSync(filePath, file.buffer);
      
      // Calculate retention expiry based on current policy
      const retentionExpiry = new Date();
      retentionExpiry.setDate(retentionExpiry.getDate() + this.retentionPeriodDays);
      
      // Create document record
      const newDocument: NewDocument = {
        guestId: documentData.guestId,
        bookingId: documentData.bookingId,
        paymentId: documentData.paymentId,
        type: documentData.type,
        filename: filename,
        fileUrl: `/uploads/documents/${filename}`,
        originalFilename: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        extractedData: extractedData || {},
        metadata: {
          uploadTime: new Date().toISOString(),
          ipAddress: 'anonymized', // For GDPR compliance, we don't store actual IP
        },
        uploadedBy: documentData.uploadedBy || 'guest',
        gdprConsent: documentData.gdprConsent,
        retentionExpiry: retentionExpiry,
      };
      
      // Validate document data with schema
      const validatedData = insertDocumentSchema.parse(newDocument);
      
      // Insert into database
      const [savedDocument] = await db.insert(documents).values(validatedData).returning();
      
      log(`Document saved: ${filename} (ID: ${savedDocument.id})`, 'documents');
      
      return savedDocument;
    } catch (error) {
      log(`Error saving document: ${error}`, 'documents');
      throw new Error(`Failed to save document: ${error}`);
    }
  }

  /**
   * Get documents for a specific guest
   * 
   * @param guestId Guest ID
   * @returns Array of document records
   */
  public async getDocumentsByGuestId(guestId: number): Promise<Document[]> {
    try {
      // Only return active documents
      const docs = await db.select().from(documents).where(
        and(
          eq(documents.guestId, guestId),
          eq(documents.status, 'active'),
          isNull(documents.deletedAt)
        )
      );
      
      return docs;
    } catch (error) {
      log(`Error retrieving guest documents: ${error}`, 'documents');
      throw new Error(`Failed to retrieve guest documents: ${error}`);
    }
  }

  /**
   * Get documents for a specific booking
   * 
   * @param bookingId Booking ID
   * @returns Array of document records
   */
  public async getDocumentsByBookingId(bookingId: number): Promise<Document[]> {
    try {
      const docs = await db.select().from(documents).where(
        and(
          eq(documents.bookingId, bookingId),
          eq(documents.status, 'active'),
          isNull(documents.deletedAt)
        )
      );
      
      return docs;
    } catch (error) {
      log(`Error retrieving booking documents: ${error}`, 'documents');
      throw new Error(`Failed to retrieve booking documents: ${error}`);
    }
  }

  /**
   * Get a document by ID
   * 
   * @param documentId Document ID
   * @returns Document record or null if not found
   */
  public async getDocumentById(documentId: number): Promise<Document | null> {
    try {
      const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
      
      if (!doc || doc.status !== 'active' || doc.deletedAt) {
        return null;
      }
      
      return doc;
    } catch (error) {
      log(`Error retrieving document: ${error}`, 'documents');
      throw new Error(`Failed to retrieve document: ${error}`);
    }
  }

  /**
   * Mark a document for deletion (GDPR compliance)
   * 
   * @param documentId Document ID
   * @returns True if successful, false if document not found
   */
  public async markDocumentForDeletion(documentId: number): Promise<boolean> {
    try {
      const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
      
      if (!doc) {
        return false;
      }
      
      // Update document status
      await db.update(documents)
        .set({
          status: 'pending_deletion',
          updatedAt: new Date(),
        })
        .where(eq(documents.id, documentId));
      
      log(`Document marked for deletion: ${documentId}`, 'documents');
      
      return true;
    } catch (error) {
      log(`Error marking document for deletion: ${error}`, 'documents');
      throw new Error(`Failed to mark document for deletion: ${error}`);
    }
  }

  /**
   * Permanently delete a document (physical file and database record)
   * This should typically be called by a scheduled GDPR compliance job
   * 
   * @param documentId Document ID
   * @returns True if successful, false if document not found
   */
  public async permanentlyDeleteDocument(documentId: number): Promise<boolean> {
    try {
      const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
      
      if (!doc) {
        return false;
      }
      
      // Delete the physical file
      const filePath = path.join(this.uploadDir, doc.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      // Update the database record (soft delete)
      await db.update(documents)
        .set({
          status: 'deleted',
          deletedAt: new Date(),
          fileUrl: null, // Remove the URL
          extractedData: {}, // Clear extracted data
        })
        .where(eq(documents.id, documentId));
      
      log(`Document permanently deleted: ${documentId}`, 'documents');
      
      return true;
    } catch (error) {
      log(`Error deleting document: ${error}`, 'documents');
      throw new Error(`Failed to delete document: ${error}`);
    }
  }

  /**
   * Run GDPR compliance check to process documents past retention date
   * This should be scheduled to run regularly (e.g., daily)
   */
  public async runGdprComplianceCheck(): Promise<void> {
    try {
      const now = new Date();
      
      // Find documents past retention date
      const expiredDocs = await db.select().from(documents).where(
        and(
          eq(documents.status, 'active'),
          isNull(documents.deletedAt)
        )
      );
      
      for (const doc of expiredDocs) {
        if (doc.retentionExpiry && doc.retentionExpiry < now) {
          log(`Document ${doc.id} has expired retention period, marking for deletion`, 'documents');
          await this.markDocumentForDeletion(doc.id);
        }
      }
      
      // Find documents marked for deletion for more than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const pendingDeletionDocs = await db.select().from(documents).where(
        eq(documents.status, 'pending_deletion')
      );
      
      for (const doc of pendingDeletionDocs) {
        if (doc.updatedAt && doc.updatedAt < thirtyDaysAgo) {
          log(`Document ${doc.id} has been pending deletion for 30+ days, permanently deleting`, 'documents');
          await this.permanentlyDeleteDocument(doc.id);
        }
      }
      
      log('GDPR compliance check completed', 'documents');
    } catch (error) {
      log(`Error running GDPR compliance check: ${error}`, 'documents');
      throw new Error(`Failed to run GDPR compliance check: ${error}`);
    }
  }
}

// Export singleton instance for use throughout the application
export const documentService = new DocumentService();