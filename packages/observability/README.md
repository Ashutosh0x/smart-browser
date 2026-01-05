# AB-OS Observability

## Overview

The Observability package provides logging, snapshotting, audit ledger, and deterministic replay capabilities.

---

## Components

| Component | Purpose |
|-----------|---------|
| Snapshot Store | DOM state capture |
| Audit Ledger | Append-only action log |
| Replay Engine | Deterministic session replay |
| Metrics | Prometheus metrics export |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Observability                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Snapshot   │  │   Audit     │  │   Replay    │         │
│  │   Store     │  │   Ledger    │  │   Engine    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                    Storage Backend                           │
│            (S3 / MinIO / Local Filesystem)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Usage

```typescript
import { Observability } from '@abos/observability';

const obs = new Observability({
  storage: { type: 's3', bucket: 'abos-snapshots' },
  audit: { backend: 'postgres' },
});

// Store snapshot
await obs.snapshots.store({
  sessionId: 'session-123',
  agentId: 'agent-456',
  data: domSnapshot,
});

// Log audit entry
await obs.audit.append({
  action: 'click',
  agentId: 'agent-456',
  target: 'button#submit',
  tokenJti: 'token-789',
});

// Replay session
await obs.replay.start({
  sessionId: 'session-123',
  speed: 1.0,
});
```

---

## References

- [Snapshot Format](snapshot-format.md)
- [Audit Ledger Spec](audit-ledger-spec.md)
- [Replay Engine Design](replay-engine-design.md)
