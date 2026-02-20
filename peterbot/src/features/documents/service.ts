import { generateText } from "ai";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
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

/**
 * Find or create the "peterbot" folder in Google Drive.
 * Uses available Google Drive actions through Composio.
 */
async function findOrCreatePeterbotFolder(): Promise<{ folderId: string; error: string | null }> {
  try {
    // First, try to search for existing "peterbot" folder
    try {
      const searchResult = await executeAction("google_drive", "GOOGLEDRIVE_SEARCH_FILE", {
        query: "name='peterbot' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      });
      
      if (!("error" in searchResult) && searchResult.data) {
        const files = (searchResult.data as { files?: Array<{ id: string; name: string }> })?.files;
        if (files && files.length > 0) {
          console.log("[findOrCreatePeterbotFolder] Found existing folder:", files[0]?.id);
          return { folderId: files[0]!.id, error: null };
        }
      }
    } catch (e) {
      console.log("[findOrCreatePeterbotFolder] Search failed, will try to create:", e);
    }

    // Try different action names that might be available for folder creation
    // Based on Composio docs, folder creation uses similar structure to file upload
    const possibleActions = [
      { 
        name: "GOOGLEDRIVE_CREATE_FOLDER", 
        params: {
          name: "peterbot",
          mime_type: "application/vnd.google-apps.folder",
          parent_folder: "root",
        }
      },
      { 
        name: "GOOGLEDRIVE_CREATE_FILE",  
        params: {
          name: "peterbot",
          mimeType: "application/vnd.google-apps.folder",
          folder_to_upload_to: "root",
        }
      },
    ];
    
    let lastError = null;
    for (const action of possibleActions) {
      try {
        console.log(`[findOrCreatePeterbotFolder] Trying action: ${action.name}`);
        const result = await executeAction("google_drive", action.name, action.params);

        if ("error" in result) {
          lastError = result.message;
          // If action not found, try next
          if (result.message.includes("not found") || result.message.includes("Unable to retrieve tool")) {
            console.log(`[findOrCreatePeterbotFolder] Action ${action.name} not found, trying next...`);
            continue;
          }
          return { folderId: "", error: result.message };
        }

        const responseData = result.data as { id?: string; fileId?: string; data?: { id?: string } };
        const folderId = responseData?.id || responseData?.fileId || responseData?.data?.id;
        
        if (!folderId) {
          return { folderId: "", error: "Failed to get folder ID after creation" };
        }

        console.log(`[findOrCreatePeterbotFolder] Created folder with ID: ${folderId}`);
        return { folderId, error: null };
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        console.error(`[findOrCreatePeterbotFolder] Exception with action ${action.name}:`, lastError);
        // Continue to try next action
      }
    }

    return { folderId: "", error: lastError || "No available Google Drive folder creation action found" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { folderId: "", error: message };
  }
}

export interface UploadResult {
  document: DocumentReference;
  driveFileId: string | null;
  driveError: string | null;
}

/**
 * Upload a file to Google Drive and create a document record.
 * Stores the file in the "peterbot" folder.
 */
export async function uploadDocument(
  db: BunSQLiteDatabase<typeof schema> | undefined,
  data: {
    name: string;
    file: File;
    content: string | null;
  }
): Promise<UploadResult> {
  // First, find or create the peterbot folder
  const { folderId, error: folderError } = await findOrCreatePeterbotFolder();
  
  if (folderError) {
    console.error("[uploadDocument] Failed to find/create peterbot folder:", folderError);
  }

  let driveFileId: string | null = null;
  let driveError: string | null = null;

  // Try to upload to Google Drive if we have a valid folder
  if (folderId) {
    try {
      // Read file content as base64 for upload
      const arrayBuffer = await data.file.arrayBuffer();
      const base64Content = Buffer.from(arrayBuffer).toString("base64");

      // Try different possible action names with correct parameter format
      // Based on Composio docs, the upload action expects:
      // - file_to_upload: object with name, mimeType, and data (base64)
      // - folder_to_upload_to: string (folder ID)
      const possibleUploadActions = [
        { name: "GOOGLEDRIVE_UPLOAD_FILE", params: {
          file_to_upload: {
            name: data.file.name,
            mimeType: data.file.type || "application/octet-stream",
            data: base64Content,
          },
          folder_to_upload_to: folderId,
        }},
        { name: "GOOGLEDRIVE_CREATE_FILE", params: {
          file_to_upload: {
            name: data.file.name,
            mimeType: data.file.type || "application/octet-stream",
            data: base64Content,
          },
          folder_to_upload_to: folderId,
        }},
      ];
      
      for (const action of possibleUploadActions) {
        try {
          console.log(`[uploadDocument] Trying action: ${action.name}`);
          const uploadResult = await executeAction("google_drive", action.name, action.params);

          if ("error" in uploadResult) {
            // If action not found, try next
            if (uploadResult.message.includes("not found") || uploadResult.message.includes("Unable to retrieve tool")) {
              console.log(`[uploadDocument] Action ${action.name} not found, trying next...`);
              continue;
            }
            driveError = uploadResult.message;
            console.error("[uploadDocument] Failed to upload to Google Drive:", uploadResult.message);
          } else {
            // Extract file ID from response - the response structure varies
            const responseData = uploadResult.data as { id?: string; fileId?: string; data?: { id?: string } };
            driveFileId = responseData?.id || responseData?.fileId || responseData?.data?.id || null;
            driveError = null;
            console.log(`[uploadDocument] Success with action ${action.name}, fileId: ${driveFileId}`);
            break; // Success!
          }
        } catch (e) {
          driveError = e instanceof Error ? e.message : String(e);
          console.error(`[uploadDocument] Exception with action ${action.name}:`, driveError);
          // Continue to try next action
        }
      }
    } catch (error) {
      driveError = error instanceof Error ? error.message : String(error);
      console.error("[uploadDocument] Exception during Google Drive upload:", driveError);
    }
  } else {
    driveError = folderError || "Could not find or create peterbot folder";
  }

  // If Google Drive upload failed, save file locally as fallback
  let localPath: string | null = null;
  if (!driveFileId) {
    try {
      // Ensure uploads directory exists
      const uploadDir = join(process.cwd(), "storage", "uploads");
      await mkdir(uploadDir, { recursive: true });

      // Save file locally with timestamp prefix to avoid collisions
      const timestamp = Date.now();
      const safeFilename = data.file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filename = `${timestamp}-${safeFilename}`;
      const filepath = join(uploadDir, filename);
      
      const arrayBuffer = await data.file.arrayBuffer();
      await writeFile(filepath, Buffer.from(arrayBuffer));
      
      localPath = filepath;
      console.log("[uploadDocument] Saved file locally:", filepath);
    } catch (localError) {
      console.error("[uploadDocument] Failed to save file locally:", localError);
    }
  }

  // Create document record
  const source = driveFileId 
    ? `google_drive:${driveFileId}` 
    : localPath 
    ? `local:${localPath}` 
    : `upload:${data.file.name}`;

  const document = await createDocument(db, {
    name: data.name,
    source,
    type: "upload",
    content: data.content,
    contentTruncated: false,
    cachedAt: data.content ? new Date() : null,
    lastFetchAttemptAt: null,
    lastFetchError: driveError,
    summary: null,
    tags: null,
  });

  return {
    document,
    driveFileId,
    driveError,
  };
}

// Re-export repository functions
export {
  getAllDocuments,
  getDocumentById,
  getDocumentByName,
  deleteDocument,
} from "./repository.js";
