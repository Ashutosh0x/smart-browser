/**
 * AB-OS Response Inspector
 * 
 * Inspects and modifies HTTP responses to strip ad-related content.
 * Primary target: YouTube's youtubei/v1/player API responses which embed
 * ad metadata in JSON that URL-based blocking cannot catch.
 */

// =============================================================================
// Types
// =============================================================================

export interface InspectableResponse {
    url: string;
    body: string;
    contentType: string;
    statusCode?: number;
}

export interface InspectionResult {
    body: string;
    modified: boolean;
    fieldsStripped: string[];
    bytesRemoved: number;
}

export interface ResponseInspectorConfig {
    /** Enable YouTube player response stripping */
    stripYouTubeAds: boolean;
    /** Enable generic ad field detection */
    stripGenericAds: boolean;
    /** Log stripped fields for debugging */
    verbose: boolean;
}

// =============================================================================
// YouTube Ad Field Definitions
// =============================================================================

/**
 * Fields in YouTube player API response that contain ad data.
 * These are stripped from the response body.
 */
const YOUTUBE_AD_FIELDS = [
    // Primary ad containers
    'adPlacements',           // Pre/mid/post roll ad markers
    'playerAds',              // Ad metadata array
    'adSlots',                // Ad slot definitions

    // Ad renderers
    'adBreakServiceRenderer',
    'instreamVideoAdRenderer',
    'linearAdSequenceRenderer',
    'promotedSparklesWebRenderer',
    'promotedSparklesTextSearchRenderer',

    // Ad tracking
    'adPlaybackContextParams',
    'adSignalsInfo',
    'adsEngagementPanelConfig',

    // Overlay ads
    'playerOverlayVideoAdsRenderer',
    'playerOverlayAdRenderer',

    // Companion ads
    'companionSlots',
    'companionAdRenderer',
];

/**
 * YouTube API endpoints to inspect.
 */
const YOUTUBE_ENDPOINTS = [
    '/youtubei/v1/player',
    '/youtubei/v1/next',
    '/youtubei/v1/browse',
    '/youtubei/v1/search',
    '/get_video_info',
    '/api/stats/ads',
    '/api/stats/qoe',
];

// =============================================================================
// Response Inspector
// =============================================================================

export class ResponseInspector {
    private config: ResponseInspectorConfig;
    private strippedCount = 0;
    private bytesRemoved = 0;

    constructor(config?: Partial<ResponseInspectorConfig>) {
        this.config = {
            stripYouTubeAds: true,
            stripGenericAds: true,
            verbose: false,
            ...config,
        };
    }

    // -------------------------------------------------------------------------
    // Main Entry Point
    // -------------------------------------------------------------------------

    /**
     * Inspect and potentially modify a response.
     */
    inspectResponse(response: InspectableResponse): InspectionResult {
        const result: InspectionResult = {
            body: response.body,
            modified: false,
            fieldsStripped: [],
            bytesRemoved: 0,
        };

        // Only process JSON responses
        if (!response.contentType?.includes('application/json')) {
            return result;
        }

        // Check if this is a YouTube endpoint
        if (this.isYouTubeEndpoint(response.url)) {
            return this.stripYouTubeAds(response.body);
        }

        // Generic ad field stripping for other JSON APIs
        if (this.config.stripGenericAds) {
            return this.stripGenericAds(response.body);
        }

        return result;
    }

    // -------------------------------------------------------------------------
    // YouTube Ad Stripping
    // -------------------------------------------------------------------------

    private isYouTubeEndpoint(url: string): boolean {
        return YOUTUBE_ENDPOINTS.some(endpoint => url.includes(endpoint));
    }

    private stripYouTubeAds(body: string): InspectionResult {
        const originalSize = body.length;
        const fieldsStripped: string[] = [];

        try {
            const json = JSON.parse(body);

            // Recursively strip ad fields
            this.stripFieldsRecursive(json, YOUTUBE_AD_FIELDS, fieldsStripped);

            // Also handle specific YouTube structures
            this.stripYouTubeSpecificStructures(json, fieldsStripped);

            const cleanedBody = JSON.stringify(json);
            const bytesRemoved = originalSize - cleanedBody.length;

            if (fieldsStripped.length > 0) {
                this.strippedCount++;
                this.bytesRemoved += bytesRemoved;

                if (this.config.verbose) {
                    console.log(`[ResponseInspector] Stripped ${fieldsStripped.length} ad fields, saved ${bytesRemoved} bytes`);
                }
            }

            return {
                body: cleanedBody,
                modified: fieldsStripped.length > 0,
                fieldsStripped,
                bytesRemoved,
            };
        } catch (e) {
            // JSON parse failed, return original
            if (this.config.verbose) {
                console.warn('[ResponseInspector] Failed to parse JSON:', e);
            }
            return {
                body,
                modified: false,
                fieldsStripped: [],
                bytesRemoved: 0,
            };
        }
    }

    private stripFieldsRecursive(
        obj: any,
        fieldsToStrip: string[],
        stripped: string[],
        path: string = ''
    ): void {
        if (obj === null || typeof obj !== 'object') {
            return;
        }

        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
                this.stripFieldsRecursive(obj[i], fieldsToStrip, stripped, `${path}[${i}]`);
            }
            return;
        }

        for (const key of Object.keys(obj)) {
            if (fieldsToStrip.includes(key)) {
                delete obj[key];
                stripped.push(path ? `${path}.${key}` : key);
            } else {
                this.stripFieldsRecursive(obj[key], fieldsToStrip, stripped, path ? `${path}.${key}` : key);
            }
        }
    }

    private stripYouTubeSpecificStructures(obj: any, stripped: string[]): void {
        // Strip engagement panels with ad content
        if (obj.engagementPanels && Array.isArray(obj.engagementPanels)) {
            const originalLength = obj.engagementPanels.length;
            obj.engagementPanels = obj.engagementPanels.filter((panel: any) => {
                const panelId = panel?.engagementPanelSectionListRenderer?.panelIdentifier || '';
                if (panelId.includes('ads') || panelId.includes('promo')) {
                    stripped.push(`engagementPanels.${panelId}`);
                    return false;
                }
                return true;
            });
        }

        // Strip ad-related video annotations
        if (obj.annotations && Array.isArray(obj.annotations)) {
            obj.annotations = obj.annotations.filter((annotation: any) => {
                const annotationType = annotation?.playerAnnotationsExpandedRenderer?.featuredChannel?.subscribeButton
                    ? 'promoted' : 'normal';
                if (annotationType === 'promoted') {
                    stripped.push('annotations.promoted');
                    return false;
                }
                return true;
            });
        }

        // Strip merchandise shelf (often sponsored)
        if (obj.contents?.twoColumnWatchNextResults?.results?.results?.contents) {
            const contents = obj.contents.twoColumnWatchNextResults.results.results.contents;
            for (let i = contents.length - 1; i >= 0; i--) {
                if (contents[i].merchandiseShelfRenderer || contents[i].ticketShelfRenderer) {
                    contents.splice(i, 1);
                    stripped.push('merchandiseShelf');
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // Generic Ad Stripping
    // -------------------------------------------------------------------------

    private stripGenericAds(body: string): InspectionResult {
        const originalSize = body.length;
        const fieldsStripped: string[] = [];

        const genericAdFields = [
            'advertisement',
            'sponsored',
            'promo',
            'ad_data',
            'adData',
            'tracking_pixels',
            'trackingPixels',
        ];

        try {
            const json = JSON.parse(body);
            this.stripFieldsRecursive(json, genericAdFields, fieldsStripped);

            const cleanedBody = JSON.stringify(json);
            const bytesRemoved = originalSize - cleanedBody.length;

            return {
                body: cleanedBody,
                modified: fieldsStripped.length > 0,
                fieldsStripped,
                bytesRemoved,
            };
        } catch {
            return {
                body,
                modified: false,
                fieldsStripped: [],
                bytesRemoved: 0,
            };
        }
    }

    // -------------------------------------------------------------------------
    // Statistics
    // -------------------------------------------------------------------------

    getStats() {
        return {
            responsesModified: this.strippedCount,
            bytesRemoved: this.bytesRemoved,
        };
    }

    resetStats(): void {
        this.strippedCount = 0;
        this.bytesRemoved = 0;
    }
}

// =============================================================================
// Default Export
// =============================================================================

export const DEFAULT_RESPONSE_INSPECTOR_CONFIG: ResponseInspectorConfig = {
    stripYouTubeAds: true,
    stripGenericAds: true,
    verbose: false,
};
