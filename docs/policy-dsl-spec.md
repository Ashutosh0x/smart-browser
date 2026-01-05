# Policy DSL Specification

## Overview

The AB-OS Policy DSL is a declarative language for defining security policies, capability constraints, and approval workflows. Policies are evaluated by the Policy Authority before issuing capability tokens.

---

## Syntax

Policies are written in YAML with the following structure:

```yaml
policy:
  name: <string>
  version: <semver>
  description: <string>
  
rules:
  - name: <string>
    when: <condition>
    then: <action>
    
defaults:
  allow: <boolean>
  audit: <boolean>
```

---

## Conditions

### Capability Conditions

```yaml
when:
  capability: CAP_PURCHASE
  amount: { gt: 100 }
```

### Domain Conditions

```yaml
when:
  domain: { in: ["amazon.com", "ebay.com"] }
```

### Time Conditions

```yaml
when:
  time:
    after: "09:00"
    before: "17:00"
    timezone: "UTC"
```

### Agent Conditions

```yaml
when:
  agent:
    id: { matches: "agent-prod-*" }
    tier: premium
```

### Composite Conditions

```yaml
when:
  all:
    - capability: CAP_PURCHASE
    - amount: { gt: 50 }
    - domain: { in: ["amazon.com"] }
```

```yaml
when:
  any:
    - capability: CAP_READ
    - capability: CAP_INTERACT
```

---

## Actions

### Allow/Deny

```yaml
then:
  allow: true
  # or
  deny: true
  reason: "Purchase limit exceeded"
```

### Require Approval

```yaml
then:
  require_approval:
    type: human
    timeout: 300s
    approvers: ["admin@company.com"]
```

### Constrain

```yaml
then:
  constrain:
    max_amount: 100
    domains: ["spotify.com"]
    pii_access: false
```

### Audit

```yaml
then:
  audit:
    level: high
    notify: ["security@company.com"]
```

---

## Built-in Capabilities

| Capability | Description |
|-----------|-------------|
| `CAP_READ` | Read DOM, take screenshots |
| `CAP_INTERACT` | Click, type, scroll |
| `CAP_NAVIGATE` | Navigate to URLs |
| `CAP_MUTATE` | Submit forms, modify state |
| `CAP_PURCHASE` | Execute financial transactions |
| `CAP_PII` | Access personal information |
| `CAP_ADMIN` | Administrative operations |

---

## Example Policies

### Purchase Limit Policy

```yaml
policy:
  name: purchase-limit
  version: "1.0.0"
  description: "Limit purchase amounts and require approval for large transactions"

rules:
  - name: block-high-value
    when:
      all:
        - capability: CAP_PURCHASE
        - amount: { gt: 500 }
    then:
      deny: true
      reason: "Purchases over $500 are not allowed"

  - name: approve-medium-value
    when:
      all:
        - capability: CAP_PURCHASE
        - amount: { gt: 100, lte: 500 }
    then:
      require_approval:
        type: human
        timeout: 600s
        message: "Approve purchase of ${amount}?"

  - name: allow-low-value
    when:
      all:
        - capability: CAP_PURCHASE
        - amount: { lte: 100 }
    then:
      allow: true
      audit:
        level: standard

defaults:
  allow: false
  audit: true
```

### Mail Read-Only Policy

```yaml
policy:
  name: mail-read-only
  version: "1.0.0"
  description: "Allow reading email but not sending or deleting"

rules:
  - name: allow-read
    when:
      all:
        - domain: { matches: "*.mail.google.com" }
        - capability: CAP_READ
    then:
      allow: true

  - name: allow-navigate-mail
    when:
      all:
        - domain: { matches: "*.mail.google.com" }
        - capability: CAP_NAVIGATE
    then:
      allow: true

  - name: block-compose
    when:
      all:
        - domain: { matches: "*.mail.google.com" }
        - capability: CAP_MUTATE
        - action: { matches: "*compose*" }
    then:
      deny: true
      reason: "Sending emails is not permitted"

  - name: block-delete
    when:
      all:
        - domain: { matches: "*.mail.google.com" }
        - action: { matches: "*delete*" }
    then:
      deny: true
      reason: "Deleting emails is not permitted"

defaults:
  allow: false
  audit: true
```

### Domain Allowlist Policy

```yaml
policy:
  name: domain-allowlist
  version: "1.0.0"
  description: "Restrict agents to approved domains only"

rules:
  - name: allow-approved-domains
    when:
      domain:
        in:
          - "spotify.com"
          - "*.spotify.com"
          - "google.com"
          - "*.google.com"
    then:
      allow: true

  - name: block-all-others
    when:
      domain: { not_in: [] }  # catch-all
    then:
      deny: true
      reason: "Domain not in allowlist"

defaults:
  allow: false
  audit: true
```

### Working Hours Policy

```yaml
policy:
  name: working-hours
  version: "1.0.0"
  description: "Restrict high-risk operations to business hours"

rules:
  - name: require-approval-after-hours
    when:
      all:
        - capability: { in: [CAP_PURCHASE, CAP_MUTATE] }
        - time:
            any:
              - before: "09:00"
              - after: "18:00"
    then:
      require_approval:
        type: human
        timeout: 1800s
        message: "After-hours action requires approval"

defaults:
  allow: true
  audit: true
```

---

## Grammar (BNF)

See [grammar.bnf](../packages/policy-authority/policy-dsl/grammar.bnf) for formal grammar.

---

## Evaluation Order

1. Explicit `deny` rules (highest priority)
2. `require_approval` rules
3. Explicit `allow` rules with constraints
4. Explicit `allow` rules
5. Default policy

---

## Testing Policies

```bash
# Validate policy syntax
abos policy validate policies/purchase-limit.yaml

# Test policy against scenario
abos policy test policies/purchase-limit.yaml \
  --agent agent-123 \
  --capability CAP_PURCHASE \
  --amount 150

# Expected output:
# Result: require_approval
# Message: "Approve purchase of $150?"
```

---

## References

- [Policy Authority README](../packages/policy-authority/README.md)
- [Capability Service](../packages/policy-authority/capability-service.md)
- [Threat Model](threat-model.md)
