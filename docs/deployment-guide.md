# AB-OS Deployment Guide

## Overview

This guide covers deploying AB-OS in various environments: local development, cloud (Kubernetes), and on-premises air-gapped installations.

---

## Deployment Models

| Model | Use Case | LLM | Infrastructure |
|-------|----------|-----|----------------|
| **Local Dev** | Development, testing | Local Llama 3.3 | Docker Compose |
| **Cloud SaaS** | Production, multi-tenant | GPT-4.1/Gemini | Kubernetes |
| **On-Premise** | Enterprise, air-gapped | Local Mistral/Llama | Kubernetes/VMs |

---

## Prerequisites

### All Deployments
- Docker 24.0+
- Git
- 16GB+ RAM (32GB recommended)
- 100GB+ storage

### Kubernetes Deployments
- Kubernetes 1.28+
- Helm 3.12+
- kubectl configured

### On-Premise
- HashiCorp Vault (or compatible)
- HSM for key management (recommended)
- Private container registry

---

## Local Development

### Quick Start

```bash
# Clone repository
git clone https://github.com/your-org/ab-os.git
cd ab-os

# Start all services
docker-compose -f deployments/docker-compose.dev.yml up -d

# Verify services
docker-compose ps

# View logs
docker-compose logs -f

# Access IDE
open http://localhost:3000
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| IDE | 3000 | Web dashboard |
| Planner | 8001 | LLM planner API |
| Policy Authority | 8002 | Policy engine |
| Agent Runtime | 8003 | Agent scheduler |
| Executor | 8004 | Action executor |
| Observability | 8005 | Audit/replay |

### Local LLM Setup

```bash
# Using Ollama for local LLM
docker run -d --gpus all -v ollama:/root/.ollama -p 11434:11434 ollama/ollama

# Pull Llama 3.3
docker exec -it ollama ollama pull llama3.3:70b

# Configure planner to use local LLM
export LLM_PROVIDER=ollama
export LLM_MODEL=llama3.3:70b
export LLM_ENDPOINT=http://localhost:11434
```

---

## Cloud Deployment (Kubernetes)

### Cluster Requirements

| Component | Min Nodes | Resources |
|-----------|-----------|-----------|
| Control Plane | 3 | 4 vCPU, 8GB RAM |
| Agent Workers | 2+ | 8 vCPU, 32GB RAM, GPU optional |
| Observability | 1 | 4 vCPU, 16GB RAM, 500GB SSD |

### Helm Installation

```bash
# Add AB-OS Helm repository
helm repo add abos https://charts.ab-os.io
helm repo update

# Create namespace
kubectl create namespace abos

# Create secrets
kubectl create secret generic abos-secrets \
  --namespace abos \
  --from-literal=openai-api-key=$OPENAI_API_KEY \
  --from-literal=vault-token=$VAULT_TOKEN

# Install AB-OS
helm install abos abos/ab-os \
  --namespace abos \
  --values values-production.yaml

# Verify deployment
kubectl get pods -n abos
```

### Production Values

```yaml
# values-production.yaml
global:
  environment: production
  replicas: 3

planner:
  model: gpt-4.1
  provider: openai
  resources:
    requests:
      cpu: "2"
      memory: "4Gi"

agentRuntime:
  replicas: 5
  maxAgentsPerNode: 50
  warmPoolSize: 10
  resources:
    requests:
      cpu: "4"
      memory: "16Gi"

policyAuthority:
  replicas: 3
  hsm:
    enabled: true
    provider: aws-cloudhsm

observability:
  storage:
    class: gp3
    size: 500Gi
  retention: 90d

ingress:
  enabled: true
  className: nginx
  hosts:
    - abos.yourcompany.com
  tls:
    - secretName: abos-tls
      hosts:
        - abos.yourcompany.com
```

### Scaling

```bash
# Scale agent runners
kubectl scale deployment abos-agent-runtime -n abos --replicas=10

# Horizontal Pod Autoscaler
kubectl autoscale deployment abos-agent-runtime \
  --namespace abos \
  --min=3 \
  --max=20 \
  --cpu-percent=70
```

---

## On-Premise Deployment

### Air-Gapped Installation

```bash
# 1. Download offline bundle (from connected machine)
abos-cli bundle download --version 1.0.0 --output abos-bundle.tar.gz

# 2. Transfer bundle to air-gapped environment
# (use secure transfer method)

# 3. Load images into private registry
abos-cli bundle load \
  --input abos-bundle.tar.gz \
  --registry registry.internal.company.com

# 4. Deploy with air-gapped values
helm install abos ./charts/ab-os \
  --namespace abos \
  --values values-airgapped.yaml
```

### Air-Gapped Values

```yaml
# values-airgapped.yaml
global:
  imageRegistry: registry.internal.company.com
  imagePullSecrets:
    - internal-registry-secret

planner:
  model: llama-3.3-70b
  provider: local
  endpoint: http://llm.internal:11434

policyAuthority:
  hsm:
    enabled: true
    provider: on-premise
    address: hsm.internal:5696

secrets:
  vault:
    enabled: true
    address: https://vault.internal:8200
    auth: kubernetes

observability:
  externalAccess: false
  storage:
    class: local-storage
```

### VM-Based Deployment

For environments without Kubernetes:

```bash
# Install on single VM (development/small scale)
curl -sSL https://install.ab-os.io | bash -s -- --mode single

# Multi-VM setup
abos-cli deploy \
  --inventory inventory.yaml \
  --ssh-key ~/.ssh/id_rsa
```

---

## Security Configuration

### TLS Certificates

```bash
# Generate certificates using cert-manager
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: abos-tls
  namespace: abos
spec:
  secretName: abos-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
    - abos.yourcompany.com
EOF
```

### HashiCorp Vault Integration

```bash
# Enable Kubernetes auth in Vault
vault auth enable kubernetes

vault write auth/kubernetes/config \
  kubernetes_host="https://$KUBERNETES_HOST:443"

vault write auth/kubernetes/role/abos \
  bound_service_account_names=abos-service \
  bound_service_account_namespaces=abos \
  policies=abos-policy \
  ttl=1h
```

### Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: abos-default-deny
  namespace: abos
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              name: abos
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
      ports:
        - port: 443
          protocol: TCP
```

---

## Monitoring

### Prometheus Metrics

```bash
# Install Prometheus stack
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace

# Configure ServiceMonitor
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: abos
  namespace: abos
spec:
  selector:
    matchLabels:
      app: abos
  endpoints:
    - port: metrics
      interval: 30s
EOF
```

### Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `abos_planner_latency_p95` | Planner latency | > 500ms |
| `abos_agent_active_count` | Active agents | > capacity |
| `abos_executor_error_rate` | Execution errors | > 1% |
| `abos_audit_write_latency` | Audit write time | > 100ms |

---

## Upgrades

### Rolling Upgrade

```bash
# Update Helm values
helm upgrade abos abos/ab-os \
  --namespace abos \
  --values values-production.yaml \
  --set global.imageTag=1.1.0

# Monitor rollout
kubectl rollout status deployment/abos-agent-runtime -n abos
```

### Rollback

```bash
# Rollback to previous
helm rollback abos 1 --namespace abos

# Or specific version
helm rollback abos 5 --namespace abos
```

---

## Troubleshooting

### Common Issues

| Issue | Diagnosis | Resolution |
|-------|-----------|------------|
| Pods pending | `kubectl describe pod` | Check resource limits |
| LLM timeout | Check planner logs | Verify API key / endpoint |
| HSM errors | Check policy-authority | Verify HSM connectivity |
| Audit failures | Check observability | Verify storage capacity |

### Debug Commands

```bash
# Check pod status
kubectl get pods -n abos -o wide

# View logs
kubectl logs -f deployment/abos-planner -n abos

# Exec into pod
kubectl exec -it deployment/abos-agent-runtime -n abos -- /bin/sh

# Check events
kubectl get events -n abos --sort-by='.lastTimestamp'
```

---

## References

- [Architecture](architecture.md)
- [Threat Model](threat-model.md)
- [Runbooks](runbooks/)
