/**
 * AB-OS Gemini Client
 * 
 * Secure Gemini API integration for video explanations.
 * Runs in main process only - never expose to renderer.
 */

import { GoogleGenerativeAI, GenerativeModel, ChatSession } from '@google/generative-ai';

// =============================================================================
// Types
// =============================================================================

export interface ExplanationRequest {
    transcript: string;
    videoTitle: string;
    channel: string;
    duration: number;
    mode: 'summary' | 'explain' | 'beginner' | 'technical';
    language?: string;
}

export interface ExplanationResponse {
    content: string;
    tokens: number;
}

export interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}

// =============================================================================
// Prompts
// =============================================================================

const SYSTEM_PROMPTS = {
    summary: `You are an AI assistant helping users understand video content.
Generate a concise bullet-point summary of this video based on the transcript.
- Use 5-8 key points
- Focus on main concepts and takeaways
- Be clear and actionable`,

    explain: `You are an AI assistant explaining video content.
Based on the transcript, provide a clear, paragraph-style explanation of what this video teaches.
- Use simple language
- Include relevant analogies when helpful
- Structure logically`,

    beginner: `You are an AI tutor explaining video content to beginners.
Based on the transcript, explain this video for someone completely new to the topic.
- Define all technical terms
- Use everyday analogies
- Be encouraging and clear`,

    technical: `You are an AI assistant for technical professionals.
Based on the transcript, provide a detailed technical breakdown of this video.
- Include technical details
- Reference specific methodologies
- Be precise and thorough`,
};

const QA_SYSTEM = `You are an AI assistant answering questions about a video.
The user has watched a video and wants to understand it better.
Answer ONLY based on the transcript content provided.
If the answer is not in the transcript, say "This wasn't covered in the video."
Be helpful and concise.`;

// =============================================================================
// Gemini Client
// =============================================================================

export class GeminiClient {
    private genAI: GoogleGenerativeAI | null = null;
    private model: GenerativeModel | null = null;
    private chatSessions: Map<string, ChatSession> = new Map();

    /**
     * Initialize with API key (call from main process only)
     */
    initialize(apiKey: string): boolean {
        try {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({
                model: 'gemini-2.0-flash-exp',
            });
            console.log('[GeminiClient] Initialized successfully');
            return true;
        } catch (error) {
            console.error('[GeminiClient] Failed to initialize:', error);
            return false;
        }
    }

    /**
     * Check if client is ready
     */
    isReady(): boolean {
        return this.model !== null;
    }

    /**
     * Generate video explanation
     */
    async explain(request: ExplanationRequest): Promise<ExplanationResponse> {
        if (!this.model) {
            throw new Error('GeminiClient not initialized');
        }

        const systemPrompt = SYSTEM_PROMPTS[request.mode] || SYSTEM_PROMPTS.summary;

        const prompt = `${systemPrompt}

VIDEO DETAILS:
- Title: ${request.videoTitle}
- Channel: ${request.channel}
- Duration: ${Math.floor(request.duration / 60)} minutes

TRANSCRIPT:
${request.transcript}

Now provide your ${request.mode === 'summary' ? 'bullet-point summary' : 'explanation'}:`;

        try {
            const result = await this.model.generateContent(prompt);
            const response = result.response;
            const text = response.text();

            return {
                content: text,
                tokens: text.length / 4, // Approximate
            };
        } catch (error) {
            console.error('[GeminiClient] Explain error:', error);
            throw error;
        }
    }

    /**
     * Start or continue a Q&A chat session for a video
     */
    async chat(
        videoId: string,
        transcript: string,
        videoTitle: string,
        question: string
    ): Promise<string> {
        if (!this.model) {
            throw new Error('GeminiClient not initialized');
        }

        // Get or create chat session
        let session = this.chatSessions.get(videoId);

        if (!session) {
            // Create new session with context
            session = this.model.startChat({
                history: [
                    {
                        role: 'user',
                        parts: [{
                            text: `${QA_SYSTEM}

VIDEO: "${videoTitle}"

TRANSCRIPT:
${transcript}

I'll now ask questions about this video.` }],
                    },
                    {
                        role: 'model',
                        parts: [{ text: "I've read the transcript and I'm ready to answer your questions about this video. What would you like to know?" }],
                    },
                ],
            });
            this.chatSessions.set(videoId, session);
        }

        // Send question
        const result = await session.sendMessage(question);
        return result.response.text();
    }

    /**
     * Clear chat session for a video
     */
    clearSession(videoId: string): void {
        this.chatSessions.delete(videoId);
    }

    /**
     * Clear all sessions
     */
    clearAllSessions(): void {
        this.chatSessions.clear();
    }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const geminiClient = new GeminiClient();
