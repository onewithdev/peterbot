import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "../../../ai/client.js";
import { extractKeywords } from "./similarity.js";

export async function autoTagSolution(
  jobInput: string,
  jobOutput: string
): Promise<{ title: string; tags: string[]; description: string }> {
  const result = await generateObject({
    model: getModel(),
    schema: z.object({
      title: z.string().describe("Short descriptive title for this solution"),
      tags: z
        .array(z.string())
        .max(5)
        .describe("Up to 5 lowercase keyword tags"),
      description: z
        .string()
        .describe("One-sentence description of what this solution does"),
    }),
    system:
      "You are a solution cataloguer. Analyze the provided job input and output to generate a concise title, relevant tags (maximum 5), and a one-sentence description. " +
      "The title should be descriptive and concise. " +
      "Tags should be lowercase keywords that categorize the solution. " +
      "The description should summarize what this solution accomplishes in one sentence.",
    prompt: `Job Input: ${jobInput}\n\nJob Output: ${jobOutput}`,
  });

  return result.object;
}

export function buildKeywords(input: string): string {
  const keywords = extractKeywords(input);
  return keywords.join(" ");
}
