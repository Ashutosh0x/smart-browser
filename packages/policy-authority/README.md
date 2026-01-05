# AB-OS Policy Authority

## Overview

The Policy Authority is the security core of AB-OS. It evaluates policies, issues capability tokens, and integrates with the secrets vault for credential management.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Policy Authority                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Policy DSL  │  │ Capability  │  │ Secrets     │         │
│  │ Engine      │  │ Token Issuer│  │ Vault       │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                    HSM Integration                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Features

- **Policy DSL** - Declarative policy language for access control
- **Capability Tokens** - Short-lived JWTs for privileged actions
- **Secrets Vault** - HashiCorp Vault integration for credentials
- **HSM Support** - Hardware security for signing keys
- **Audit Trail** - All decisions logged immutably

---

## Policy DSL

See [policy-dsl/grammar.bnf](policy-dsl/grammar.bnf) for the grammar.

Example policies:
- [purchase_limit.yaml](policy-dsl/policies/purchase_limit.yaml)
- [mail_read_only.yaml](policy-dsl/policies/mail_read_only.yaml)

---

## Capability Token Flow

```
1. Agent requests capability token
2. Policy Authority evaluates policies
3. If approved, issues signed JWT
4. Token includes:
   - Agent ID
   - Allowed capabilities
   - Constraints (domains, amounts)
   - Expiration (short TTL)
5. Agent presents token to Executor
6. Executor verifies signature and expiration
7. Action executed if valid
```

---

## API

### Request Capability

```typescript
interface CapabilityRequest {
  agentId: string;
  planId: string;
  capabilities: Capability[];
  constraints?: {
    domains?: string[];
    maxAmount?: number;
  };
}

interface CapabilityResponse {
  token: string;  // JWT
  expiresAt: string;
  grantedCapabilities: Capability[];
  deniedCapabilities?: {
    capability: Capability;
    reason: string;
  }[];
}
```

---

## References

- [Capability Service](capability-service.md)
- [Policy DSL Grammar](policy-dsl/grammar.bnf)
- [Example Policies](policy-dsl/policies/)
