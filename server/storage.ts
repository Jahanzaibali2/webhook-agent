import { type User, type InsertUser, type Call, type InsertCall } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Call state persistence
  getCall(callSid: string): Promise<Call | undefined>;
  saveCall(callData: InsertCall): Promise<Call>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private calls: Map<string, Call>;

  constructor() {
    this.users = new Map();
    this.calls = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getCall(callSid: string): Promise<Call | undefined> {
    return Array.from(this.calls.values()).find(call => call.callSid === callSid);
  }

  async saveCall(insertCall: InsertCall): Promise<Call> {
    const existing = await this.getCall(insertCall.callSid);
    const id = existing?.id || randomUUID();
    const call: Call = {
      ...insertCall,
      id,
      lastUpdate: new Date(),
      accountNumber: insertCall.accountNumber ?? (existing?.accountNumber || null)
    };
    this.calls.set(id, call);
    return call;
  }
}

export const storage = new MemStorage();
