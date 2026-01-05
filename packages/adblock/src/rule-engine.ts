/**
 * AB-OS Adblock Rule Engine
 * 
 * High-performance rule matching engine using trie-based domain lookups
 * and compiled regex patterns for path matching.
 */

import {
    AdblockRule,
    ResourceType,
    RuleAction,
    BlockedRequest,
    AdblockStats,
} from './types';

// =============================================================================
// Trie Node for Domain Matching
// =============================================================================

interface TrieNode {
    children: Map<string, TrieNode>;
    rules: AdblockRule[];
    /** Wildcard rules that match any subdomain */
    wildcardRules: AdblockRule[];
}

function createTrieNode(): TrieNode {
    return {
        children: new Map(),
        rules: [],
        wildcardRules: [],
    };
}

// =============================================================================
// Rule Engine
// =============================================================================

export interface MatchResult {
    matched: boolean;
    rule?: AdblockRule;
    action: RuleAction;
}

export interface InterceptRequest {
    url: string;
    host: string;
    path: string;
    resource_type: ResourceType;
    page_url?: string;
    is_third_party: boolean;
    method?: string;
}

export class RuleEngine {
    private domainTrie: TrieNode = createTrieNode();
    private pathRegexCache: Map<string, RegExp> = new Map();
    private rules: Map<string, AdblockRule> = new Map();
    private stats: AdblockStats = this.createEmptyStats();

    // -------------------------------------------------------------------------
    // Rule Management
    // -------------------------------------------------------------------------

    /**
     * Load rules into the engine
     */
    loadRules(rules: AdblockRule[]): void {
        for (const rule of rules) {
            if (!rule.enabled) continue;
            this.addRule(rule);
        }
        this.stats.rules_loaded = this.rules.size;
        console.log(`[RuleEngine] Loaded ${this.rules.size} rules`);
    }

    /**
     * Add a single rule to the engine
     */
    addRule(rule: AdblockRule): void {
        this.rules.set(rule.rule_id, rule);

        // Index by domain for fast lookup
        if (rule.match.host && rule.match.host.length > 0) {
            for (const hostPattern of rule.match.host) {
                this.indexByDomain(hostPattern, rule);
            }
        } else {
            // Rules without host match all domains - add to root
            this.domainTrie.rules.push(rule);
        }

        // Pre-compile path regex if present
        if (rule.match.path_regex) {
            try {
                const compiled = new RegExp(rule.match.path_regex);
                this.pathRegexCache.set(rule.rule_id, compiled);
            } catch (e) {
                console.warn(`[RuleEngine] Invalid regex in rule ${rule.rule_id}: ${rule.match.path_regex}`);
            }
        }
    }

    /**
     * Remove a rule from the engine
     */
    removeRule(ruleId: string): boolean {
        const rule = this.rules.get(ruleId);
        if (!rule) return false;

        this.rules.delete(ruleId);
        this.pathRegexCache.delete(ruleId);
        // Note: Removing from trie is expensive, typically we rebuild
        return true;
    }

    /**
     * Clear all rules
     */
    clearRules(): void {
        this.domainTrie = createTrieNode();
        this.pathRegexCache.clear();
        this.rules.clear();
        this.stats = this.createEmptyStats();
    }

    // -------------------------------------------------------------------------
    // Domain Trie Indexing
    // -------------------------------------------------------------------------

    private indexByDomain(hostPattern: string, rule: AdblockRule): void {
        const isWildcard = hostPattern.startsWith('*.');
        const domain = isWildcard ? hostPattern.slice(2) : hostPattern;

        // Split domain into parts and reverse for trie insertion
        // e.g., "ads.example.com" -> ["com", "example", "ads"]
        const parts = domain.split('.').reverse();

        let node = this.domainTrie;
        for (const part of parts) {
            if (!node.children.has(part)) {
                node.children.set(part, createTrieNode());
            }
            node = node.children.get(part)!;
        }

        if (isWildcard) {
            node.wildcardRules.push(rule);
        } else {
            node.rules.push(rule);
        }
    }

    private findMatchingRules(host: string): AdblockRule[] {
        const parts = host.split('.').reverse();
        const matchingRules: AdblockRule[] = [...this.domainTrie.rules];

        let node = this.domainTrie;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];

            // Collect wildcard rules at current level (for subdomain matching)
            matchingRules.push(...node.wildcardRules);

            // Move to child node
            if (!node.children.has(part)) {
                break;
            }
            node = node.children.get(part)!;

            // After moving, if this is the last part, collect rules from this node
            if (i === parts.length - 1) {
                matchingRules.push(...node.rules);
                matchingRules.push(...node.wildcardRules);
            }
        }

        return matchingRules;
    }

    // -------------------------------------------------------------------------
    // Request Matching
    // -------------------------------------------------------------------------

    /**
     * Check if a request should be blocked
     */
    match(request: InterceptRequest): MatchResult {
        const startTime = performance.now();
        this.stats.requests_checked++;

        // Find all rules that could match this domain
        const candidateRules = this.findMatchingRules(request.host);

        // Sort by priority (lower = higher priority)
        candidateRules.sort((a, b) => a.metadata.priority - b.metadata.priority);

        let matchedRule: AdblockRule | undefined;

        for (const rule of candidateRules) {
            if (this.ruleMatches(rule, request)) {
                matchedRule = rule;
                break;
            }
        }

        // Update timing stats
        const matchTime = performance.now() - startTime;
        this.stats.avg_match_time_ms =
            (this.stats.avg_match_time_ms * (this.stats.requests_checked - 1) + matchTime)
            / this.stats.requests_checked;

        if (matchedRule) {
            if (matchedRule.action === 'block') {
                this.stats.requests_blocked++;
            } else if (matchedRule.action === 'allow') {
                this.stats.requests_allowed++;
            }

            return {
                matched: true,
                rule: matchedRule,
                action: matchedRule.action,
            };
        }

        return { matched: false, action: 'allow' };
    }

    private ruleMatches(rule: AdblockRule, request: InterceptRequest): boolean {
        // Skip CSS rules - they are for DOM sanitization, not network blocking
        if (rule.type === 'css') {
            return false;
        }

        // Check resource type
        if (rule.match.resource_type && rule.match.resource_type.length > 0) {
            if (!rule.match.resource_type.includes(request.resource_type)) {
                return false;
            }
        }

        // Check first-party/third-party
        if (rule.match.third_party !== undefined) {
            if (rule.match.third_party !== request.is_third_party) {
                return false;
            }
        }
        if (rule.match.first_party !== undefined) {
            if (rule.match.first_party === request.is_third_party) {
                return false;
            }
        }

        // Check path regex
        if (rule.match.path_regex) {
            const regex = this.pathRegexCache.get(rule.rule_id);
            if (regex && !regex.test(request.path)) {
                return false;
            }
        }

        return true;
    }

    // -------------------------------------------------------------------------
    // Audit & Statistics
    // -------------------------------------------------------------------------

    /**
     * Create a blocked request audit entry
     */
    createBlockedRequestAudit(
        request: InterceptRequest,
        result: MatchResult,
        agentId: string
    ): BlockedRequest | null {
        if (!result.matched || !result.rule) return null;

        return {
            request_id: crypto.randomUUID(),
            agent_id: agentId,
            timestamp: Date.now(),
            url: request.url,
            host: request.host,
            resource_type: request.resource_type,
            rule_id: result.rule.rule_id,
            action: result.action,
            page_url: request.page_url,
            method: request.method,
        };
    }

    /**
     * Get current statistics
     */
    getStats(): AdblockStats {
        return { ...this.stats };
    }

    /**
     * Reset statistics
     */
    resetStats(): void {
        this.stats = this.createEmptyStats();
    }

    private createEmptyStats(): AdblockStats {
        return {
            requests_checked: 0,
            requests_blocked: 0,
            requests_allowed: 0,
            dom_elements_removed: 0,
            bytes_saved: 0,
            time_saved_ms: 0,
            avg_match_time_ms: 0,
            rules_loaded: 0,
        };
    }

    /**
     * Get number of loaded rules
     */
    getRuleCount(): number {
        return this.rules.size;
    }
}
