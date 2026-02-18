import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as schema from "../../db/schema.js";
import { getAllSolutions } from "./repository.js";
import type { Solution } from "./schema.js";

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "from",
  "into",
  "have",
  "will",
  "are",
  "was",
  "not",
  "but",
  "can",
  "its",
  "use",
  "used",
  "using",
]);

export function extractKeywords(text: string): string[] {
  const lowercased = text.toLowerCase();
  const tokens = lowercased.split(/\s+/);
  return tokens.filter(
    (token) => token.length >= 3 && !STOPWORDS.has(token)
  );
}

export function calculateSimilarity(
  keywordsA: string[],
  keywordsB: string[]
): number {
  const setA = new Set(keywordsA);
  const setB = new Set(keywordsB);

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  if (union.size === 0) {
    return 0;
  }

  return intersection.size / union.size;
}

export async function findSimilarSolutions(
  db: BunSQLiteDatabase<typeof schema>,
  input: string
): Promise<Array<Solution & { score: number }>> {
  const inputKeywords = extractKeywords(input);
  const allSolutions = await getAllSolutions(db);

  const scored = allSolutions
    .map((solution) => {
      const solutionKeywords = solution.keywords
        ? solution.keywords.split(/\s+/).filter((k) => k.length > 0)
        : [];
      const score = calculateSimilarity(inputKeywords, solutionKeywords);
      return { ...solution, score };
    })
    .filter((item) => item.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return scored;
}
