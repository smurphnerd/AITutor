import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema still included from original
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Files table to store uploaded rubrics and submissions
export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  originalname: text("originalname").notNull(),
  filename: text("filename").notNull(),
  mimetype: text("mimetype").notNull(),
  path: text("path").notNull(),
  size: integer("size").notNull(),
  fileType: text("file_type").notNull(), // "rubric" or "submission"
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  
  // New fields to store extracted content directly in the database
  extractedText: text("extracted_text"), // Store the extracted text content
  contentType: text("content_type"), // Indicate the type of content (PDF text, DOCX text, etc.)
  processingStatus: text("processing_status"), // Track processing status
  userId: integer("user_id"), // Added for proper user association
});

export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  uploadedAt: true,
  // New fields can be set after initial upload
  extractedText: true,
  contentType: true,
  processingStatus: true
});

export type InsertFile = z.infer<typeof insertFileSchema>;
export type File = typeof files.$inferSelect;

// Grading jobs table
export const gradingJobs = pgTable("grading_jobs", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("pending"), // "pending", "processing", "completed", "error"
  progress: integer("progress").notNull().default(0),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertGradingJobSchema = createInsertSchema(gradingJobs).omit({
  id: true,
  status: true,
  progress: true,
  error: true,
  createdAt: true,
  completedAt: true,
});

export type InsertGradingJob = z.infer<typeof insertGradingJobSchema>;
export type GradingJob = typeof gradingJobs.$inferSelect;

// Grading results table
export const gradingResults = pgTable("grading_results", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => gradingJobs.id),
  submissionId: integer("submission_id").notNull().references(() => files.id),
  submissionName: text("submission_name").notNull(),
  totalScore: integer("total_score").notNull(),
  maxPossibleScore: integer("max_possible_score").notNull(),
  overallFeedback: text("overall_feedback").notNull(),
  status: text("status").notNull(), // "pass" or "fail"
  sectionFeedback: jsonb("section_feedback").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});



export const insertGradingResultSchema = createInsertSchema(gradingResults).omit({
  id: true,
  createdAt: true,
});

export type InsertGradingResult = z.infer<typeof insertGradingResultSchema>;
export type GradingResult = typeof gradingResults.$inferSelect;

// Many-to-many table for job-file relationships
export const jobFiles = pgTable("job_files", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => gradingJobs.id),
  fileId: integer("file_id").notNull().references(() => files.id),
  fileType: text("file_type").notNull(), // "rubric" or "submission"
});



export const insertJobFileSchema = createInsertSchema(jobFiles).omit({
  id: true,
});

export type InsertJobFile = z.infer<typeof insertJobFileSchema>;
export type JobFile = typeof jobFiles.$inferSelect;
