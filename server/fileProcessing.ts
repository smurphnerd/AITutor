import fs from "fs/promises";
import path from "path";
import { File } from "@shared/schema";
import { PDFDocument } from "pdf-lib";
import mammoth from "mammoth";
import { db } from "./db";
import { files } from "@shared/schema";
import { eq } from "drizzle-orm";
import { extractPDFContent, isLikelyScannedPDF } from "./utils/pdfHelper";
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
    // Use our PDF helper to extract content safely
    const pdfResult = await extractPDFContent(filePath);
    
    // Check if we got an error
    if ('error' in pdfResult) {
      console.error("PDF extraction error:", pdfResult.error);
      
      // Try to at least get page count from the file
      try {
        const dataBuffer = await fs.readFile(filePath);
        const pdfDoc = await PDFDocument.load(dataBuffer);
        const numPages = pdfDoc.getPageCount();
        
        return { 
          text: `PDF document with ${numPages} pages. Could not extract text due to error: ${pdfResult.error}`,
          contentType: "pdf/error" 
        };
      } catch (fallbackError) {
        // Complete failure case
        return { 
          text: `Error processing PDF: ${pdfResult.error}`,
          contentType: "pdf/error" 
        };
      }
    }
    
    // If we have successful extraction
    if (pdfResult.text) {
      console.log(`PDF processed successfully: ${pdfResult.numpages} pages, ${pdfResult.text.length} characters`);
      
      // Create enhanced text with metadata
      let enhancedText = pdfResult.text;
      
      // Add metadata if available
      if (pdfResult.info && pdfResult.info.Title) {
        enhancedText = `Document Title: ${pdfResult.info.Title}\n\n${enhancedText}`;
      }
      
      // Add basic metadata
      enhancedText = `Document Length: ${pdfResult.numpages} pages\n${enhancedText}`;
      
      // Check if the document might be a scanned PDF
      if (isLikelyScannedPDF(pdfResult)) {
        enhancedText = `NOTE: This document appears to be scanned or contain image-based content that may not be fully extracted as text.\n\n${enhancedText}`;
      }
      
      return {
        text: enhancedText,
        contentType: "pdf/text"
      };
    } else {
      // Extraction didn't return an error but also didn't get much text
      return { 
        text: `PDF document with ${pdfResult.numpages || 'unknown'} pages. The document appears to be scanned, encrypted, or contain primarily images. Limited text extraction was possible.`,
        contentType: "pdf/limited" 
      };
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
