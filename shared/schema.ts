import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  
  // Subscription fields
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionStatus: varchar("subscription_status").default("free"), // free, active, canceled
  
  // Usage tracking
  monthlyAssessments: integer("monthly_assessments").default(0),
  lastResetDate: timestamp("last_reset_date").defaultNow(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
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
  
  // Store extracted content directly in the database
  extractedText: text("extracted_text"),
  contentType: text("content_type"),
  processingStatus: text("processing_status"),
  
  // User association
  userId: varchar("user_id").references(() => users.id),
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
  userId: varchar("user_id").references(() => users.id),
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
