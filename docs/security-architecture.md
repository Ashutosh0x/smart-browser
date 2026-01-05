# AB-OS Security Architecture

> Enterprise-grade, phishing-resistant, safe for automation

---

## Security Layers

```
[1] Authentication & Identity (Passkeys, MFA, Biometric)
[2] Credential & Secrets (Vault, Ephemeral, Isolated)
[3] Runtime & Kernel (Sandbox, Signed, Attestation)
[4] Network & Data (Egress, Encryption, PII)
[5] Policy & Governance (RBAC, Audit, Compliance)
[6] Detection & Response (Anomaly, SIEM, Forensics)
[7] Supply Chain (Signed Agents, SBOM)
[8] UX & Consent (Secure Approval, Preview)
```

---

## 1. Authentication & Identity

### Passkeys (FIDO2 / WebAuthn)

**Purpose**: Phishing-resistant primary authentication

**Implementation**:
- WebAuthn for profile sign-in
- Store credential handles in Secrets Vault
- Require local user verification (biometric/PIN)

**UX**:
- "Use passkey to approve sensitive actions" toggle
- Support device-bound and roaming passkeys

### Hardware Security Key (CTAP2 / YubiKey)

**Purpose**: Strong MFA for high-assurance users

**Implementation**:
- CTAP attestation in approval flows
- Store attestation metadata in audit ledger

**UX**:
- "Approve with Security Key" for purchases and admin workflows

### Biometric + Secure Enclave

**Purpose**: Local user verification without exposing secrets

**Implementation**:
- Platform Secure Enclave / TPM gates passkey usage
- Sign approval event with enclave key

**UX**:
- Touch/Face confirm in modal
- Show which agent requested approval

### Passkey-Protected Capability Tokens

**Purpose**: Sensitive capabilities require passkey confirmation

**Implementation**:
```typescript
// Policy Authority flow
if (capability === 'CAP_PURCHASE') {
  const assertion = await webauthn.verify(challenge);
  if (!assertion.valid) throw new Error('Passkey required');
  return issueToken(agent_id, capability);
}
```

**UX**:
- Preflight shows HTTP payload + "Confirm with passkey"

### Recovery & Backup

**Purpose**: Secure passkey recovery

**Implementation**:
- Encrypted backup to user vault or enterprise key escrow (HSM)
- Secondary approval required for restore

**UX**:
- Recovery flows show audit trail
- Admin approval for enterprise

---

## 2. Credential & Secrets Management

### Ephemeral Credential Injection

**Purpose**: Prevent long-term credential leakage

**Implementation**:
- Vault issues short-lived tokens (TTL: 5-15 min)
- Injected at runtime, scrubbed from logs/artifacts

**UX**:
- "Use vault credential for this agent" with visible TTL

### Per-Agent Credential Isolation

**Purpose**: No cross-agent credential reuse

**Implementation**:
```typescript
// Vault returns scoped credential
{
  credential_id: "cred_abc",
  scoped_to: {
    agent_id: "agent_123",
    site_domain: "bank.com",
    page_id: "page_456"
  },
  expires_at: "2026-01-05T01:00:00Z"
}
```

### Rotation & Automatic Revocation

**Purpose**: Minimize exposure window

**Implementation**:
- Vault auto-rotates tokens
- Policy Authority can revoke immediately

**UX**:
- Admin console with one-click revoke

---

## 3. Runtime & Kernel Protections

### Secure Boot / Signed Kernel

**Purpose**: Ensure kernel integrity

**Implementation**:
- Sign kernel binaries with release key
- Verify at startup (remote attestation optional)

**UX**:
- Admin view shows verification status

### Process Sandboxing

**Purpose**: Limit renderer/agent process capabilities

**Implementation**:
- Seccomp profiles (syscall filtering)
- Capabilities removed
- cgroups for memory/CPU limits

**UX**:
- Transparent; violations reported to telemetry

### Secure Approval Sheet (Anti-Spoofing)

**Purpose**: Prevent phishing overlays

**Implementation**:
- Compositor-level secure UI (not DOM)
- Unique visual chrome impossible to mimic

**UX**:
- Distinct approval dialog for passkeys
- Sites/agents cannot fake this UI

### Signed Action Execution

**Purpose**: Non-repudiable actions

**Implementation**:
```typescript
interface SignedAction {
  action: Action;
  agent_signature: string;  // Agent key
  user_signature?: string;  // Passkey (if required)
  timestamp: string;
  ledger_hash: string;      // HSM-signed
}
```

---

## 4. Network & Data Controls

### Domain Allowlist / Denylist

**Purpose**: Prevent data exfiltration

**Implementation**:
- Kernel-level egress firewall
- Policy-enforced domain lists
- Per-agent allowances

### Content Security Policy

**Purpose**: Reduce third-party script risk

**Implementation**:
- Inject CSP headers at kernel level
- Subresource Integrity for critical resources

### Cookie Partitioning

**Purpose**: No cookie leakage between agents

**Implementation**:
- True partitioned storage per PageID
- SameSite & SameParty enforcement

### PII Redaction

**Purpose**: Protect sensitive data in artifacts

**Implementation**:
- Automatic PII detection
- Redaction before storing screenshots/DOM
- Policy-driven exceptions

**UX**:
- Preview redacted artifacts
- "Show unredacted" requires approval

### Encryption

- mTLS for all internal services
- AES-256 for artifact storage
- Keys in HSM/KMS

---

## 5. Policy & Governance

### Policy DSL Extension

**Purpose**: Express complex auth requirements

```yaml
policy:
  name: high-value-purchase
  rules:
    - when:
        capability: CAP_PURCHASE
        amount: { gt: 100 }
      then:
        requires_auth: passkey
        requires_approval: manager
```

### RBAC & SCIM Integration

**Purpose**: Enterprise user/role management

**Implementation**:
- SSO integration (SAML, OIDC)
- SCIM for user provisioning
- Scope-based RBAC for policies

### Delegated Approvals

**Purpose**: Business workflow support

**Implementation**:
- Approval tickets with preflight payloads
- Escalation rules in policy engine
- Manager approval workflows

### Explainability Metadata

**Purpose**: Why actions were taken

**Implementation**:
```typescript
interface ActionExplanation {
  action_id: string;
  llm_rationale: string;      // Planner reasoning
  policy_decision: string;     // Policy engine annotation
  confidence: number;
  risk_level: string;
}
```

---

## 6. Detection & Response

### Behavioral Anomaly Detection

**Purpose**: Detect compromised/abnormal agents

**Implementation**:
- ML anomaly scoring on action patterns
- Access timing analysis
- Domain pattern analysis
- Auto-pause suspicious agents

### Real-Time Telemetry

**Purpose**: Fast detection & triage

**Implementation**:
- Stream events to SOC
- SIEM integration (Splunk, Datadog)
- Alert rules for critical actions

### Forensic Snapshotting

**Purpose**: Preserve evidence on suspicion

**Implementation**:
- Immediately freeze agent
- Create full signed snapshot
- Offline analysis capability

### Rate Limiting

**Purpose**: Prevent abuse

**Implementation**:
- Per-agent, per-domain quotas
- Policy hooks for custom limits

---

## 7. Supply Chain Protection

### Signed Agent Marketplace

**Purpose**: No malicious agent code

**Implementation**:
- Agents must be signed and vetted
- Defined scope/capability limits
- Admin blacklist capability

### SBOM & SCA

**Purpose**: Track dependencies and vulns

**Implementation**:
- Generate SBOM for all releases
- Block builds with critical CVEs

### Reproducible Builds

**Purpose**: Prevent binary tampering

**Implementation**:
- Reproducible build pipeline
- Signed manifests
- Public transparency logs (optional)

---

## 8. UX & Consent Safeguards

### Secure Approval UX

- Kernel-level approval sheet (distinct chrome)
- Passkey prompt integrated
- Cannot be spoofed by web content

### Policy Preflight Preview

- HTTP payload preview (masked sensitive data)
- DOM snapshot
- Cost estimate for purchases

### Consent History

- Timeline with signatures
- Who approved what, when
- Exportable audit trail

### Privacy Mode

- Local-first operation
- Disable external LLMs
- On-prem only mode

---

## Implementation Phases

### Phase 1: Essential (0-3 months)
- [ ] Passkeys + WebAuthn sign-in
- [ ] Passkey-protected CAP_PURCHASE
- [ ] Ephemeral credential injection
- [ ] Per-agent credential isolation
- [ ] Secure approval sheet UI
- [ ] Basic signed audit ledger

### Phase 2: Enterprise (3-6 months)
- [ ] Hardware key support
- [ ] Secure Enclave binding
- [ ] Domain allowlist/egress controls
- [ ] Cookie partitioning
- [ ] Policy DSL `requires_auth` extension
- [ ] RBAC + SCIM integration
- [ ] PII redaction for artifacts

### Phase 3: Advanced (6-12 months)
- [ ] Behavioral anomaly detection
- [ ] Auto-pause suspicious agents
- [ ] Signed agent marketplace
- [ ] SBOM supply chain
- [ ] Forensic snapshotting
- [ ] HSM-signed ledger
- [ ] Enterprise key escrow + recovery

---

## Integration Map

```
                     ┌─────────────────┐
                     │   WebAuthn /    │
                     │   Passkeys      │
                     └────────┬────────┘
                              │
                              ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  Secrets Vault  │◄──│ Policy Authority │──►│  Audit Ledger   │
│ (Credentials)   │   │ (Token Issuer)   │   │  (HSM-Signed)   │
└────────┬────────┘   └────────┬────────┘   └─────────────────┘
         │                     │
         │                     │
         ▼                     ▼
┌─────────────────┐   ┌─────────────────┐
│  Kernel        │◄──│  Agent Runtime   │
│ (Secure Inject) │   │  (Execution)     │
└─────────────────┘   └─────────────────┘
```

---

## References

- [Threat Model](threat-model.md)
- [Policy DSL Spec](policy-dsl-spec.md)
- [Capability Service](../packages/policy-authority/capability-service.md)
- [Vault Integration](../packages/secrets-vault/vault-integration.md)
