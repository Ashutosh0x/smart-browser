# AB-OS Executor

## Overview

The Verified Executor mediates between agents and the kernel, ensuring all actions are validated, logged, and reversible.

---

## Responsibilities

1. **Validate capability tokens** before execution
2. **Preview state-changing requests** for human approval
3. **Log all actions** to append-only audit ledger
4. **Coordinate with kernel** for syscall execution

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Verified Executor                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Preflight  │  │    HTTP     │  │   Audit     │         │
│  │  Validator  │  │   Preview   │  │   Logger    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                    Kernel Interface                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Execution Flow

```
1. Agent submits action request with capability token
2. Executor validates token signature and expiration
3. Executor checks token has required capability
4. For state-changing actions, executor shows HTTP preview
5. If approval required, wait for human confirmation
6. Execute action via kernel syscall
7. Log action to audit ledger
8. Return result to agent
```

---

## API

See [executor-spec.md](executor-spec.md) for full specification.

---

## References

- [Executor Specification](executor-spec.md)
- [Audit Interfaces](audit-interfaces.md)
