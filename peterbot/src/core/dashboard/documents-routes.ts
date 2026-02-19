import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { passwordAuth } from "./auth.js";
import {
  getAllDocuments,
  getDocumentById,
  deleteDocument,
  addDocument,
  refreshDocument,
} from "../../features/documents/service.js";
import { createDocument } from "../../features/documents/repository.js";

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
  // POST /upload - Upload a local file
  // ==========================================================================
  .post("/upload", passwordAuth, async (c) => {
    const body = await c.req.parseBody();
    const file = body.file as File;
    const name = (body.name as string) || file?.name;

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

    // Validate file type
    const allowedTypes = [
      "text/plain",
      "text/markdown",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: "Invalid file type" }, 400);
    }

    try {
      // Ensure uploads directory exists
      const uploadDir = join(process.cwd(), "storage", "uploads");
      await mkdir(uploadDir, { recursive: true });

      // Save file locally
      const filename = `${Date.now()}-${file.name}`;
      const filepath = join(uploadDir, filename);
      const arrayBuffer = await file.arrayBuffer();
      await writeFile(filepath, Buffer.from(arrayBuffer));

      // Read file content as text (for now, only text files will have extractable content)
      let content: string | null = null;
      if (file.type === "text/plain" || file.type === "text/markdown") {
        content = await file.text();
      }

      // Create document record
      const document = await createDocument(undefined, {
        name,
        source: `local:${filepath}`,
        type: "upload",
        content,
        contentTruncated: false,
        cachedAt: content ? new Date() : null,
        lastFetchAttemptAt: null,
        lastFetchError: null,
        summary: null,
        tags: null,
      });

      return c.json({ document }, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: "Upload failed", message }, 500);
    }
  });
