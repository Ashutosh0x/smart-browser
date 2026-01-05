/**
 * AB-OS Explain Service
 * 
 * Orchestrates caption extraction and Gemini explanation.
 * Used by shell main process to handle "Explain" button clicks.
 */

import { CaptionExtractor, Transcript } from './caption-extractor';
import { GeminiClient, ExplanationRequest, ExplanationResponse } from './gemini-client';

// =============================================================================
// Types
// =============================================================================

export interface VideoContext {
    videoId: string;
    title: string;
    channel: string;
    duration: number;
    url: string;
}

export interface ExplainResult {
    success: boolean;
    videoId: string;
    summary?: string;
    explanation?: string;
    transcript?: Transcript;
    error?: string;
}

export type ExplainMode = 'summary' | 'explain' | 'beginner' | 'technical';

// =============================================================================
// Explain Service
// =============================================================================

export class ExplainService {
    private captionExtractor: CaptionExtractor;
    private geminiClient: GeminiClient;
    private explanationCache: Map<string, Map<ExplainMode, string>> = new Map();

    constructor(geminiApiKey?: string) {
        this.captionExtractor = new CaptionExtractor();
        this.geminiClient = new GeminiClient();

        if (geminiApiKey) {
            this.initialize(geminiApiKey);
        }
    }

    /**
     * Initialize Gemini client with API key
     */
    initialize(apiKey: string): boolean {
        return this.geminiClient.initialize(apiKey);
    }

    /**
     * Check if service is ready
     */
    isReady(): boolean {
        return this.geminiClient.isReady();
    }

    /**
     * Main entry point: Explain a video
     */
    async explainVideo(
        video: VideoContext,
        pageData: {
            captionTracks?: any[];
            playerResponse?: any;
        },
        mode: ExplainMode = 'summary'
    ): Promise<ExplainResult> {
        try {
            // Check cache first
            const cached = this.getCachedExplanation(video.videoId, mode);
            if (cached) {
                const transcript = this.captionExtractor['cache'].get(video.videoId);
                return {
                    success: true,
                    videoId: video.videoId,
                    [mode === 'summary' ? 'summary' : 'explanation']: cached,
                    transcript: transcript || undefined,
                };
            }

            // Extract captions
            const transcript = await this.captionExtractor.extractFromPage(
                video.videoId,
                {
                    title: video.title,
                    channel: video.channel,
                    duration: video.duration,
                    captionTracks: pageData.captionTracks,
                    playerResponse: pageData.playerResponse,
                }
            );

            if (!transcript) {
                return {
                    success: false,
                    videoId: video.videoId,
                    error: 'Could not extract captions from this video',
                };
            }

            // Generate explanation
            const request: ExplanationRequest = {
                transcript: transcript.fullText,
                videoTitle: video.title,
                channel: video.channel,
                duration: video.duration,
                mode,
            };

            const response = await this.geminiClient.explain(request);

            // Cache the result
            this.cacheExplanation(video.videoId, mode, response.content);

            return {
                success: true,
                videoId: video.videoId,
                [mode === 'summary' ? 'summary' : 'explanation']: response.content,
                transcript,
            };
        } catch (error) {
            console.error('[ExplainService] Error:', error);
            return {
                success: false,
                videoId: video.videoId,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Ask a follow-up question about a video
     */
    async askQuestion(videoId: string, question: string): Promise<string> {
        // Get cached transcript
        const transcript = this.captionExtractor['cache'].get(videoId);

        if (!transcript) {
            throw new Error('No transcript available for this video');
        }

        return this.geminiClient.chat(
            videoId,
            transcript.fullText,
            transcript.title,
            question
        );
    }

    /**
     * Get cached explanation
     */
    private getCachedExplanation(videoId: string, mode: ExplainMode): string | null {
        const videoCache = this.explanationCache.get(videoId);
        return videoCache?.get(mode) || null;
    }

    /**
     * Cache an explanation
     */
    private cacheExplanation(videoId: string, mode: ExplainMode, content: string): void {
        if (!this.explanationCache.has(videoId)) {
            this.explanationCache.set(videoId, new Map());
        }
        this.explanationCache.get(videoId)!.set(mode, content);
    }

    /**
     * Clear all caches
     */
    clearCache(videoId?: string): void {
        if (videoId) {
            this.explanationCache.delete(videoId);
            this.captionExtractor.clearCache(videoId);
            this.geminiClient.clearSession(videoId);
        } else {
            this.explanationCache.clear();
            this.captionExtractor.clearCache();
            this.geminiClient.clearAllSessions();
        }
    }
}
