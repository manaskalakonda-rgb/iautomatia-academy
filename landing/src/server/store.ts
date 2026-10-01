// Enquiry storage.
// - Locally: one JSON object per line in data/enquiries.jsonl (no setup needed).
// - On Vercel (or any host with DATABASE_URL / POSTGRES_URL): a Postgres table, e.g. Neon.
import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import type { Enquiry } from "../shared/enquiry.js";

export interface StoredEnquiry extends Enquiry {
  id: string;
  createdAt: string;
}

export interface EnquiryStore {
  add(enquiry: Enquiry): Promise<StoredEnquiry>;
  list(): Promise<StoredEnquiry[]>;
}

function newRecord(enquiry: Enquiry): StoredEnquiry {
  return { id: randomUUID(), createdAt: new Date().toISOString(), ...enquiry };
}

export class FileEnquiryStore implements EnquiryStore {
  private readonly file: string;

  constructor(dataDir: string) {
    this.file = path.join(dataDir, "enquiries.jsonl");
  }

  describe(): string {
    return this.file;
  }

  async add(enquiry: Enquiry): Promise<StoredEnquiry> {
    const record = newRecord(enquiry);
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

interface EnquiryRow {
  id: string;
  created_at: string | Date;
  name: string;
  phone: string;
  email: string;
  program: Enquiry["program"];
  status: Enquiry["status"];
}

export class PostgresEnquiryStore implements EnquiryStore {
  private readonly sql: ReturnType<typeof neon>;
  private ready: Promise<unknown> | null = null;

  constructor(connectionString: string) {
    this.sql = neon(connectionString);
  }

  /** Creates the table on first use, once per server instance. */
  private ensureTable(): Promise<unknown> {
    this.ready ??= this.sql`
      CREATE TABLE IF NOT EXISTS enquiries (
        id         uuid PRIMARY KEY,
        created_at timestamptz NOT NULL DEFAULT now(),
        name       text NOT NULL,
        phone      text NOT NULL,
        email      text NOT NULL,
        program    text NOT NULL,
        status     text NOT NULL
      )`.catch((err: unknown) => {
      this.ready = null; // retry on the next request
      throw err;
    });
    return this.ready;
  }

  async add(enquiry: Enquiry): Promise<StoredEnquiry> {
    await this.ensureTable();
    const record = newRecord(enquiry);
    await this.sql`
      INSERT INTO enquiries (id, created_at, name, phone, email, program, status)
      VALUES (${record.id}, ${record.createdAt}, ${record.name}, ${record.phone}, ${record.email}, ${record.program}, ${record.status})`;
    return record;
  }

  async list(): Promise<StoredEnquiry[]> {
    await this.ensureTable();
    const rows = (await this.sql`
      SELECT id, created_at, name, phone, email, program, status
      FROM enquiries ORDER BY created_at DESC LIMIT 1000`) as EnquiryRow[];
    return rows.map((r) => ({
      id: r.id,
      createdAt: new Date(r.created_at).toISOString(),
      name: r.name,
      phone: r.phone,
      email: r.email,
      program: r.program,
      status: r.status,
    }));
  }
}

/** Used on Vercel when no database is connected: fails loudly instead of losing enquiries. */
class MissingDatabaseStore implements EnquiryStore {
  private fail(): never {
    throw new Error("No database configured: set DATABASE_URL (e.g. connect Neon Postgres in Vercel → Storage).");
  }
  async add(): Promise<StoredEnquiry> {
    return this.fail();
  }
  async list(): Promise<StoredEnquiry[]> {
    return this.fail();
  }
}

/** Picks the store from the environment. */
export function createStore(env: NodeJS.ProcessEnv, defaultDataDir: string): { store: EnquiryStore; description: string } {
  const url = env.DATABASE_URL || env.POSTGRES_URL;
  if (url) return { store: new PostgresEnquiryStore(url), description: "Postgres (DATABASE_URL)" };
  if (env.VERCEL) {
    console.error("[store] DATABASE_URL is not set – enquiries cannot be saved on Vercel.");
    return { store: new MissingDatabaseStore(), description: "none (DATABASE_URL missing)" };
  }
  const fileStore = new FileEnquiryStore(env.DATA_DIR ?? defaultDataDir);
  return { store: fileStore, description: fileStore.describe() };
}
