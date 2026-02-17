import { z } from "zod";

export const createJobSchema = z.object({
  type: z.enum(["task", "quick"]),
  input: z.string().min(1).max(10000),
  chatId: z.string().min(1),
});

export const jobIdSchema = z.string().uuid();

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type JobIdInput = z.infer<typeof jobIdSchema>;
