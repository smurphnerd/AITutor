/**
 * PDF Helper functions
 * 
 * A safe wrapper around pdf-parse to handle extraction without dependencies on test files
 */
import * as fs from 'fs/promises';

// Define interface to match pdf-parse response
export interface PDFExtractResult {
  numpages: number;
  numrender: number;
  info: {
    PDFFormatVersion?: string;
    IsAcroFormPresent?: boolean;
    IsXFAPresent?: boolean;
    Title?: string;
    Author?: string;
    Subject?: string;
    Keywords?: string;
    Creator?: string;
    Producer?: string;
    CreationDate?: string;
    ModDate?: string;
    [key: string]: any;
  };
  metadata: any;
  text: string;
  version: string;
}

/**
 * Extract text from a PDF file
 */
export async function extractPDFContent(filePath: string): Promise<PDFExtractResult | { error: string }> {
  try {
    // Read file as buffer
    const dataBuffer = await fs.readFile(filePath);
    
    // Import pdf-parse in a try-catch to handle initialization errors
    try {
      // Using dynamic import to avoid initialization issues
      const pdfParse = (await import('pdf-parse')).default;
      
      // Parse PDF
      const result = await pdfParse(dataBuffer);
      return result;
      
    } catch (importError) {
      console.error('Error importing pdf-parse module:', importError);
      return {
        error: `Failed to load PDF parser: ${importError instanceof Error ? importError.message : String(importError)}`
      };
    }
    
  } catch (fileError) {
    console.error('Error reading PDF file:', fileError);
    return {
      error: `Failed to read PDF file: ${fileError instanceof Error ? fileError.message : String(fileError)}`
    };
  }
}

/**
 * Check if a PDF might be primarily scanned content based on text-to-page ratio
 */
export function isLikelyScannedPDF(result: PDFExtractResult): boolean {
  if (!result.text || !result.numpages) return false;
  
  // Calculate text-to-page ratio
  const textToPageRatio = result.text.length / result.numpages;
  
  // Typical text pages have thousands of characters
  // Scanned PDFs or image-heavy PDFs will have much lower ratios
  return textToPageRatio < 500;
}