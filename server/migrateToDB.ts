/**
 * Migration script to extract content from existing files in the uploads directory 
 * and store it in the database
 */
import fs from "fs/promises";
import path from "path";
import { db } from "./db";
import { files } from "@shared/schema";
import { eq } from "drizzle-orm";
import { processFile } from "./fileProcessing";
import { log } from "./vite";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// Fix for file paths that have incorrect prefixes
function fixFilePath(filePath: string): string {
  // Replace any incorrect path prefix with the correct one
  if (filePath.includes('/home/smurphnerd/projects/AITutor/uploads/')) {
    return filePath.replace('/home/smurphnerd/projects/AITutor/uploads/', path.join(UPLOADS_DIR, '/'));
  }
  return filePath;
}

async function migrateContentToDB() {
  try {
    log("Starting content migration to database...", "migration");
    
    // Get all files from database
    const allFiles = await db.select().from(files);
    let migrationCount = 0;
    
    // Process each file
    for (const file of allFiles) {
      try {
        // Skip files that already have content
        if (file.extractedText) {
          log(`Skipping file ${file.id}: ${file.originalname} - already processed`, "migration");
          continue;
        }
        
        // Fix the file path and check if it exists in the uploads directory
        const correctedPath = fixFilePath(file.path);
        if (!await fileExists(correctedPath)) {
          log(`Skipping file ${file.id}: ${file.originalname} - file not found at ${correctedPath}`, "migration");
          continue;
        }
        
        // Update the file path to use the corrected one
        const fixedFile = { ...file, path: correctedPath };

        // Process file to extract content
        log(`Processing file ${file.id}: ${file.originalname}`, "migration");
        
        // If there's a content.json file already, use that
        const contentJsonPath = `${fixedFile.path}.content.json`;
        
        if (await fileExists(contentJsonPath)) {
          // Read the extracted content from the JSON file
          const contentJsonRaw = await fs.readFile(contentJsonPath, 'utf-8');
          let contentJson;
          
          try {
            contentJson = JSON.parse(contentJsonRaw);
          } catch (parseError) {
            log(`Error parsing content JSON for file ${file.id}: ${parseError}`, "migration");
            contentJson = { text: "Error parsing content file", contentType: "error" };
          }
          
          // Update the file record with the extracted content
          await db.update(files)
            .set({
              extractedText: contentJson.text,
              contentType: file.mimetype.includes('pdf') ? 'pdf/text' : 'docx/text',
              processingStatus: "completed"
            })
            .where(eq(files.id, file.id));
            
          migrationCount++;
          log(`Migrated existing content for file ${file.id}: ${file.originalname}`, "migration");
        } else {
          // No content.json file, process the file
          log(`No content file found, processing file ${file.id}: ${file.originalname}`, "migration");
          const processedContent = await processFile(fixedFile);
          
          if (processedContent) {
            log(`Processed and saved content for file ${file.id}: ${file.originalname}`, "migration");
            migrationCount++;
          }
        }
      } catch (fileError) {
        log(`Error processing file ${file.id}: ${file.originalname} - ${fileError}`, "migration");
      }
    }
    
    log(`Migration complete. Processed ${migrationCount} files.`, "migration");
  } catch (error) {
    log(`Error during migration: ${error}`, "migration");
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Run the migration
migrateContentToDB().catch(error => {
  log(`Migration script failed: ${error}`, "migration");
});