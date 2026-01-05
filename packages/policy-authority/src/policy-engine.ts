/**
 * AB-OS Policy Engine
 * 
 * DSL-based policy evaluation with auth requirements
 */

import { z } from 'zod';

// =============================================================================
// Policy Schema
// =============================================================================

const ConditionSchema = z.object({
    capability: z.string().optional(),
    domain: z.union([z.string(), z.array(z.string())]).optional(),
    domain_not: z.array(z.string()).optional(),
    amount: z.object({
        gt: z.number().optional(),
        lt: z.number().optional(),
        gte: z.number().optional(),
        lte: z.number().optional(),
    }).optional(),
    risk_level: z.enum(['low', 'medium', 'high']).optional(),
    agent_trust: z.enum(['trusted', 'standard', 'restricted', 'untrusted']).optional(),
    time: z.object({
        after: z.string().optional(),
        before: z.string().optional(),
        days: z.array(z.string()).optional(),
    }).optional(),
});

const ActionSchema = z.object({
    allow: z.boolean().optional(),
    deny: z.boolean().optional(),
    require_approval: z.boolean().optional(),
    requires_auth: z.enum(['none', 'passkey', 'platform', 'hardware_key', 'biometric', 'manager']).optional(),
    log_level: z.enum(['none', 'basic', 'detailed', 'full']).optional(),
    rate_limit: z.object({
        max: z.number(),
        period_seconds: z.number(),
    }).optional(),
    notify: z.array(z.string()).optional(),
    // Adblock policy actions
    adblock_mode: z.enum(['strict', 'balanced', 'allowlist', 'off']).optional(),
    adblock_override: z.boolean().optional(),
});

const PolicyRuleSchema = z.object({
    name: z.string(),
    description: z.string().optional(),
    priority: z.number().optional().default(100),
    when: ConditionSchema,
    then: ActionSchema,
});

const PolicySchema = z.object({
    version: z.string().optional().default('1.0'),
    name: z.string(),
    description: z.string().optional(),
    rules: z.array(PolicyRuleSchema),
});

export type Condition = z.infer<typeof ConditionSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type PolicyRule = z.infer<typeof PolicyRuleSchema>;
export type Policy = z.infer<typeof PolicySchema>;

// =============================================================================
// Evaluation Context
// =============================================================================

export interface EvaluationContext {
    agent_id: string;
    capability: string;
    domain: string;
    amount?: number;
    risk_level?: 'low' | 'medium' | 'high';
    agent_trust?: 'trusted' | 'standard' | 'restricted' | 'untrusted';
    timestamp?: Date;
}

export interface EvaluationResult {
    allowed: boolean;
    requires_approval: boolean;
    requires_auth: string;
    matched_rules: string[];
    denying_rule?: string;
    log_level: string;
    rate_limited: boolean;
    notifications: string[];
}

// =============================================================================
// Policy Engine
// =============================================================================

export class PolicyEngine {
    private policies: Policy[] = [];
    private rateLimitCounters: Map<string, { count: number; reset_at: number }> = new Map();

    constructor() {
        // Load default policies
        this.loadDefaultPolicies();
    }

    // ---------------------------------------------------------------------------
    // Policy Management
    // ---------------------------------------------------------------------------

    loadPolicy(policyYaml: unknown): Policy {
        const policy = PolicySchema.parse(policyYaml);
        this.policies.push(policy);
        console.log('[PolicyEngine] Policy loaded:', policy.name);
        return policy;
    }

    private loadDefaultPolicies(): void {
        // High-value purchase policy
        this.policies.push({
            version: '1.0',
            name: 'default-purchase-policy',
            description: 'Require passkey for purchases over $50',
            rules: [
                {
                    name: 'high-value-purchase',
                    priority: 10,
                    when: {
                        capability: 'CAP_PURCHASE',
                        amount: { gt: 50 },
                    },
                    then: {
                        allow: true,
                        requires_auth: 'passkey',
                        require_approval: true,
                        log_level: 'full',
                    },
                },
                {
                    name: 'low-value-purchase',
                    priority: 20,
                    when: {
                        capability: 'CAP_PURCHASE',
                        amount: { lte: 50 },
                    },
                    then: {
                        allow: true,
                        requires_auth: 'passkey',
                        log_level: 'detailed',
                    },
                },
            ],
        });

        // Delete action policy
        this.policies.push({
            version: '1.0',
            name: 'default-delete-policy',
            rules: [
                {
                    name: 'require-approval-for-delete',
                    priority: 5,
                    when: {
                        capability: 'CAP_DELETE',
                    },
                    then: {
                        allow: true,
                        requires_auth: 'hardware_key',
                        require_approval: true,
                        log_level: 'full',
                    },
                },
            ],
        });

        // Banking domain policy
        this.policies.push({
            version: '1.0',
            name: 'banking-protection',
            rules: [
                {
                    name: 'bank-write-protection',
                    priority: 1,
                    when: {
                        capability: 'CAP_WRITE',
                        domain: ['*.bank.com', '*.chase.com', '*.bankofamerica.com'],
                    },
                    then: {
                        allow: true,
                        requires_auth: 'passkey',
                        require_approval: true,
                        log_level: 'full',
                        notify: ['security@company.com'],
                    },
                },
            ],
        });

        // Rate limiting policy
        this.policies.push({
            version: '1.0',
            name: 'rate-limiting',
            rules: [
                {
                    name: 'navigate-rate-limit',
                    priority: 50,
                    when: {
                        capability: 'CAP_NAVIGATE',
                    },
                    then: {
                        allow: true,
                        rate_limit: {
                            max: 60,
                            period_seconds: 60,
                        },
                        log_level: 'basic',
                    },
                },
            ],
        });

        // Default adblock policy - strict for guests, balanced for standard
        this.policies.push({
            version: '1.0',
            name: 'default-adblock-policy',
            description: 'Adblock mode per profile/trust level',
            rules: [
                {
                    name: 'guest-strict-adblock',
                    priority: 10,
                    when: {
                        agent_trust: 'untrusted',
                    },
                    then: {
                        adblock_mode: 'strict',
                        log_level: 'detailed',
                    },
                },
                {
                    name: 'restricted-strict-adblock',
                    priority: 15,
                    when: {
                        agent_trust: 'restricted',
                    },
                    then: {
                        adblock_mode: 'strict',
                    },
                },
                {
                    name: 'standard-balanced-adblock',
                    priority: 20,
                    when: {
                        agent_trust: 'standard',
                    },
                    then: {
                        adblock_mode: 'balanced',
                    },
                },
                {
                    name: 'trusted-balanced-adblock',
                    priority: 25,
                    when: {
                        agent_trust: 'trusted',
                    },
                    then: {
                        adblock_mode: 'balanced',
                    },
                },
            ],
        });

        // Banking domain adblock override protection
        this.policies.push({
            version: '1.0',
            name: 'adblock-banking-protection',
            description: 'Deny adblock override for banking sites',
            rules: [
                {
                    name: 'deny-adblock-override-banking',
                    priority: 1,
                    when: {
                        capability: 'CAP_ADBLOCK_OVERRIDE',
                        domain: ['*.bank.com', '*.chase.com', '*.bankofamerica.com', '*.wellsfargo.com'],
                    },
                    then: {
                        deny: true,
                        log_level: 'full',
                    },
                },
            ],
        });
    }

    // ---------------------------------------------------------------------------
    // Evaluation
    // ---------------------------------------------------------------------------

    evaluate(context: EvaluationContext): EvaluationResult {
        const result: EvaluationResult = {
            allowed: true,
            requires_approval: false,
            requires_auth: 'none',
            matched_rules: [],
            log_level: 'basic',
            rate_limited: false,
            notifications: [],
        };

        // Collect all matching rules with priority
        const matchingRules: { rule: PolicyRule; policy: Policy }[] = [];

        for (const policy of this.policies) {
            for (const rule of policy.rules) {
                if (this.matchesCondition(rule.when, context)) {
                    matchingRules.push({ rule, policy });
                }
            }
        }

        // Sort by priority (lower = higher priority)
        matchingRules.sort((a, b) => (a.rule.priority || 100) - (b.rule.priority || 100));

        // Apply rules
        for (const { rule } of matchingRules) {
            result.matched_rules.push(rule.name);

            // Check deny
            if (rule.then.deny) {
                result.allowed = false;
                result.denying_rule = rule.name;
                break;
            }

            // Check allow with conditions
            if (rule.then.allow !== undefined) {
                result.allowed = rule.then.allow;
            }

            // Require approval
            if (rule.then.require_approval) {
                result.requires_approval = true;
            }

            // Auth requirement (take strictest)
            if (rule.then.requires_auth) {
                result.requires_auth = this.stricterAuth(result.requires_auth, rule.then.requires_auth);
            }

            // Log level (take highest)
            if (rule.then.log_level) {
                result.log_level = this.higherLogLevel(result.log_level, rule.then.log_level);
            }

            // Rate limit check
            if (rule.then.rate_limit) {
                const limited = this.checkRateLimit(
                    `${context.agent_id}:${context.capability}`,
                    rule.then.rate_limit.max,
                    rule.then.rate_limit.period_seconds
                );
                if (limited) {
                    result.rate_limited = true;
                    result.allowed = false;
                    result.denying_rule = `${rule.name}:rate_limit`;
                }
            }

            // Notifications
            if (rule.then.notify) {
                result.notifications.push(...rule.then.notify);
            }
        }

        return result;
    }

    // ---------------------------------------------------------------------------
    // Condition Matching
    // ---------------------------------------------------------------------------

    private matchesCondition(condition: Condition, context: EvaluationContext): boolean {
        // Capability
        if (condition.capability && condition.capability !== context.capability) {
            return false;
        }

        // Domain
        if (condition.domain) {
            const domains = Array.isArray(condition.domain) ? condition.domain : [condition.domain];
            const matches = domains.some(d => this.matchDomain(d, context.domain));
            if (!matches) return false;
        }

        // Domain exclusion
        if (condition.domain_not) {
            const matches = condition.domain_not.some(d => this.matchDomain(d, context.domain));
            if (matches) return false;
        }

        // Amount
        if (condition.amount && context.amount !== undefined) {
            if (condition.amount.gt !== undefined && context.amount <= condition.amount.gt) return false;
            if (condition.amount.lt !== undefined && context.amount >= condition.amount.lt) return false;
            if (condition.amount.gte !== undefined && context.amount < condition.amount.gte) return false;
            if (condition.amount.lte !== undefined && context.amount > condition.amount.lte) return false;
        }

        // Risk level
        if (condition.risk_level && condition.risk_level !== context.risk_level) {
            return false;
        }

        // Agent trust
        if (condition.agent_trust && condition.agent_trust !== context.agent_trust) {
            return false;
        }

        return true;
    }

    private matchDomain(pattern: string, domain: string): boolean {
        if (pattern.startsWith('*.')) {
            const suffix = pattern.slice(1);
            return domain.endsWith(suffix) || domain === pattern.slice(2);
        }
        return pattern === domain;
    }

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------

    private stricterAuth(a: string, b: string): string {
        const order = ['none', 'passkey', 'platform', 'biometric', 'hardware_key', 'manager'];
        return order.indexOf(a) > order.indexOf(b) ? a : b;
    }

    private higherLogLevel(a: string, b: string): string {
        const order = ['none', 'basic', 'detailed', 'full'];
        return order.indexOf(a) > order.indexOf(b) ? a : b;
    }

    private checkRateLimit(key: string, max: number, periodSeconds: number): boolean {
        const now = Date.now();
        const counter = this.rateLimitCounters.get(key);

        if (!counter || now > counter.reset_at) {
            this.rateLimitCounters.set(key, { count: 1, reset_at: now + periodSeconds * 1000 });
            return false;
        }

        counter.count++;
        return counter.count > max;
    }
}
