# peterbot Dashboard

React-based web dashboard for peterbot.

## Tech Stack

- **Build Tool**: Vite
- **Framework**: React 19 + TypeScript
- **Routing**: TanStack Router (file-based)
- **State Management**: TanStack Query
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui inspired components
- **API Client**: Hono RPC

## Getting Started

```bash
# Install dependencies
bun install

# Start development server (runs on port 5173)
bun run dev

# Build for production
bun run build

# Run tests
bun test
```

## Project Structure

```
src/
├── components/
│   ├── ui/          # shadcn/ui components (Button, Card, Input, Label)
│   └── sidebar.tsx  # Navigation sidebar
├── lib/
│   ├── api.ts       # Hono RPC client
│   ├── auth.ts      # Password utilities (localStorage)
│   ├── utils.ts     # cn() utility for Tailwind
│   └── auth.test.ts # Auth utilities tests
├── routes/          # File-based routes
│   ├── __root.tsx   # Root layout with sidebar
│   ├── index.tsx    # Overview page
│   ├── login.tsx    # Login page
│   ├── soul.tsx     # Soul configuration
│   ├── memory.tsx   # Memory management
│   ├── monitor.tsx  # Job monitoring
│   ├── config.tsx   # Settings & blocklist
│   └── console.tsx  # Dev console (terminal)
└── main.tsx         # Application entry
```

## Development

The Vite dev server is configured to:
- Run on port 5173
- Proxy `/api` requests to `http://localhost:3000` (the peterbot backend)

## Authentication

Simple password-based authentication using localStorage:
- Password is stored in localStorage after successful login
- All API requests include the password in the Authorization header
- Password verification is handled by the backend
