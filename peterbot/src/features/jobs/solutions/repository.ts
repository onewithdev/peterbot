import { eq, desc } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { db as defaultDb } from "../../../db/index.js";
import * as schema from "../../../db/schema.js";
import { solutions } from "./schema.js";
import type { Solution, NewSolution } from "./schema.js";

export async function createSolution(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  input: NewSolution
): Promise<Solution> {
  const result = await db.insert(solutions).values(input).returning();
  return result[0];
}

export async function getAllSolutions(
  db: BunSQLiteDatabase<typeof schema> = defaultDb
): Promise<Solution[]> {
  return db.select().from(solutions).orderBy(desc(solutions.createdAt));
}

export async function getSolutionById(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  id: string
): Promise<Solution | undefined> {
  const result = await db
    .select()
    .from(solutions)
    .where(eq(solutions.id, id))
    .limit(1);
  return result[0];
}

export async function deleteSolution(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  id: string
): Promise<void> {
  await db.delete(solutions).where(eq(solutions.id, id));
}
