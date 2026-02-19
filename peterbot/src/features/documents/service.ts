import { generateText } from "ai";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as schema from "../../db/schema.js";
import { getModel } from "../../ai/client.js";
import { executeAction } from "../integrations/service.js";
import {
  createDocument,
  updateDocumentContent,
  getDocumentById,
  getDocumentByName,
} from "./repository.js";
import type { DocumentReference } from "./schema.js";

const MAX_CONTENT_LENGTH = 200_000; // ~200k characters

/**
 * Strip HTML tags from text, preserving basic structure.
 */
function stripHtml(html: string): string {
  // Remove script and style tags with their content
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  
  // Replace common block elements with newlines
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/h[1-6]>/gi, "\n\n");
  text = text.replace(/<\/li>/gi, "\n");
  
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");
  
  // Decode common HTML entities
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#x27;/g, "'");
  text = text.replace(/&#x2F;/g, "/");
  text = text.replace(/&nbsp;/g, " ");
  
  // Normalize whitespace
  text = text.replace(/\n\s*\n\s*\n/g, "\n\n"); // Max 2 consecutive newlines
  text = text.replace(/[ \t]+/g, " "); // Collapse multiple spaces/tabs
  
  return text.trim();
}

/**
 * Truncate content to max length and add indicator.
 */
function truncateContent(content: string): { text: string; wasTruncated: boolean } {
  if (content.length <= MAX_CONTENT_LENGTH) {
    return { text: content, wasTruncated: false };
  }
  
  const truncated = content.slice(0, MAX_CONTENT_LENGTH);
  return { text: truncated, wasTruncated: true };
}

/**
 * Generate an AI summary of the document content.
 */
async function generateSummary(content: string): Promise<string> {
  try {
    // Use first 8000 chars for summary generation to stay within token limits
    const sampleContent = content.slice(0, 8000);
    
    const { text } = await generateText({
      model: getModel(),
      system: "You are a helpful assistant that creates brief summaries of documents. Summarize the content in 1-2 sentences.",
      prompt: `Please summarize this document:\n\n${sampleContent}`,
    });
    
    return text;
  } catch (error) {
    console.error("Failed to generate summary:", error);
    return "Summary not available";
  }
}

/**
 * Fetch content from a web URL.
 */
async function fetchWebContent(url: string): Promise<{ content: string; error: string | null }> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; peterbot/1.0)",
      },
    });
    
    if (!response.ok) {
      return {
        content: "",
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    
    const html = await response.text();
    const plainText = stripHtml(html);
    
    return { content: plainText, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: "", error: message };
  }
}

/**
 * Fetch content from Google Drive using Composio.
 */
async function fetchGoogleDriveContent(fileId: string): Promise<{ content: string; error: string | null }> {
  const result = await executeAction("google_drive", "GOOGLEDRIVE_GET_DOCUMENT", {
    file_id: fileId,
  });
  
  if ("error" in result) {
    return { content: "", error: result.message };
  }
  
  // Extract content from the result
  const data = result.data as { content?: string; text?: string; body?: string };
  const content = data?.content || data?.text || data?.body || "";
  
  return { content, error: null };
}

/**
 * Determine the document type and extract identifier from source.
 */
function parseSource(source: string): { type: "web" | "doc"; identifier: string } {
  // Check for Google Drive pattern
  const driveMatch = source.match(/^google_drive:(.+)$/);
  if (driveMatch) {
    return { type: "doc", identifier: driveMatch[1]! };
  }
  
  // Check for Google Drive URL patterns and convert to fileId
  const driveUrlMatch = source.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveUrlMatch) {
    return { type: "doc", identifier: driveUrlMatch[1]! };
  }
  
  // Default to web URL
  return { type: "web", identifier: source };
}

/**
 * Fetch and cache document content.
 * This function handles both web URLs and Google Drive documents.
 */
export async function fetchAndCache(
  db: BunSQLiteDatabase<typeof schema> | undefined,
  doc: DocumentReference
): Promise<{ success: boolean; error: string | null }> {
  const now = new Date();
  
  try {
    const { type, identifier } = parseSource(doc.source);
    
    let fetchResult: { content: string; error: string | null };
    
    if (type === "doc") {
      fetchResult = await fetchGoogleDriveContent(identifier);
    } else {
      fetchResult = await fetchWebContent(identifier);
    }
    
    if (fetchResult.error) {
      // Update with error but don't fail - document reference still exists
      await updateDocumentContent(db, doc.id, {
        content: doc.content, // Keep existing content if any
        contentTruncated: doc.contentTruncated,
        summary: doc.summary,
        cachedAt: doc.cachedAt,
        lastFetchAttemptAt: now,
        lastFetchError: fetchResult.error,
      });
      
      return { success: false, error: fetchResult.error };
    }
    
    // Truncate if needed
    const { text: truncatedContent, wasTruncated } = truncateContent(fetchResult.content);
    
    // Generate summary for new content
    let summary = doc.summary;
    if (!summary && truncatedContent.length > 100) {
      summary = await generateSummary(truncatedContent);
    }
    
    // Update document with fetched content
    await updateDocumentContent(db, doc.id, {
      content: truncatedContent,
      contentTruncated: wasTruncated,
      summary,
      cachedAt: now,
      lastFetchAttemptAt: now,
      lastFetchError: null,
    });
    
    return { success: true, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    
    // Update with error
    await updateDocumentContent(db, doc.id, {
      content: doc.content,
      contentTruncated: doc.contentTruncated,
      summary: doc.summary,
      cachedAt: doc.cachedAt,
      lastFetchAttemptAt: now,
      lastFetchError: message,
    });
    
    return { success: false, error: message };
  }
}

/**
 * Add a new document from a source (URL or Google Drive reference).
 * Fetches and caches the content immediately.
 */
export async function addDocument(
  db: BunSQLiteDatabase<typeof schema> | undefined,
  data: {
    name: string;
    source: string;
  }
): Promise<{ document: DocumentReference; fetchSuccess: boolean; fetchError: string | null }> {
  const { type, identifier } = parseSource(data.source);
  
  // Create document reference first
  const document = await createDocument(db, {
    name: data.name,
    source: type === "doc" ? `google_drive:${identifier}` : identifier,
    type,
    content: null,
    contentTruncated: false,
    cachedAt: null,
    lastFetchAttemptAt: null,
    lastFetchError: null,
    summary: null,
    tags: null,
  });
  
  // Try to fetch and cache content
  const fetchResult = await fetchAndCache(db, document);
  
  // Return updated document
  const updatedDoc = await getDocumentById(db, document.id);
  
  return {
    document: updatedDoc ?? document,
    fetchSuccess: fetchResult.success,
    fetchError: fetchResult.error,
  };
}

/**
 * Refresh a document's cached content.
 */
export async function refreshDocument(
  db: BunSQLiteDatabase<typeof schema> | undefined,
  id: string
): Promise<{ success: boolean; error: string | null }> {
  const document = await getDocumentById(db, id);
  
  if (!document) {
    return { success: false, error: "Document not found" };
  }
  
  return fetchAndCache(db, document);
}

/**
 * Find a document by name and refresh it.
 * Used by the bot's "refresh <doc name>" command.
 */
export async function refreshDocumentByName(
  db: BunSQLiteDatabase<typeof schema> | undefined,
  name: string
): Promise<{ document: DocumentReference | null; success: boolean; error: string | null }> {
  const document = await getDocumentByName(db, name);
  
  if (!document) {
    return { document: null, success: false, error: "Document not found" };
  }
  
  const result = await fetchAndCache(db, document);
  
  // Return updated document
  const updatedDoc = await getDocumentById(db, document.id);
  
  return {
    document: updatedDoc ?? document,
    success: result.success,
    error: result.error,
  };
}

// Re-export repository functions
export {
  getAllDocuments,
  getDocumentById,
  getDocumentByName,
  deleteDocument,
} from "./repository.js";
