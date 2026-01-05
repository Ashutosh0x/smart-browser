# AB-OS Incident Response Runbook

## Overview

This runbook provides step-by-step procedures for responding to security incidents and operational issues in AB-OS.

---

## Severity Levels

| Level | Description | Response Time | Escalation |
|-------|-------------|---------------|------------|
| **P1** | Active exploitation, data breach | 15 minutes | Immediate |
| **P2** | Vulnerability discovered, service down | 4 hours | Within 1 hour |
| **P3** | Security improvement needed | 24 hours | Within 4 hours |
| **P4** | Hardening task | 1 week | Standard process |

---

## P1: Active Exploitation

### Immediate Actions (0-15 minutes)

1. **Assess scope**
   ```bash
   # Check active sessions
   kubectl exec -it deployment/abos-observability -n abos -- \
     abos-cli audit list --since 1h --filter "suspicious=true"
   
   # Check for anomalous agents
   kubectl logs deployment/abos-agent-runtime -n abos --since 1h | \
     grep -E "(error|warning|unauthorized)"
   ```

2. **Isolate affected components**
   ```bash
   # Revoke all active capability tokens
   kubectl exec -it deployment/abos-policy-authority -n abos -- \
     abos-cli tokens revoke-all --reason "security-incident"
   
   # Pause agent runtime
   kubectl scale deployment abos-agent-runtime -n abos --replicas=0
   ```

3. **Preserve evidence**
   ```bash
   # Export audit logs
   kubectl exec -it deployment/abos-observability -n abos -- \
     abos-cli audit export --since 24h --output /tmp/audit-export.json
   
   # Copy to secure location
   kubectl cp abos/abos-observability:/tmp/audit-export.json ./audit-export.json
   ```

4. **Notify stakeholders**
   - Security team lead
   - Engineering on-call
   - Legal/compliance (if data breach)

### Investigation (15-60 minutes)

1. **Analyze attack vector**
   - Review audit logs for unauthorized actions
   - Check for capability token abuse
   - Identify affected agents and users

2. **Determine blast radius**
   - What data was accessed?
   - What actions were performed?
   - Which users are affected?

### Remediation

1. **Patch vulnerability**
2. **Rotate affected credentials**
3. **Update policies to prevent recurrence**

### Post-Incident

1. **Write incident report**
2. **Conduct blameless postmortem**
3. **Update this runbook**

---

## P2: Service Degradation

### Diagnosis

```bash
# Check pod status
kubectl get pods -n abos -o wide

# Check resource usage
kubectl top pods -n abos

# Check events
kubectl get events -n abos --sort-by='.lastTimestamp'

# Check logs
kubectl logs -f deployment/abos-planner -n abos --tail=100
```

### Common Issues

#### Planner Timeout

```bash
# Check LLM provider status
curl -I https://api.openai.com/v1/models

# Check planner metrics
kubectl exec -it deployment/abos-planner -n abos -- \
  curl localhost:8001/metrics | grep planner_latency

# Fallback to local LLM
kubectl set env deployment/abos-planner -n abos \
  LLM_PROVIDER=ollama LLM_MODEL=llama3.3:70b
```

#### Agent Runtime OOM

```bash
# Check memory usage
kubectl top pods -n abos -l app=agent-runtime

# Reduce concurrent agents
kubectl set env deployment/abos-agent-runtime -n abos \
  MAX_CONCURRENT_AGENTS=20

# Restart with more memory
kubectl patch deployment abos-agent-runtime -n abos -p \
  '{"spec":{"template":{"spec":{"containers":[{"name":"agent-runtime","resources":{"limits":{"memory":"32Gi"}}}]}}}}'
```

#### Audit Storage Full

```bash
# Check storage
kubectl exec -it deployment/abos-observability -n abos -- df -h

# Archive old logs
kubectl exec -it deployment/abos-observability -n abos -- \
  abos-cli audit archive --older-than 30d

# Expand PVC (if supported)
kubectl patch pvc audit-storage -n abos -p \
  '{"spec":{"resources":{"requests":{"storage":"1Ti"}}}}'
```

---

## Key Rotation

### Capability Signing Keys

```bash
# Generate new key
kubectl exec -it deployment/abos-policy-authority -n abos -- \
  abos-cli keys generate --type rsa-4096 --name signing-key-2026-02

# Update key reference
kubectl set env deployment/abos-policy-authority -n abos \
  SIGNING_KEY_ID=signing-key-2026-02

# Mark old key for revocation (after grace period)
kubectl exec -it deployment/abos-policy-authority -n abos -- \
  abos-cli keys deprecate --name signing-key-2026-01 --grace-period 7d
```

### Vault Token Rotation

```bash
# Rotate Vault token
vault token renew

# Update Kubernetes secret
kubectl create secret generic vault-token \
  --namespace abos \
  --from-literal=token=$(vault token lookup -format=json | jq -r .data.id) \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart dependent services
kubectl rollout restart deployment/abos-policy-authority -n abos
```

---

## Rollback Procedures

### Helm Rollback

```bash
# List releases
helm history abos -n abos

# Rollback to previous
helm rollback abos -n abos

# Rollback to specific revision
helm rollback abos 5 -n abos
```

### Emergency Shutdown

```bash
# Stop all agents
kubectl scale deployment abos-agent-runtime -n abos --replicas=0

# Stop accepting new requests
kubectl annotate ingress abos-ingress -n abos \
  nginx.ingress.kubernetes.io/server-snippet="return 503;"

# Verify shutdown
kubectl get pods -n abos
```

---

## Contact Information

| Role | Contact | Escalation |
|------|---------|------------|
| On-call Engineer | PagerDuty | Auto-escalate 15min |
| Security Lead | security@company.com | Manual |
| Platform Lead | platform@company.com | Manual |
| Legal | legal@company.com | P1 only |

---

## References

- [Threat Model](../threat-model.md)
- [Architecture](../architecture.md)
