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
    // Load the PDF document to get basic metadata
    const dataBuffer = await fs.readFile(filePath);
    const pdfDoc = await PDFDocument.load(dataBuffer);
    
    // Get the number of pages
    const numPages = pdfDoc.getPageCount();
    
    // Try direct PDF text extraction first
    try {
      // Import pdf-parse for reliable text extraction
      const pdfParse = await import('pdf-parse');
      
      // Extract text from PDF
      const pdfData = await pdfParse.default(dataBuffer);
      
      // Get the text content
      const extractedText = pdfData.text || "";
      
      console.log(`PDF processed directly: ${numPages} pages, ${extractedText.length} characters extracted`);
      
      // Check if we got meaningful text content
      if (extractedText.trim().length > 50) {
        // We have good text content from pdf-parse
        const imageDescriptions = [];
        if (numPages > 1) {
          imageDescriptions.push("This document may contain images or figures that couldn't be processed automatically.");
        }
        
        return { 
          text: extractedText, 
          images: [], 
          imageDescriptions 
        };
      } else {
        console.log("Limited text extracted with pdf-parse, trying AI extraction as fallback");
        // Not enough text extracted, try AI-based extraction
        throw new Error("Insufficient text extracted with pdf-parse");
      }
    } catch (directError) {
      console.log("Direct PDF parsing failed, trying AI extraction:", directError.message);
      
      // Fallback to AI extraction
      try {
        // Use Gemini to process the PDF and extract content
        const result = await processPdfWithGemini(filePath);
        return result;
      } catch (aiError) {
        console.error("Error using Gemini for PDF processing:", aiError);
        
        // Both methods failed, return basic information
        const fullText = `PDF document with ${numPages} pages. Content not fully extracted, but processing will attempt to continue.`;
        
        // Add a generic image description if it appears to be a multi-page document
        const imageDescriptions = [];
        if (numPages > 1) {
          imageDescriptions.push("This document may contain images or figures that couldn't be processed automatically.");
        }
        
        return { text: fullText, images: [], imageDescriptions };
      }
    }
  } catch (error) {
    console.error("Error processing PDF:", error);
    throw new Error("Failed to process PDF: " + (error instanceof Error ? error.message : String(error)));
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
