# HashiCorp Vault Integration

## Overview

AB-OS integrates with HashiCorp Vault for secure credential and secret management.

---

## Supported Features

| Feature | Purpose |
|---------|---------|
| KV Secrets Engine | Store static secrets |
| Transit Engine | Encrypt/decrypt data |
| PKI Engine | Issue certificates |
| Dynamic Credentials | Database/cloud credentials |

---

## Authentication Methods

### Kubernetes Auth (Recommended)

```yaml
# Vault configuration
auth:
  method: kubernetes
  config:
    role: abos-agent
    jwt_path: /var/run/secrets/kubernetes.io/serviceaccount/token
```

### AppRole Auth

```yaml
auth:
  method: approle
  config:
    role_id: ${VAULT_ROLE_ID}
    secret_id: ${VAULT_SECRET_ID}
```

### Token Auth (Development)

```yaml
auth:
  method: token
  config:
    token: ${VAULT_TOKEN}
```

---

## Vault Configuration

### Enable KV Secrets

```bash
# Enable KV v2
vault secrets enable -path=secret kv-v2

# Create policy for AB-OS
vault policy write abos-policy - <<EOF
path "secret/data/abos/*" {
  capabilities = ["read"]
}

path "secret/metadata/abos/*" {
  capabilities = ["list", "read"]
}
EOF
```

### Configure Kubernetes Auth

```bash
# Enable kubernetes auth
vault auth enable kubernetes

# Configure auth
vault write auth/kubernetes/config \
  kubernetes_host="https://$KUBERNETES_HOST:443" \
  kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt

# Create role
vault write auth/kubernetes/role/abos-agent \
  bound_service_account_names=abos-service \
  bound_service_account_namespaces=abos \
  policies=abos-policy \
  ttl=1h
```

---

## Storing Secrets

```bash
# Store API key
vault kv put secret/abos/spotify \
  api_key="your-api-key" \
  client_id="client-id" \
  client_secret="client-secret"

# Store with metadata
vault kv put secret/abos/credentials/google \
  username="user@gmail.com" \
  password="password" \
  -metadata=service=google \
  -metadata=owner=abos
```

---

## Client Configuration

```typescript
interface VaultConfig {
  // Vault server address
  address: string;
  
  // Authentication method
  auth: {
    method: 'kubernetes' | 'approle' | 'token';
    config: Record<string, string>;
  };
  
  // TLS configuration
  tls?: {
    caCert?: string;
    clientCert?: string;
    clientKey?: string;
  };
  
  // Request settings
  timeout?: number;
  retries?: number;
}
```

---

## Dynamic Credentials

### Database Credentials

```bash
# Enable database secrets
vault secrets enable database

# Configure PostgreSQL
vault write database/config/abos-db \
  plugin_name=postgresql-database-plugin \
  allowed_roles="abos-readonly" \
  connection_url="postgresql://{{username}}:{{password}}@db.internal:5432/abos"

# Create role
vault write database/roles/abos-readonly \
  db_name=abos-db \
  creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
  default_ttl="1h" \
  max_ttl="24h"
```

---

## Transit Encryption

```typescript
// Encrypt sensitive data before storage
const encrypted = await vault.transit.encrypt({
  keyName: 'abos-data-key',
  plaintext: Buffer.from(sensitiveData).toString('base64'),
});

// Decrypt when needed
const decrypted = await vault.transit.decrypt({
  keyName: 'abos-data-key',
  ciphertext: encrypted.ciphertext,
});
```

---

## Audit Logging

Vault audit logs capture all secret access:

```bash
# Enable audit logging
vault audit enable file file_path=/var/log/vault/audit.log

# Audit log entry example
{
  "time": "2026-01-04T21:15:00Z",
  "type": "response",
  "auth": {
    "token_type": "service"
  },
  "request": {
    "path": "secret/data/abos/spotify",
    "operation": "read"
  }
}
```

---

## References

- [Secrets Vault README](README.md)
- [HashiCorp Vault Documentation](https://developer.hashicorp.com/vault)
