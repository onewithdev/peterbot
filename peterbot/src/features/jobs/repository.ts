import { eq, and, desc } from "drizzle-orm";
import { db } from "../../db";
import { jobs, type Job, type NewJob } from "./schema";

export async function createJob(input: NewJob): Promise<Job> {
  const id = crypto.randomUUID();
  const now = new Date();

  const newJob: NewJob = {
    id,
    type: input.type,
    status: "pending",
    input: input.input,
    chatId: input.chatId,
    delivered: false,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(jobs).values(newJob);
  return newJob as Job;
}

export async function getJobById(id: string): Promise<Job | undefined> {
  const result = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return result[0];
}

export async function getJobsByChatId(chatId: string): Promise<Job[]> {
  return await db
    .select()
    .from(jobs)
    .where(eq(jobs.chatId, chatId))
    .orderBy(desc(jobs.createdAt))
    .limit(20);
}

export async function getPendingJobs(limit = 5): Promise<Job[]> {
  return await db
    .select()
    .from(jobs)
    .where(eq(jobs.status, "pending"))
    .orderBy(desc(jobs.createdAt))
    .limit(limit);
}

export async function getUndeliveredJobs(): Promise<Job[]> {
  return await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.status, "completed"), eq(jobs.delivered, false)))
    .orderBy(desc(jobs.createdAt));
}

export async function markRunning(id: string): Promise<void> {
  await db
    .update(jobs)
    .set({
      status: "running",
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, id));
}

export async function markCompleted(id: string, output: string): Promise<void> {
  await db
    .update(jobs)
    .set({
      status: "completed",
      output,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, id));
}

export async function markFailed(id: string, error: string): Promise<void> {
  await db
    .update(jobs)
    .set({
      status: "failed",
      output: error,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, id));
}

export async function markDelivered(id: string): Promise<void> {
  await db
    .update(jobs)
    .set({
      delivered: true,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, id));
}
