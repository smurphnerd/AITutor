import fs from "fs/promises";
import path from "path";
import { File } from "@shared/schema";
import { PDFDocument } from "pdf-lib";
import mammoth from "mammoth";
import { db } from "./db";
import { files } from "@shared/schema";
import { eq } from "drizzle-orm";
// We now focus on text extraction only

/**
 * Process an uploaded file, extracting text content and storing it in the database
 */
export async function processFile(file: File) {
  try {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    let extractedContent: { text: string; contentType: string } = {
      text: "",
      contentType: ""
    };

    if (fileExtension === ".pdf") {
      extractedContent = await processPdf(file.path);
    } else if (fileExtension === ".docx" || fileExtension === ".doc") {
      extractedContent = await processDocx(file.path);
    } else {
      throw new Error(`Unsupported file type: ${fileExtension}`);
    }

    // Store the extracted content directly in the database
    await db.update(files)
      .set({
        extractedText: extractedContent.text,
        contentType: extractedContent.contentType,
        processingStatus: "completed"
      })
      .where(eq(files.id, file.id));

    // We don't need to save to a file anymore since content is in the database
    return extractedContent;
  } catch (error) {
    // Update the database with error status
    await db.update(files)
      .set({
        processingStatus: "error",
        extractedText: `Error processing file: ${error instanceof Error ? error.message : String(error)}`
      })
      .where(eq(files.id, file.id));
      
    console.error(`Error processing file ${file.originalname}:`, error);
    throw error;
  }
}

/**
 * Process a PDF file, extracting text content
 */
async function processPdf(filePath: string): Promise<{ text: string; contentType: string }> {
  try {
    // Use our enhanced PDF extractor
    const { extractPdfText, isLikelyScannedPdf } = await import('./utils/pdfExtractor');
    
    // Extract text from PDF using the improved extractor
    const result = await extractPdfText(filePath);
    
    if (result.success && result.text.length > 100) {
      console.log(`PDF processed successfully: ${result.numPages} pages, ${result.text.length} characters`);
      
      // Include basic metadata in the content if available
      let enhancedText = result.text;
      if (result.metadata.title) {
        enhancedText = `Document Title: ${result.metadata.title}\n\n${enhancedText}`;
      }
      
      // Add scan detection info
      if (isLikelyScannedPdf(result)) {
        enhancedText = `NOTE: This document appears to be scanned or contain image-based content that may not be fully extracted as text.\n\n${enhancedText}`;
      }
      
      return {
        text: enhancedText,
        contentType: "pdf/text"
      };
    } else {
      // If extraction failed or returned minimal text, try loading basic metadata
      try {
        const dataBuffer = await fs.readFile(filePath);
        const pdfDoc = await PDFDocument.load(dataBuffer);
        const numPages = pdfDoc.getPageCount();
        
        console.log(`PDF metadata extracted: ${numPages} pages, but text extraction failed: ${result.error || 'Unknown error'}`);
        
        // Create a more informative fallback response
        const fallbackText = `PDF document with ${numPages} pages. The document appears to be scanned, encrypted, or contain primarily images. Limited text extraction was possible.\n\n${result.text}`;
        
        return { 
          text: fallbackText,
          contentType: "pdf/limited" 
        };
      } catch (metadataError) {
        // Even basic metadata extraction failed
        console.error("Error extracting PDF metadata:", metadataError);
        return { 
          text: "PDF processing faced challenges. The document may be encrypted, password-protected, or use an unsupported format.",
          contentType: "pdf/error"
        };
      }
    }
  } catch (error) {
    console.error("Error processing PDF:", error);
    return { 
      text: "PDF processing encountered an error: " + (error instanceof Error ? error.message : String(error)),
      contentType: "pdf/error"
    };
  }
}

/**
 * Process a DOCX file, extracting text content
 */
async function processDocx(filePath: string): Promise<{ text: string; contentType: string }> {
  try {
    const dataBuffer = await fs.readFile(filePath);
    
    // Extract text from DOCX using mammoth
    const result = await mammoth.extractRawText({ buffer: dataBuffer });
    const text = result.value;
    
    return { 
      text,
      contentType: "docx/text" 
    };
  } catch (error) {
    console.error("Error processing DOCX:", error);
    return { 
      text: "DOCX processing encountered an error: " + (error instanceof Error ? error.message : String(error)),
      contentType: "docx/error"
    };
  }
}
