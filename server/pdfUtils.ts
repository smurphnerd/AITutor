import fs from 'fs/promises';
import pdfParse from 'pdf-parse';

/**
 * Extract text directly from a PDF file using pdf-parse
 * @param filePath Path to the PDF file
 * @returns Object containing extracted text and metadata
 */
export async function extractTextFromPdf(filePath: string): Promise<{
  text: string;
  numPages: number;
  info: any;
  success: boolean;
  error?: string;
}> {
  try {
    console.log(`Extracting text from PDF: ${filePath}`);
    
    // Read the PDF file
    const dataBuffer = await fs.readFile(filePath);
    
    // Parse the PDF
    const data = await pdfParse(dataBuffer, {
      // Options for pdf-parse
      max: 0, // No limit on pages
      version: "default" // Use default PDF.js version
    });
    
    // Get the extraction results
    const numPages = data.numpages || 0;
    const text = data.text || "";
    const info = data.info || {};
    
    console.log(`PDF successfully parsed: ${numPages} pages, ${text.length} characters`);
    
    return {
      text,
      numPages,
      info,
      success: true
    };
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    return {
      text: "",
      numPages: 0,
      info: {},
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}