/**
 * Script to directly extract content from existing content.json files in uploads
 * and store them in the database
 */
import fs from "fs/promises";
import path from "path";
import { db } from "./db";
import { files } from "@shared/schema";
import { eq } from "drizzle-orm";
import { log } from "./vite";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

async function migrateContentToDB() {
  try {
    log("Starting content migration from existing files...", "migration");
    
    // Get all files from uploads directory that have content.json
    const dirEntries = await fs.readdir(UPLOADS_DIR, { withFileTypes: true });
    
    // Filter for content.json files
    const contentFiles = dirEntries
      .filter(entry => !entry.isDirectory() && entry.name.endsWith('.content.json'))
      .map(entry => entry.name);
    
    log(`Found ${contentFiles.length} content files to process`, "migration");
    
    // Process each content file
    let processedCount = 0;
    
    for (const contentFileName of contentFiles) {
      try {
        // Extract the original filename (remove .content.json)
        const originalFileName = contentFileName.replace('.content.json', '');
        
        // Read the content.json file
        const contentPath = path.join(UPLOADS_DIR, contentFileName);
        const contentData = await fs.readFile(contentPath, 'utf-8');
        
        // Parse the content
        let extractedContent;
        try {
          extractedContent = JSON.parse(contentData);
        } catch (parseError) {
          log(`Error parsing content from ${contentFileName}: ${parseError}`, "migration");
          continue;
        }
        
        // Find the file in the database that has this filename
        const [fileRecord] = await db.select()
          .from(files)
          .where(eq(files.filename, originalFileName));
        
        if (!fileRecord) {
          log(`No matching file found in database for ${originalFileName}`, "migration");
          continue;
        }
        
        // Update the database with the content
        await db.update(files)
          .set({
            extractedText: extractedContent.text || "",
            contentType: fileRecord.mimetype.includes('pdf') ? 'pdf/text' : 'docx/text',
            processingStatus: "completed"
          })
          .where(eq(files.id, fileRecord.id));
        
        processedCount++;
        log(`Updated content for file ID ${fileRecord.id}: ${fileRecord.originalname}`, "migration");
      } catch (error) {
        log(`Error processing content file ${contentFileName}: ${error}`, "migration");
      }
    }
    
    log(`Migration complete. Processed ${processedCount} content files.`, "migration");
  } catch (error) {
    log(`Migration failed: ${error}`, "migration");
  }
}

// Run the migration
migrateContentToDB().catch(error => {
  log(`Migration script error: ${error}`, "migration");
});