/**
 * AB-OS EasyList Filter Parser
 * 
 * Parses EasyList format filter rules into canonical AdblockRule format.
 * Supports:
 * - Network rules: ||domain.com^
 * - Exception rules: @@||allow.com^
 * - Cosmetic rules: ##.ad-class
 * - Domain-specific cosmetic: example.com##.ad-class
 */

import { AdblockRule, ResourceType, RuleType, RuleAction } from './types';

// =============================================================================
// Parser Types
// =============================================================================

interface ParsedFilter {
    raw: string;
    isException: boolean;
    isCosmetic: boolean;
    domains?: string[];
    selector?: string;
    pattern?: string;
    options?: FilterOptions;
}

interface FilterOptions {
    resourceTypes?: ResourceType[];
    thirdParty?: boolean;
    firstParty?: boolean;
    domains?: { include: string[]; exclude: string[] };
}

// =============================================================================
// Filter Parser
// =============================================================================

export class FilterParser {
    private ruleCounter = 0;
    private source: string;

    constructor(source: string = 'custom') {
        this.source = source;
    }

    /**
     * Parse a full filter list (multiple lines)
     */
    parseFilterList(content: string): AdblockRule[] {
        const lines = content.split('\n');
        const rules: AdblockRule[] = [];

        for (const line of lines) {
            const trimmed = line.trim();

            // Skip comments and empty lines
            if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('[')) {
                continue;
            }

            try {
                const rule = this.parseLine(trimmed);
                if (rule) {
                    rules.push(rule);
                }
            } catch (e) {
                // Skip invalid rules silently
                console.debug(`[FilterParser] Skipping invalid rule: ${trimmed}`);
            }
        }

        return rules;
    }

    /**
     * Parse a single filter line
     */
    parseLine(line: string): AdblockRule | null {
        const parsed = this.parseFilterSyntax(line);
        if (!parsed) return null;

        return this.convertToRule(parsed);
    }

    // -------------------------------------------------------------------------
    // Syntax Parsing
    // -------------------------------------------------------------------------

    private parseFilterSyntax(raw: string): ParsedFilter | null {
        // Check for exception rule
        const isException = raw.startsWith('@@');
        const filter = isException ? raw.slice(2) : raw;

        // Check for cosmetic rule (##)
        if (filter.includes('##') || filter.includes('#@#')) {
            return this.parseCosmeticFilter(raw, filter, isException);
        }

        // Network rule
        return this.parseNetworkFilter(raw, filter, isException);
    }

    private parseCosmeticFilter(raw: string, filter: string, isException: boolean): ParsedFilter | null {
        // Cosmetic hide: ##.class or domain.com##.class
        // Cosmetic exception: #@#.class
        const cosmeticIndex = filter.indexOf('##');
        const cosmeticExceptionIndex = filter.indexOf('#@#');

        let separatorIndex: number;
        let separatorLength: number;

        if (cosmeticExceptionIndex !== -1 && (cosmeticIndex === -1 || cosmeticExceptionIndex < cosmeticIndex)) {
            separatorIndex = cosmeticExceptionIndex;
            separatorLength = 3;
            isException = true;
        } else if (cosmeticIndex !== -1) {
            separatorIndex = cosmeticIndex;
            separatorLength = 2;
        } else {
            return null;
        }

        const domainPart = filter.slice(0, separatorIndex);
        const selector = filter.slice(separatorIndex + separatorLength);

        if (!selector) return null;

        const domains = domainPart ? domainPart.split(',').filter(d => d) : undefined;

        return {
            raw,
            isException,
            isCosmetic: true,
            domains,
            selector,
        };
    }

    private parseNetworkFilter(raw: string, filter: string, isException: boolean): ParsedFilter {
        // Parse options (after $)
        const optionIndex = filter.lastIndexOf('$');
        let pattern = filter;
        let options: FilterOptions | undefined;

        if (optionIndex !== -1) {
            pattern = filter.slice(0, optionIndex);
            const optionsStr = filter.slice(optionIndex + 1);
            options = this.parseOptions(optionsStr);
        }

        // Handle domain anchoring (||domain.com)
        if (pattern.startsWith('||')) {
            pattern = pattern.slice(2);
        }

        // Handle separator (^)
        pattern = pattern.replace(/\^/g, '([/?#]|$)');

        // Handle wildcards (*)
        pattern = pattern.replace(/\*/g, '.*');

        return {
            raw,
            isException,
            isCosmetic: false,
            pattern,
            options,
        };
    }

    private parseOptions(optionsStr: string): FilterOptions {
        const options: FilterOptions = {};
        const parts = optionsStr.split(',');

        const resourceTypes: ResourceType[] = [];
        const includeDomains: string[] = [];
        const excludeDomains: string[] = [];

        for (const part of parts) {
            const trimmed = part.trim().toLowerCase();

            // Resource type options
            switch (trimmed) {
                case 'script':
                    resourceTypes.push('script');
                    break;
                case 'image':
                    resourceTypes.push('image');
                    break;
                case 'stylesheet':
                case 'css':
                    resourceTypes.push('stylesheet');
                    break;
                case 'xmlhttprequest':
                case 'xhr':
                    resourceTypes.push('xhr');
                    break;
                case 'subdocument':
                case 'frame':
                    resourceTypes.push('subdocument');
                    break;
                case 'font':
                    resourceTypes.push('font');
                    break;
                case 'media':
                    resourceTypes.push('media');
                    break;
                case 'websocket':
                    resourceTypes.push('websocket');
                    break;
                case 'ping':
                    resourceTypes.push('ping');
                    break;
                case 'other':
                    resourceTypes.push('other');
                    break;
                case 'third-party':
                case '3p':
                    options.thirdParty = true;
                    break;
                case '~third-party':
                case '~3p':
                case 'first-party':
                case '1p':
                    options.firstParty = true;
                    break;
                default:
                    // Domain option: domain=example.com|~excluded.com
                    if (trimmed.startsWith('domain=')) {
                        const domainsPart = trimmed.slice(7);
                        const domains = domainsPart.split('|');
                        for (const domain of domains) {
                            if (domain.startsWith('~')) {
                                excludeDomains.push(domain.slice(1));
                            } else {
                                includeDomains.push(domain);
                            }
                        }
                    }
            }
        }

        if (resourceTypes.length > 0) {
            options.resourceTypes = resourceTypes;
        }

        if (includeDomains.length > 0 || excludeDomains.length > 0) {
            options.domains = { include: includeDomains, exclude: excludeDomains };
        }

        return options;
    }

    // -------------------------------------------------------------------------
    // Rule Conversion
    // -------------------------------------------------------------------------

    private convertToRule(parsed: ParsedFilter): AdblockRule {
        const ruleId = `${this.source}-${++this.ruleCounter}`;

        if (parsed.isCosmetic) {
            return this.createCosmeticRule(ruleId, parsed);
        } else {
            return this.createNetworkRule(ruleId, parsed);
        }
    }

    private createCosmeticRule(ruleId: string, parsed: ParsedFilter): AdblockRule {
        return {
            rule_id: ruleId,
            type: 'css',
            match: {
                host: parsed.domains,
            },
            action: parsed.isException ? 'allow' : 'block',
            css_selector: parsed.selector,
            metadata: {
                source: this.source,
                priority: 100,
            },
            enabled: true,
        };
    }

    private createNetworkRule(ruleId: string, parsed: ParsedFilter): AdblockRule {
        // Extract host from pattern
        const hosts = this.extractHostsFromPattern(parsed.pattern || '');

        // For domain-only rules (||domain.com^), the host match is sufficient
        // Don't use path_regex for these as it would incorrectly fail
        const usePathRegex = hosts.length === 0 && parsed.pattern;

        return {
            rule_id: ruleId,
            type: 'network',
            match: {
                host: hosts.length > 0 ? hosts : undefined,
                path_regex: usePathRegex ? parsed.pattern : undefined,
                resource_type: parsed.options?.resourceTypes,
                third_party: parsed.options?.thirdParty,
                first_party: parsed.options?.firstParty,
            },
            action: parsed.isException ? 'allow' : 'block',
            metadata: {
                source: this.source,
                priority: parsed.isException ? 50 : 100, // Exceptions have higher priority
            },
            enabled: true,
        };
    }

    private extractHostsFromPattern(pattern: string): string[] {
        // Simple extraction: if pattern looks like a domain, extract it
        // Pattern is already processed, so we try to extract domain-like strings
        const domainMatch = pattern.match(/^([a-zA-Z0-9][a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}/);
        if (domainMatch) {
            return [domainMatch[0]];
        }
        return [];
    }
}

// =============================================================================
// Built-in Rules (Sample EasyList subset)
// =============================================================================

export const BUILTIN_RULES = `
! AB-OS Built-in Adblock Rules
! Domain-based blocking for reliability

! Google Ads Network
||doubleclick.net^
||googlesyndication.com^
||googleadservices.com^
||adservice.google.com^
||pagead2.googlesyndication.com^
||adsense.google.com^
||googleads.g.doubleclick.net^
||tpc.googlesyndication.com^

! Google Analytics/Tracking
||google-analytics.com^
||analytics.google.com^
||ssl.google-analytics.com^

! Facebook Tracking
||connect.facebook.net^$third-party
||pixel.facebook.com^
||tr.facebook.com^

! Amazon Ads
||amazon-adsystem.com^
||advertising-api.amazon.com^
||aax.amazon.com^

! Other Ad Networks
||adnxs.com^
||criteo.com^
||taboola.com^
||outbrain.com^
||pubmatic.com^
||rubiconproject.com^
||openx.net^
||advertising.com^

! Cosmetic rules (DOM element hiding)
##.ad-container
##.advertisement
##[class*="ad-slot"]
##[id*="google_ads"]
##.sponsored-content
##[class*="cookie-banner"]
##[id*="cookie-consent"]
##.modal-backdrop.show
`;
