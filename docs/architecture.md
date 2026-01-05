# AB-OS Architecture

## System Overview

AB-OS is a browser-based AI operating system that treats browser actions as kernel syscalls. It enables parallel AI agents to control browsers with deterministic replay, policy enforcement, and enterprise security.

---

## Core Principles

1. **Browser as OS** - DOM interactions are syscalls, not API calls
2. **Capability-Based Security** - No implicit permissions, explicit tokens
3. **Deterministic Replay** - Every session can be reproduced exactly
4. **Multi-Agent Parallelism** - Concurrent execution with isolation
5. **Human-in-the-Loop** - Critical actions require approval

---

## Component Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              AB-OS IDE                                    │
│                     (React/Next.js Dashboard)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Prompt UI   │  │ Agent View  │  │ Replay View │  │ Policy UI   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                            Planner (LLM)                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  GPT-4.1 / Gemini 2.5 Flash  │  Mistral 3 / Llama 3.3 (local)  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  Responsibilities:                                                       │
│  • Parse user intent → Plan DAG (JSON)                                  │
│  • Decompose complex tasks into agent-executable steps                  │
│  • Select appropriate agents and capabilities                           │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                          Plan DAG (JSON)
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         Policy Authority                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │ Policy DSL   │  │ Capability   │  │ Secrets      │                   │
│  │ Engine       │  │ Token Issuer │  │ Vault        │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
│                                                                          │
│  Responsibilities:                                                       │
│  • Evaluate policies (purchase limits, domain restrictions)             │
│  • Issue short-lived capability tokens (JWTs)                           │
│  • Inject secrets at point-of-use only                                  │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                         Capability Tokens
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          Agent Runtime                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │ Actor Model  │  │ Memory Store │  │ Warm Pool    │                   │
│  │ Scheduler    │  │ (per-agent)  │  │ Manager      │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
│                                                                          │
│  Responsibilities:                                                       │
│  • Spawn/manage agent actors concurrently                               │
│  • Maintain agent-local memory and context                              │
│  • Pool warm browser contexts for fast startup                          │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                            Syscall Requests
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        Verified Executor                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │ Preflight    │  │ HTTP Preview │  │ Audit        │                   │
│  │ Validator    │  │ (masked)     │  │ Logger       │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
│                                                                          │
│  Responsibilities:                                                       │
│  • Validate capability tokens before execution                          │
│  • Preview state-mutating requests for approval                         │
│  • Log all actions to append-only audit ledger                          │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                           Verified Syscalls
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           AB-OS Kernel                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │ DOM Syscalls │  │ Event        │  │ Network      │                   │
│  │ (snapshot,   │  │ Virtuali-    │  │ Interception │                   │
│  │  click, etc) │  │ zation       │  │              │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
│                                                                          │
│  Built on: Chromium Fork (Blink + V8)                                   │
│  Responsibilities:                                                       │
│  • Expose browser primitives as syscalls                                │
│  • Capture deterministic DOM snapshots                                  │
│  • Virtualize events for replay                                         │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         Observability                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │ Snapshot     │  │ Audit        │  │ Replay       │                   │
│  │ Store        │  │ Ledger       │  │ Engine       │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Kernel ABI (Syscalls)

The kernel exposes browser operations as syscalls with capability requirements:

| Syscall | Description | Required Capability |
|---------|-------------|---------------------|
| `snapshot()` | Capture DOM state | `CAP_READ` |
| `click(selector)` | Click element | `CAP_INTERACT` |
| `type(selector, text)` | Type into input | `CAP_INTERACT` |
| `navigate(url)` | Navigate to URL | `CAP_NAVIGATE` |
| `screenshot()` | Capture screenshot | `CAP_READ` |
| `submit_form()` | Submit form data | `CAP_MUTATE` |
| `purchase(amount)` | Execute purchase | `CAP_PURCHASE` |

---

## Data Flow

```
User Prompt
     │
     ▼
┌─────────┐    Plan DAG    ┌─────────────────┐
│ Planner │───────────────▶│ Policy Authority │
└─────────┘                └────────┬────────┘
                                    │
                          Capability Tokens
                                    ▼
                           ┌───────────────┐
                           │ Agent Runtime │
                           └───────┬───────┘
                                   │
                    Parallel Agent Execution
                    ┌──────┬──────┬──────┐
                    ▼      ▼      ▼      ▼
               ┌──────┐┌──────┐┌──────┐┌──────┐
               │Agent1││Agent2││Agent3││AgentN│
               └──┬───┘└──┬───┘└──┬───┘└──┬───┘
                  │       │       │       │
                  └───────┴───────┴───────┘
                                │
                         ┌──────▼──────┐
                         │   Executor  │
                         └──────┬──────┘
                                │
                     ┌──────────▼──────────┐
                     │    AB-OS Kernel     │
                     └──────────┬──────────┘
                                │
                     ┌──────────▼──────────┐
                     │   Observability     │
                     │ (Snapshots, Audit)  │
                     └─────────────────────┘
```

---

## Security Model

### Capability-Based Access Control

```yaml
# Example capability token payload
{
  "agent_id": "agent-123",
  "capabilities": ["CAP_READ", "CAP_INTERACT"],
  "constraints": {
    "domains": ["spotify.com"],
    "max_purchase": 0
  },
  "expires_at": "2026-01-04T21:30:00Z",
  "signature": "..."
}
```

### Trust Boundaries

1. **User ↔ IDE** - Authentication required
2. **IDE ↔ Planner** - Signed requests
3. **Planner ↔ Policy** - Validated plans
4. **Policy ↔ Runtime** - Capability tokens
5. **Runtime ↔ Executor** - Token verification
6. **Executor ↔ Kernel** - Syscall validation
7. **Kernel ↔ Observability** - Signed audit entries

---

## Deployment Models

### Cloud (SaaS)

```
┌─────────────────────────────────────────┐
│            Load Balancer                 │
└─────────────────┬───────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
┌───────┐    ┌───────┐    ┌───────┐
│ IDE   │    │Planner│    │Policy │
│ Pods  │    │ Pods  │    │ Pods  │
└───────┘    └───────┘    └───────┘
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
┌───────┐    ┌───────┐    ┌───────┐
│Agent  │    │Agent  │    │Agent  │
│Runner1│    │Runner2│    │RunnerN│
└───────┘    └───────┘    └───────┘
```

### On-Premises

- Helm chart deployment
- Air-gapped support with local LLMs
- HSM integration for key management
- Private container registry

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Planner latency (p95) | < 400ms | Cloud LLM |
| Agent startup (warm) | < 1.5s | Pooled contexts |
| Agent startup (cold) | < 6s | New context |
| Snapshot capture | < 100ms | DOM serialization |
| Audit write | < 50ms | Append-only |

---

## References

- [Kernel Design](../packages/kernel/design.md)
- [Agent Runtime Design](../packages/agent-runtime/design.md)
- [Policy DSL Spec](policy-dsl-spec.md)
- [Threat Model](threat-model.md)
