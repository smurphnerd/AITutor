/**
 * Enhanced PDF Text Extractor
 * 
 * This utility provides improved text extraction from PDF files using the pdf-parse package.
 * It includes additional processing to handle common issues with PDFs and improve text quality.
 */

import fs from 'fs/promises';
import path from 'path';

// Interface for extracted PDF content
export interface ExtractedPdfContent {
  text: string;
  numPages: number;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
    modificationDate?: string;
  };
  success: boolean;
  error?: string;
}

/**
 * Extract text from a PDF using pdf-parse for better quality results
 */
export async function extractPdfText(filePath: string): Promise<ExtractedPdfContent> {
  try {
    console.log(`Extracting text from PDF: ${filePath}`);
    
    // Read the PDF file as a buffer
    const dataBuffer = await fs.readFile(filePath);
    
    // Use pdf-parse with dynamic import to avoid dependency issues
    try {
      // Dynamic import to avoid potential issues with direct imports
      const pdfParse = (await import('pdf-parse')).default;
      
      const result = await pdfParse(dataBuffer);
      
      // Extract metadata
      const metadata = {
        title: result.info?.Title,
        author: result.info?.Author,
        subject: result.info?.Subject,
        keywords: result.info?.Keywords,
        creator: result.info?.Creator,
        producer: result.info?.Producer,
        creationDate: result.info?.CreationDate,
        modificationDate: result.info?.ModDate
      };
      
      // Clean and normalize the extracted text
      const cleanedText = cleanPdfText(result.text);
      
      return {
        text: cleanedText,
        numPages: result.numpages || 0,
        metadata,
        success: true
      };
    } catch (error) {
      const pdfParseError = error as Error;
      console.error("Error with pdf-parse:", pdfParseError);
      
      // Fall back to a secondary method if available
      try {
        // Try the custom PDF parser as fallback
        const { parsePdf } = await import('../pdf-parser');
        const fallbackResult = await parsePdf(filePath);
        
        return {
          text: cleanPdfText(fallbackResult.text),
          numPages: fallbackResult.numPages,
          metadata: fallbackResult.info || {},
          success: fallbackResult.success
        };
      } catch (fallbackError) {
        throw new Error(`PDF extraction failed with both methods: ${pdfParseError.message || 'Unknown error'}`);
      }
    }
  } catch (error) {
    console.error("PDF extraction error:", error);
    return {
      text: "",
      numPages: 0,
      metadata: {},
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Clean and normalize extracted PDF text
 */
function cleanPdfText(text: string): string {
  if (!text) return '';
  
  // Replace common PDF extraction artifacts
  let cleaned = text
    // Remove control characters and null bytes
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Replace multiple spaces with a single space
    .replace(/\s+/g, ' ')
    // Fix common encoding issues
    .replace(/�/g, '')
    // Normalize newlines
    .replace(/\r\n/g, '\n')
    // Fix word breaks
    .replace(/(\w)-\s*\n\s*(\w)/g, '$1$2')
    // Handle bullets
    .replace(/•/g, '* ')
    // Fix line breaks
    .replace(/([a-z])\s+([A-Z])/g, '$1\n$2')
    // Remove excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  return cleaned;
}

/**
 * Check if a PDF document might be scanned/image-based
 * This is a heuristic approach - not 100% accurate
 */
export function isLikelyScannedPdf(content: ExtractedPdfContent): boolean {
  // If we couldn't extract text successfully, it might be scanned
  if (!content.success || !content.text) {
    return true;
  }
  
  // Calculate text density (characters per page)
  const charsPerPage = content.text.length / content.numPages;
  
  // Very low character count per page may indicate a scanned document
  // Typical text pages have thousands of characters
  if (charsPerPage < 500 && content.numPages > 0) {
    return true;
  }
  
  // Check for signs of OCR or image-based PDFs
  let hasOcrMarkers = false;
  
  if (content.text.includes('OCR') || content.text.includes('scanned')) {
    hasOcrMarkers = true;
  }
  
  // Check producer metadata if available
  if (content.metadata.producer && typeof content.metadata.producer === 'string') {
    const producer = content.metadata.producer;
    if (
      producer.includes('scan') ||
      producer.includes('OCR') ||
      producer.includes('image')
    ) {
      hasOcrMarkers = true;
    }
  }
  
  return hasOcrMarkers;
}