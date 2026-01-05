# Capability Token Service

## Overview

The Capability Token Service issues, validates, and revokes short-lived JWTs for privileged agent actions.

---

## Token Structure

```json
{
  "header": {
    "alg": "RS256",
    "typ": "JWT",
    "kid": "signing-key-2026-01"
  },
  "payload": {
    "iss": "abos-policy-authority",
    "sub": "agent-12345",
    "aud": "abos-executor",
    "iat": 1704389400,
    "exp": 1704389700,
    "jti": "unique-nonce-uuid",
    "plan_id": "plan-uuid",
    "caps": ["CAP_READ", "CAP_INTERACT", "CAP_NAVIGATE"],
    "constraints": {
      "domains": ["spotify.com", "*.spotify.com"],
      "max_purchase": 0,
      "pii_access": false
    }
  },
  "signature": "..."
}
```

---

## Token Properties

| Property | Description | Value |
|----------|-------------|-------|
| `iss` | Token issuer | `abos-policy-authority` |
| `sub` | Agent ID | Agent's unique identifier |
| `aud` | Token audience | `abos-executor` |
| `iat` | Issued at | Unix timestamp |
| `exp` | Expiration | iat + TTL (max 5 min) |
| `jti` | Token ID (nonce) | UUID for replay prevention |
| `caps` | Capabilities | Array of granted capabilities |
| `constraints` | Limits | Domain/amount/PII restrictions |

---

## API

### Issue Token

```typescript
async function issueToken(request: CapabilityRequest): Promise<Token> {
  // 1. Validate agent exists
  const agent = await validateAgent(request.agentId);
  
  // 2. Evaluate policies
  const decision = await evaluatePolicies(request);
  
  if (decision.denied) {
    throw new PolicyDeniedError(decision.reason);
  }
  
  // 3. Apply constraints
  const constraints = mergeConstraints(
    request.constraints,
    decision.requiredConstraints
  );
  
  // 4. Generate token
  const token = await signToken({
    sub: agent.id,
    caps: decision.grantedCapabilities,
    constraints,
    exp: now() + TOKEN_TTL,
    jti: uuid(),
  });
  
  // 5. Log issuance
  await auditLog.append({
    action: 'token_issued',
    agentId: agent.id,
    capabilities: decision.grantedCapabilities,
    jti: token.jti,
  });
  
  return token;
}
```

### Verify Token

```typescript
async function verifyToken(token: string): Promise<TokenPayload> {
  // 1. Verify signature
  const payload = await verifySignature(token);
  
  // 2. Check expiration
  if (payload.exp < now()) {
    throw new TokenExpiredError();
  }
  
  // 3. Check if revoked
  if (await isRevoked(payload.jti)) {
    throw new TokenRevokedError();
  }
  
  // 4. Check audience
  if (payload.aud !== 'abos-executor') {
    throw new InvalidAudienceError();
  }
  
  return payload;
}
```

### Revoke Token

```typescript
async function revokeToken(jti: string, reason: string): Promise<void> {
  await revokedTokens.add(jti, {
    revokedAt: now(),
    reason,
  });
  
  await auditLog.append({
    action: 'token_revoked',
    jti,
    reason,
  });
}
```

---

## HSM Integration

For production, tokens are signed using an HSM:

```typescript
const signer = new HSMSigner({
  provider: 'aws-cloudhsm',  // or 'pkcs11'
  keyLabel: 'abos-signing-key',
  keyType: 'RSA_4096',
});

async function signToken(payload: TokenPayload): Promise<string> {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: signer.getKeyId(),
  };
  
  const unsigned = `${b64(header)}.${b64(payload)}`;
  const signature = await signer.sign(unsigned);
  
  return `${unsigned}.${b64(signature)}`;
}
```

---

## Security Considerations

1. **Short TTL**: Tokens expire in 5 minutes maximum
2. **Single Use**: `jti` nonce prevents replay attacks
3. **Minimal Scope**: Only requested capabilities granted
4. **Signed**: HSM-backed signature prevents forgery
5. **Audited**: All operations logged to immutable ledger

---

## References

- [Policy Authority README](README.md)
- [Policy DSL Spec](../../docs/policy-dsl-spec.md)
- [Threat Model](../../docs/threat-model.md)
