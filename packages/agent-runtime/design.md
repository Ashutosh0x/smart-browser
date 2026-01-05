# Agent Runtime Design

## Overview

The Agent Runtime implements an actor-based system for managing concurrent AI agents. Each agent operates in isolation with its own memory store and browser context.

---

## Actor Model

### Agent Actor

```typescript
interface AgentActor {
  id: string;
  mailbox: Message[];
  state: AgentState;
  memory: MemoryStore;
  context: BrowserContext;
  
  // Receive and process messages
  receive(message: Message): Promise<void>;
  
  // Execute a step from the plan
  executeStep(step: PlanStep): Promise<StepResult>;
  
  // Clean up resources
  terminate(): Promise<void>;
}
```

### Message Types

```typescript
type Message =
  | { type: 'execute'; step: PlanStep }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'terminate' }
  | { type: 'status_request' };
```

---

## Memory Store

Each agent has isolated memory:

```typescript
interface MemoryStore {
  // Short-term: current step context
  shortTerm: Map<string, any>;
  
  // Working: cross-step context (URLs, extracted data)
  working: Map<string, any>;
  
  // Episodic: historical snapshots
  episodic: Snapshot[];
  
  // Methods
  get(key: string): any;
  set(key: string, value: any): void;
  snapshot(): Snapshot;
}
```

---

## Warm Pool

Pre-created browser contexts for fast startup:

```typescript
class WarmPool {
  private available: BrowserContext[] = [];
  private inUse: Map<string, BrowserContext> = new Map();
  
  constructor(private config: WarmPoolConfig) {
    this.initialize();
  }
  
  async acquire(): Promise<BrowserContext> {
    if (this.available.length > 0) {
      return this.available.pop()!;
    }
    return this.createNewContext();
  }
  
  async release(context: BrowserContext): Promise<void> {
    await this.resetContext(context);
    if (this.available.length < this.config.maxSize) {
      this.available.push(context);
    } else {
      await context.close();
    }
  }
}
```

---

## Scheduler

The scheduler manages agent execution:

```typescript
class Scheduler {
  private agents: Map<string, AgentActor> = new Map();
  private queue: PriorityQueue<Task>;
  
  async spawn(request: StartAgentRequest): Promise<AgentActor> {
    // 1. Acquire browser context from warm pool
    const context = await this.warmPool.acquire();
    
    // 2. Create agent actor
    const agent = new AgentActor({
      id: request.agentId,
      context,
      capabilities: request.capabilities,
    });
    
    // 3. Register agent
    this.agents.set(agent.id, agent);
    
    // 4. Queue initial step
    this.queue.enqueue({
      agentId: agent.id,
      step: request.planDag.steps[0],
    });
    
    return agent;
  }
  
  async tick(): Promise<void> {
    // Process next task in queue
    const task = this.queue.dequeue();
    if (!task) return;
    
    const agent = this.agents.get(task.agentId);
    if (!agent) return;
    
    await agent.executeStep(task.step);
  }
}
```

---

## LLM Integration

Agents use local LLMs for micro-planning:

```typescript
interface AgentLLM {
  // Generate next action based on current state
  planNextAction(
    memory: MemoryStore,
    snapshot: DOMSnapshot,
    goal: string
  ): Promise<Action>;
  
  // Handle unexpected states
  handleError(
    error: Error,
    snapshot: DOMSnapshot
  ): Promise<RecoveryAction>;
}

// Configuration
const agentLLM: LLMConfig = {
  provider: 'ollama',
  model: 'mistral:latest',
  endpoint: 'http://localhost:11434',
  temperature: 0.2,
  maxTokens: 1024,
};
```

---

## Parallel Execution

Agents in the same parallel group execute concurrently:

```typescript
async function executeParallelGroup(
  agents: AgentActor[],
  steps: PlanStep[]
): Promise<StepResult[]> {
  // Execute all steps concurrently
  const results = await Promise.all(
    agents.map((agent, i) => agent.executeStep(steps[i]))
  );
  
  // Wait for all to complete before next group
  return results;
}
```

---

## Error Handling

```typescript
async function executeWithRetry(
  agent: AgentActor,
  step: PlanStep,
  maxRetries: number = 3
): Promise<StepResult> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await agent.executeStep(step);
    } catch (error) {
      // Ask LLM for recovery action
      const recovery = await agent.llm.handleError(
        error,
        await agent.snapshot()
      );
      
      // Execute recovery
      await agent.executeAction(recovery);
    }
  }
  
  throw new Error(`Step failed after ${maxRetries} attempts`);
}
```

---

## Metrics

```typescript
// Prometheus metrics
const agentActiveGauge = new Gauge({
  name: 'abos_agent_active_count',
  help: 'Number of active agents',
});

const agentStepDuration = new Histogram({
  name: 'abos_agent_step_duration_seconds',
  help: 'Agent step execution time',
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

const warmPoolSize = new Gauge({
  name: 'abos_warm_pool_size',
  help: 'Available contexts in warm pool',
});
```

---

## References

- [README](README.md)
- [Runtime Config](runtime-config.yaml)
