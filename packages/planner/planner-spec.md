# Plan DAG Specification

## Overview

This document specifies the Plan DAG (Directed Acyclic Graph) schema used by the AB-OS Planner to represent executable task plans.

---

## Schema

```typescript
interface PlanDAG {
  // Unique plan identifier
  plan_id: string;
  
  // Original user intent
  intent: string;
  
  // Decomposed steps
  steps: PlanStep[];
  
  // What constitutes success
  success_criteria: string;
  
  // Steps to undo if failed
  rollback_plan?: string;
  
  // Plan metadata
  metadata: PlanMetadata;
}

interface PlanStep {
  // Unique step identifier
  step_id: string;
  
  // Step dependencies (must complete before this step)
  depends_on: string[];
  
  // Parallel group (steps in same group run concurrently)
  parallel_group: number;
  
  // Agent type to execute this step
  agent_type: 'browser_agent' | 'api_agent';
  
  // Action to perform
  action: ActionType;
  
  // Action target (URL, selector, etc.)
  target: string;
  
  // Additional parameters
  params?: Record<string, any>;
  
  // Required capabilities
  capabilities_required: Capability[];
  
  // Expected outcome
  expected_outcome?: string;
  
  // Timeout for this step (ms)
  timeout?: number;
}

type ActionType =
  | 'navigate'
  | 'click'
  | 'type'
  | 'scroll'
  | 'hover'
  | 'wait'
  | 'extract'
  | 'screenshot'
  | 'snapshot';

type Capability =
  | 'CAP_READ'
  | 'CAP_INTERACT'
  | 'CAP_NAVIGATE'
  | 'CAP_MUTATE'
  | 'CAP_PURCHASE'
  | 'CAP_PII';

interface PlanMetadata {
  created_at: string;
  planner_model: string;
  confidence: number;
  estimated_duration_ms: number;
}
```

---

## JSON Example

```json
{
  "plan_id": "550e8400-e29b-41d4-a716-446655440000",
  "intent": "Play my Liked Songs on Spotify and set volume to 50%",
  "steps": [
    {
      "step_id": "1",
      "depends_on": [],
      "parallel_group": 1,
      "agent_type": "browser_agent",
      "action": "navigate",
      "target": "https://open.spotify.com",
      "capabilities_required": ["CAP_NAVIGATE"],
      "expected_outcome": "Spotify web player loaded",
      "timeout": 30000
    },
    {
      "step_id": "2",
      "depends_on": ["1"],
      "parallel_group": 2,
      "agent_type": "browser_agent",
      "action": "wait",
      "target": "[data-testid='login-button'], [data-testid='user-widget']",
      "params": {
        "condition": "visible"
      },
      "capabilities_required": ["CAP_READ"],
      "expected_outcome": "Page fully loaded",
      "timeout": 10000
    },
    {
      "step_id": "3",
      "depends_on": ["2"],
      "parallel_group": 3,
      "agent_type": "browser_agent",
      "action": "click",
      "target": "[data-testid='your-library-button']",
      "capabilities_required": ["CAP_INTERACT"],
      "expected_outcome": "Library sidebar opened"
    },
    {
      "step_id": "4",
      "depends_on": ["3"],
      "parallel_group": 4,
      "agent_type": "browser_agent",
      "action": "click",
      "target": "[data-testid='liked-songs-button']",
      "capabilities_required": ["CAP_INTERACT"],
      "expected_outcome": "Liked Songs playlist opened"
    },
    {
      "step_id": "5",
      "depends_on": ["4"],
      "parallel_group": 5,
      "agent_type": "browser_agent",
      "action": "click",
      "target": "[data-testid='play-button']",
      "capabilities_required": ["CAP_INTERACT"],
      "expected_outcome": "Music started playing"
    },
    {
      "step_id": "6",
      "depends_on": ["5"],
      "parallel_group": 6,
      "agent_type": "browser_agent",
      "action": "click",
      "target": "[data-testid='volume-bar']",
      "params": {
        "position": { "x": 0.5, "y": 0.5 }
      },
      "capabilities_required": ["CAP_INTERACT"],
      "expected_outcome": "Volume set to 50%"
    }
  ],
  "success_criteria": "Liked Songs playing at 50% volume",
  "rollback_plan": "Click pause button if playing, restore original volume",
  "metadata": {
    "created_at": "2026-01-04T21:15:00Z",
    "planner_model": "gpt-4.1",
    "confidence": 0.92,
    "estimated_duration_ms": 15000
  }
}
```

---

## Parallel Execution

Steps with the same `parallel_group` execute concurrently:

```
Group 1: [Step 1]
            │
            ▼
Group 2: [Step 2]
            │
            ▼
Group 3: [Step 3a] [Step 3b] [Step 3c]  ← Parallel
            │         │         │
            └────┬────┘         │
                 │              │
                 ▼              │
Group 4: [Step 4] ◄─────────────┘
```

---

## Validation Rules

1. **Acyclic**: No circular dependencies
2. **Reachable**: All steps reachable from root
3. **Valid Actions**: Action types must be known
4. **Valid Capabilities**: Capabilities must be recognized
5. **Positive Groups**: `parallel_group` must be positive integer
6. **Unique IDs**: `step_id` must be unique within plan

---

## References

- [Planner README](README.md)
- [System Prompt](prompts/planner-system-prompt.txt)
