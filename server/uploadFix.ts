/**
 * Simple utility to create the uploads directory and ensure files can be saved there
 */
import * as fs from 'fs';
import path from 'path';

export function ensureUploadsDirectory() {
  const tempDir = path.join(process.cwd(), 'temp_uploads');
  
  if (!fs.existsSync(tempDir)) {
    try {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log(`Created temp upload directory: ${tempDir}`);
    } catch (err) {
      console.error(`Error creating temp uploads directory: ${err}`);
    }
  } else {
    console.log(`Temp upload directory already exists: ${tempDir}`);
  }
  
  return tempDir;
}

// Export the directory path
export const UPLOADS_DIR = ensureUploadsDirectory();