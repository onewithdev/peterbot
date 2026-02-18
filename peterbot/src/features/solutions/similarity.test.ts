import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../../db/schema";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import {
  extractKeywords,
  calculateSimilarity,
  findSimilarSolutions,
} from "./similarity";

// Test database instance
let testDb: BunSQLiteDatabase<typeof schema>;

// Helper to create an in-memory test database
function createTestDb(): BunSQLiteDatabase<typeof schema> {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });

  // Create solutions table
  sqlite.exec(`
    CREATE TABLE solutions (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      tags TEXT,
      keywords TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  return db;
}

// Helper to insert a solution directly via raw SQL
async function insertSolution(
  db: BunSQLiteDatabase<typeof schema>,
  jobId: string,
  title: string,
  keywords: string
): Promise<void> {
  const sqlite = (db as any).$client as Database;
  const id = crypto.randomUUID();
  const now = Date.now();

  sqlite.exec(`
    INSERT INTO solutions (id, job_id, title, keywords, created_at)
    VALUES ('${id}', '${jobId}', '${title.replace(/'/g, "''")}', '${keywords.replace(/'/g, "''")}', ${now})
  `);
}

beforeEach(() => {
  testDb = createTestDb();
});

describe("extractKeywords", () => {
  test("returns lowercase tokens", () => {
    const result = extractKeywords("Hello World Python");
    expect(result).toEqual(["hello", "world", "python"]);
  });

  test("filters stopwords", () => {
    const result = extractKeywords("the python and javascript");
    expect(result).toEqual(["python", "javascript"]);
  });

  test("filters short words", () => {
    const result = extractKeywords("py python go golang");
    expect(result).toEqual(["python", "golang"]);
  });

  test("handles empty string", () => {
    const result = extractKeywords("");
    expect(result).toEqual([]);
  });

  test("handles multiple spaces", () => {
    const result = extractKeywords("python   scraping   csv");
    expect(result).toEqual(["python", "scraping", "csv"]);
  });

  test("filters both stopwords and short words", () => {
    const result = extractKeywords("the py and go for web");
    expect(result).toEqual(["web"]);
  });
});

describe("calculateSimilarity", () => {
  test('returns 0.5 for ["scrape","python","csv"] and ["scrape","python","pricing"]', () => {
    const result = calculateSimilarity(
      ["scrape", "python", "csv"],
      ["scrape", "python", "pricing"]
    );
    expect(result).toBe(0.5);
  });

  test("returns 1 for identical arrays", () => {
    const result = calculateSimilarity(
      ["python", "scraping"],
      ["python", "scraping"]
    );
    expect(result).toBe(1);
  });

  test("returns 0 for disjoint arrays", () => {
    const result = calculateSimilarity(
      ["python", "scraping"],
      ["javascript", "react"]
    );
    expect(result).toBe(0);
  });

  test("returns 0 for one empty array", () => {
    const result = calculateSimilarity(["python", "scraping"], []);
    expect(result).toBe(0);
  });

  test("returns 0 for both empty arrays", () => {
    const result = calculateSimilarity([], []);
    expect(result).toBe(0);
  });

  test("handles duplicate keywords correctly", () => {
    const result = calculateSimilarity(
      ["python", "python", "scraping"],
      ["python", "scraping", "scraping"]
    );
    // Set-based, so duplicates are ignored: intersection=2, union=2
    expect(result).toBe(1);
  });
});

describe("findSimilarSolutions", () => {
  test("returns only solutions with score > 0.3", async () => {
    await insertSolution(testDb, "job-1", "Python Scraper", "python scrape csv");
    await insertSolution(testDb, "job-2", "JavaScript App", "javascript react web");
    await insertSolution(testDb, "job-3", "Python Pricing", "python scrape pricing");

    const results = await findSimilarSolutions(testDb, "python scrape data");

    // "python scrape csv" and "python scrape pricing" should match well
    // "javascript react web" should not match (score = 0)
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.every((r) => r.score > 0.3)).toBe(true);
    expect(results.some((r) => r.title === "JavaScript App")).toBe(false);
  });

  test("returns results sorted descending by score", async () => {
    await insertSolution(testDb, "job-1", "Exact Match", "python scrape csv");
    await insertSolution(testDb, "job-2", "Partial Match", "python scrape json");
    await insertSolution(testDb, "job-3", "Low Match", "python api rest");

    const results = await findSimilarSolutions(testDb, "python scrape csv");

    // Exact match should have highest score
    expect(results[0].title).toBe("Exact Match");
    expect(results[0].score).toBe(1);

    // Verify descending order
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
  });

  test("returns at most 3 results", async () => {
    // Insert 5 solutions
    await insertSolution(testDb, "job-1", "Solution 1", "python scrape");
    await insertSolution(testDb, "job-2", "Solution 2", "python scrape");
    await insertSolution(testDb, "job-3", "Solution 3", "python scrape");
    await insertSolution(testDb, "job-4", "Solution 4", "python scrape");
    await insertSolution(testDb, "job-5", "Solution 5", "python scrape");

    const results = await findSimilarSolutions(testDb, "python scrape");

    expect(results.length).toBeLessThanOrEqual(3);
  });

  test("returns empty array for empty DB", async () => {
    const results = await findSimilarSolutions(testDb, "python scrape");
    expect(results).toEqual([]);
  });

  test("filters out solutions with null/empty keywords", async () => {
    await insertSolution(testDb, "job-1", "With Keywords", "python scrape");
    
    // Insert solution with empty keywords via raw SQL
    const sqlite = (testDb as any).$client as Database;
    const id = crypto.randomUUID();
    const now = Date.now();
    sqlite.exec(`
      INSERT INTO solutions (id, job_id, title, keywords, created_at)
      VALUES ('${id}', 'job-2', 'No Keywords', NULL, ${now})
    `);

    const results = await findSimilarSolutions(testDb, "python scrape");

    expect(results.length).toBe(1);
    expect(results[0].title).toBe("With Keywords");
  });

  test("solutions with no matching keywords score 0 and are filtered", async () => {
    await insertSolution(testDb, "job-1", "Python Scraper", "python scrape csv");
    await insertSolution(testDb, "job-2", "Unrelated", "java spring boot");

    const results = await findSimilarSolutions(testDb, "python scrape");

    expect(results.length).toBe(1);
    expect(results[0].title).toBe("Python Scraper");
  });
});
