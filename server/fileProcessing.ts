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
    // Use our enhanced PDF extractor
    const { extractPdfText, isLikelyScannedPdf } = await import('./utils/pdfExtractor');
    
    // Extract text from PDF using the improved extractor
    const result = await extractPdfText(filePath);
    
    if (result.success && result.text.length > 100) {
      console.log(`PDF processed successfully: ${result.numPages} pages, ${result.text.length} characters`);
      
      // Create image description placeholder
      const imageDescriptions = [];
      
      // Check if the PDF is likely scanned
      if (isLikelyScannedPdf(result)) {
        imageDescriptions.push("This document appears to be scanned or contain image-based content that may not be fully extracted as text.");
      } else if (result.numPages > 1) {
        imageDescriptions.push("This document may contain figures, tables, or graphics that weren't extracted as text.");
      }
      
      // Include basic metadata in the content if available
      let enhancedText = result.text;
      if (result.metadata.title) {
        enhancedText = `Document Title: ${result.metadata.title}\n\n${enhancedText}`;
      }
      
      return {
        text: enhancedText,
        images: [],
        imageDescriptions
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
        
        // Add a descriptive message
        const imageDescriptions = ["This document appears to be primarily visual content (images, scanned text) that couldn't be fully extracted as plain text."];
        
        return { text: fallbackText, images: [], imageDescriptions };
      } catch (metadataError) {
        // Even basic metadata extraction failed
        console.error("Error extracting PDF metadata:", metadataError);
        return { 
          text: "PDF processing faced challenges. The document may be encrypted, password-protected, or use an unsupported format.", 
          images: [],
          imageDescriptions: ["PDF processing faced technical limitations."]
        };
      }
    }
  } catch (error) {
    console.error("Error processing PDF:", error);
    return { 
      text: "PDF processing encountered an error: " + (error instanceof Error ? error.message : String(error)), 
      images: [],
      imageDescriptions: ["PDF processing encountered technical difficulties."]
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
