# Executor Specification

## Overview

This document specifies the Verified Executor's behavior, including preflight validation, HTTP preview, and audit logging.

---

## Preflight Validation

Before executing any action, the executor performs:

### 1. Token Validation

```typescript
async function validateToken(token: string): Promise<TokenPayload> {
  // Verify signature using public key
  const payload = jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    issuer: 'abos-policy-authority',
    audience: 'abos-executor',
  });
  
  // Check not revoked
  if (await isRevoked(payload.jti)) {
    throw new TokenRevokedError();
  }
  
  return payload;
}
```

### 2. Capability Check

```typescript
function hasRequiredCapability(
  token: TokenPayload,
  action: Action
): boolean {
  const required = ACTION_CAPABILITY_MAP[action.type];
  return token.caps.includes(required);
}
```

### 3. Constraint Validation

```typescript
function validateConstraints(
  token: TokenPayload,
  action: Action
): ValidationResult {
  const constraints = token.constraints;
  
  // Domain check
  if (constraints.domains) {
    if (!matchesDomain(action.target, constraints.domains)) {
      return { valid: false, reason: 'Domain not allowed' };
    }
  }
  
  // Amount check
  if (constraints.max_purchase !== undefined) {
    if (action.amount > constraints.max_purchase) {
      return { valid: false, reason: 'Amount exceeds limit' };
    }
  }
  
  return { valid: true };
}
```

---

## HTTP Preview

For state-changing actions (forms, purchases), show a preview:

### Preview Fields

```typescript
interface HTTPPreview {
  method: 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers: Record<string, string>;
  body: {
    masked: Record<string, string>;  // Sensitive fields masked
    preview: Record<string, string>; // Safe to show
  };
  estimatedEffect: string;
}
```

### Masking Rules

| Field Type | Masking |
|------------|---------|
| Passwords | `********` |
| Credit Cards | `****-****-****-1234` |
| SSN | `***-**-1234` |
| API Keys | `sk_...xxxx` |
| Emails | `j***@example.com` |

### Approval Flow

```typescript
async function executeWithApproval(
  action: MutatingAction,
  token: TokenPayload
): Promise<ActionResult> {
  // Generate preview
  const preview = await generatePreview(action);
  
  // Request approval
  const approval = await requestHumanApproval({
    agentId: token.sub,
    preview,
    expires: Date.now() + 600_000, // 10 minutes
  });
  
  if (!approval.approved) {
    return { success: false, reason: 'User denied' };
  }
  
  // Execute
  return executeAction(action);
}
```

---

## Execution

### Action Types

| Action | Mutating | Requires Preview |
|--------|----------|------------------|
| `navigate` | No | No |
| `click` | Maybe | If form submit |
| `type` | Yes | If in password field |
| `screenshot` | No | No |
| `snapshot` | No | No |
| `submit` | Yes | Always |
| `purchase` | Yes | Always |

### Kernel Call

```typescript
async function executeViaKernel(
  action: Action,
  token: TokenPayload
): Promise<KernelResult> {
  // Create kernel request
  const request = buildKernelRequest(action, token);
  
  // Call kernel
  const result = await kernel.execute(request);
  
  // Log to audit
  await auditLog.append({
    timestamp: Date.now(),
    agentId: token.sub,
    action: action.type,
    target: action.target,
    tokenJti: token.jti,
    success: result.success,
    contentHashBefore: result.hashBefore,
    contentHashAfter: result.hashAfter,
  });
  
  return result;
}
```

---

## Error Handling

### Error Types

```typescript
type ExecutorError =
  | { code: 'TOKEN_INVALID'; message: string }
  | { code: 'TOKEN_EXPIRED'; message: string }
  | { code: 'TOKEN_REVOKED'; message: string }
  | { code: 'CAPABILITY_MISSING'; required: Capability }
  | { code: 'CONSTRAINT_VIOLATED'; constraint: string }
  | { code: 'APPROVAL_DENIED'; message: string }
  | { code: 'APPROVAL_TIMEOUT'; message: string }
  | { code: 'KERNEL_ERROR'; message: string }
  | { code: 'ELEMENT_NOT_FOUND'; selector: string };
```

### Retry Policy

```typescript
const retryPolicy = {
  maxRetries: 3,
  retryableErrors: ['KERNEL_ERROR', 'ELEMENT_NOT_FOUND'],
  backoff: {
    initial: 1000,
    multiplier: 2,
    max: 10000,
  },
};
```

---

## Metrics

```typescript
// Prometheus metrics
const executorRequestsTotal = new Counter({
  name: 'abos_executor_requests_total',
  help: 'Total executor requests',
  labelNames: ['action', 'status'],
});

const executorDuration = new Histogram({
  name: 'abos_executor_duration_seconds',
  help: 'Executor request duration',
  labelNames: ['action'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

const approvalPendingGauge = new Gauge({
  name: 'abos_executor_approvals_pending',
  help: 'Pending human approvals',
});
```

---

## References

- [Executor README](README.md)
- [Audit Interfaces](audit-interfaces.md)
- [Kernel ABI](../kernel/abi/kernel_syscall.md)
