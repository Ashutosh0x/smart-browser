# AB-OS IDE

## Overview

The AB-OS IDE is a React-based dashboard for operators and users to interact with the AB-OS system.

---

## Features

- **Prompt Interface** - Natural language task submission
- **Agent Dashboard** - Real-time agent status monitoring
- **Replay Viewer** - Session playback and debugging
- **Policy Editor** - Visual policy authoring
- **Audit Log Viewer** - Searchable action history

---

## Technology Stack

- **Framework**: Next.js 14+
- **Styling**: TailwindCSS
- **State Management**: Zustand
- **Data Fetching**: TanStack Query
- **Real-time**: WebSocket / SSE

---

## Getting Started

```bash
# Install dependencies
cd packages/ide
npm install

# Start development server
npm run dev

# Open browser
open http://localhost:3000
```

---

## Project Structure

```
packages/ide/
├── src/
│   ├── app/                  # Next.js app router
│   │   ├── (dashboard)/      # Dashboard routes
│   │   ├── agents/           # Agent management
│   │   ├── policies/         # Policy editor
│   │   ├── replay/           # Replay viewer
│   │   └── settings/         # Settings
│   ├── components/           # UI components
│   │   ├── ui/               # Base components
│   │   ├── agents/           # Agent-related
│   │   └── policies/         # Policy-related
│   ├── hooks/                # Custom hooks
│   ├── lib/                  # Utilities
│   └── stores/               # State stores
├── public/
└── package.json
```

---

## API Integration

```typescript
// API client configuration
const api = createClient({
  planner: process.env.PLANNER_URL,
  agentRuntime: process.env.AGENT_RUNTIME_URL,
  policyAuthority: process.env.POLICY_URL,
  observability: process.env.OBSERVABILITY_URL,
});
```

---

## References

- [UI Specifications](ui-specs/)
- [Design Tokens](design-tokens/)
