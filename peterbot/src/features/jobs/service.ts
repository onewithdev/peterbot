import type { Job } from "./schema";

export function formatAge(createdAt: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return "just now";
  } else if (diffMins < 60) {
    return `${diffMins}min ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return `${diffDays}d ago`;
  }
}

export function formatJob(job: Job): string {
  const shortId = job.id.slice(0, 8);
  const age = formatAge(job.createdAt);
  const preview = job.input.length > 60 ? job.input.slice(0, 60) + "..." : job.input;

  const statusIcon = {
    pending: "⏳",
    running: "🔄",
    completed: "✅",
    failed: "❌",
  }[job.status];

  let message = `${statusIcon} [${shortId}] ${age} — ${preview}`;

  if (job.status === "completed") {
    message += `\n   💡 Reply 'get ${shortId}' to retrieve`;
  } else if (job.status === "failed") {
    message += `\n   💡 Reply 'retry ${shortId}' to try again`;
  }

  return message;
}

export function formatJobsForStatus(jobs: Job[]): string {
  if (jobs.length === 0) {
    return "📭 No jobs found. Send me a task to get started!";
  }

  const grouped = {
    pending: jobs.filter((j) => j.status === "pending"),
    running: jobs.filter((j) => j.status === "running"),
    completed: jobs.filter((j) => j.status === "completed"),
    failed: jobs.filter((j) => j.status === "failed"),
  };

  const lines: string[] = [];

  if (grouped.running.length > 0) {
    lines.push(`🔄 Running (${grouped.running.length}):`);
    lines.push(...grouped.running.map(formatJob));
    lines.push("");
  }

  if (grouped.pending.length > 0) {
    lines.push(`⏳ Pending (${grouped.pending.length}):`);
    lines.push(...grouped.pending.map(formatJob));
    lines.push("");
  }

  if (grouped.completed.length > 0) {
    lines.push(`✅ Completed (${grouped.completed.length}):`);
    lines.push(...grouped.completed.map(formatJob));
    lines.push("");
  }

  if (grouped.failed.length > 0) {
    lines.push(`❌ Failed (${grouped.failed.length}):`);
    lines.push(...grouped.failed.map(formatJob));
    lines.push("");
  }

  // Remove trailing empty line
  if (lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.join("\n");
}
