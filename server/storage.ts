import { 
  users, 
  files, 
  gradingJobs,
  gradingResults,
  type User, 
  type UpsertUser, 
  type File, 
  type InsertFile,
  type GradingJob,
  type InsertGradingJob,
  type GradingResult
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, desc } from "drizzle-orm";

export interface IStorage {
  // User operations (IMPORTANT: mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Usage tracking for 3 free assessments per month
  checkUsageLimit(userId: string): Promise<{ canUse: boolean; assessmentsUsed: number; assessmentsLimit: number }>;
  incrementUsage(userId: string): Promise<void>;
  
  // File management
  createFile(file: InsertFile): Promise<File>;
  getFileById(id: number): Promise<File | undefined>;
  getFilesByType(fileType: string, userId?: string): Promise<File[]>;
  getUserFiles(userId: string): Promise<File[]>;
  deleteFile(id: number): Promise<void>;
  
  // Content management
  updateFileContent(id: number, content: { 
    extractedText?: string; 
    contentType?: string; 
    processingStatus?: string 
  }): Promise<File>;
  getFileContent(id: number): Promise<{ 
    extractedText?: string; 
    contentType?: string; 
    processingStatus?: string 
  } | undefined>;
  
  // Grading management
  createGradingJob(job: InsertGradingJob): Promise<GradingJob>;
  getGradingJob(id: number): Promise<GradingJob | undefined>;
  updateGradingJob(id: number, updates: Partial<GradingJob>): Promise<void>;
  getUserGradingHistory(userId: string): Promise<GradingResult[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations (IMPORTANT: mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Usage tracking for 3 free assessments per month
  async checkUsageLimit(userId: string): Promise<{ canUse: boolean; assessmentsUsed: number; assessmentsLimit: number }> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if it's a new month and reset counter
    const now = new Date();
    const lastReset = user.lastResetDate ? new Date(user.lastResetDate) : new Date(0);
    const currentMonth = now.getMonth();
    const lastResetMonth = lastReset.getMonth();
    const currentYear = now.getFullYear();
    const lastResetYear = lastReset.getFullYear();

    let assessmentsUsed = user.monthlyAssessments || 0;

    // Reset if it's a new month
    if (currentYear > lastResetYear || (currentYear === lastResetYear && currentMonth > lastResetMonth)) {
      await db
        .update(users)
        .set({
          monthlyAssessments: 0,
          lastResetDate: now,
        })
        .where(eq(users.id, userId));
      assessmentsUsed = 0;
    }

    const assessmentsLimit = user.subscriptionStatus === "active" ? 999 : 3; // Unlimited for paid users
    const canUse = assessmentsUsed < assessmentsLimit;

    return { canUse, assessmentsUsed, assessmentsLimit };
  }

  async incrementUsage(userId: string): Promise<void> {
    const user = await this.getUser(userId);
    if (user) {
      await db
        .update(users)
        .set({
          monthlyAssessments: (user.monthlyAssessments || 0) + 1,
        })
        .where(eq(users.id, userId));
    }
  }
  
  // File management methods
  async createFile(insertFile: InsertFile): Promise<File> {
    // Set the initial processing status to "pending"
    const fileWithStatus = {
      ...insertFile,
      processingStatus: "pending"
    };
    
    const [file] = await db
      .insert(files)
      .values(fileWithStatus)
      .returning();
    return file;
  }

  async getFileById(id: number): Promise<File | undefined> {
    const [file] = await db.select().from(files).where(eq(files.id, id));
    return file || undefined;
  }

  async getFilesByType(fileType: string): Promise<File[]> {
    return await db.select().from(files).where(eq(files.fileType, fileType));
  }

  async deleteFile(id: number): Promise<void> {
    await db.delete(files).where(eq(files.id, id));
  }
  
  // Content management methods
  async updateFileContent(
    id: number, 
    content: { 
      extractedText?: string; 
      contentType?: string; 
      processingStatus?: string 
    }
  ): Promise<File> {
    const [updatedFile] = await db
      .update(files)
      .set(content)
      .where(eq(files.id, id))
      .returning();
      
    return updatedFile;
  }
  
  async getFileContent(id: number): Promise<{ 
    extractedText?: string; 
    contentType?: string; 
    processingStatus?: string 
  } | undefined> {
    const [file] = await db
      .select({
        extractedText: files.extractedText,
        contentType: files.contentType,
        processingStatus: files.processingStatus
      })
      .from(files)
      .where(eq(files.id, id));
      
    if (!file) return undefined;
    
    // Convert nulls to undefined for TypeScript compatibility
    return {
      extractedText: file.extractedText ?? undefined,
      contentType: file.contentType ?? undefined,
      processingStatus: file.processingStatus ?? undefined
    };
  }
}

export const storage = new DatabaseStorage();
