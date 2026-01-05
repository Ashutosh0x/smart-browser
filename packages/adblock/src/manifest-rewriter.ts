/**
 * AB-OS Manifest Rewriter
 * 
 * Rewrites DASH (MPD) and HLS (m3u8) manifests to remove ad segments.
 * YouTube and other video platforms use server-side ad insertion (SSAI)
 * where ads are stitched into the media manifest.
 */

// =============================================================================
// Types
// =============================================================================

export interface ManifestRewriteResult {
    content: string;
    modified: boolean;
    segmentsRemoved: number;
    originalDuration?: number;
    newDuration?: number;
}

export interface ManifestRewriterConfig {
    /** Enable DASH manifest rewriting */
    rewriteDASH: boolean;
    /** Enable HLS manifest rewriting */
    rewriteHLS: boolean;
    /** Ad segment detection patterns */
    adPatterns: string[];
    /** Verbose logging */
    verbose: boolean;
}

// =============================================================================
// Ad Pattern Definitions
// =============================================================================

const DEFAULT_AD_PATTERNS = [
    // YouTube ad markers
    'googlevideo.com/videoplayback.*?aitags=',
    'googlevideo.com/api/manifest/dash/.*ad',
    '/adbreak/',
    '/ad_pod/',
    '/preroll/',
    '/midroll/',
    '/postroll/',

    // Generic SSAI patterns
    '/dai/',
    '/ssai/',
    '/stitched-ad/',
    '/interstitial/',

    // Ad segment markers in URLs
    'adformat=',
    'adsegment',
    'ad_type=',
];

// =============================================================================
// Manifest Rewriter
// =============================================================================

export class ManifestRewriter {
    private config: ManifestRewriterConfig;
    private adPatternRegexes: RegExp[];
    private stats = {
        manifestsProcessed: 0,
        segmentsRemoved: 0,
    };

    constructor(config?: Partial<ManifestRewriterConfig>) {
        this.config = {
            rewriteDASH: true,
            rewriteHLS: true,
            adPatterns: DEFAULT_AD_PATTERNS,
            verbose: false,
            ...config,
        };

        // Pre-compile ad pattern regexes
        this.adPatternRegexes = this.config.adPatterns.map(pattern => {
            try {
                return new RegExp(pattern, 'i');
            } catch {
                return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            }
        });
    }

    // -------------------------------------------------------------------------
    // Main Entry Points
    // -------------------------------------------------------------------------

    /**
     * Detect manifest type and rewrite accordingly
     */
    rewrite(content: string, contentType?: string): ManifestRewriteResult {
        if (contentType?.includes('mpegurl') || content.startsWith('#EXTM3U')) {
            return this.rewriteHLS(content);
        }
        if (contentType?.includes('dash+xml') || content.includes('<MPD')) {
            return this.rewriteDASH(content);
        }

        return {
            content,
            modified: false,
            segmentsRemoved: 0,
        };
    }

    /**
     * Rewrite DASH MPD manifest
     */
    rewriteDASH(mpd: string): ManifestRewriteResult {
        if (!this.config.rewriteDASH) {
            return { content: mpd, modified: false, segmentsRemoved: 0 };
        }

        this.stats.manifestsProcessed++;
        let segmentsRemoved = 0;
        let modified = false;

        try {
            // Remove Period elements that are ads
            let result = mpd.replace(
                /<Period[^>]*id="[^"]*ad[^"]*"[^>]*>[\s\S]*?<\/Period>/gi,
                () => {
                    segmentsRemoved++;
                    modified = true;
                    return '';
                }
            );

            // Remove SegmentTimeline entries pointing to ad URLs
            for (const pattern of this.adPatternRegexes) {
                result = result.replace(
                    new RegExp(`<S[^>]*media="[^"]*${pattern.source}[^"]*"[^>]*/>`, 'gi'),
                    () => {
                        segmentsRemoved++;
                        modified = true;
                        return '';
                    }
                );
            }

            // Remove AdaptationSet with ad content
            result = result.replace(
                /<AdaptationSet[^>]*contentType="ad"[^>]*>[\s\S]*?<\/AdaptationSet>/gi,
                () => {
                    segmentsRemoved++;
                    modified = true;
                    return '';
                }
            );

            // Remove EventStream with ad events
            result = result.replace(
                /<EventStream[^>]*schemeIdUri="[^"]*ad[^"]*"[^>]*>[\s\S]*?<\/EventStream>/gi,
                () => {
                    segmentsRemoved++;
                    modified = true;
                    return '';
                }
            );

            this.stats.segmentsRemoved += segmentsRemoved;

            if (modified && this.config.verbose) {
                console.log(`[ManifestRewriter] DASH: Removed ${segmentsRemoved} ad segments`);
            }

            return {
                content: result,
                modified,
                segmentsRemoved,
            };
        } catch (e) {
            if (this.config.verbose) {
                console.warn('[ManifestRewriter] DASH parse error:', e);
            }
            return { content: mpd, modified: false, segmentsRemoved: 0 };
        }
    }

    /**
     * Rewrite HLS m3u8 manifest
     */
    rewriteHLS(m3u8: string): ManifestRewriteResult {
        if (!this.config.rewriteHLS) {
            return { content: m3u8, modified: false, segmentsRemoved: 0 };
        }

        this.stats.manifestsProcessed++;
        const lines = m3u8.split('\n');
        const cleanedLines: string[] = [];
        let segmentsRemoved = 0;
        let skipNext = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Check if this line is an ad marker
            if (this.isAdLine(line)) {
                segmentsRemoved++;
                skipNext = true; // Skip the next line (actual segment URL)
                continue;
            }

            // Skip the segment URL after an ad marker
            if (skipNext && !line.startsWith('#')) {
                segmentsRemoved++;
                skipNext = false;
                continue;
            }

            // Check if segment URL itself is an ad
            if (!line.startsWith('#') && this.isAdUrl(line)) {
                // Also remove the previous EXTINF line
                if (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1].startsWith('#EXTINF')) {
                    cleanedLines.pop();
                }
                segmentsRemoved++;
                continue;
            }

            // Remove discontinuity markers around removed ads
            if (line === '#EXT-X-DISCONTINUITY' && segmentsRemoved > 0) {
                continue;
            }

            cleanedLines.push(line);
        }

        this.stats.segmentsRemoved += segmentsRemoved;
        const modified = segmentsRemoved > 0;

        if (modified && this.config.verbose) {
            console.log(`[ManifestRewriter] HLS: Removed ${segmentsRemoved} ad segments`);
        }

        return {
            content: cleanedLines.join('\n'),
            modified,
            segmentsRemoved,
        };
    }

    // -------------------------------------------------------------------------
    // Ad Detection
    // -------------------------------------------------------------------------

    private isAdLine(line: string): boolean {
        // HLS ad markers
        const adComments = [
            '#EXT-X-CUE-OUT',
            '#EXT-X-CUE-IN',
            '#EXT-X-SCTE35',
            '#EXT-OATCLS-SCTE35',
            '#EXT-X-DATERANGE',
            '#EXT-X-ASSET',
        ];

        for (const marker of adComments) {
            if (line.startsWith(marker)) {
                return true;
            }
        }

        // Check for ad class in DATERANGE
        if (line.includes('CLASS="com.apple.hls.interstitial"') ||
            line.includes('CLASS="com.google.dai.ad"')) {
            return true;
        }

        return false;
    }

    private isAdUrl(url: string): boolean {
        return this.adPatternRegexes.some(regex => regex.test(url));
    }

    // -------------------------------------------------------------------------
    // Statistics
    // -------------------------------------------------------------------------

    getStats() {
        return { ...this.stats };
    }

    resetStats(): void {
        this.stats = {
            manifestsProcessed: 0,
            segmentsRemoved: 0,
        };
    }
}

// =============================================================================
// Default Export
// =============================================================================

export const DEFAULT_MANIFEST_REWRITER_CONFIG: ManifestRewriterConfig = {
    rewriteDASH: true,
    rewriteHLS: true,
    adPatterns: DEFAULT_AD_PATTERNS,
    verbose: false,
};
