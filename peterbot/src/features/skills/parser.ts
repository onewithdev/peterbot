/**
 * Skills Parser Module
 *
 * Parses `.skill.md` files with frontmatter format:
 * ```
 * ---
 * name: skillName
 * triggerPattern: brainstorm|ideate
 * systemPrompt: |
 *   You are a brainstorming assistant...
 * tools: ["web_search", "code_execution"]
 * category: creativity
 * ---
 *
 * # Skill Title
 *
 * Markdown content here...
 * ```
 */

export interface ParsedSkill {
  name: string;
  description: string | null;
  triggerPattern: string;
  tools: string | null; // JSON array string
  category: string;
  systemPrompt: string;
  content: string; // full markdown body
  filePath: string;
}

/**
 * Parse a skill file and extract frontmatter and content.
 *
 * @param filePath - Path to the .skill.md file
 * @returns ParsedSkill on success, or { error: string } on failure
 */
export async function parseSkillFile(
  filePath: string
): Promise<ParsedSkill | { error: string }> {
  try {
    const file = Bun.file(filePath);
    const rawContent = await file.text();

    // Split on --- to separate frontmatter from body
    const parts = rawContent.split(/^---\s*$/m);

    let frontmatter: string;
    let body: string;

    if (parts.length >= 3 && parts[0].trim() === "") {
      // Standard format: ---\nfrontmatter\n---\nbody
      frontmatter = parts[1].trim();
      body = parts.slice(2).join("---").trim();
    } else if (parts.length >= 2 && parts[0].trim() !== "") {
      // No leading ---, first part is frontmatter
      frontmatter = parts[0].trim();
      body = parts.slice(1).join("---").trim();
    } else {
      return { error: "Invalid format: missing frontmatter delimiter ---" };
    }

    // Parse frontmatter key-value pairs
    const metadata = parseFrontmatter(frontmatter);

    // Validate required fields
    if (!metadata.name) {
      return { error: "Missing required field: name" };
    }

    if (!metadata.triggerPattern) {
      return { error: "Missing required field: triggerPattern" };
    }

    // Get system prompt from frontmatter or body
    let systemPrompt = metadata.systemPrompt;

    // If no systemPrompt in frontmatter, look for ## System Prompt section in body
    if (!systemPrompt) {
      const systemPromptMatch = body.match(/##\s*System\s*Prompt\s*\n+([\s\S]*?)(?=\n##\s|\n*$)/i);
      if (systemPromptMatch) {
        systemPrompt = systemPromptMatch[1].trim();
        // Remove the system prompt section from body
        body = body.replace(systemPromptMatch[0], "").trim();
      }
    }

    if (!systemPrompt) {
      return { error: "Missing systemPrompt: must be in frontmatter or ## System Prompt section" };
    }

    // Parse tools if present
    let tools: string | null = null;
    if (metadata.tools) {
      try {
        // If it's already a JSON string, validate it
        const parsed = JSON.parse(metadata.tools);
        if (Array.isArray(parsed)) {
          tools = JSON.stringify(parsed);
        } else {
          return { error: "Invalid tools: must be a JSON array" };
        }
      } catch {
        // Try to parse as comma-separated list
        const toolList = metadata.tools
          .split(",")
          .map((t: string) => t.trim())
          .filter((t: string) => t.length > 0);
        tools = JSON.stringify(toolList);
      }
    }

    return {
      name: metadata.name.trim(),
      description: metadata.description?.trim() ?? null,
      triggerPattern: metadata.triggerPattern.trim(),
      tools,
      category: metadata.category?.trim() || "general",
      systemPrompt: systemPrompt.trim(),
      content: body,
      filePath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: `Failed to parse skill file: ${message}` };
  }
}

/**
 * Parse frontmatter string into key-value pairs.
 * Supports simple key: value format and multiline values with |
 */
function parseFrontmatter(frontmatter: string): Record<string, string> {
  const metadata: Record<string, string> = {};
  const lines = frontmatter.split("\n");

  let currentKey: string | null = null;
  let currentValue: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trimEnd();

    // Check for new key: value pair
    const match = trimmedLine.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);

    if (match) {
      // Save previous key-value if exists
      if (currentKey) {
        metadata[currentKey] = currentValue.join("\n").trim();
      }

      currentKey = match[1];
      const value = match[2].trim();

      // Check for multiline indicator (|)
      if (value === "|") {
        currentValue = [];
      } else {
        currentValue = [value];
      }
    } else if (currentKey && trimmedLine.startsWith("  ") || (currentKey && trimmedLine === "")) {
      // Continuation of multiline value (indented or empty line)
      currentValue.push(trimmedLine);
    } else if (currentKey) {
      // End of multiline value
      metadata[currentKey] = currentValue.join("\n").trim();
      currentKey = null;
      currentValue = [];
    }
  }

  // Save last key-value
  if (currentKey) {
    metadata[currentKey] = currentValue.join("\n").trim();
  }

  return metadata;
}
