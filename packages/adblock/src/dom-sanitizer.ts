/**
 * AB-OS DOM Sanitizer
 * 
 * In-page cleanup for ads, overlays, and trackers that bypass network blocking.
 * Runs in a safe sandbox with mutation observers.
 */

import { DOMSanitizeEvent, AdblockRule } from './types';

// =============================================================================
// Types
// =============================================================================

export interface SanitizerConfig {
    /** Enable overlay removal */
    remove_overlays: boolean;
    /** Enable ad container removal */
    remove_ad_containers: boolean;
    /** Enable autoplay blocking */
    block_autoplay: boolean;
    /** Enable cookie banner removal */
    remove_cookie_banners: boolean;
    /** Max elements to process per mutation batch */
    max_batch_size: number;
    /** Debounce time for mutations (ms) */
    debounce_ms: number;
}

export const DEFAULT_SANITIZER_CONFIG: SanitizerConfig = {
    remove_overlays: true,
    remove_ad_containers: true,
    block_autoplay: true,
    remove_cookie_banners: true,
    max_batch_size: 50,
    debounce_ms: 100,
};

interface DetectedElement {
    element: Element;
    selector: string;
    reason: DOMSanitizeEvent['reason'];
    confidence: number;
}

// =============================================================================
// Heuristic Patterns
// =============================================================================

const OVERLAY_PATTERNS = {
    /** High z-index threshold */
    zIndexThreshold: 9000,
    /** Minimum coverage of viewport to be considered overlay (0-1) */
    minCoverage: 0.5,
};

const AD_CONTAINER_PATTERNS = {
    /** Class patterns that indicate ad containers */
    classPatterns: [
        /\bad[s]?\b/i,
        /\bsponsored\b/i,
        /\badvertis/i,
        /\bgoogle[_-]?ad/i,
        /\bdfp[_-]/i,
        /\bpromote[d]?\b/i,
        /\bbanner[_-]?ad/i,
    ],
    /** ID patterns that indicate ad containers */
    idPatterns: [
        /\bad[s]?[_-]?/i,
        /^google_ads/i,
        /^div-gpt-ad/i,
        /\bsponsored/i,
    ],
    /** Data attribute patterns */
    attrPatterns: [
        'data-ad',
        'data-ad-slot',
        'data-ad-client',
        'data-google-query-id',
    ],
};

const COOKIE_BANNER_PATTERNS = {
    classPatterns: [
        /cookie[_-]?banner/i,
        /cookie[_-]?consent/i,
        /cookie[_-]?notice/i,
        /gdpr/i,
        /consent[_-]?modal/i,
        /privacy[_-]?notice/i,
    ],
    idPatterns: [
        /cookie/i,
        /consent/i,
        /gdpr/i,
    ],
};

// =============================================================================
// DOM Sanitizer
// =============================================================================

export class DOMSanitizer {
    private config: SanitizerConfig;
    private cosmeticRules: AdblockRule[] = [];
    private sanitizeEvents: DOMSanitizeEvent[] = [];
    private removedElements: Map<string, { html: string; parent: string }> = new Map();
    private observer: MutationObserver | null = null;
    private debounceTimer: NodeJS.Timeout | null = null;
    private agentId: string;
    private pageUrl: string;

    constructor(
        agentId: string,
        pageUrl: string,
        config?: Partial<SanitizerConfig>
    ) {
        this.agentId = agentId;
        this.pageUrl = pageUrl;
        this.config = { ...DEFAULT_SANITIZER_CONFIG, ...config };
    }

    // -------------------------------------------------------------------------
    // Rule Loading
    // -------------------------------------------------------------------------

    loadCosmeticRules(rules: AdblockRule[]): void {
        this.cosmeticRules = rules.filter(r => r.type === 'css' && r.css_selector);
    }

    // -------------------------------------------------------------------------
    // Scanning & Detection
    // -------------------------------------------------------------------------

    /**
     * Scan the document for ad elements
     * Returns elements that should be removed
     */
    scan(document: Document): DetectedElement[] {
        const detected: DetectedElement[] = [];

        // 1. Apply cosmetic rules
        for (const rule of this.cosmeticRules) {
            if (!rule.css_selector) continue;

            try {
                const elements = document.querySelectorAll(rule.css_selector);
                for (const element of elements) {
                    detected.push({
                        element,
                        selector: rule.css_selector,
                        reason: 'ad_container',
                        confidence: 0.9,
                    });
                }
            } catch {
                // Invalid selector
            }
        }

        // 2. Detect overlays
        if (this.config.remove_overlays) {
            detected.push(...this.detectOverlays(document));
        }

        // 3. Detect ad containers by heuristics
        if (this.config.remove_ad_containers) {
            detected.push(...this.detectAdContainers(document));
        }

        // 4. Detect cookie banners
        if (this.config.remove_cookie_banners) {
            detected.push(...this.detectCookieBanners(document));
        }

        // Deduplicate
        return this.deduplicateDetections(detected);
    }

    private detectOverlays(document: Document): DetectedElement[] {
        const detected: DetectedElement[] = [];
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = document.documentElement.clientHeight;

        const fixedElements = document.querySelectorAll('*');

        for (const element of fixedElements) {
            const style = window.getComputedStyle(element);

            // Check for fixed/sticky positioning
            if (style.position !== 'fixed' && style.position !== 'sticky') {
                continue;
            }

            // Check z-index
            const zIndex = parseInt(style.zIndex, 10);
            if (isNaN(zIndex) || zIndex < OVERLAY_PATTERNS.zIndexThreshold) {
                continue;
            }

            // Check coverage
            const rect = element.getBoundingClientRect();
            const coverage = (rect.width * rect.height) / (viewportWidth * viewportHeight);

            if (coverage >= OVERLAY_PATTERNS.minCoverage) {
                detected.push({
                    element,
                    selector: this.generateSelector(element),
                    reason: 'overlay',
                    confidence: Math.min(0.5 + coverage * 0.5, 0.95),
                });
            }
        }

        return detected;
    }

    private detectAdContainers(document: Document): DetectedElement[] {
        const detected: DetectedElement[] = [];

        // Check all elements with suspicious class/id
        const allElements = document.querySelectorAll('[class], [id]');

        for (const element of allElements) {
            let confidence = 0;
            let matchReason = '';

            // Check class
            const className = element.className;
            if (typeof className === 'string') {
                for (const pattern of AD_CONTAINER_PATTERNS.classPatterns) {
                    if (pattern.test(className)) {
                        confidence += 0.4;
                        matchReason = `class:${className}`;
                        break;
                    }
                }
            }

            // Check ID
            const id = element.id;
            if (id) {
                for (const pattern of AD_CONTAINER_PATTERNS.idPatterns) {
                    if (pattern.test(id)) {
                        confidence += 0.4;
                        matchReason = matchReason || `id:${id}`;
                        break;
                    }
                }
            }

            // Check data attributes
            for (const attr of AD_CONTAINER_PATTERNS.attrPatterns) {
                if (element.hasAttribute(attr)) {
                    confidence += 0.3;
                    break;
                }
            }

            // Check for iframe sources from ad networks
            if (element.tagName === 'IFRAME') {
                const src = element.getAttribute('src') || '';
                if (/doubleclick|googlesyndication|adsense/i.test(src)) {
                    confidence += 0.5;
                }
            }

            if (confidence >= 0.5) {
                detected.push({
                    element,
                    selector: this.generateSelector(element),
                    reason: 'ad_container',
                    confidence: Math.min(confidence, 0.95),
                });
            }
        }

        return detected;
    }

    private detectCookieBanners(document: Document): DetectedElement[] {
        const detected: DetectedElement[] = [];

        const allElements = document.querySelectorAll('[class], [id]');

        for (const element of allElements) {
            let confidence = 0;

            const className = element.className;
            if (typeof className === 'string') {
                for (const pattern of COOKIE_BANNER_PATTERNS.classPatterns) {
                    if (pattern.test(className)) {
                        confidence += 0.5;
                        break;
                    }
                }
            }

            const id = element.id;
            if (id) {
                for (const pattern of COOKIE_BANNER_PATTERNS.idPatterns) {
                    if (pattern.test(id)) {
                        confidence += 0.4;
                        break;
                    }
                }
            }

            if (confidence >= 0.5) {
                detected.push({
                    element,
                    selector: this.generateSelector(element),
                    reason: 'heuristic',
                    confidence: Math.min(confidence, 0.9),
                });
            }
        }

        return detected;
    }

    private deduplicateDetections(detected: DetectedElement[]): DetectedElement[] {
        const seen = new Set<Element>();
        return detected.filter(d => {
            if (seen.has(d.element)) return false;
            seen.add(d.element);
            return true;
        });
    }

    // -------------------------------------------------------------------------
    // Element Removal
    // -------------------------------------------------------------------------

    /**
     * Remove detected elements from the DOM
     */
    sanitize(detections: DetectedElement[]): DOMSanitizeEvent[] {
        const events: DOMSanitizeEvent[] = [];

        for (const detection of detections.slice(0, this.config.max_batch_size)) {
            const event = this.removeElement(detection);
            if (event) {
                events.push(event);
                this.sanitizeEvents.push(event);
            }
        }

        return events;
    }

    private removeElement(detection: DetectedElement): DOMSanitizeEvent | null {
        const { element, selector, reason } = detection;

        // Generate revert token
        const revertToken = crypto.randomUUID();

        // Store for potential revert
        const parentSelector = element.parentElement
            ? this.generateSelector(element.parentElement)
            : 'body';

        this.removedElements.set(revertToken, {
            html: element.outerHTML,
            parent: parentSelector,
        });

        // Remove element
        try {
            element.remove();
        } catch {
            return null;
        }

        return {
            event_id: crypto.randomUUID(),
            agent_id: this.agentId,
            timestamp: Date.now(),
            page_url: this.pageUrl,
            selector,
            reason,
            revert_token: revertToken,
        };
    }

    /**
     * Revert a removed element
     */
    revert(revertToken: string, document: Document): boolean {
        const stored = this.removedElements.get(revertToken);
        if (!stored) return false;

        try {
            const parent = document.querySelector(stored.parent);
            if (!parent) return false;

            parent.insertAdjacentHTML('beforeend', stored.html);
            this.removedElements.delete(revertToken);
            return true;
        } catch {
            return false;
        }
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private generateSelector(element: Element): string {
        if (element.id) {
            return `#${element.id}`;
        }

        const tag = element.tagName.toLowerCase();
        const className = element.className;

        if (typeof className === 'string' && className) {
            const classes = className.split(/\s+/).slice(0, 2).join('.');
            return `${tag}.${classes}`;
        }

        return tag;
    }

    // -------------------------------------------------------------------------
    // Observation
    // -------------------------------------------------------------------------

    /**
     * Start observing DOM mutations
     */
    startObserving(document: Document): void {
        if (this.observer) return;

        this.observer = new MutationObserver((mutations) => {
            this.handleMutations(mutations, document);
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    /**
     * Stop observing
     */
    stopObserving(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
    }

    private handleMutations(mutations: MutationRecord[], document: Document): void {
        // Debounce
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            const detections = this.scan(document);
            if (detections.length > 0) {
                this.sanitize(detections);
            }
        }, this.config.debounce_ms);
    }

    // -------------------------------------------------------------------------
    // Stats
    // -------------------------------------------------------------------------

    getEvents(): DOMSanitizeEvent[] {
        return [...this.sanitizeEvents];
    }

    getStats(): { removed: number; reverted: number } {
        return {
            removed: this.sanitizeEvents.length,
            reverted: 0, // Track separately if needed
        };
    }
}
