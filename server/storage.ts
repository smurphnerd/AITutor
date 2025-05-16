import { users, type User, type InsertUser, type File, type InsertFile } from "@shared/schema";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // File management
  createFile(file: InsertFile): Promise<File>;
  getFileById(id: number): Promise<File | undefined>;
  getFilesByType(fileType: string): Promise<File[]>;
  deleteFile(id: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private files: Map<number, File>;
  private userCurrentId: number;
  private fileCurrentId: number;

  constructor() {
    this.users = new Map();
    this.files = new Map();
    this.userCurrentId = 1;
    this.fileCurrentId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // File management methods
  async createFile(insertFile: InsertFile): Promise<File> {
    const id = this.fileCurrentId++;
    const now = new Date();
    const file: File = { 
      ...insertFile, 
      id, 
      uploadedAt: now 
    };
    this.files.set(id, file);
    return file;
  }

  async getFileById(id: number): Promise<File | undefined> {
    return this.files.get(id);
  }

  async getFilesByType(fileType: string): Promise<File[]> {
    return Array.from(this.files.values()).filter(
      file => file.fileType === fileType
    );
  }

  async deleteFile(id: number): Promise<void> {
    this.files.delete(id);
  }
}

export const storage = new MemStorage();
