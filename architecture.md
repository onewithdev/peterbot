# ARCHITECTURE.md

> **Stack**: Bun (Core & Worker) + SQLite (State) + E2B (Sandbox)
> **Pattern**: "Local Manager, Cloud Worker"
> **Goal**: A zero-infra, high-safety AI assistant that runs entirely on Bun.

---

## 1. High-Level Concept

We have replaced the heavy local infrastructure (Docker/Redis) with lightweight, modern alternatives.

* **The Core (Bun)**: The "Manager." It stays online, handles WebSockets from the frontend, and acts as the interface for WhatsApp/Telegram.
* **The Job Board (SQLite)**: A single local file (`jobs.db`) acts as the communication bus. No servers to install.
* **The Worker (Bun)**: The "Orchestrator." It picks up jobs from the DB and sends them to **E2B** (a secure cloud sandbox) to execute Python code.
* **The Runtime (E2B)**: The actual "Computer." This is where the Python code runs, files are generated, and internet scraping happens. It is ephemeral and safe.

### System Diagram

```mermaid
graph TD
    subgraph "Local Machine (Your Laptop)"
        WA[WhatsApp / Web UI]
        CORE[Bun Core Server]
        DB[(SQLite File)]
        WORKER[Bun Worker Process]
    end

    subgraph "The Cloud (Secure)"
        E2B[E2B Sandbox (Python VM)]
        INTERNET((The Internet))
    end

    %% Flow
    WA --> CORE
    CORE -- "1. INSERT Job" --> DB
    DB -- "2. Poll for Job" --> WORKER
    WORKER -- "3. Run Code" --> E2B
    E2B -- "4. Scrape/Download" --> INTERNET
    E2B -- "5. Return Artifacts" --> WORKER
    WORKER -- "6. UPDATE Job" --> DB
2. Component Breakdown
A. The Core: "The Interface"
Runtime: Bun (TypeScript)

Database: bun:sqlite

Responsibilities:

API Server: Serves the Web Dashboard and receives Webhooks.

Job Creator: Parses user intent (e.g., "Analyze this") and creates a job row in SQLite.

Real-time Updates: Watches SQLite for status changes (DONE) and pushes the result back to the user via WebSocket.

B. The Worker: "The Orchestrator"
Runtime: Bun (TypeScript)

Responsibilities:

Polling Loop: Checks SQLite every 500ms for pending jobs.

E2B Client: Uses the @e2b/code-interpreter SDK to spin up a sandbox.

Asset Management: Downloads generated files (charts, PDFs) from the E2B sandbox and saves them locally to ./storage for the user to see.

C. The Sandbox: "The Execution Environment"
Provider: E2B (Cloud)

Responsibilities:

Safety: Runs untrusted AI-generated code. If the AI tries to delete files, it deletes them in the cloud, not on your laptop.

Capabilities: Comes pre-installed with Python, Pandas, Internet access, and system tools.

3. Data Schema (The "Protocol")
We use a single SQLite table to manage the state.

File: ./data/jobs.db

SQL
CREATE TABLE jobs (
    id TEXT PRIMARY KEY,        -- UUID
    type TEXT,                  -- 'code_exec', 'browser', 'chat'
    status TEXT,                -- 'pending', 'running', 'completed', 'failed'
    input_context JSON,         -- { "code": "print('hello')", "files": [...] }
    output_result JSON,         -- { "stdout": "hello", "artifacts": ["chart.png"] }
    created_at INTEGER,         -- Timestamp
    updated_at INTEGER
);
4. The "Code Execution" Workflow
Here is exactly what happens when you ask: "Graph this CSV file."

Core: Uploads the CSV to ./storage/temp/.

Core: Inserts job into SQLite:

JSON
{ "type": "code_exec", "status": "pending", "input_context": { "files": ["data.csv"] } }
Worker: Detects new job.

Worker (E2B Step):

Initializes E2B Sandbox.

Uploads data.csv to the Sandbox.

Sends Python code: import pandas as pd... plt.savefig('graph.png').

Downloads graph.png from Sandbox to local ./storage/outputs/.

Kills Sandbox.

Worker: Updates SQLite to completed with path to graph.png.

Core: Sees completed, sends image to WhatsApp.

5. Directory Structure
This structure is designed for Bun monorepo simplicity.

Plaintext
/my-ai-agent
├── data/
│   └── jobs.db            # The brain (SQLite)
├── storage/               # Local file cache
│   ├── uploads/           # Files from user
│   └── outputs/           # Files from E2B
├── src/
│   ├── core/              # The Web Server
│   │   ├── server.ts      # Main Entry point
│   │   └── routes.ts      # API definitions
│   ├── worker/            # The Background Processor
│   │   ├── worker.ts      # Polling loop
│   │   └── e2b_client.ts  # E2B SDK Logic
│   └── shared/
│       └── db.ts          # Shared SQLite client
├── package.json           # Bun dependencies
└── .env                   # E2B_API_KEY
6. Security Note
FileSystem: Your local files are safe. The AI only touches files inside the E2B cloud sandbox.

API Keys: The Worker needs E2B_API_KEY. Keep this in .env.

Costs: E2B is a paid service (with a free tier). Monitor usage in the loop to avoid draining credits.