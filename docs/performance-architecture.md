# AB-OS Performance Architecture

> **Goal**: Make AB-OS blazingly fast — lower latency than normal browsers across the stack.

---

## Target SLOs

| Metric | p50 | p95 | p99 |
|--------|-----|-----|-----|
| Planner decision | < 200ms | < 400ms | < 800ms |
| Agent startup (warm) | < 150ms | < 300ms | < 800ms |
| Agent startup (cold) | < 800ms | < 1500ms | < 3000ms |
| Action execution (click/get_dom) | < 100ms | < 200ms | < 500ms |
| Time to first screenshot | < 500ms | < 1000ms | < 2000ms |

---

## 0. Guiding Principles

1. **Perceived latency > throughput** — Reduce "time to useful state"
2. **Eliminate blocking** — No main-thread stalls, no long round trips
3. **Speculate safely** — Prefetch/prerender on high-confidence predictions
4. **Warm everything hot** — Keep contexts, models, TLS sessions alive
5. **Measure continuously** — Instrument everywhere, define SLOs/SLIs

---

## 1. Kernel & Rendering Engine Optimizations

### Zero-Copy Compositing & GPU Pipelines
- GPU-accelerated compositing for every layer
- DMA buffers and zero-copy texture transfers
- GPU fences for synchronization (avoid CPU↔GPU round trips)

### Thread Separation
- Maximize offloading to compositor thread
- Main thread only for critical layout updates
- Worker threads for style/paint work

### Incremental/Partial Paints
- Recompose only changed regions (damage rects)
- Incremental layout, avoid full reflows

### Fast Event Dispatch
- Synthesized events as kernel syscalls
- Bypass heavy DOM event plumbing
- Route directly to renderer input pipelines

### Fast DOM Snapshot & Restore
- Compact binary format (struct-of-arrays)
- Prebuilt snapshots for common pages
- COW memory mappings for instant restore

### IPC Optimization
- Coalesce small IPCs into batched messages
- Minimize syscall ABI chattiness

### Build Optimizations
- LTO + PGO + optimized Clang flags
- Thin-LTO for fast links + runtime perf
- Strip debug for release builds

---

## 2. Network & Protocol Optimizations

### Default to QUIC/HTTP3
- Minimizes connection spin-up latency
- Eliminates head-of-line blocking
- Keep TLS/QUIC sessions in warm pools

### TLS Session Reuse & 0-RTT
- Reuse session tickets across agent contexts
- 0-RTT for predictable safe requests
- Anti-replay guards for sensitive operations

### Connection Coalescing
- Fewer connections, maximum multiplexing
- HTTP/2 and HTTP/3 prioritization

### Speculative Warmup
- DNS prefetch for predicted domains
- TCP/TLS warmup via planner hints

### Request Batching
- Batch small HTTP requests where safe
- Preflight POST bodies for preview

### Adaptive QoS
- Rate limit background downloads
- Prioritize interactive requests (click, get_dom)
- DSCP tagging for enterprise networks

---

## 3. JavaScript / V8 Engine Optimizations

### JIT Tuning
- Warm JIT caches for frequent site scripts
- Persist compiled code between contexts
- Reduce cold parse/compile time

### GC Optimization
- Isolate per-agent memory pools
- Tune for short-lived workloads
- Small incremental GCs, low pause times

### Main Thread Offload
- Heavy JS processing to WebWorkers
- Thread-safe worker bindings for agents

### Lazy Parsing
- Defer non-critical scripts (analytics)
- Use defer/async and dynamic imports

### Fast DOM Access
- Native syscalls for common queries
- Accessibility tree queries bypass JS
- Precompiled selector templates

---

## 4. Agent Runtime & LLM Optimizations

### Hybrid Model Split
| Role | Model | Location |
|------|-------|----------|
| Planner | GPT-4.1/Gemini | Cloud/GPU server |
| Micro-agent | Mistral/Llama 8B | Local (quantized) |

### Model Quantization
- INT8/INT4/QLoRA quantization
- FlashAttention kernels for GPU
- TensorRT/cuBLAS fused kernels
- FBGEMM/AVX512 for CPU fallback

### Inference Optimization
- Shared embedding cache
- Micro-batching with latency deadlines
- Warm model instances, pinned GPUs

### Prompt Engineering
- Concise system prompts
- Structured JSON schema output
- Fewer tokens = lower latency

### Model Distillation
- Distill planner behaviors into small models
- Site-specific adapters (Spotify, Gmail)

---

## 5. Scheduler & Warm Pools

### Warm Context Pools
- Pre-authenticated contexts for top domains
- Instant acquire & attach to agents
- Target domains: Spotify, Gmail, Amazon, GitHub

### Instant Snapshot Restore
- Binary snapshots for <100-300ms spawns
- COW restore for near-instant windows

### Process/Container Reuse
- Reuse agent runners, avoid cold spawn
- Preloaded binaries and memory maps

### Priority Scheduler
- Interactive agents > background agents
- CPU/memory quotas per tenant/pool
- cgroup limits for isolation

### Backpressure
- Graceful degradation under load
- Defer non-critical prefetch
- Fast error state for replanning

---

## 6. Caching & Speculation

### Prediction-Driven Prefetch
- Planner predicts next domains/resources
- Kernel prefetches DNS, TLS, JS/CSS

### Speculative Prerender
- Load predicted page in hidden context
- Swap in on intent commit
- Isolated prerender contexts

### Result-Level Caching
- Cache structured extractor outputs
- Invalidation rules per site

### HTTP/2 Push & Early Hints
- Honor `rel=preload`, Early Hints
- Priority headers for critical resources

---

## 7. Storage & Artifact I/O

### Tiered Storage
| Tier | Storage | Use Case | TTL |
|------|---------|----------|-----|
| Hot | NVMe SSD | Active replays | 24h |
| Warm | SSD | Recent artifacts | 7d |
| Cold | S3 Glacier | Archive | 1y+ |

### Incremental Snapshots
- Store deltas between snapshots
- Faster restore, less storage

### Parallel Upload
- Chunked uploads with Brotli compression
- Stream to storage asynchronously

---

## 8. OS & Infrastructure Tuning

### Linux Kernel
- `NOHZ` / `PREEMPT` configuration
- `sched_rt` tuning for interactive processes
- High-frequency timers

### Network Stack
- Increased socket buffers
- BBR congestion control
- NUMA-aware allocation

### Resource Isolation
- cgroups/containers per agent
- Tight resource control
- Predictable latency

---

## 9. Observability & Profiling

### Distributed Tracing
```
Planner → Scheduler → Agent → Kernel Syscall
   ↓          ↓          ↓          ↓
 trace_id propagated across all components
```

### Key Metrics (SLIs)
- Planner decision latency (p50/p95/p99)
- Agent warm/cold startup time
- Action execution latency
- Cache hit ratio (warm pool reuse)
- Artifact write latency
- Network establishment latency

### Continuous Profiling
- CPU/heap flamegraphs on warm nodes
- Hotspot identification
- Perf regression CI gates

---

## 10. Security Trade-offs

| Optimization | Risk | Mitigation |
|--------------|------|------------|
| Snapshot reuse | Credential leakage | Scrub secrets, use ephemeral tokens |
| Speculative prefetch | Privacy concern | Policy-gated, user consent |
| 0-RTT | Replay attacks | Idempotent calls only, anti-replay |
| Model caching | Stale behavior | TTL, revalidation |

---

## 11. Quick Wins (First 90 Days)

| Priority | Optimization | Impact | Effort |
|----------|--------------|--------|--------|
| 1 | Warm pool for top 5 sites | High | Medium |
| 2 | Binary DOM snapshot prototype | High | High |
| 3 | Local quantized agent model | High | Medium |
| 4 | Planner prompt optimization | Medium | Low |
| 5 | QUIC/HTTP3 + TLS session reuse | Medium | Medium |
| 6 | Baseline metrics instrumentation | High | Low |

---

## 12. Long-term Investments (3-12 Months)

- Kernel-level zero-copy & GPU optimizations
- Distilled site-adapter models
- Deterministic replay engine with COW
- Adaptive model orchestration layer
- Edge nodes for global low-latency

---

## 13. Implementation Checklist

- [ ] Add QUIC/HTTP3 + TLS session reuse to network stack
- [ ] Implement warm context pools for top N domains
- [ ] Prototype binary DOM snapshot & instant restore
- [ ] Deploy local quantized agent model on agent host
- [ ] Optimize planner prompts + reduce token counts
- [ ] Add distributed tracing across planner → kernel path
- [ ] Baseline p50/p95 for all key metrics
- [ ] Add perf gates to CI pipeline

---

## References

- [Architecture](architecture.md)
- [Kernel Design](../packages/kernel/design.md)
- [Agent Runtime Design](../packages/agent-runtime/design.md)
- [LLM Integration](llm-integration.md)
