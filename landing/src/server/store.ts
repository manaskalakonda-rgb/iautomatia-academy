// Enquiry storage: one JSON object per line in data/enquiries.jsonl.
// Simple and dependency-free; swap for a database or CRM when volumes grow.
import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Enquiry } from "../shared/enquiry.js";

export interface StoredEnquiry extends Enquiry {
  id: string;
  createdAt: string;
}

export class EnquiryStore {
  private readonly file: string;

  constructor(dataDir: string) {
    this.file = path.join(dataDir, "enquiries.jsonl");
  }

  async add(enquiry: Enquiry): Promise<StoredEnquiry> {
    const record: StoredEnquiry = { id: randomUUID(), createdAt: new Date().toISOString(), ...enquiry };
    await mkdir(path.dirname(this.file), { recursive: true });
    await appendFile(this.file, JSON.stringify(record) + "\n", "utf8");
    return record;
  }

  async list(): Promise<StoredEnquiry[]> {
    let text: string;
    try {
      text = await readFile(this.file, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
    return text
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as StoredEnquiry)
      .reverse(); // newest first
  }
}
