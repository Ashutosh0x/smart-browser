# Replay Engine Design

## Overview

The Replay Engine provides deterministic session replay by combining snapshots, action logs, and network recordings.

---

## Replay Types

| Type | Description | Use Case |
|------|-------------|----------|
| **Visual** | Screenshot-based playback | Demos, reviews |
| **Interactive** | Live DOM reconstruction | Debugging |
| **Verification** | Re-execute with validation | Testing |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Replay Engine                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Snapshot   │  │   Action    │  │   Network   │         │
│  │   Loader    │  │   Replayer  │  │   Mock      │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                   Verification Layer                         │
│            (Compare hashes at each step)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Replay Flow

```
1. Load session metadata
2. Restore initial snapshot
3. For each action in audit log:
   a. Mock network responses if needed
   b. Execute action
   c. Capture new snapshot
   d. Verify hash matches recorded hash
4. Report any divergences
```

---

## Determinism Handling

### Non-Determinism Sources

| Source | Mitigation |
|--------|------------|
| Timestamps | Virtual clock |
| Random numbers | Seeded PRNG |
| Network timing | Mocked responses |
| Animations | Frame synchronization |
| localStorage | State restoration |

### Virtual Clock

```typescript
class VirtualClock {
  private baseTime: number;
  private offset: number = 0;
  
  constructor(startTime: number) {
    this.baseTime = startTime;
  }
  
  now(): number {
    return this.baseTime + this.offset;
  }
  
  advance(ms: number): void {
    this.offset += ms;
  }
}
```

### Network Mocking

```typescript
interface NetworkMock {
  // Match request
  match(request: Request): boolean;
  
  // Return recorded response
  respond(request: Request): Response;
}

class ReplayNetworkLayer {
  private recordings: NetworkRecording[];
  
  intercept(request: Request): Response {
    const recording = this.recordings.find(r => 
      r.url === request.url && 
      r.method === request.method
    );
    
    if (recording) {
      return new Response(recording.body, {
        status: recording.status,
        headers: recording.headers,
      });
    }
    
    throw new UnmockedRequestError(request);
  }
}
```

---

## Verification Mode

```typescript
async function verifyReplay(
  sessionId: string
): Promise<VerificationResult> {
  const session = await loadSession(sessionId);
  const divergences: Divergence[] = [];
  
  // Restore initial state
  await restoreSnapshot(session.initialSnapshot);
  
  for (const action of session.actions) {
    // Execute action
    await executeAction(action);
    
    // Capture current hash
    const currentHash = await captureContentHash();
    
    // Compare with recorded
    if (currentHash !== action.contentHashAfter) {
      divergences.push({
        actionId: action.id,
        expected: action.contentHashAfter,
        actual: currentHash,
      });
    }
  }
  
  return {
    verified: divergences.length === 0,
    divergences,
  };
}
```

---

## API

```typescript
interface ReplayEngine {
  // Load session for replay
  load(sessionId: string): Promise<ReplaySession>;
  
  // Start playback
  play(options?: PlaybackOptions): Promise<void>;
  
  // Pause playback
  pause(): void;
  
  // Step forward
  step(): Promise<void>;
  
  // Jump to specific action
  seek(actionIndex: number): Promise<void>;
  
  // Verify entire session
  verify(): Promise<VerificationResult>;
}

interface PlaybackOptions {
  speed: number;  // 0.5 = half speed, 2 = double speed
  startAt?: number;  // Action index
  stopAt?: number;
  onAction?: (action: AuditEntry) => void;
  onDivergence?: (divergence: Divergence) => void;
}
```

---

## Tolerance Handling

Some divergences are expected:

```typescript
interface ToleranceConfig {
  // Ignore timing differences
  ignoreTiming: boolean;
  
  // Allowed hash differences (for animations)
  hashTolerance: number;
  
  // Skip actions that can't be replayed
  skipUnreplayable: boolean;
}
```

---

## References

- [Observability README](README.md)
- [Snapshot Format](snapshot-format.md)
- [Audit Ledger Spec](audit-ledger-spec.md)
