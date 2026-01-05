/**
 * AB-OS Network Interceptor
 * 
 * Network-level request interception for adblocking.
 * Integrates with the kernel network layer to block/modify requests
 * before they reach the renderer.
 */

import { RuleEngine, InterceptRequest, MatchResult } from './rule-engine';
import {
    AdblockConfig,
    BlockedRequest,
    ResourceType,
    DEFAULT_ADBLOCK_CONFIG
} from './types';

// =============================================================================
// Types
// =============================================================================

export interface NetworkRequest {
    request_id: string;
    url: string;
    method: string;
    resource_type: string;
    headers: Record<string, string>;
    page_url?: string;
    agent_id: string;
}

export interface InterceptDecision {
    blocked: boolean;
    modified: boolean;
    rule_id?: string;
    modified_headers?: Record<string, string>;
    reason?: string;
}

export interface InterceptorEvents {
    onBlock: (request: BlockedRequest) => void;
    onAllow: (request: NetworkRequest, reason?: string) => void;
    onModify: (request: NetworkRequest, modifications: Record<string, string>) => void;
}

// =============================================================================
// Tracking Headers to Strip
// =============================================================================

const TRACKING_HEADERS = [
    'x-fb-trace-id',
    'x-fb-rev',
    'x-ga-',
    'x-goog-visitor-id',
    'x-client-data',
    'x-requested-with',
];

const HEADERS_TO_STRIP = [
    'referer', // Stripped for third-party requests in strict mode
];

// =============================================================================
// Network Interceptor
// =============================================================================

export class NetworkInterceptor {
    private ruleEngine: RuleEngine;
    private config: AdblockConfig;
    private events: Partial<InterceptorEvents> = {};
    private auditLog: BlockedRequest[] = [];
    private maxAuditLogSize = 1000;

    constructor(ruleEngine: RuleEngine, config?: Partial<AdblockConfig>) {
        this.ruleEngine = ruleEngine;
        this.config = { ...DEFAULT_ADBLOCK_CONFIG, ...config };
    }

    // -------------------------------------------------------------------------
    // Configuration
    // -------------------------------------------------------------------------

    updateConfig(config: Partial<AdblockConfig>): void {
        this.config = { ...this.config, ...config };
    }

    getConfig(): AdblockConfig {
        return { ...this.config };
    }

    setEventHandlers(events: Partial<InterceptorEvents>): void {
        this.events = events;
    }

    // -------------------------------------------------------------------------
    // Request Interception
    // -------------------------------------------------------------------------

    /**
     * Main interception entry point
     * Called for each outgoing request
     */
    intercept(request: NetworkRequest): InterceptDecision {
        // Check if adblock is disabled
        if (this.config.mode === 'off') {
            return { blocked: false, modified: false };
        }

        // Parse URL
        const url = new URL(request.url);
        const host = url.hostname;
        const path = url.pathname + url.search;

        // Check allowlist
        if (this.isAllowlisted(host)) {
            this.events.onAllow?.(request, 'allowlist');
            return { blocked: false, modified: false, reason: 'allowlist' };
        }

        // Determine third-party status
        const isThirdParty = this.isThirdParty(host, request.page_url);

        // Build intercept request
        const interceptReq: InterceptRequest = {
            url: request.url,
            host,
            path,
            resource_type: this.normalizeResourceType(request.resource_type),
            page_url: request.page_url,
            is_third_party: isThirdParty,
            method: request.method,
        };

        // Check rule engine
        const result = this.ruleEngine.match(interceptReq);

        if (result.matched && result.action === 'block') {
            return this.handleBlock(request, interceptReq, result);
        }

        // Check for header modifications
        const modifications = this.getHeaderModifications(request, isThirdParty);
        if (Object.keys(modifications).length > 0) {
            this.events.onModify?.(request, modifications);
            return {
                blocked: false,
                modified: true,
                modified_headers: modifications,
            };
        }

        return { blocked: false, modified: false };
    }

    private handleBlock(
        request: NetworkRequest,
        interceptReq: InterceptRequest,
        result: MatchResult
    ): InterceptDecision {
        // Create audit entry
        const auditEntry = this.ruleEngine.createBlockedRequestAudit(
            interceptReq,
            result,
            request.agent_id
        );

        if (auditEntry) {
            this.addToAuditLog(auditEntry);
            this.events.onBlock?.(auditEntry);
        }

        return {
            blocked: true,
            modified: false,
            rule_id: result.rule?.rule_id,
            reason: 'blocked by rule',
        };
    }

    // -------------------------------------------------------------------------
    // Header Modifications
    // -------------------------------------------------------------------------

    private getHeaderModifications(
        request: NetworkRequest,
        isThirdParty: boolean
    ): Record<string, string> {
        const modifications: Record<string, string> = {};

        if (!this.config.strip_tracking_headers) {
            return modifications;
        }

        const headers = request.headers;

        // Remove tracking headers
        for (const headerPrefix of TRACKING_HEADERS) {
            for (const key of Object.keys(headers)) {
                if (key.toLowerCase().startsWith(headerPrefix.toLowerCase())) {
                    modifications[key] = ''; // Empty string = remove header
                }
            }
        }

        // Strip referer for third-party in strict mode
        if (this.config.mode === 'strict' && isThirdParty) {
            if (headers['referer'] || headers['Referer']) {
                modifications['Referer'] = '';
            }
        }

        return modifications;
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private isAllowlisted(host: string): boolean {
        return this.config.allowlist.some(pattern => {
            if (pattern.startsWith('*.')) {
                const suffix = pattern.slice(1);
                return host.endsWith(suffix) || host === pattern.slice(2);
            }
            return pattern === host;
        });
    }

    private isThirdParty(requestHost: string, pageUrl?: string): boolean {
        if (!pageUrl) return true;

        try {
            const pageHost = new URL(pageUrl).hostname;

            // Extract eTLD+1 (simplified)
            const requestDomain = this.getBaseDomain(requestHost);
            const pageDomain = this.getBaseDomain(pageHost);

            return requestDomain !== pageDomain;
        } catch {
            return true;
        }
    }

    private getBaseDomain(host: string): string {
        // Simplified eTLD+1 extraction
        const parts = host.split('.');
        if (parts.length <= 2) return host;
        return parts.slice(-2).join('.');
    }

    private normalizeResourceType(type: string): ResourceType {
        const typeMap: Record<string, ResourceType> = {
            'script': 'script',
            'stylesheet': 'stylesheet',
            'image': 'image',
            'font': 'font',
            'xhr': 'xhr',
            'xmlhttprequest': 'xhr',
            'fetch': 'fetch',
            'websocket': 'websocket',
            'media': 'media',
            'document': 'document',
            'subdocument': 'subdocument',
            'iframe': 'subdocument',
            'ping': 'ping',
        };
        return typeMap[type.toLowerCase()] || 'other';
    }

    // -------------------------------------------------------------------------
    // Audit Log
    // -------------------------------------------------------------------------

    private addToAuditLog(entry: BlockedRequest): void {
        this.auditLog.push(entry);

        // Trim if too large
        if (this.auditLog.length > this.maxAuditLogSize) {
            this.auditLog = this.auditLog.slice(-this.maxAuditLogSize / 2);
        }
    }

    getAuditLog(): BlockedRequest[] {
        return [...this.auditLog];
    }

    getRecentBlocks(count: number = 20): BlockedRequest[] {
        return this.auditLog.slice(-count);
    }

    clearAuditLog(): void {
        this.auditLog = [];
    }

    // -------------------------------------------------------------------------
    // Site Override
    // -------------------------------------------------------------------------

    /**
     * Temporarily allow blocking on a site (for breakage recovery)
     */
    allowSite(host: string): void {
        if (!this.config.allowlist.includes(host)) {
            this.config.allowlist.push(host);
        }
    }

    /**
     * Remove site from allowlist
     */
    removeSiteAllow(host: string): void {
        this.config.allowlist = this.config.allowlist.filter(h => h !== host);
    }

    /**
     * Add site to denylist (force blocking)
     */
    denySite(host: string): void {
        if (!this.config.denylist.includes(host)) {
            this.config.denylist.push(host);
        }
    }
}
