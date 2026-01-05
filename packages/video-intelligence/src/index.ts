/**
 * AB-OS Video Intelligence
 * 
 * Production-grade video explanation for Smart Browser.
 * Kernel-driven caption extraction, window-scoped sessions.
 * 
 * @packageDocumentation
 */

// Transcript Store (kernel-level storage)
export {
    TranscriptStore,
    transcriptStore,
    type StoredTranscript,
    type TranscriptSegment,
} from './transcript-store';

// Caption Extraction (network interception)
export {
    CaptionExtractor,
    type Caption,
    type Transcript,
    type CaptionTrack,
} from './caption-extractor';

// Explain Session (window-scoped)
export {
    ExplainSession,
    SessionManager,
    type SessionContext,
    type ChatMessage,
    type ExplainMode,
} from './explain-session';

// Gemini Client
export {
    GeminiClient,
    geminiClient,
    type ExplanationRequest,
    type ExplanationResponse,
} from './gemini-client';

// Legacy Explain Service (will be deprecated)
export {
    ExplainService,
    type VideoContext,
    type ExplainResult,
} from './explain-service';

