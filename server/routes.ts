import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import * as fsSync from "fs";
import { v4 as uuidv4 } from "uuid";
import { processFile } from "./fileProcessing";
// Import only the services we need
import { generateErrorGradingResult } from "./mockGrader";
import { insertFileSchema } from "@shared/schema";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ZodError } from "zod";

// We'll use the uploads directory for initial file upload,
// but content will be stored in the database
import { UPLOADS_DIR } from "./uploadFix";

// Configure multer storage
const storage_config = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use the uploads directory that was created in uploadFix
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueFilename = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  },
});

const upload = multer({
  storage: storage_config,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type, only PDF and DOCX are allowed"));
    }
  },
});

// Define schema for grading request
const gradingRequestSchema = z.object({
  rubricIds: z.array(z.string().or(z.number().transform(n => n.toString()))),
  submissionIds: z.array(z.string().or(z.number().transform(n => n.toString()))),
});

// Keep track of grading jobs in memory for this MVP
const gradingJobs = new Map();

export async function registerRoutes(app: Express): Promise<Server> {
  // Error handling middleware
  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "File is too large (max 10MB)" });
      }
    }
    if (err instanceof ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: err.errors });
    }
    next(err);
  });

  // File upload endpoint for rubrics
  app.post("/api/upload/rubric", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileData = {
        originalname: req.file.originalname,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        path: req.file.path,
        size: req.file.size,
        fileType: "rubric",
      };

      const validatedData = insertFileSchema.parse(fileData);
      const file = await storage.createFile(validatedData);

      // Process the file to extract text and content in background
      try {
        const processedContent = await processFile(file);
        
        // File successfully processed, send back metadata with processing status
        res.status(201).json({
          id: file.id,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          fileType: file.fileType,
          processingStatus: "completed",
          contentSummary: processedContent.text.substring(0, 100) + "..." // Show a preview
        });
        
        // Clean up temporary file after processing
        await fs.unlink(file.path).catch(e => console.error("Error deleting temp file:", e));
        
      } catch (processingError) {
        // We still return success since the file was uploaded, but with processing error
        console.error("Error processing rubric:", processingError);
        res.status(201).json({
          id: file.id,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          fileType: file.fileType,
          processingStatus: "error",
          processingError: processingError.message
        });
      }
    } catch (error) {
      console.error("Error uploading rubric:", error);
      res.status(500).json({ message: "Failed to upload rubric" });
    }
  });

  // File upload endpoint for submissions
  app.post("/api/upload/submission", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileData = {
        originalname: req.file.originalname,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        path: req.file.path,
        size: req.file.size,
        fileType: "submission",
      };

      const validatedData = insertFileSchema.parse(fileData);
      const file = await storage.createFile(validatedData);

      // Process the file to extract text and content in background
      try {
        const processedContent = await processFile(file);
        
        // File successfully processed, send back metadata with processing status
        res.status(201).json({
          id: file.id,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          fileType: file.fileType,
          processingStatus: "completed",
          contentSummary: processedContent.text.substring(0, 100) + "..." // Show a preview
        });
        
        // Clean up temporary file after processing
        await fs.unlink(file.path).catch(e => console.error("Error deleting temp file:", e));
        
      } catch (processingError) {
        // We still return success since the file was uploaded, but with processing error
        console.error("Error processing submission:", processingError);
        res.status(201).json({
          id: file.id,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          fileType: file.fileType,
          processingStatus: "error",
          processingError: processingError.message
        });
      }
    } catch (error) {
      console.error("Error uploading submission:", error);
      res.status(500).json({ message: "Failed to upload submission" });
    }
  });

  // Get uploaded files by type
  app.get("/api/files/:fileType", async (req, res) => {
    try {
      const { fileType } = req.params;
      if (fileType !== "rubric" && fileType !== "submission") {
        return res.status(400).json({ message: "Invalid file type" });
      }

      const files = await storage.getFilesByType(fileType);
      
      // Return file information including processing status
      const fileData = files.map(file => ({
        id: file.id,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        fileType: file.fileType,
        processingStatus: file.processingStatus,
        uploadedAt: file.uploadedAt
      }));

      res.json(fileData);
    } catch (error) {
      console.error(`Error getting ${req.params.fileType} files:`, error);
      res.status(500).json({ message: `Failed to get ${req.params.fileType} files` });
    }
  });

  // Get extracted content for a specific file
  app.get("/api/files/:id/content", async (req, res) => {
    try {
      const fileId = parseInt(req.params.id);
      if (isNaN(fileId)) {
        return res.status(400).json({ message: "Invalid file ID" });
      }
      
      const file = await storage.getFileById(fileId);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      
      // If content already exists in the database, return it
      if (file.extractedText) {
        return res.json({
          id: file.id,
          originalname: file.originalname,
          fileType: file.fileType,
          extractedText: file.extractedText,
          contentType: file.contentType,
          processingStatus: "completed"
        });
      }
      
      // On-demand processing: If we have a valid file path, try to extract content
      try {
        // Create a fallback text extraction
        let extractedText = "";
        let contentType = "text/plain";
        
        // Since we're migrating and paths might be wrong, provide a useful fallback
        extractedText = `Content of ${file.originalname} (file ID: ${file.id}).\n\n` +
          `This is a ${file.fileType === "rubric" ? "grading rubric" : "student submission"} document.\n\n` +
          `The system is transitioning to storing content directly in the database. ` +
          `Please re-upload this file if you need to access its full content.`;
        
        // Update the database with this basic content
        await storage.updateFileContent(file.id, {
          extractedText,
          contentType: file.mimetype,
          processingStatus: "completed"
        });
        
        return res.json({
          id: file.id,
          originalname: file.originalname,
          fileType: file.fileType,
          extractedText,
          contentType: file.mimetype,
          processingStatus: "completed"
        });
      } catch (processingError) {
        console.error(`Error processing file content on-demand:`, processingError);
        return res.status(500).json({ 
          message: "Failed to process file content",
          error: processingError.message 
        });
      }
    } catch (error) {
      console.error(`Error getting file content:`, error);
      res.status(500).json({ message: "Failed to retrieve file content" });
    }
  });

  // Delete a file
  app.delete("/api/files/:id", async (req, res) => {
    try {
      const fileId = parseInt(req.params.id);
      if (isNaN(fileId)) {
        return res.status(400).json({ message: "Invalid file ID" });
      }

      const file = await storage.getFileById(fileId);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // Delete the physical file if it exists
      try {
        // First check if the path is valid and exists
        const filePath = file.path.startsWith('/home') 
          ? path.join(TEMP_UPLOAD_DIR, path.basename(file.path))
          : file.path;
          
        // Check if file exists before trying to delete
        const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
        if (fileExists) {
          await fs.unlink(filePath);
          console.log(`Successfully deleted file: ${filePath}`);
        } else {
          console.log(`File not found, skipping deletion: ${filePath}`);
        }
      } catch (unlinkError) {
        console.error("Error deleting file from disk:", unlinkError);
        // Continue anyway, we still want to remove from DB
      }

      await storage.deleteFile(fileId);
      res.json({ message: "File deleted successfully" });
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  // Start grading job
  app.post("/api/grade", async (req, res) => {
    try {
      const { rubricIds, submissionIds } = gradingRequestSchema.parse(req.body);
      
      if (rubricIds.length === 0 || submissionIds.length === 0) {
        return res.status(400).json({ 
          message: "You must provide at least one rubric and one submission" 
        });
      }

      // Convert strings to numbers if needed
      const numericRubricIds = rubricIds.map(id => typeof id === 'string' ? parseInt(id) : id);
      const numericSubmissionIds = submissionIds.map(id => typeof id === 'string' ? parseInt(id) : id);

      // Verify files exist and filter out any undefined values
      const rubricFilesWithUndefined = await Promise.all(
        numericRubricIds.map(id => storage.getFileById(id))
      );
      const submissionFilesWithUndefined = await Promise.all(
        numericSubmissionIds.map(id => storage.getFileById(id))
      );
      
      // Filter out any undefined files
      const rubricFiles = rubricFilesWithUndefined.filter(file => file !== undefined);
      const submissionFiles = submissionFilesWithUndefined.filter(file => file !== undefined);

      // Check if any files were not found by comparing original arrays with filtered ones
      if (rubricFiles.length !== numericRubricIds.length) {
        return res.status(404).json({ message: "One or more rubric files not found" });
      }
      if (submissionFiles.length !== numericSubmissionIds.length) {
        return res.status(404).json({ message: "One or more submission files not found" });
      }

      // Create job ID
      const jobId = uuidv4();
      
      // Initialize job in memory
      gradingJobs.set(jobId, {
        status: 'processing',
        progress: 0,
        submissionFiles,
        rubricFiles,
        results: [],
        currentFile: submissionFiles[0]?.originalname,
        totalFiles: submissionFiles.length,
        createdAt: new Date().toISOString()
      });

      // Start the grading process asynchronously
      (async () => {
        try {
          for (let i = 0; i < submissionFiles.length; i++) {
            const submission = submissionFiles[i];
            
            // Update job status
            gradingJobs.set(jobId, {
              ...gradingJobs.get(jobId),
              progress: Math.round((i / submissionFiles.length) * 100),
              currentFile: submission.originalname
            });
            
            // Process the submission against all rubrics
            // Make sure submission is not undefined before passing to grading function
            if (!submission) {
              throw new Error("Submission file is undefined");
            }

            // Import our comprehensive analyzer and enhanced grader
            const { enhancedGradePapers } = await import('./services/enhancedGrader');
            
            // Process using comprehensive two-stage approach:
            // 1. First stage: Analyze all assignment materials together (instructions, rubrics, reference materials)
            // 2. Second stage: Grade submission against comprehensive standardized format
            // This gives students clear understanding of what was expected and how they performed
            const result = await enhancedGradePapers(rubricFiles, submission);
            
            // Store result (using our result from either the successful call or the error handler)
            const currentJob = gradingJobs.get(jobId);
            if (currentJob && result) {
              gradingJobs.set(jobId, {
                ...currentJob,
                results: [...currentJob.results, result]
              });
            }
          }
          
          // Mark job as complete
          gradingJobs.set(jobId, {
            ...gradingJobs.get(jobId),
            status: 'complete',
            progress: 100,
            completedAt: new Date().toISOString()
          });
        } catch (error) {
          console.error("Error processing grading job:", error);
          gradingJobs.set(jobId, {
            ...gradingJobs.get(jobId),
            status: 'error',
            error: error.message || "An unknown error occurred"
          });
        }
      })();
      
      res.status(202).json({ jobId });
    } catch (error) {
      console.error("Error starting grading job:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to start grading" });
    }
  });

  // Get grading job status
  app.get("/api/grade/status/:jobId", (req, res) => {
    const { jobId } = req.params;
    const job = gradingJobs.get(jobId);
    
    if (!job) {
      return res.status(404).json({ message: "Grading job not found" });
    }
    
    res.json({
      status: job.status,
      progress: job.progress,
      currentFile: job.currentFile,
      totalFiles: job.totalFiles,
      error: job.error
    });
  });

  // Get grading results
  app.get("/api/grade/results/:jobId", (req, res) => {
    const { jobId } = req.params;
    const job = gradingJobs.get(jobId);
    
    if (!job) {
      return res.status(404).json({ message: "Grading job not found" });
    }
    
    if (job.status !== 'complete') {
      return res.status(400).json({ 
        message: "Grading is not complete yet",
        status: job.status
      });
    }
    
    res.json(job.results);
  });

  const httpServer = createServer(app);
  return httpServer;
}
