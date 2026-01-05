/**
 * AB-OS Adblock
 * 
 * Kernel-level network and DOM protection subsystem.
 * 
 * Stage 1: URL-based blocking ✅
 * Stage 2: Response inspection ✅
 * Stage 3: Manifest rewriting ✅
 * 
 * @packageDocumentation
 */

// Types
export * from './types';

// Core Components
export { RuleEngine, type MatchResult, type InterceptRequest } from './rule-engine';
export { FilterParser, BUILTIN_RULES } from './filter-parser';
export {
    NetworkInterceptor,
    type NetworkRequest,
    type InterceptDecision,
    type InterceptorEvents
} from './network-interceptor';
export {
    DOMSanitizer,
    type SanitizerConfig,
    DEFAULT_SANITIZER_CONFIG
} from './dom-sanitizer';

// Stage 2: Response Inspection
export {
    ResponseInspector,
    type InspectableResponse,
    type InspectionResult,
    type ResponseInspectorConfig,
    DEFAULT_RESPONSE_INSPECTOR_CONFIG
} from './response-inspector';

// Stage 3: Manifest Rewriting
export {
    ManifestRewriter,
    type ManifestRewriteResult,
    type ManifestRewriterConfig,
    DEFAULT_MANIFEST_REWRITER_CONFIG
} from './manifest-rewriter';

// =============================================================================
// Convenience Factory
// =============================================================================

import { RuleEngine } from './rule-engine';
import { FilterParser, BUILTIN_RULES } from './filter-parser';
import { NetworkInterceptor } from './network-interceptor';
import { ResponseInspector } from './response-inspector';
import { ManifestRewriter } from './manifest-rewriter';
import { AdblockConfig, DEFAULT_ADBLOCK_CONFIG } from './types';

/**
 * Create a fully configured adblock instance with all stages enabled
 */
export function createAdblock(config?: Partial<AdblockConfig>): {
    ruleEngine: RuleEngine;
    interceptor: NetworkInterceptor;
    responseInspector: ResponseInspector;
    manifestRewriter: ManifestRewriter;
} {
    // Create rule engine
    const ruleEngine = new RuleEngine();

    // Parse and load built-in rules
    const parser = new FilterParser('builtin');
    const rules = parser.parseFilterList(BUILTIN_RULES);
    ruleEngine.loadRules(rules);

    // Create interceptor (Stage 1: URL blocking)
    const interceptor = new NetworkInterceptor(ruleEngine, {
        ...DEFAULT_ADBLOCK_CONFIG,
        ...config,
    });

    // Create response inspector (Stage 2)
    const responseInspector = new ResponseInspector({
        stripYouTubeAds: true,
        stripGenericAds: true,
        verbose: false,
    });

    // Create manifest rewriter (Stage 3)
    const manifestRewriter = new ManifestRewriter({
        rewriteDASH: true,
        rewriteHLS: true,
        verbose: false,
    });

    return { ruleEngine, interceptor, responseInspector, manifestRewriter };
}

