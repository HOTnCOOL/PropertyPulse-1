# OCR Model Usage Guide

## Overview

This guide outlines the OCR (Optical Character Recognition) capabilities of our Property Management application, with a focus on document processing for ID verification and guest registration.

## Supported Document Types

Our OCR system can process the following document types:

1. **National ID Cards** (from most countries)
2. **Passports** (international standard formats)
3. **Driver's Licenses** (standard formats)

## Extracted Information

The OCR system can extract the following information from identity documents:

| Field | Description | Example |
|-------|-------------|---------|
| firstName | Guest's first/given name | "John" |
| lastName | Guest's last/surname | "Smith" |
| dateOfBirth | Date of birth (various formats) | "1990-05-15" |
| placeOfBirth | Place of birth | "London" |
| idNumber | ID/Passport/License number | "AB123456" |
| personalNumber | National ID number (if applicable) | "1234567890" |
| homeAddress | Residential address | "123 Main St, Anytown" |
| nationality | Country of citizenship | "United Kingdom" |
| idType | Type of document | "passport" or "national_id" |
| expiryDate | Document expiration date | "2028-01-01" |

## Technical Implementation

### Models Used

In accordance with our [Model Usage Policy](./MODEL_USAGE_POLICY.md), our OCR system **exclusively** uses Google Gemini models:

1. **Primary: Gemini Flash 1.5**
   - Fast processing time
   - Excellent at structured data extraction
   - Lower resource consumption

2. **Secondary: Gemini 2.0 Pro**
   - Higher accuracy for complex documents
   - Better language understanding for multilingual documents
   - Used when Flash 1.5 fails or for documents requiring more complex analysis

### Process Flow

1. User captures/uploads document image
2. System preprocesses the image (compression, orientation correction)
3. Image is sent to Google Gemini model with appropriate prompts
4. Model extracts structured data
5. System validates and normalizes the extracted data
6. Validated data is provided to the application

## Best Practices for Optimal Results

1. **Image Quality**
   - Ensure good lighting (avoid glare and shadows)
   - Capture the entire document with margins
   - Keep the document flat and avoid angles

2. **Document Positioning**
   - Center the document in the frame
   - Make sure all text is clearly visible
   - Remove any obstructions (fingers, etc.)

3. **Background**
   - Use a dark, solid background for light documents
   - Use a light background for dark documents
   - Avoid patterns or textured backgrounds

## Troubleshooting

If the OCR system fails to extract information correctly:

1. **Try a different angle** or lighting condition
2. **Manually enter** the information if OCR continues to fail
3. **Check document validity** - expired or damaged documents may not scan properly

## Privacy & Security

- **No document images are permanently stored** after processing
- All data is transmitted securely via HTTPS
- Only Google Gemini models are used, ensuring consistent security standards
- No third-party OCR services are utilized

## Technical Support

For technical issues related to OCR functionality:

1. Check the application logs for specific error messages
2. Verify your API configuration is correct
3. Ensure you have proper permissions for document processing

## Version

OCR Guide Version: 1.1.0
Last Updated: February 26, 2025