/**
 * AB-OS Explain Session
 * 
 * Window-scoped session for video explanations.
 * Binds Gemini to specific agent + video context.
 */

import { GeminiClient } from './gemini-client';
import { TranscriptStore, StoredTranscript, transcriptStore } from './transcript-store';

// =============================================================================
// Types
// =============================================================================

export interface SessionContext {
    sessionId: string;
    agentId: string;
    videoId: string;
    createdAt: number;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export type ExplainMode = 'summary' | 'explain' | 'beginner' | 'technical' | 'timeline';

// =============================================================================
// Explain Session
// =============================================================================

export class ExplainSession {
    readonly sessionId: string;
    readonly agentId: string;
    readonly videoId: string;
    readonly createdAt: number;

    private geminiClient: GeminiClient;
    private history: ChatMessage[] = [];
    private transcript: StoredTranscript | null = null;
    private explanations: Map<ExplainMode, string> = new Map();

    constructor(agentId: string, videoId: string, geminiClient: GeminiClient) {
        this.sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        this.agentId = agentId;
        this.videoId = videoId;
        this.createdAt = Date.now();
        this.geminiClient = geminiClient;

        // Load transcript from store
        this.transcript = transcriptStore.get(agentId, videoId);

        console.log(`[ExplainSession] Created ${this.sessionId} for ${agentId}:${videoId}`);
    }

    /**
     * Check if session has valid transcript
     */
    hasTranscript(): boolean {
        return this.transcript !== null && this.transcript.segments.length > 0;
    }

    /**
     * Get full transcript text
     */
    getTranscriptText(): string | null {
        if (!this.transcript) return null;
        return this.transcript.segments.map(s => s.text).join(' ');
    }

    /**
     * Generate explanation (cached per mode)
     */
    async explain(mode: ExplainMode = 'summary'): Promise<string> {
        // Check cache
        if (this.explanations.has(mode)) {
            return this.explanations.get(mode)!;
        }

        if (!this.hasTranscript()) {
            throw new Error('No transcript available for this video');
        }

        const transcriptText = this.getTranscriptText()!;

        const result = await this.geminiClient.explain({
            transcript: transcriptText,
            videoTitle: this.transcript!.title,
            channel: this.transcript!.channel,
            duration: this.transcript!.duration,
            mode: mode as 'summary' | 'explain' | 'beginner' | 'technical',
        });

        // Cache result
        this.explanations.set(mode, result.content);

        return result.content;
    }

    /**
     * Ask a question (grounded in transcript)
     */
    async ask(question: string): Promise<string> {
        if (!this.hasTranscript()) {
            throw new Error('No transcript available for this video');
        }

        // Add user message to history
        this.history.push({
            role: 'user',
            content: question,
            timestamp: Date.now(),
        });

        // Get response from Gemini
        const response = await this.geminiClient.chat(
            this.videoId,
            this.getTranscriptText()!,
            this.transcript!.title,
            question
        );

        // Add assistant response to history
        this.history.push({
            role: 'assistant',
            content: response,
            timestamp: Date.now(),
        });

        return response;
    }

    /**
     * Get chat history
     */
    getHistory(): ChatMessage[] {
        return [...this.history];
    }

    /**
     * Get session context
     */
    getContext(): SessionContext {
        return {
            sessionId: this.sessionId,
            agentId: this.agentId,
            videoId: this.videoId,
            createdAt: this.createdAt,
        };
    }

    /**
     * Clear session
     */
    clear(): void {
        this.history = [];
        this.explanations.clear();
        this.geminiClient.clearSession(this.videoId);
    }
}

// =============================================================================
// Session Manager
// =============================================================================

export class SessionManager {
    private sessions: Map<string, ExplainSession> = new Map();
    private geminiClient: GeminiClient;

    constructor(geminiClient: GeminiClient) {
        this.geminiClient = geminiClient;
    }

    /**
     * Get or create session for agent + video
     */
    getSession(agentId: string, videoId: string): ExplainSession {
        const key = `${agentId}:${videoId}`;

        if (!this.sessions.has(key)) {
            const session = new ExplainSession(agentId, videoId, this.geminiClient);
            this.sessions.set(key, session);
        }

        return this.sessions.get(key)!;
    }

    /**
     * Check if session exists
     */
    hasSession(agentId: string, videoId: string): boolean {
        return this.sessions.has(`${agentId}:${videoId}`);
    }

    /**
     * Clear session
     */
    clearSession(agentId: string, videoId?: string): void {
        if (videoId) {
            const key = `${agentId}:${videoId}`;
            this.sessions.get(key)?.clear();
            this.sessions.delete(key);
        } else {
            // Clear all sessions for agent
            for (const [key, session] of this.sessions) {
                if (key.startsWith(`${agentId}:`)) {
                    session.clear();
                    this.sessions.delete(key);
                }
            }
        }
    }

    /**
     * Clear all sessions
     */
    clearAll(): void {
        for (const session of this.sessions.values()) {
            session.clear();
        }
        this.sessions.clear();
    }
}
