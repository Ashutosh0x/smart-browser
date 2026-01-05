/**
 * AB-OS Transcript Store
 * 
 * Per-agent transcript storage with timestamps.
 * Stores real captions captured from network interception.
 */

// =============================================================================
// Types
// =============================================================================

export interface TranscriptSegment {
    start: number;      // Start time in seconds
    end: number;        // End time in seconds
    text: string;       // Caption text
}

export interface StoredTranscript {
    videoId: string;
    agentId: string;
    title: string;
    channel: string;
    duration: number;
    language: string;
    segments: TranscriptSegment[];
    capturedAt: number;
    source: 'timedtext' | 'vtt' | 'srv3' | 'audio-stt';
}

// =============================================================================
// Transcript Store
// =============================================================================

export class TranscriptStore {
    private transcripts: Map<string, StoredTranscript> = new Map();

    /**
     * Generate store key from agentId and videoId
     */
    private key(agentId: string, videoId: string): string {
        return `${agentId}:${videoId}`;
    }

    /**
     * Store transcript for an agent's video
     */
    store(
        agentId: string,
        videoId: string,
        segments: TranscriptSegment[],
        metadata: {
            title?: string;
            channel?: string;
            duration?: number;
            language?: string;
            source?: StoredTranscript['source'];
        } = {}
    ): void {
        const transcript: StoredTranscript = {
            videoId,
            agentId,
            title: metadata.title || '',
            channel: metadata.channel || '',
            duration: metadata.duration || 0,
            language: metadata.language || 'en',
            segments,
            capturedAt: Date.now(),
            source: metadata.source || 'timedtext',
        };

        this.transcripts.set(this.key(agentId, videoId), transcript);
        console.log(`[TranscriptStore] Stored ${segments.length} segments for ${agentId}:${videoId}`);
    }

    /**
     * Get transcript for an agent's current video
     */
    get(agentId: string, videoId: string): StoredTranscript | null {
        return this.transcripts.get(this.key(agentId, videoId)) || null;
    }

    /**
     * Get any transcript for an agent (latest)
     */
    getForAgent(agentId: string): StoredTranscript | null {
        for (const [key, transcript] of this.transcripts) {
            if (key.startsWith(`${agentId}:`)) {
                return transcript;
            }
        }
        return null;
    }

    /**
     * Get full text from segments
     */
    getFullText(agentId: string, videoId: string): string | null {
        const transcript = this.get(agentId, videoId);
        if (!transcript) return null;

        return transcript.segments
            .map(s => s.text)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Get segments in a time range (for timeline-aware explanations)
     */
    getSegmentsInRange(
        agentId: string,
        videoId: string,
        startTime: number,
        endTime: number
    ): TranscriptSegment[] {
        const transcript = this.get(agentId, videoId);
        if (!transcript) return [];

        return transcript.segments.filter(
            s => s.start >= startTime && s.end <= endTime
        );
    }

    /**
     * Check if transcript exists
     */
    has(agentId: string, videoId: string): boolean {
        return this.transcripts.has(this.key(agentId, videoId));
    }

    /**
     * Clear transcript for agent
     */
    clear(agentId: string, videoId?: string): void {
        if (videoId) {
            this.transcripts.delete(this.key(agentId, videoId));
        } else {
            // Clear all for agent
            for (const key of this.transcripts.keys()) {
                if (key.startsWith(`${agentId}:`)) {
                    this.transcripts.delete(key);
                }
            }
        }
    }

    /**
     * Clear all transcripts
     */
    clearAll(): void {
        this.transcripts.clear();
    }

    /**
     * Get stats
     */
    getStats(): { count: number; agents: string[] } {
        const agents = new Set<string>();
        for (const key of this.transcripts.keys()) {
            agents.add(key.split(':')[0]);
        }
        return {
            count: this.transcripts.size,
            agents: Array.from(agents),
        };
    }
}

// =============================================================================
// Singleton
// =============================================================================

export const transcriptStore = new TranscriptStore();
