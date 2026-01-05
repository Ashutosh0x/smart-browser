# AB-OS Agent Runtime

## Overview

The Agent Runtime manages the lifecycle of AI agents using an actor model. It provides concurrent execution, memory isolation, and warm pooling for fast agent startup.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Agent Runtime                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Scheduler   │  │ Memory Mgr  │  │ Warm Pool   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ Agent 1 │ │ Agent 2 │ │ Agent 3 │ │ Agent N │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
├─────────────────────────────────────────────────────────────┤
│                    Kernel Interface                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Features

- **Actor Model** - Each agent is an isolated actor with mailbox
- **Memory Isolation** - Per-agent memory store
- **Warm Pooling** - Pre-created browser contexts
- **LLM Integration** - Local Mistral/Llama for micro-planning
- **Observability** - Full action logging

---

## Agent Lifecycle

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Created  │───▶│  Ready   │───▶│ Running  │───▶│ Complete │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │
     └───────────────┴───────────────┴───────────────┘
                          │
                          ▼
                    ┌──────────┐
                    │  Failed  │
                    └──────────┘
```

---

## Configuration

See [runtime-config.yaml](runtime-config.yaml) for all options.

---

## API

### Start Agent

```typescript
interface StartAgentRequest {
  agentId: string;
  planDag: PlanDAG;
  capabilities: CapabilityToken;
  timeout?: number;
}

interface StartAgentResponse {
  success: boolean;
  agentId: string;
  status: AgentStatus;
}
```

### Get Agent Status

```typescript
interface AgentStatus {
  agentId: string;
  state: 'created' | 'ready' | 'running' | 'complete' | 'failed';
  currentStep: number;
  totalSteps: number;
  error?: string;
}
```

---

## References

- [Design Document](design.md)
- [Runtime Config](runtime-config.yaml)
