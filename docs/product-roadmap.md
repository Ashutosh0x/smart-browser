# AB-OS Product Roadmap

> High-leverage feature set optimized for **real differentiation**, **low latency**, **enterprise readiness**, and **user delight**.

---

## Feature Summary

| Category | Features | Priority |
|----------|----------|----------|
| 🚀 Core | 7 | Non-Negotiable |
| ⚡ Performance | 6 | P0 |
| 🧠 Intelligence | 6 | P1 |
| 🔐 Security | 6 | P0 |
| 🖥️ UX | 8 | P1 |
| 🧱 Platform | 5 | P2 |
| 🧪 Advanced | 14 | Future |

**Total: 52 features**

---

## 🚀 Core Features (Non-Negotiable)

These define what AB-OS is. Without them, it's just "Chromium + AI".

### 1. Prompt → Parallel Execution
One natural-language prompt spawns multiple agents and windows concurrently. No sequential execution, no tab juggling.

```
User: "Compare prices for AirPods on Amazon, Best Buy, and Walmart"
      → 3 agents spawn simultaneously
      → Results aggregate automatically
```

**Status**: 🟡 Planner MVP done, parallel scheduling pending

---

### 2. Agent-Centric Browser Model
- **No tabs** — each task = one autonomous agent = one isolated window
- Paradigm shift from "browser with AI" to "AI operating system"

**Status**: 🟡 Architecture defined

---

### 3. Kernel-Level Browser Syscalls
`CLICK`, `TYPE`, `NAVIGATE`, `SNAPSHOT` executed below JS/DOM. Faster, safer, deterministic.

| Syscall | Latency Target |
|---------|---------------|
| CLICK | <50ms |
| TYPE | <30ms |
| SNAPSHOT | <50ms |
| NAVIGATE | <500ms |

**Status**: 🟢 Protobuf ABI defined, Chromium patches pending

---

### 4. Hard Agent Isolation
- Separate cookies, storage, memory, auth
- Zero cross-agent contamination
- Each agent = sandboxed container

**Status**: 🟡 Design complete

---

### 5. Deterministic Replay
Every action replayable exactly. Time-travel debugging and auditability.

```typescript
replay.goto(timestamp: "2026-01-04T12:34:56Z");
replay.stepForward();
replay.fork();  // Branch from this point
```

**Status**: 🟢 Design complete (`replay-engine-design.md`)

---

### 6. Warm Context Pools
Pre-initialized browser contexts for sub-300ms startup.

| Domain | Pool Size | Startup |
|--------|-----------|---------|
| spotify.com | 3-10 | <200ms |
| gmail.com | 2-8 | <200ms |
| amazon.com | 2-8 | <250ms |

**Status**: 🟢 Design complete (`warm-pool-design.md`)

---

### 7. Explainable Actions
"Why this action happened" for every step. No black-box automation.

```json
{
  "action": "click",
  "target": "#play-button",
  "reasoning": "User wants to play music. Play button identified via aria-label.",
  "confidence": 0.95
}
```

**Status**: 🔴 Not started

---

## ⚡ Performance Features

These make AB-OS faster than any traditional browser.

### 1. Binary DOM Snapshots
SNAPSHOT returns compact DOM in <50ms. No JS traversal overhead.

- Struct-of-arrays format
- String table deduplication
- Brotli compression
- COW support for deltas

**Status**: 🟢 Design complete (`binary-snapshot-design.md`)

---

### 2. Speculative Execution
Prefetch likely next actions. Safe, policy-gated speculation.

```
Planner predicts: navigate("checkout") likely
Kernel pre-warms: DNS, TLS, critical resources
```

**Status**: 🔴 Not started

---

### 3. Zero-Jank Rendering
- GPU-first compositing
- Damage-rect only repaints
- No UI freezes even with 50+ agents

**Status**: 🔴 Pending Chromium patches

---

### 4. Async Agent Scheduler
OS-style task scheduling. Priority-aware, non-blocking.

```yaml
priorities:
  interactive: 100  # User-visible
  background: 10    # Prefetch/scrape
  idle: 1           # Maintenance
```

**Status**: 🟡 Design in agent-runtime

---

### 5. Local Micro-Models
Lightweight on-device models for micro decisions. Cloud only for planning.

| Role | Model | Location |
|------|-------|----------|
| Planner | GPT-4.1 | Cloud |
| Micro-decisions | Mistral 7B Q4 | Local |
| Site adapters | Llama 8B | Local |

**Status**: 🟢 Architecture defined (`llm-integration.md`)

---

### 6. Network Fast Path
- QUIC / HTTP3 default
- TLS session reuse + 0-RTT
- Connection warm-up for predicted domains

**Status**: 🔴 Pending kernel config

---

## 🧠 Intelligence & Autonomy Features

Where AB-OS becomes autonomous, not scripted.

### 1. Automatic Task Decomposition
Prompt → independent sub-tasks. Transparent, editable plan.

```
Input: "Book a flight to NYC and a hotel near Central Park"
Plan:
  └─ [Parallel Group 1]
       ├─ search_flights(destination: "NYC")
       └─ search_hotels(near: "Central Park")
  └─ [Parallel Group 2]
       ├─ select_best_flight()
       └─ select_best_hotel()
```

**Status**: 🟢 Planner MVP working

---

### 2. Self-Healing Execution
Detects failures. Retries with alternative strategies.

```
Failed: click("#buy-btn") - element not found
Retry 1: wait(2000) + click("#buy-btn")
Retry 2: scroll_to("#buy-btn") + click()
Retry 3: escalate_to_human()
```

**Status**: 🔴 Not started

---

### 3. Site Understanding Layer
Learns UI semantics (Spotify, Gmail, Amazon). No brittle selectors.

```typescript
// Instead of: click("#yDmH0d > div.T4LgNb")
// Use: click(semantic: "play_button", site: "spotify.com")
```

**Status**: 🔴 Not started (requires fine-tuning)

---

### 4. Confidence & Risk Scoring
Agent reports certainty. Flags ambiguous or risky actions.

```json
{
  "action": "purchase",
  "confidence": 0.72,
  "risk": "high",
  "requires_approval": true
}
```

**Status**: 🔴 Not started

---

### 5. Multi-Agent Collaboration
Agents can delegate and share context safely.

```
Agent-1: "I found the product. Agent-2, proceed to checkout."
Agent-2: receives(product_url, session_context)
```

**Status**: 🔴 Not started

---

### 6. Conditional Logic in Natural Language
- "If price < $20, buy it"
- "If unread emails exist, summarize"

**Status**: 🔴 Not started (planner enhancement)

---

## 🔐 Security & Enterprise Trust

These unlock real-world adoption.

### 1. Capability-Based Permissions
`CAP_READ`, `CAP_WRITE`, `CAP_PURCHASE`, etc. Least-privilege execution.

**Status**: 🟢 Defined (`capability-service.md`)

---

### 2. Policy Engine (Declarative)
```yaml
policy:
  rules:
    - when: { capability: CAP_PURCHASE, amount: { gt: 100 } }
      then: { require_approval: true }
    - when: { domain: { not_in: ["*.company.com"] } }
      then: { deny_egress: true }
```

**Status**: 🟢 DSL defined (`policy-dsl-spec.md`)

---

### 3. Cryptographically Signed Audit Ledger
HSM-signed, append-only. Non-repudiation. Compliance-ready.

**Status**: 🟢 Design complete (`audit-ledger-spec.md`)

---

### 4. Secrets Vault Integration
Runtime injection. Never logged, never snapshotted.

**Status**: 🟢 Vault integration documented

---

### 5. Human-in-the-Loop Escalation
Purchases, emails, destructive actions → clean approval UI.

**Status**: 🔴 Not started

---

### 6. On-Prem / Air-Gapped Mode
Local models. No external calls.

**Status**: 🟡 Ollama integration working

---

## 🖥️ User Experience & Control

Make users feel like commanders, not operators.

### 1. Live Multi-Window Workspace
See all agents working in real time. Commander view.

### 2. Replay Slider
Scrub through execution timeline like a video.

### 3. Fork Execution
Branch from any point. Explore alternatives in parallel.

### 4. Interrupt & Override
User can take control mid-execution. Hand back to AI seamlessly.

### 5. Structured Output Panel
Tables, summaries, JSON extracted live.

### 6. Ghost Cursor Visualization
Optional AI cursor visibility for transparency.

### 7. Task Memory (Scoped)
Preferences remembered per agent or domain.

### 8. Voice → Parallel Execution
Speak commands, spawn agents.

**Status**: 🔴 All pending (IDE package)

---

## 🧱 Platform & Extensibility

### 1. Agent Templates
- Research Agent
- Shopping Agent
- Monitoring Agent

### 2. Agent Marketplace (Verified Only)
Signed, permissioned behaviors. No arbitrary extensions.

### 3. Web-as-API Mode
Treat websites as structured data sources.

### 4. Scheduled & Recurring Tasks
"Do this every Monday" — fully visible and auditable.

### 5. Enterprise RBAC Views
Role-based dashboards for admins and operators.

**Status**: 🔴 All pending

---

## 🧪 Advanced / Future Features

| Feature | Description |
|---------|-------------|
| Multi-Device Continuity | Start on desktop, continue on mobile |
| Cross-Session Learning | Opt-in preference learning |
| Time-Shifted Replays | Watch at 2x speed with highlights |
| Agent Simulation Mode | Dry run without real execution |
| Adaptive UI Layout | Auto-arrange agent windows |
| Predictive Agent Suggestions | "You usually check email now" |
| Federated Learning | Privacy-preserving site models |
| Compliance Mode | SOX, HIPAA, GDPR templates |
| Agent Swarm Mode | 100+ agents for large-scale tasks |
| Offline-Resilient Execution | Queue actions when offline |
| Data Lineage Tracking | Where did this data come from? |
| Formal Policy Verification | Prove policies are correct |

---

## Implementation Phases

### Phase 1: Foundation (Current) ✅
- Project scaffold
- Planner MVP
- Agent runtime MVP
- Documentation

### Phase 2: Core Features (Next 90 Days)
- Warm pools
- Binary snapshots
- Chromium build
- Local models

### Phase 3: Intelligence (3-6 Months)
- Self-healing
- Site adapters
- Multi-agent collaboration

### Phase 4: Enterprise (6-12 Months)
- Full policy engine
- Compliance modes
- RBAC
- Agent marketplace

---

*Last Updated: 2026-01-04*
