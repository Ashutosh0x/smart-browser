import type { Page, BrowserContext } from 'playwright';

// Agent states
export type AgentState = 'created' | 'ready' | 'running' | 'paused' | 'complete' | 'failed';

// Action types (matching planner)
export type ActionType =
    | 'navigate'
    | 'click'
    | 'type'
    | 'scroll'
    | 'hover'
    | 'wait'
    | 'extract'
    | 'screenshot'
    | 'snapshot';

// Capability types
export type Capability =
    | 'CAP_READ'
    | 'CAP_INTERACT'
    | 'CAP_NAVIGATE'
    | 'CAP_MUTATE'
    | 'CAP_PURCHASE'
    | 'CAP_PII';

// Plan step from planner
export interface PlanStep {
    step_id: string;
    depends_on: string[];
    parallel_group: number;
    agent_type: 'browser_agent' | 'api_agent';
    action: ActionType;
    target: string;
    params?: Record<string, unknown>;
    capabilities_required: Capability[];
    expected_outcome?: string;
    timeout?: number;
}

// Step execution result
export interface StepResult {
    step_id: string;
    success: boolean;
    error?: string;
    data?: unknown;
    screenshot?: Buffer;
    duration_ms: number;
    content_hash_before?: string;
    content_hash_after?: string;
}

// Agent configuration
export interface AgentConfig {
    headless?: boolean;
    timeout?: number;
    viewport?: { width: number; height: number };
    userAgent?: string;
}

// Memory store types
export interface MemoryStore {
    shortTerm: Map<string, unknown>;
    working: Map<string, unknown>;
    episodic: Snapshot[];
}

// DOM Snapshot
export interface Snapshot {
    id: string;
    timestamp: string;
    url: string;
    title: string;
    html?: string;
    screenshot?: Buffer;
}

// Agent status
export interface AgentStatus {
    agentId: string;
    state: AgentState;
    currentStep: number;
    totalSteps: number;
    currentUrl?: string;
    error?: string;
    startedAt?: string;
    completedAt?: string;
}

// Audit log entry
export interface AuditEntry {
    timestamp: string;
    agentId: string;
    action: ActionType;
    target: string;
    success: boolean;
    duration_ms: number;
    error?: string;
}
