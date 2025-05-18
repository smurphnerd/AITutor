import fs from 'fs/promises';

// PDF parsing function that doesn't rely directly on problematic pdf-parse import
export async function parsePdf(filePath: string): Promise<{
  text: string;
  numPages: number;
  info: Record<string, any>;
  success: boolean;
  error?: string;
}> {
  try {
    // Read the PDF file
    const dataBuffer = await fs.readFile(filePath);
    
    // Use a dynamic import to avoid the problematic code in the main module
    // We're importing a specific file to bypass the problematic index.js
    const pdfParse = (await import('../node_modules/pdf-parse/lib/pdf-parse.js')).default;
    
    console.log(`Attempting to parse PDF: ${filePath}`);
    
    // Parse the PDF
    const result = await pdfParse(dataBuffer, {
      max: 0 // No page limit
    });
    
    return {
      text: result.text || "",
      numPages: result.numpages || 0,
      info: result.info || {},
      success: true
    };
  } catch (error) {
    console.error("Error in PDF parsing:", error);
    return {
      text: "",
      numPages: 0,
      info: {},
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}