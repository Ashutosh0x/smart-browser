/**
 * AB-OS Adblock Types
 * 
 * Canonical type definitions for the adblocking subsystem
 */

import { z } from 'zod';

// =============================================================================
// Rule Types
// =============================================================================

/**
 * Resource types that can be blocked
 */
export type ResourceType =
    | 'script'
    | 'image'
    | 'stylesheet'
    | 'font'
    | 'xhr'
    | 'fetch'
    | 'websocket'
    | 'webrtc'
    | 'media'
    | 'document'
    | 'subdocument'
    | 'ping'
    | 'other';

/**
 * Rule types supported by the engine
 */
export type RuleType =
    | 'network'     // Block network requests
    | 'css'         // Cosmetic filtering (element hiding)
    | 'script'      // Script injection/blocking
    | 'ws'          // WebSocket specific
    | 'webrtc'      // WebRTC specific
    | 'dom';        // DOM element removal

/**
 * Actions the rule can take
 */
export type RuleAction = 'block' | 'allow' | 'modify';

/**
 * Match criteria for rules
 */
export interface RuleMatch {
    /** Domain patterns (supports wildcards like *.example.com) */
    host?: string[];
    /** Regex pattern for path matching */
    path_regex?: string;
    /** Specific resource types to match */
    resource_type?: ResourceType[];
    /** First-party only */
    first_party?: boolean;
    /** Third-party only */
    third_party?: boolean;
}

/**
 * Rule metadata for provenance and updates
 */
export interface RuleMetadata {
    /** Source filter list (e.g., 'easylist', 'easyprivacy') */
    source: string;
    /** Rule priority (lower = higher priority) */
    priority: number;
    /** When the rule was added */
    added_at?: string;
    /** Rule version */
    version?: string;
}

/**
 * Canonical adblock rule format
 */
export interface AdblockRule {
    /** Unique rule identifier */
    rule_id: string;
    /** Type of rule */
    type: RuleType;
    /** Match criteria */
    match: RuleMatch;
    /** Action to take */
    action: RuleAction;
    /** CSS selector for cosmetic rules */
    css_selector?: string;
    /** Metadata */
    metadata: RuleMetadata;
    /** Whether rule is enabled */
    enabled: boolean;
}

// =============================================================================
// Adblock Mode & Configuration
// =============================================================================

/**
 * Adblock operating modes
 */
export type AdblockMode =
    | 'strict'      // Block all ads and trackers aggressively
    | 'balanced'    // Block most ads, allow acceptable ads
    | 'allowlist'   // Only block on specific sites
    | 'off';        // Disabled

/**
 * Per-agent adblock configuration
 */
export interface AdblockConfig {
    /** Operating mode */
    mode: AdblockMode;
    /** Sites where blocking is disabled */
    allowlist: string[];
    /** Sites where blocking is forced */
    denylist: string[];
    /** Enable DOM sanitizer */
    dom_sanitizer: boolean;
    /** Enable cosmetic filtering */
    cosmetic_filtering: boolean;
    /** Block WebSocket connections to ad servers */
    block_websockets: boolean;
    /** Strip tracking headers */
    strip_tracking_headers: boolean;
}

/**
 * Default adblock configuration
 */
export const DEFAULT_ADBLOCK_CONFIG: AdblockConfig = {
    mode: 'balanced',
    allowlist: [],
    denylist: [],
    dom_sanitizer: true,
    cosmetic_filtering: true,
    block_websockets: true,
    strip_tracking_headers: true,
};

// =============================================================================
// Blocked Request & Audit Types
// =============================================================================

/**
 * Blocked request audit entry
 */
export interface BlockedRequest {
    /** Unique request ID */
    request_id: string;
    /** Agent that triggered the request */
    agent_id: string;
    /** Timestamp of block decision */
    timestamp: number;
    /** Blocked URL */
    url: string;
    /** Host portion of URL */
    host: string;
    /** Resource type */
    resource_type: ResourceType;
    /** Rule that caused the block */
    rule_id: string;
    /** Action taken */
    action: RuleAction;
    /** Page URL where request originated */
    page_url?: string;
    /** HTTP method */
    method?: string;
    /** Content hash for audit verification */
    content_hash?: string;
}

/**
 * DOM mutation audit entry (for sanitizer)
 */
export interface DOMSanitizeEvent {
    /** Unique event ID */
    event_id: string;
    /** Agent ID */
    agent_id: string;
    /** Timestamp */
    timestamp: number;
    /** Page URL */
    page_url: string;
    /** CSS selector of removed element */
    selector: string;
    /** Reason for removal */
    reason: 'overlay' | 'ad_container' | 'autoplay' | 'tracker' | 'heuristic';
    /** Revert token for undo */
    revert_token?: string;
}

// =============================================================================
// Filter Bundle Types
// =============================================================================

/**
 * Signed filter bundle for updates
 */
export interface FilterBundle {
    /** Bundle version */
    version: string;
    /** Bundle name (e.g., 'easylist') */
    name: string;
    /** ISO timestamp of bundle creation */
    created_at: string;
    /** SHA-256 hash of rules content */
    content_hash: string;
    /** HSM signature for verification */
    signature: string;
    /** The rules in this bundle */
    rules: AdblockRule[];
    /** Delta patch from previous version (optional) */
    delta_from_version?: string;
}

/**
 * Filter bundle metadata (without full rules)
 */
export interface FilterBundleInfo {
    name: string;
    version: string;
    rule_count: number;
    last_updated: string;
    enabled: boolean;
}

// =============================================================================
// Engine Statistics
// =============================================================================

/**
 * Adblock engine statistics
 */
export interface AdblockStats {
    /** Total requests checked */
    requests_checked: number;
    /** Requests blocked */
    requests_blocked: number;
    /** Requests allowed by exception rules */
    requests_allowed: number;
    /** DOM elements removed */
    dom_elements_removed: number;
    /** Bytes saved (estimated) */
    bytes_saved: number;
    /** Page load time saved (ms) */
    time_saved_ms: number;
    /** Average match time (ms) */
    avg_match_time_ms: number;
    /** Rules loaded */
    rules_loaded: number;
}

// =============================================================================
// Zod Schemas for Validation
// =============================================================================

export const AdblockRuleSchema = z.object({
    rule_id: z.string(),
    type: z.enum(['network', 'css', 'script', 'ws', 'webrtc', 'dom']),
    match: z.object({
        host: z.array(z.string()).optional(),
        path_regex: z.string().optional(),
        resource_type: z.array(z.enum([
            'script', 'image', 'stylesheet', 'font', 'xhr', 'fetch',
            'websocket', 'webrtc', 'media', 'document', 'subdocument', 'ping', 'other'
        ])).optional(),
        first_party: z.boolean().optional(),
        third_party: z.boolean().optional(),
    }),
    action: z.enum(['block', 'allow', 'modify']),
    css_selector: z.string().optional(),
    metadata: z.object({
        source: z.string(),
        priority: z.number(),
        added_at: z.string().optional(),
        version: z.string().optional(),
    }),
    enabled: z.boolean(),
});

export const AdblockConfigSchema = z.object({
    mode: z.enum(['strict', 'balanced', 'allowlist', 'off']),
    allowlist: z.array(z.string()),
    denylist: z.array(z.string()),
    dom_sanitizer: z.boolean(),
    cosmetic_filtering: z.boolean(),
    block_websockets: z.boolean(),
    strip_tracking_headers: z.boolean(),
});
