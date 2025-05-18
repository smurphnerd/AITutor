import fs from "fs/promises";
import path from "path";
import { File } from "@shared/schema";
import { PDFDocument } from "pdf-lib";
import mammoth from "mammoth";
import { processPdfWithGemini } from "./gemini";

/**
 * Process an uploaded file, extracting text and images
 */
export async function processFile(file: File) {
  try {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    let extractedContent: { text: string; images: string[]; imageDescriptions?: string[] } = {
      text: "",
      images: [],
    };

    if (fileExtension === ".pdf") {
      extractedContent = await processPdf(file.path);
    } else if (fileExtension === ".docx" || fileExtension === ".doc") {
      extractedContent = await processDocx(file.path);
    } else {
      throw new Error(`Unsupported file type: ${fileExtension}`);
    }

    // Save the extracted content alongside the original file
    const contentPath = `${file.path}.content.json`;
    await fs.writeFile(contentPath, JSON.stringify(extractedContent), "utf-8");

    return extractedContent;
  } catch (error) {
    console.error(`Error processing file ${file.originalname}:`, error);
    throw error;
  }
}

/**
 * Process a PDF file, extracting text and images
 */
async function processPdf(filePath: string) {
  try {
    // Use our dedicated utility for PDF text extraction
    const { extractTextFromPdf } = await import('./pdfUtils');
    
    // Extract text directly from the PDF
    const result = await extractTextFromPdf(filePath);
    
    if (result.success && result.text.length > 50) {
      console.log(`PDF processed successfully: ${result.numPages} pages, ${result.text.length} characters`);
      
      // Create image description placeholder
      const imageDescriptions = [];
      if (result.numPages > 1) {
        imageDescriptions.push("This document may contain images or figures that couldn't be extracted automatically.");
      }
      
      return {
        text: result.text,
        images: [],
        imageDescriptions
      };
    } else {
      // If direct extraction failed or returned minimal text, try loading basic metadata
      try {
        const dataBuffer = await fs.readFile(filePath);
        const pdfDoc = await PDFDocument.load(dataBuffer);
        const numPages = pdfDoc.getPageCount();
        
        console.log(`PDF metadata extracted: ${numPages} pages, but text extraction failed: ${result.error || 'Unknown error'}`);
        
        // Create a fallback response with basic information
        const fallbackText = `PDF document with ${numPages} pages. Text extraction was limited. The document may be scanned, encrypted, or contain primarily images.`;
        
        // Add a generic image description
        const imageDescriptions = ["This document appears to contain content that couldn't be fully extracted as text."];
        
        return { text: fallbackText, images: [], imageDescriptions };
      } catch (metadataError) {
        // Even basic metadata extraction failed
        console.error("Failed to extract PDF metadata:", metadataError);
        
        // Return minimal information
        return {
          text: "Could not extract content from this PDF. The file may be damaged or in an unsupported format.",
          images: [],
          imageDescriptions: ["Document processing failed."]
        };
      }
    }
  } catch (error) {
    console.error("Error processing PDF:", error);
    return {
      text: "Error processing PDF: " + (error instanceof Error ? error.message : String(error)),
      images: [],
      imageDescriptions: []
    };
  }
}

/**
 * Process a DOCX file, extracting text and handling images
 */
async function processDocx(filePath: string) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    
    // Extract text from DOCX
    const result = await mammoth.extractRawText({ buffer: dataBuffer });
    const text = result.value;
    
    // Extract images
    const { images } = await extractDocxImages(dataBuffer);
    
    return { text, images };
  } catch (error) {
    console.error("Error processing DOCX:", error);
    throw new Error("Failed to process DOCX");
  }
}

/**
 * Extract images from a DOCX file
 */
async function extractDocxImages(buffer: Buffer) {
  try {
    const imageData: string[] = [];
    
    // Use mammoth to extract images
    const result = await mammoth.extractRawText({ buffer });
    
    // For MVP, we'll just indicate that we found images
    // In a production environment, we would extract and save the actual images
    
    return { images: imageData };
  } catch (error) {
    console.error("Error extracting DOCX images:", error);
    return { images: [] };
  }
}
