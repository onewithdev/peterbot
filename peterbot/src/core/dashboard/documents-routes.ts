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
  );
