import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './index.js';

// Run migrations programmatically
async function main() {
  console.log('Running migrations...');
  
  try {
    // Create enums
    await db.execute(`
      DO $$ BEGIN
        CREATE TYPE IF NOT EXISTS document_type AS ENUM (
          'id_card', 'passport', 'residence_permit', 'invoice', 'payment_receipt', 'booking_confirmation'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await db.execute(`
      DO $$ BEGIN
        CREATE TYPE IF NOT EXISTS document_status AS ENUM (
          'active', 'retention_period', 'pending_deletion', 'deleted'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    // Create documents table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        guest_id INTEGER REFERENCES guests(id),
        booking_id INTEGER REFERENCES bookings(id),
        payment_id INTEGER REFERENCES payments(id),
        type document_type NOT NULL,
        filename TEXT NOT NULL,
        file_url TEXT NOT NULL,
        original_filename TEXT,
        file_size INTEGER,
        mime_type TEXT,
        status document_status NOT NULL DEFAULT 'active',
        extracted_data JSONB,
        metadata JSONB,
        uploaded_by TEXT,
        retention_expiry TIMESTAMP,
        gdpr_consent BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP
      );
    `);
    
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

main();