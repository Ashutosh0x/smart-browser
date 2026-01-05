# AB-OS Planner

## Overview

The Planner is the central LLM component that decomposes user intents into executable plan DAGs (Directed Acyclic Graphs). It uses cloud LLMs (GPT-4.1/Gemini) for complex reasoning and local models for fallback.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Planner                               │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Intent    │  │    Plan     │  │  Validator  │         │
│  │   Parser    │  │  Generator  │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                    Model Adapters                            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ OpenAI  │ │ Gemini  │ │ Mistral │ │ Ollama  │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
└─────────────────────────────────────────────────────────────┘
```

---

## Plan DAG Schema

See [planner-spec.md](planner-spec.md) for the complete schema.

```json
{
  "plan_id": "uuid",
  "intent": "Play my Liked Songs on Spotify",
  "steps": [
    {
      "step_id": "1",
      "action": "navigate",
      "target": "https://open.spotify.com",
      "capabilities_required": ["CAP_NAVIGATE"],
      "parallel_group": 1
    },
    {
      "step_id": "2",
      "action": "click",
      "target": "button[data-testid='play-button']",
      "capabilities_required": ["CAP_INTERACT"],
      "depends_on": ["1"],
      "parallel_group": 2
    }
  ]
}
```

---

## LLM Configuration

| Use Case | Primary | Fallback |
|----------|---------|----------|
| Complex planning | GPT-4.1 | Gemini 2.5 Flash |
| Simple tasks | Gemini 2.5 Flash | Llama 3.3 (local) |
| Offline | Llama 3.3 | Mistral 3 |

---

## Usage

```typescript
import { Planner } from '@abos/planner';

const planner = new Planner({
  primary: {
    provider: 'openai',
    model: 'gpt-4.1',
  },
  fallback: {
    provider: 'ollama',
    model: 'llama3.3:70b',
  },
});

const plan = await planner.createPlan({
  intent: "Play my Liked Songs on Spotify",
  context: {
    currentUrl: "https://open.spotify.com",
  },
});
```

---

## System Prompt

See [prompts/planner-system-prompt.txt](prompts/planner-system-prompt.txt) for the full system prompt.

---

## References

- [Plan Specification](planner-spec.md)
- [System Prompt](prompts/planner-system-prompt.txt)
- [Model Adapters](model-adapters/)
