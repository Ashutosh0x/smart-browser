# Audit Ledger Specification

## Overview

The Audit Ledger is an append-only, signed log of all agent actions. It provides non-repudiation and enables forensic analysis.

---

## Properties

1. **Append-Only** - Entries cannot be modified or deleted
2. **Signed** - Each entry signed with HSM key
3. **Chained** - Hash chain for tamper detection
4. **Replicated** - Multiple storage backends

---

## Entry Structure

```typescript
interface AuditEntry {
  // Entry identification
  id: string;
  sequence: number;
  timestamp: string;  // ISO 8601
  
  // Agent identification
  agentId: string;
  sessionId: string;
  planId: string;
  
  // Action details
  action: ActionType;
  target: string;
  params?: Record<string, any>;
  
  // Authorization
  capabilityTokenJti: string;
  capabilities: Capability[];
  
  // State
  contentHashBefore: string;
  contentHashAfter: string;
  
  // Result
  success: boolean;
  error?: string;
  duration_ms: number;
  
  // Integrity
  prevHash: string;
  signature: string;
}
```

---

## JSON Example

```json
{
  "id": "entry-550e8400-e29b",
  "sequence": 12345,
  "timestamp": "2026-01-04T21:15:30.000Z",
  "agentId": "agent-123",
  "sessionId": "session-456",
  "planId": "plan-789",
  "action": "click",
  "target": "button#play",
  "capabilityTokenJti": "token-abc",
  "capabilities": ["CAP_INTERACT"],
  "contentHashBefore": "sha256:before...",
  "contentHashAfter": "sha256:after...",
  "success": true,
  "duration_ms": 150,
  "prevHash": "sha256:previous-entry...",
  "signature": "RSA-SHA256:..."
}
```

---

## Hash Chain

Each entry includes the hash of the previous entry:

```typescript
function computeEntryHash(entry: AuditEntry): string {
  const data = {
    id: entry.id,
    sequence: entry.sequence,
    timestamp: entry.timestamp,
    agentId: entry.agentId,
    action: entry.action,
    target: entry.target,
    success: entry.success,
    prevHash: entry.prevHash,
  };
  
  return crypto.createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
}
```

---

## Signing

Entries are signed using HSM:

```typescript
async function signEntry(entry: AuditEntry): Promise<string> {
  const hash = computeEntryHash(entry);
  return hsm.sign(hash, 'audit-signing-key');
}

async function verifyEntry(entry: AuditEntry): Promise<boolean> {
  const hash = computeEntryHash(entry);
  return hsm.verify(hash, entry.signature, 'audit-signing-key');
}
```

---

## Storage Backend

```typescript
interface AuditStorage {
  // Append new entry
  append(entry: AuditEntry): Promise<void>;
  
  // Query entries
  query(filter: AuditFilter): Promise<AuditEntry[]>;
  
  // Verify chain integrity
  verifyChain(startSeq: number, endSeq: number): Promise<boolean>;
  
  // Export for compliance
  export(filter: AuditFilter): Promise<ExportResult>;
}

interface AuditFilter {
  agentId?: string;
  sessionId?: string;
  planId?: string;
  action?: ActionType;
  startTime?: string;
  endTime?: string;
  limit?: number;
}
```

---

## Retention

```yaml
retention:
  # Hot storage (fast query)
  hot:
    duration: 30d
    backend: postgres
  
  # Warm storage (archived)
  warm:
    duration: 1y
    backend: s3
  
  # Cold storage (compliance)
  cold:
    duration: 7y
    backend: glacier
```

---

## Compliance Export

```typescript
interface ExportResult {
  format: 'json' | 'csv';
  entries: AuditEntry[];
  metadata: {
    exportedAt: string;
    filter: AuditFilter;
    count: number;
    chainValid: boolean;
  };
  signature: string;  // Export signed by HSM
}
```

---

## References

- [Observability README](README.md)
- [Threat Model](../../docs/threat-model.md)
- [Key Rotation Runbook](../../docs/runbooks/key-rotation.md)
