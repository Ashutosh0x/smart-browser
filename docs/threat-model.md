# AB-OS Threat Model

## Overview

This document describes the security threat model for AB-OS, including attack surfaces, threat actors, mitigations, and security controls.

---

## Threat Actors

| Actor | Capability | Motivation |
|-------|-----------|------------|
| **External Attacker** | Network access, public endpoints | Data theft, service disruption |
| **Malicious User** | Authenticated access | Privilege escalation, abuse |
| **Compromised Agent** | Agent credentials | Unauthorized actions |
| **Insider Threat** | System access | Data exfiltration |
| **Supply Chain** | Dependency control | Backdoor injection |

---

## Attack Surfaces

### 1. IDE Interface

**Threats:**
- Unauthorized access to dashboard
- Session hijacking
- Cross-site scripting (XSS)

**Mitigations:**
- Strong authentication (OAuth2/OIDC)
- Secure session management
- Content Security Policy (CSP)
- Input validation and output encoding

### 2. Planner (LLM)

**Threats:**
- Prompt injection attacks
- Plan manipulation
- Model hallucination exploitation

**Mitigations:**
- Structured output validation
- Plan schema enforcement
- Human approval for critical plans
- Rate limiting

### 3. Policy Authority

**Threats:**
- Capability token forgery
- Policy bypass
- Privilege escalation

**Mitigations:**
- Cryptographic token signing (HSM)
- Short token TTL (< 5 minutes)
- Policy immutability audit
- Capability minimization

### 4. Agent Runtime

**Threats:**
- Agent impersonation
- Memory corruption
- Resource exhaustion

**Mitigations:**
- Agent identity keys (cryptographic)
- Process isolation (containers)
- Resource quotas
- Memory bounds checking

### 5. Executor

**Threats:**
- Unauthorized action execution
- Token replay attacks
- Audit log tampering

**Mitigations:**
- Token verification before execution
- Nonce-based replay prevention
- Append-only signed audit ledger
- HSM-backed signatures

### 6. Kernel (Browser)

**Threats:**
- Browser exploits
- DOM manipulation
- Network interception

**Mitigations:**
- Chromium sandbox
- Regular security updates
- Network egress control
- Process isolation

### 7. Observability

**Threats:**
- Audit log tampering
- Snapshot data leakage
- Replay attacks

**Mitigations:**
- Signed audit entries
- Encrypted storage
- Access control on snapshots
- Tamper detection

---

## Security Controls Matrix

| Control | Component | Implementation |
|---------|-----------|----------------|
| **Authentication** | IDE | OAuth2/OIDC |
| **Authorization** | All | Capability tokens |
| **Encryption (Transit)** | All | TLS 1.3, mTLS internal |
| **Encryption (Rest)** | Observability | AES-256-GCM |
| **Signing** | Audit, Tokens | HSM (RSA-4096/Ed25519) |
| **Isolation** | Agents, Kernel | Containers, seccomp |
| **Rate Limiting** | IDE, Planner | Token bucket |
| **Audit Logging** | All | Append-only ledger |

---

## Capability Token Security

### Token Structure
```json
{
  "header": {
    "alg": "RS256",
    "typ": "JWT",
    "kid": "key-2026-01"
  },
  "payload": {
    "iss": "policy-authority",
    "sub": "agent-123",
    "aud": "executor",
    "iat": 1704389400,
    "exp": 1704389700,
    "jti": "unique-nonce-uuid",
    "caps": ["CAP_READ", "CAP_INTERACT"],
    "constraints": {
      "domains": ["spotify.com"],
      "max_purchase": 0,
      "pii_access": false
    }
  },
  "signature": "..."
}
```

### Security Properties
- **Short TTL**: 5 minutes maximum
- **Single Use**: Nonce prevents replay
- **Minimal Scope**: Least-privilege capabilities
- **Signed**: HSM-backed signature

---

## Secrets Management

### Principles
1. **Never log secrets** - Scrubbing at all log points
2. **Never store in snapshots** - Memory-only at use
3. **Just-in-time injection** - Secrets retrieved at execution
4. **Rotation ready** - Dynamic secret fetching

### Vault Integration
```
┌─────────────┐    Request    ┌─────────────┐
│   Agent     │──────────────▶│   Policy    │
└─────────────┘               │  Authority  │
                              └──────┬──────┘
                                     │
                              Vault Token
                                     ▼
                              ┌─────────────┐
                              │ HashiCorp   │
                              │   Vault     │
                              └──────┬──────┘
                                     │
                                  Secret
                                     ▼
                              ┌─────────────┐
                              │  Executor   │
                              │ (memory)    │
                              └─────────────┘
```

---

## Audit Ledger Security

### Properties
- **Append-only**: No modifications or deletions
- **Signed entries**: Each entry signed with HSM
- **Chained hashes**: Tamper detection via hash chain
- **Replicated**: Multiple storage backends

### Entry Format
```json
{
  "id": "entry-uuid",
  "timestamp": "2026-01-04T21:15:00Z",
  "agent_id": "agent-123",
  "action": "click",
  "target": "button#submit",
  "capability_token_jti": "token-nonce",
  "prev_hash": "sha256:abc...",
  "signature": "..."
}
```

---

## Network Security

### Egress Control
```yaml
# Default deny, explicit allow
egress_policy:
  default: deny
  allowed_domains:
    - "*.spotify.com"
    - "*.google.com"
    - "api.openai.com"
  blocked_categories:
    - malware
    - adult
    - gambling
```

### Internal mTLS
- All service-to-service communication over mTLS
- Certificate rotation via cert-manager
- Service mesh optional (Istio/Linkerd)

---

## Incident Response

### Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| **P1** | Active exploitation | 15 minutes |
| **P2** | Vulnerability discovered | 4 hours |
| **P3** | Security improvement | 24 hours |
| **P4** | Hardening task | 1 week |

### Response Procedures
1. **Detect** - Alert from monitoring
2. **Isolate** - Revoke affected tokens
3. **Investigate** - Audit log analysis
4. **Remediate** - Patch and deploy
5. **Report** - Document findings

---

## Compliance

### Frameworks
- SOC 2 Type II (in progress)
- GDPR (data minimization)
- PCI-DSS (payment handling)

### Controls Mapping
| Requirement | AB-OS Control |
|------------|---------------|
| Access control | Capability tokens |
| Encryption | TLS, AES-256 |
| Audit logging | Signed ledger |
| Data minimization | Retention policies |

---

## Security Roadmap

- [ ] Third-party penetration test
- [ ] Bug bounty program
- [ ] SOC 2 certification
- [ ] FIPS 140-2 HSM integration
- [ ] Zero-trust network architecture

---

## References

- [Architecture](architecture.md)
- [Policy DSL Spec](policy-dsl-spec.md)
- [Runbooks](runbooks/)
