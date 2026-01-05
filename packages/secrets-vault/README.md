# AB-OS Secrets Vault

## Overview

The Secrets Vault package provides secure credential management through HashiCorp Vault integration.

---

## Features

- **Just-in-Time Secrets** - Credentials retrieved only at point of use
- **Never Logged** - Secrets never appear in logs or snapshots
- **Rotation Ready** - Dynamic secret fetching supports rotation
- **Vault Integration** - Native HashiCorp Vault support

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Agent / Executor                        │
│                            │                                 │
│                   Secret Request                             │
│                            ▼                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │               Secrets Vault Client                   │    │
│  │  - Request secret for credential ID                 │    │
│  │  - Validate agent capability token                  │    │
│  │  - Return secret to memory only                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                            │                                 │
│                     Vault Token                              │
│                            ▼                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │               HashiCorp Vault                        │    │
│  │  - KV Secrets Engine                                │    │
│  │  - Dynamic Credentials                              │    │
│  │  - Transit Engine (encryption)                      │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Usage

```typescript
import { SecretsClient } from '@abos/secrets-vault';

const secrets = new SecretsClient({
  vaultAddr: process.env.VAULT_ADDR,
  authMethod: 'kubernetes',
});

// Retrieve secret (memory only)
const credential = await secrets.get({
  path: 'secret/data/spotify',
  key: 'api_key',
  capabilityToken: agentToken,
});

// Use credential
await executeWithCredential(credential);

// Credential automatically wiped from memory after use
```

---

## Security Properties

1. **No Disk Storage** - Secrets never written to disk
2. **No Logging** - Automatic scrubbing from all log outputs
3. **No Snapshots** - Excluded from DOM snapshots
4. **Short TTL** - Vault leases with automatic renewal
5. **Audit Trail** - All access logged in Vault audit log

---

## References

- [Vault Integration Guide](vault-integration.md)
- [Threat Model](../../docs/threat-model.md)
