import { type User, type InsertUser, type Call, type InsertCall } from "@shared/schema";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Call state persistence
  getCall(callSid: string): Promise<Call | undefined>;
  saveCall(callData: InsertCall & { transcript?: string }): Promise<Call>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private calls: Map<string, Call>;
  private responsesDir = path.resolve(process.cwd(), "responses");

  constructor() {
    this.users = new Map();
    this.calls = new Map();

    // Ensure responses directory exists
    if (!fs.existsSync(this.responsesDir)) {
      fs.mkdirSync(this.responsesDir, { recursive: true });
    }
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
    // Try in-memory first
    const call = Array.from(this.calls.values()).find(call => call.callSid === callSid);
    if (call) return call;

    // Then try file-based if not in memory (restores state on restart)
    try {
      const filePath = path.join(this.responsesDir, `${callSid}.json`);
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, "utf-8");
        const loadedCall = JSON.parse(data);
        // Cast lastUpdate back to Date object if needed
        if (loadedCall.lastUpdate) loadedCall.lastUpdate = new Date(loadedCall.lastUpdate);
        this.calls.set(loadedCall.id, loadedCall);
        return loadedCall;
      }
    } catch (err) {
      console.error(`Error reading call file ${callSid}:`, err);
    }
    return undefined;
  }

  async saveCall(insertCall: InsertCall & { transcript?: string }): Promise<Call> {
    const existing = await this.getCall(insertCall.callSid);
    const id = existing?.id || randomUUID();

    // Merge transcripts if provided
    let updatedTranscript = existing?.transcript || "";
    if (insertCall.transcript) {
      updatedTranscript = insertCall.transcript; // Full transcript replacement or we could append
    }

    const call: Call = {
      ...insertCall,
      id,
      lastUpdate: new Date(),
      accountNumber: insertCall.accountNumber ?? (existing?.accountNumber || null),
      transcript: updatedTranscript || null
    } as Call;

    this.calls.set(id, call);

    // Save to individual JSON file
    try {
      if (!fs.existsSync(this.responsesDir)) {
        console.log(`[Storage] Creating responses directory: ${this.responsesDir}`);
        fs.mkdirSync(this.responsesDir, { recursive: true });
      }
      const filePath = path.join(this.responsesDir, `${call.callSid}.json`);
      fs.writeFileSync(filePath, JSON.stringify(call, null, 2));
      console.log(`[Storage] ✅ Successfully saved call data to ${filePath}`);
    } catch (err) {
      console.error(`[Storage] ❌ Error saving call to file:`, err);
    }

    return call;
  }
}

export const storage = new MemStorage();
