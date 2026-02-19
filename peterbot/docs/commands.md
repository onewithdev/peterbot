# peterbot Commands Reference

Complete reference for all Telegram commands available in peterbot.

---

## Core Commands

### `/start`
Initialize the bot and display the welcome message.

**Usage:**
```
/start
```

**Response:** Welcome message with brief introduction.

---

### `/help`
Display the help message with all available commands, grouped by category.

**Usage:**
```
/help
```

**Response:** Markdown-formatted help message with Core, Scheduling, and Solutions categories.

---

### `/status`
Show all your tasks with their current status.

**Usage:**
```
/status
```

**Response:** List of jobs grouped by status (Running, Pending, Completed, Failed).

---

### `/get [jobId]`
Retrieve the output of a completed job.

**Usage:**
```
/get abc12345
```

**Parameters:**
- `jobId` — First 8 characters or full UUID of the job

**Response:** The job output (truncated if over 4000 characters).

---

### `/retry [jobId]`
Retry a failed job with the same input.

**Usage:**
```
/retry abc12345
```

**Parameters:**
- `jobId` — First 8 characters or full UUID of the failed job

**Response:** Acknowledgment of new job creation.

---

## Scheduling Commands

### `/schedule <when> "<what>"`
Create a new scheduled task that runs at specified intervals.

**Usage:**
```
/schedule every monday 9am "send me a briefing"
/schedule every weekday at 8:30am "check emails"
/schedule every day at midnight "daily summary"
```

**Parameters:**
- `when` — Natural language schedule description
- `what` — The task to execute (in quotes)

**Response:** Schedule confirmation with ID, timing, and next run time.

---

### `/schedule delete <id>`
Delete a schedule by its ID.

**Usage:**
```
/schedule delete abc12345
```

**Parameters:**
- `id` — First 8 characters of the schedule ID

**Response:** Confirmation of deletion.

---

### `/schedules`
List all your schedules.

**Usage:**
```
/schedules
```

**Response:** List of all schedules with status (enabled/disabled) and descriptions.

---

## Solutions Commands

### `/solutions`
List all saved solutions.

**Usage:**
```
/solutions
```

**Response:** List of saved solutions with titles and tags.

---

### `save this solution`
Save a completed job as a reusable solution. Reply to a completed job message with this phrase.

**Usage:**
```
[Reply to completed job message]
save this solution
```

**Response:** Selection of recent completed jobs to save.

---

## Natural Language Tasks

Send any task description without a `/` prefix, and peterbot will process it:

- **Quick questions** (short, informational): Answered immediately
- **Background tasks** (complex, time-consuming): Queued and processed asynchronously

**Examples:**
```
What time is it in Tokyo?                    → Quick reply
Research the top AI frameworks                 → Background task
Write a report on climate change               → Background task
Analyze this data and create a chart           → Background task
```

---

## Command Summary

| Command | Purpose |
|---------|---------|
| `/start` | Initialize bot |
| `/help` | Show this help |
| `/status` | List all jobs |
| `/get [id]` | Get job output |
| `/retry [id]` | Retry failed job |
| `/schedule <when> "<what>"` | Create schedule |
| `/schedules` | List schedules |
| `/solutions` | List saved solutions |
