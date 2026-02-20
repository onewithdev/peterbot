import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { passwordAuth } from "./auth.js";
import {
  getAllDocuments,
  getDocumentById,
  deleteDocument,
  addDocument,
  refreshDocument,
  uploadDocument,
} from "../../features/documents/service.js";

/**
 * Document ID parameter schema for routes with :id.
 */
const DocumentIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Documents routes for dashboard API.
 *
 * Provides endpoints for managing document references and their cached content.
 */
export const documentsRoutes = new Hono()
  // ==========================================================================
  // GET / - List all documents
  // ==========================================================================
  .get("/", passwordAuth, async (c) => {
    const documents = await getAllDocuments(undefined);
    return c.json({
      documents,
      total: documents.length,
    });
  })

  // ==========================================================================
  // POST / - Add a new document
  // ==========================================================================
  .post(
    "/",
    passwordAuth,
    zValidator(
      "json",
      z.object({
        name: z.string().min(1),
        source: z.string().min(1), // URL or google_drive:fileId
      })
    ),
    async (c) => {
      const { name, source } = c.req.valid("json");

      try {
        const result = await addDocument(undefined, { name, source });

        return c.json({
          document: result.document,
          fetchSuccess: result.fetchSuccess,
          fetchError: result.fetchError,
        }, result.fetchSuccess ? 201 : 201);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return c.json(
          {
            error: "Internal Server Error",
            message: `Failed to add document: ${message}`,
          },
          500
        );
      }
    }
  )

  // ==========================================================================
  // DELETE /:id - Delete a document
  // ==========================================================================
  .delete(
    "/:id",
    passwordAuth,
    zValidator("param", DocumentIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");

      // Check if document exists
      const document = await getDocumentById(undefined, id);
      if (!document) {
        return c.json(
          {
            error: "Not Found",
            message: `Document ${id} not found`,
          },
          404
        );
      }

      await deleteDocument(undefined, id);
      return c.json({ success: true });
    }
  )

  // ==========================================================================
  // POST /:id/refresh - Refresh document content
  // ==========================================================================
  .post(
    "/:id/refresh",
    passwordAuth,
    zValidator("param", DocumentIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");

      // Check if document exists
      const document = await getDocumentById(undefined, id);
      if (!document) {
        return c.json(
          {
            error: "Not Found",
            message: `Document ${id} not found`,
          },
          404
        );
      }

      try {
        const result = await refreshDocument(undefined, id);
        
        // Get updated document
        const updatedDoc = await getDocumentById(undefined, id);

        return c.json({
          success: result.success,
          error: result.error,
          document: updatedDoc,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return c.json(
          {
            error: "Internal Server Error",
            message: `Failed to refresh document: ${message}`,
          },
          500
        );
      }
    }
  )

  // ==========================================================================
  // POST /upload - Upload a local file to Google Drive
  // ==========================================================================
  .post("/upload", passwordAuth, async (c) => {
    const body = await c.req.parseBody();
    const file = body.file as File;
    const name = (body.name as string) || file?.name;

    console.log("[upload] Received file:", file?.name, "type:", file?.type, "size:", file?.size);

    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }

    if (!name) {
      return c.json({ error: "No name provided" }, 400);
    }

    // Validate file size (10MB limit)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return c.json({ error: "File too large (max 10MB)" }, 413);
    }

    // Validate file type (allow empty/unknown for text files based on extension)
    const allowedTypes = [
      "text/plain",
      "text/markdown",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    
    // Also check file extension as fallback when type is empty or generic
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const isAllowedByExtension = ["txt", "md", "pdf", "doc", "docx"].includes(fileExtension || "");
    
    if (!allowedTypes.includes(file.type) && !isAllowedByExtension) {
      console.log("[upload] Invalid file type:", file.type, "extension:", fileExtension);
      return c.json({ error: "Invalid file type" }, 400);
    }

    try {
      // Read file content as text (for now, only text files will have extractable content)
      let content: string | null = null;
      if (file.type === "text/plain" || file.type === "text/markdown") {
        content = await file.text();
      }

      // Upload to Google Drive and create document record
      const result = await uploadDocument(undefined, {
        name,
        file,
        content,
      });

      return c.json({
        document: result.document,
        driveFileId: result.driveFileId,
        driveError: result.driveError,
      }, result.driveFileId ? 201 : 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[upload] Error:", message);
      return c.json({ error: "Upload failed", message }, 500);
    }
  });
