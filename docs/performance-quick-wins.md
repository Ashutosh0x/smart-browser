# Performance Quick Wins - 90 Day Implementation Plan

## Priority 1: Warm Pool for Top Sites (Week 1-2)

**Goal**: Reduce warm agent startup from 1500ms → 300ms

### Implementation Steps

1. **Create WarmPoolManager class**
   - Pool configuration per domain
   - Context lifecycle management
   - Health scoring and eviction

2. **Configure top 5 domains**
   ```yaml
   spotify.com, gmail.com, amazon.com, github.com, linkedin.com
   ```

3. **Integrate with Agent Runtime**
   - Check warm pool before cold start
   - Release contexts back to pool

4. **Metrics**
   - `abos_warm_pool_hit_rate`
   - `abos_agent_startup_seconds{type=warm|cold}`

---

## Priority 2: Binary DOM Snapshot (Week 3-4)

**Goal**: Enable <100ms page restore

### Implementation Steps

1. **Create SnapshotSerializer**
   - Struct-of-arrays format
   - String table deduplication
   - Layout capture

2. **Create SnapshotRestorer**
   - Fast DOM reconstruction
   - Form state restoration

3. **Integrate with kernel syscalls**
   - `SNAPSHOT` syscall returns binary format
   - `RESTORE` syscall accepts binary format

---

## Priority 3: Local Quantized Agent Model (Week 5-6)

**Goal**: Reduce cloud LLM calls by 80% for micro-decisions

### Implementation Steps

1. **Deploy Ollama with Mistral 7B**
   ```bash
   ollama pull mistral:7b-instruct-q4_K_M
   ```

2. **Create decision router**
   - Simple actions → local model
   - Complex planning → cloud model

3. **Implement fallback chain**
   - Local → Cloud → Error

---

## Priority 4: Planner Prompt Optimization (Week 7-8)

**Goal**: Reduce planner latency p95 from 800ms → 400ms

### Implementation Steps

1. **Analyze current token counts**
   - System prompt tokens
   - Response tokens

2. **Optimize prompts**
   - Shorter examples
   - Structured JSON schema
   - Remove verbose instructions

3. **Implement streaming responses**
   - Start agent before full plan received

---

## Priority 5: QUIC/HTTP3 + TLS Session Reuse (Week 9-10)

**Goal**: Reduce network establishment latency

### Implementation Steps

1. **Enable QUIC in kernel build flags**
   ```
   enable_quic = true
   ```

2. **Configure TLS session caching**
   - Session ticket reuse
   - 0-RTT for safe requests

3. **Warm connection pools**
   - Maintain TLS sessions for frequent domains

---

## Priority 6: Observability Baseline (Week 11-12)

**Goal**: Measure everything to prioritize next optimizations

### Implementation Steps

1. **Instrument all components**
   - Planner decision latency
   - Agent startup time
   - Action execution time

2. **Set up dashboards**
   - p50/p95/p99 latencies
   - Error rates
   - Cache hit rates

3. **Add perf regression CI gates**
   - Fail if p95 increases by >10%

---

## Success Metrics

| Metric | Current | Target | Quick Win |
|--------|---------|--------|-----------|
| Agent warm start | ~1500ms | <300ms | Warm pool |
| Agent cold start | ~3000ms | <1500ms | Binary snapshot |
| Planner p95 | ~800ms | <400ms | Prompt optimization |
| Micro-decision | ~500ms | <100ms | Local model |

---

## References

- [Performance Architecture](performance-architecture.md)
- [Warm Pool Design](warm-pool-design.md)
- [Binary Snapshot Design](binary-snapshot-design.md)
