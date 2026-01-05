# LLM Integration Guide

## Overview

AB-OS uses multiple LLMs for different system roles. This guide covers model selection, configuration, and best practices.

---

## LLM Roles

| Role | Primary | Fallback | Purpose |
|------|---------|----------|---------|
| **Planner** | GPT-4.1 / Gemini 2.5 Flash | Llama 3.3 (70B) | Complex task decomposition |
| **Agent Runtime** | Mistral 3 | Llama 3.3 | Low-latency micro-planning |
| **Site Adapters** | Fine-tuned Llama 3 (8B) | - | Site-specific heuristics |
| **IDE Helpers** | GPT-4.1 | Gemini | Log summarization, UI hints |

---

## Model Recommendations

### Planner (Central Brain)

**Primary: GPT-4.1 / GPT-4o / Gemini 2.5 Flash**

Why:
- Best-in-class reasoning for complex task decomposition
- Excellent instruction following for structured JSON output
- Long context support for complex multi-step plans
- Low latency variants available

Configuration:
```yaml
planner:
  provider: openai
  model: gpt-4.1
  temperature: 0.1
  max_tokens: 4096
  response_format: json_object
```

**Alternative: Google Gemini 2.5/3 Flash**

Why:
- Competitive reasoning with lower latency
- Optimized for agentic workloads
- Good price-performance ratio
- Native Google Cloud integration

Configuration:
```yaml
planner:
  provider: google
  model: gemini-2.5-flash
  temperature: 0.1
  max_tokens: 4096
```

### Agent Runtime (Micro-Planning)

**Primary: Mistral 3 / Llama 3.3**

Why:
- Fast inference for real-time decisions
- Permissive licensing for on-premise deployment
- Good instruction following
- Lower cost than frontier models

Configuration:
```yaml
agent_runtime:
  provider: mistral
  model: mistral-3
  temperature: 0.2
  max_tokens: 1024
```

**Local Deployment (Ollama)**
```yaml
agent_runtime:
  provider: ollama
  model: llama3.3:70b
  endpoint: http://localhost:11434
  temperature: 0.2
```

### Site Adapters (Fast Heuristics)

**Primary: Fine-tuned Llama 3 (8B)**

Why:
- Extremely fast inference
- Easily fine-tuned for specific sites
- Low resource requirements
- Can run on edge devices

Configuration:
```yaml
site_adapters:
  provider: local
  model: llama-3-8b-site-adapter
  temperature: 0.1
  max_tokens: 256
```

---

## Model Comparison

| Model | Provider | Context | Latency | Cost | Reasoning |
|-------|----------|---------|---------|------|-----------|
| GPT-4.1 | OpenAI | 128K | Medium | $$$ | Excellent |
| GPT-4o | OpenAI | 128K | Fast | $$ | Very Good |
| Gemini 2.5 Flash | Google | 1M | Fast | $$ | Very Good |
| Gemini 3 Flash | Google | 1M | Fast | $$ | Excellent |
| Mistral 3 | Mistral | 32K | Fast | $ | Good |
| Llama 3.3 (70B) | Meta | 128K | Medium | Free | Very Good |
| Llama 3 (8B) | Meta | 8K | Very Fast | Free | Moderate |

---

## Provider Configuration

### OpenAI

```yaml
providers:
  openai:
    api_key: ${OPENAI_API_KEY}
    organization: ${OPENAI_ORG_ID}
    base_url: https://api.openai.com/v1
    timeout: 60s
    retry:
      max_attempts: 3
      backoff: exponential
```

### Google Vertex AI

```yaml
providers:
  google:
    project: ${GCP_PROJECT_ID}
    location: us-central1
    credentials: ${GOOGLE_APPLICATION_CREDENTIALS}
    timeout: 60s
```

### Mistral AI

```yaml
providers:
  mistral:
    api_key: ${MISTRAL_API_KEY}
    base_url: https://api.mistral.ai/v1
    timeout: 30s
```

### Ollama (Local)

```yaml
providers:
  ollama:
    base_url: http://localhost:11434
    timeout: 120s
    models:
      - llama3.3:70b
      - mistral:latest
```

---

## Planner System Prompt

```text
You are the AB-OS Planner, responsible for decomposing user tasks into executable agent plans.

## Output Format
You MUST output a valid JSON plan with this structure:
{
  "plan_id": "uuid",
  "intent": "user intent summary",
  "steps": [
    {
      "step_id": "uuid",
      "agent_type": "browser_agent",
      "action": "navigate",
      "target": "https://example.com",
      "capabilities_required": ["CAP_NAVIGATE", "CAP_READ"],
      "depends_on": [],
      "parallel_group": 1
    }
  ],
  "success_criteria": "description of success",
  "rollback_plan": "steps to undo if failed"
}

## Rules
1. Decompose complex tasks into atomic steps
2. Identify parallelizable steps (same parallel_group)
3. Specify minimum required capabilities
4. Include rollback plan for state-changing operations
5. Never assume credentials - request from Policy Authority

## Available Actions
- navigate(url): Go to URL
- click(selector): Click element
- type(selector, text): Enter text
- screenshot(): Capture page
- snapshot(): Capture DOM state
- wait(condition): Wait for condition
- extract(selector): Extract content
```

---

## Fallback Strategy

### Automatic Failover

```yaml
planner:
  primary:
    provider: openai
    model: gpt-4.1
  fallback:
    - provider: google
      model: gemini-2.5-flash
    - provider: ollama
      model: llama3.3:70b
  failover:
    on_error: true
    on_timeout: true
    on_rate_limit: true
```

### Health Checks

```yaml
health_check:
  interval: 30s
  timeout: 5s
  unhealthy_threshold: 3
  healthy_threshold: 1
```

---

## Performance Optimization

### Caching

```yaml
cache:
  enabled: true
  provider: redis
  ttl: 3600s
  key_strategy: hash
  exclude_patterns:
    - "*purchase*"
    - "*delete*"
```

### Batching

```yaml
batching:
  enabled: true
  max_batch_size: 10
  max_wait: 100ms
```

### Streaming

```yaml
streaming:
  enabled: true
  chunk_size: 256
  timeout: 60s
```

---

## Cost Management

### Rate Limiting

```yaml
rate_limits:
  openai:
    requests_per_minute: 500
    tokens_per_minute: 100000
  google:
    requests_per_minute: 300
    tokens_per_minute: 80000
```

### Budget Alerts

```yaml
budget:
  monthly_limit: 10000  # USD
  alerts:
    - threshold: 0.5
      notify: admin@company.com
    - threshold: 0.8
      notify: admin@company.com
    - threshold: 0.95
      action: fallback_to_local
```

---

## On-Premise LLM Deployment

### Hardware Requirements

| Model | VRAM | RAM | Notes |
|-------|------|-----|-------|
| Llama 3.3 (70B) | 80GB | 128GB | 2x A100 or 4x A10 |
| Llama 3 (8B) | 16GB | 32GB | Single RTX 4090 |
| Mistral 3 | 32GB | 64GB | 2x RTX 4090 |

### Ollama Setup

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Enable GPU support
sudo systemctl edit ollama
# Add: Environment="CUDA_VISIBLE_DEVICES=0,1"

# Pull models
ollama pull llama3.3:70b
ollama pull mistral:latest

# Configure for production
cat > /etc/ollama/config.yaml <<EOF
host: 0.0.0.0
port: 11434
gpu_memory_fraction: 0.9
num_parallel: 4
EOF
```

### vLLM Setup

```bash
# Install vLLM
pip install vllm

# Run Llama 3.3
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-3.3-70B-Instruct \
  --tensor-parallel-size 2 \
  --port 8000
```

---

## Monitoring

### Metrics

| Metric | Description |
|--------|-------------|
| `llm_request_duration_seconds` | Request latency |
| `llm_tokens_total` | Total tokens used |
| `llm_error_rate` | Error percentage |
| `llm_cache_hit_rate` | Cache efficiency |
| `llm_cost_usd` | Estimated cost |

### Logging

```yaml
logging:
  level: info
  format: json
  include:
    - request_id
    - model
    - tokens
    - latency
  exclude:
    - prompt_content  # Privacy
    - response_content
```

---

## References

- [Architecture](architecture.md)
- [Planner Package](../packages/planner/README.md)
- [Model Adapters](../packages/planner/model-adapters/)
