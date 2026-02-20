import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { generateText } from "ai";
import { passwordAuth } from "./auth.js";
import { detectIntent } from "../telegram/intent.js";
import { formatAckReply } from "../telegram/handlers.js";
import { getBot } from "../telegram/bot.js";
import { getModel } from "../../ai/client.js";
import { createJob } from "../../features/jobs/repository.js";
import {
  saveMessage,
  getMessages,
  getMessagesSince,
  getMessagesBefore,
} from "../../features/chat/repository.js";
import { config } from "../../shared/config.js";

/**
 * Chat routes for dashboard API.
 *
 * Provides endpoints for fetching and sending chat messages.
 * Messages are persisted to the database and synced with Telegram.
 */
export const chatRoutes = new Hono()
  // ==========================================================================
  // GET /messages - Fetch chat messages
  // ==========================================================================
  .get(
    "/messages",
    passwordAuth,
    zValidator(
      "query",
      z.object({
        since: z.string().optional(),
        before: z.string().optional(),
        limit: z.string().optional(),
      })
    ),
    async (c) => {
      const { since, before, limit } = c.req.valid("query");
      const parsedLimit = limit ? parseInt(limit, 10) : 50;

      try {
        let messages;
        if (since) {
          messages = await getMessagesSince(
            undefined,
            config.telegramChatId,
            new Date(parseInt(since, 10)),
            parsedLimit
          );
        } else if (before) {
          messages = await getMessagesBefore(
            undefined,
            config.telegramChatId,
            new Date(parseInt(before, 10)),
            parsedLimit
          );
        } else {
          messages = await getMessages(
            undefined,
            config.telegramChatId,
            parsedLimit
          );
        }

        return c.json({ messages });
      } catch (err) {
        console.error("[chat] GET /messages error:", err);
        return c.json({ error: "Internal Server Error", message: String(err) }, 500);
      }
    }
  )

  // ==========================================================================
  // POST /send - Send a message from dashboard
  // ==========================================================================
  .post(
    "/send",
    passwordAuth,
    zValidator(
      "json",
      z.object({
        content: z.string().min(1),
      })
    ),
    async (c) => {
      const { content } = c.req.valid("json");

      // Save user message synchronously
      const saved = await saveMessage(undefined, {
        chatId: config.telegramChatId,
        direction: "in",
        content,
        sender: "user",
      });

      const messageId = saved.id;
      const createdAt = saved.createdAt.getTime();

      // Return immediately
      c.json({ messageId, createdAt });

      // Fire-and-forget background processing
      (async () => {
        try {
          // Send to Telegram
          await getBot().api.sendMessage(
            config.telegramChatId,
            `📱 You (via dashboard): ${content}`
          );

          // Detect intent and process accordingly
          const intent = detectIntent(content);

          if (intent === "quick") {
            // Generate quick response
            const { text: reply } = await generateText({
              model: getModel(),
              system:
                "You are peterbot, a helpful personal AI assistant. Answer concisely and directly.",
              prompt: content,
            });

            // Save bot response
            await saveMessage(undefined, {
              chatId: config.telegramChatId,
              direction: "out",
              content: reply,
              sender: "bot",
            });

            // Send reply to Telegram
            await getBot().api.sendMessage(config.telegramChatId, reply);
          } else {
            // Create a job for task
            const job = await createJob(undefined, {
              type: "task",
              input: content,
              chatId: config.telegramChatId,
            });

            // Save ack message with jobId
            await saveMessage(undefined, {
              chatId: config.telegramChatId,
              direction: "out",
              content: formatAckReply(job.id),
              sender: "bot",
              jobId: job.id,
            });

            // Send ack to Telegram
            await getBot().api.sendMessage(
              config.telegramChatId,
              formatAckReply(job.id),
              { parse_mode: "Markdown" }
            );
          }
        } catch (err) {
          console.error("[chat] background error:", err);
        }
      })().catch((err) => console.error("[chat] background error:", err));

      return c.json({ messageId, createdAt });
    }
  );
