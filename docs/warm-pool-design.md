# Warm Pool Implementation

## Overview

Warm pools maintain pre-initialized browser contexts for frequently-used domains, enabling <300ms agent startup instead of 1-3 seconds cold start.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Warm Pool Manager                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │                Pool Registry                         │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │    │
│  │  │ spotify │ │  gmail  │ │ amazon  │ │ github  │   │    │
│  │  │  Pool   │ │  Pool   │ │  Pool   │ │  Pool   │   │    │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘   │    │
│  │       │           │           │           │         │    │
│  │       ▼           ▼           ▼           ▼         │    │
│  │  [ctx1,ctx2] [ctx1,ctx2] [ctx1,ctx2] [ctx1,ctx2]   │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  Health Monitor │ Evictor │ Prewarmer │ Metrics            │
└─────────────────────────────────────────────────────────────┘
```

---

## Pool Configuration

```yaml
warmPool:
  # Global settings
  maxTotalContexts: 100
  defaultIdleTimeout: 300s
  healthCheckInterval: 30s
  
  # Domain-specific pools
  pools:
    - domain: "*.spotify.com"
      minSize: 3
      maxSize: 10
      idleTimeout: 600s
      prewarm:
        url: "https://open.spotify.com"
        waitFor: "[data-testid='user-widget']"
      
    - domain: "*.mail.google.com"
      minSize: 2
      maxSize: 8
      idleTimeout: 600s
      prewarm:
        url: "https://mail.google.com"
        waitFor: "[role='main']"
      
    - domain: "*.amazon.com"
      minSize: 2
      maxSize: 8
      idleTimeout: 300s
      prewarm:
        url: "https://www.amazon.com"
        waitFor: "#nav-logo"
      
    - domain: "*.github.com"
      minSize: 2
      maxSize: 6
      idleTimeout: 600s
      prewarm:
        url: "https://github.com"
        waitFor: "[data-target='qbsearch-input.inputButtonText']"
```

---

## Context Lifecycle

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Creating │───▶│  Warming │───▶│   Ready  │───▶│ Acquired │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                     │               │
                                     │               │
                                     ▼               ▼
                               ┌──────────┐    ┌──────────┐
                               │  Evicted │    │ Released │
                               └──────────┘    └──────────┘
                                                    │
                                                    │ reset
                                                    ▼
                                              ┌──────────┐
                                              │   Ready  │
                                              └──────────┘
```

---

## Implementation

### PooledContext

```typescript
interface PooledContext {
  id: string;
  domain: string;
  context: BrowserContext;
  page: Page;
  state: 'creating' | 'warming' | 'ready' | 'acquired' | 'released';
  createdAt: Date;
  lastUsedAt: Date;
  warmUrl?: string;
  healthScore: number;  // 0-100
}
```

### WarmPoolManager

```typescript
class WarmPoolManager {
  private pools: Map<string, PooledContext[]> = new Map();
  private config: WarmPoolConfig;
  private browser: Browser;

  async acquire(domain: string): Promise<PooledContext | null> {
    const pool = this.pools.get(domain);
    if (!pool || pool.length === 0) {
      return null;  // No warm context, caller should cold start
    }

    // Find healthiest ready context
    const ctx = pool
      .filter(c => c.state === 'ready')
      .sort((a, b) => b.healthScore - a.healthScore)[0];

    if (!ctx) return null;

    ctx.state = 'acquired';
    ctx.lastUsedAt = new Date();
    
    // Trigger replenishment
    this.replenish(domain);
    
    return ctx;
  }

  async release(ctx: PooledContext): Promise<void> {
    // Reset context state
    await this.resetContext(ctx);
    ctx.state = 'ready';
    ctx.lastUsedAt = new Date();
  }

  private async resetContext(ctx: PooledContext): Promise<void> {
    // Clear cookies, localStorage, sessionStorage
    await ctx.context.clearCookies();
    await ctx.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Navigate back to warm URL
    if (ctx.warmUrl) {
      await ctx.page.goto(ctx.warmUrl, { waitUntil: 'domcontentloaded' });
    }
  }

  private async replenish(domain: string): Promise<void> {
    const config = this.getPoolConfig(domain);
    const pool = this.pools.get(domain) || [];
    const ready = pool.filter(c => c.state === 'ready').length;

    if (ready < config.minSize) {
      const toCreate = config.minSize - ready;
      for (let i = 0; i < toCreate; i++) {
        this.createWarmContext(domain);
      }
    }
  }
}
```

---

## Health Scoring

```typescript
function calculateHealthScore(ctx: PooledContext): number {
  let score = 100;

  // Age penalty (older = less healthy)
  const ageMinutes = (Date.now() - ctx.createdAt.getTime()) / 60000;
  score -= Math.min(30, ageMinutes * 0.5);

  // Idle penalty (unused for long = potentially stale)
  const idleMinutes = (Date.now() - ctx.lastUsedAt.getTime()) / 60000;
  score -= Math.min(20, idleMinutes * 0.3);

  // Memory pressure penalty
  // (would need to measure context memory usage)

  return Math.max(0, Math.round(score));
}
```

---

## Eviction Policy

```typescript
async function evict(pool: PooledContext[], config: PoolConfig): Promise<void> {
  const now = Date.now();

  for (const ctx of pool) {
    // Evict if idle too long
    if (ctx.state === 'ready') {
      const idleMs = now - ctx.lastUsedAt.getTime();
      if (idleMs > config.idleTimeout * 1000) {
        await ctx.context.close();
        ctx.state = 'evicted';
      }
    }

    // Evict if health score too low
    if (ctx.healthScore < 20) {
      await ctx.context.close();
      ctx.state = 'evicted';
    }
  }

  // Remove evicted from pool
  pool = pool.filter(c => c.state !== 'evicted');
}
```

---

## Metrics

```typescript
// Prometheus metrics
const warmPoolAcquireLatency = new Histogram({
  name: 'abos_warm_pool_acquire_seconds',
  help: 'Time to acquire warm context',
  labelNames: ['domain', 'hit'],  // hit=true|false
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
});

const warmPoolSize = new Gauge({
  name: 'abos_warm_pool_size',
  help: 'Current warm pool size by domain',
  labelNames: ['domain', 'state'],
});

const warmPoolHitRate = new Counter({
  name: 'abos_warm_pool_requests_total',
  help: 'Total warm pool requests',
  labelNames: ['domain', 'result'],  // hit|miss
});
```

---

## Expected Performance

| Metric | Cold Start | Warm Start | Improvement |
|--------|------------|------------|-------------|
| Context creation | 800-1500ms | <50ms | 16-30x |
| Page navigation | 500-2000ms | <100ms | 5-20x |
| Total agent start | 1500-3000ms | <300ms | 5-10x |

---

## References

- [Performance Architecture](performance-architecture.md)
- [Agent Runtime Design](../packages/agent-runtime/design.md)
