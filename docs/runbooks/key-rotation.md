# Key Rotation Runbook

## Overview

This runbook covers procedures for rotating cryptographic keys in AB-OS, including capability signing keys, Vault tokens, TLS certificates, and agent identity keys.

---

## Rotation Schedule

| Key Type | Rotation Period | Grace Period |
|----------|-----------------|--------------|
| Capability Signing | Monthly | 7 days |
| Vault Token | Weekly | 1 hour |
| TLS Certificates | 90 days | 30 days |
| Agent Identity | On compromise | Immediate |
| HSM Master Key | Yearly | 30 days |

---

## Capability Signing Key Rotation

### Prerequisites
- Admin access to Policy Authority
- HSM access (if using HSM)

### Procedure

1. **Generate new key**
   ```bash
   # Connect to Policy Authority
   kubectl exec -it deployment/abos-policy-authority -n abos -- bash
   
   # Generate new key (HSM)
   abos-cli keys generate \
     --type rsa-4096 \
     --name signing-key-$(date +%Y-%m) \
     --hsm
   
   # Or generate local key
   abos-cli keys generate \
     --type rsa-4096 \
     --name signing-key-$(date +%Y-%m)
   ```

2. **Activate new key**
   ```bash
   # Set as primary signing key
   abos-cli keys set-primary --name signing-key-$(date +%Y-%m)
   
   # Verify
   abos-cli keys list
   ```

3. **Deprecate old key**
   ```bash
   # Mark old key for deprecation
   abos-cli keys deprecate \
     --name signing-key-$(date -d 'last month' +%Y-%m) \
     --grace-period 7d
   ```

4. **Monitor transition**
   ```bash
   # Check for tokens using old key
   abos-cli tokens audit --key-id signing-key-old --since 24h
   ```

5. **Remove old key (after grace period)**
   ```bash
   abos-cli keys remove --name signing-key-old
   ```

---

## Vault Token Rotation

### Automatic Rotation

Vault tokens should auto-renew. Verify:

```bash
# Check token TTL
vault token lookup

# Check renewal service
kubectl logs deployment/abos-vault-sidecar -n abos | grep renew
```

### Manual Rotation

```bash
# Generate new token
NEW_TOKEN=$(vault token create \
  -policy=abos-policy \
  -ttl=168h \
  -format=json | jq -r .auth.client_token)

# Update Kubernetes secret
kubectl create secret generic vault-token \
  --namespace abos \
  --from-literal=token=$NEW_TOKEN \
  --dry-run=client -o yaml | kubectl apply -f -

# Rolling restart
kubectl rollout restart deployment/abos-policy-authority -n abos
kubectl rollout restart deployment/abos-executor -n abos

# Revoke old token
vault token revoke <old-token>
```

---

## TLS Certificate Rotation

### cert-manager (Automatic)

If using cert-manager, certificates rotate automatically.

```bash
# Check certificate status
kubectl get certificates -n abos

# Force renewal
kubectl annotate certificate abos-tls \
  cert-manager.io/issuer-name="" --overwrite
kubectl delete secret abos-tls -n abos
```

### Manual Rotation

```bash
# Generate new certificate
openssl req -x509 -newkey rsa:4096 \
  -keyout key.pem -out cert.pem \
  -days 365 -nodes \
  -subj "/CN=abos.yourcompany.com"

# Update secret
kubectl create secret tls abos-tls \
  --namespace abos \
  --cert=cert.pem \
  --key=key.pem \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart ingress controller
kubectl rollout restart deployment/ingress-nginx -n ingress-nginx
```

---

## Agent Identity Key Rotation

### On Compromise

```bash
# Identify compromised agent
AGENT_ID="agent-12345"

# Revoke agent's active tokens
abos-cli tokens revoke --agent-id $AGENT_ID

# Regenerate agent identity
abos-cli agents regenerate-identity --agent-id $AGENT_ID

# Update agent deployment
kubectl rollout restart deployment/abos-agent-$AGENT_ID -n abos
```

### Bulk Rotation

```bash
# Rotate all agent keys (maintenance window required)
abos-cli agents rotate-all-identities \
  --batch-size 10 \
  --delay 5s

# Monitor progress
watch kubectl get pods -n abos -l app=agent
```

---

## HSM Key Rotation

### Prerequisites
- HSM admin credentials
- Maintenance window
- Backup of current keys

### Procedure

1. **Backup current key (if supported)**
   ```bash
   pkcs11-tool --module /usr/lib/pkcs11/libsofthsm2.so \
     --login --backup-key \
     --label "abos-master" \
     --output-file master-key-backup.pem
   ```

2. **Generate new master key**
   ```bash
   pkcs11-tool --module /usr/lib/pkcs11/libsofthsm2.so \
     --login --keypairgen \
     --key-type rsa:4096 \
     --label "abos-master-$(date +%Y)"
   ```

3. **Re-wrap existing keys**
   ```bash
   abos-cli keys rewrap \
     --old-master abos-master \
     --new-master abos-master-$(date +%Y)
   ```

4. **Update configuration**
   ```bash
   kubectl set env deployment/abos-policy-authority -n abos \
     HSM_KEY_LABEL=abos-master-$(date +%Y)
   ```

5. **Verify functionality**
   ```bash
   # Test token signing
   abos-cli tokens test-sign
   
   # Test audit signing
   abos-cli audit test-sign
   ```

---

## Emergency Key Revocation

### All Keys

```bash
# Revoke all active capability tokens
abos-cli tokens revoke-all --reason "emergency-rotation"

# Stop all agents
kubectl scale deployment abos-agent-runtime -n abos --replicas=0

# Generate new signing key
abos-cli keys generate --type rsa-4096 --name emergency-key --primary

# Restart services
kubectl rollout restart deployment -n abos -l app.kubernetes.io/part-of=abos

# Restart agents
kubectl scale deployment abos-agent-runtime -n abos --replicas=5
```

---

## Verification

After any key rotation:

```bash
# Test token issuance
abos-cli tokens issue --test

# Verify audit signing
abos-cli audit verify --last 10

# Check for errors
kubectl logs deployment/abos-policy-authority -n abos | grep -i error

# Run integration tests
abos-cli test integration --suite security
```

---

## References

- [Threat Model](../threat-model.md)
- [Incident Response](incident-response.md)
