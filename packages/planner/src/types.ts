import { z } from 'zod';

// Capability types
export const CapabilitySchema = z.enum([
    'CAP_READ',
    'CAP_INTERACT',
    'CAP_NAVIGATE',
    'CAP_MUTATE',
    'CAP_PURCHASE',
    'CAP_PII',
]);

export type Capability = z.infer<typeof CapabilitySchema>;

// Action types
export const ActionTypeSchema = z.enum([
    'navigate',
    'click',
    'type',
    'scroll',
    'hover',
    'wait',
    'extract',
    'screenshot',
    'snapshot',
]);

export type ActionType = z.infer<typeof ActionTypeSchema>;

// Plan step schema
export const PlanStepSchema = z.object({
    step_id: z.string(),
    depends_on: z.array(z.string()),
    parallel_group: z.number().positive(),
    agent_type: z.enum(['browser_agent', 'api_agent']),
    action: ActionTypeSchema,
    target: z.string(),
    params: z.record(z.any()).optional(),
    capabilities_required: z.array(CapabilitySchema),
    expected_outcome: z.string().optional(),
    timeout: z.number().positive().optional(),
});

export type PlanStep = z.infer<typeof PlanStepSchema>;

// Plan metadata
export const PlanMetadataSchema = z.object({
    created_at: z.string(),
    planner_model: z.string(),
    confidence: z.number().min(0).max(1),
    estimated_duration_ms: z.number().positive(),
});

export type PlanMetadata = z.infer<typeof PlanMetadataSchema>;

// Complete Plan DAG schema
export const PlanDAGSchema = z.object({
    plan_id: z.string(),
    intent: z.string(),
    steps: z.array(PlanStepSchema),
    success_criteria: z.string(),
    rollback_plan: z.string().optional(),
    metadata: PlanMetadataSchema,
});

export type PlanDAG = z.infer<typeof PlanDAGSchema>;

// Planner request
export interface PlannerRequest {
    intent: string;
    context?: {
        currentUrl?: string;
        previousSteps?: PlanStep[];
        memory?: Record<string, unknown>;
    };
}

// Planner response
export interface PlannerResponse {
    success: boolean;
    plan?: PlanDAG;
    error?: string;
}
