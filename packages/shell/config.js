/**
 * Smart Browser - Configuration Constants
 * 
 * Centralized configuration values to avoid magic numbers
 */

// =============================================================================
// Timing Constants
// =============================================================================

export const TIMING = {
    // UI Transition delays
    FULLSCREEN_TRANSITION_DELAY: 220,      // CSS transition time for fullscreen mode
    FULLSCREEN_ENTER_DELAY: 50,            // Delay before entering fullscreen (DOM settle)
    RESIZE_DEBOUNCE_DELAY: 100,            // Debounce time for window resize events

    // Agent initialization
    AGENT_INIT_DELAY: 100,                 // Wait time after agent creation before navigation
    AGENT_FRAME_WAIT: 1,                   // RequestAnimationFrame cycles to wait

    // AI/Command execution
    STEP_EXECUTION_DELAY: 1000,            // Delay between AI plan steps (user-visible)
    API_KEY_WARNING_DELAY: 1000,           // Delay before showing API key warning

    // Input handling
    COMMAND_INPUT_DEBOUNCE: 300,           // Debounce for command input autocomplete
};

// =============================================================================
// Agent Configuration
// =============================================================================

export const AGENT = {
    MAX_AGENTS: 4,                         // Maximum number of simultaneous agents
    DEFAULT_URL: 'about:blank',            // Initial URL for new agents
    USER_AGENT: 'Smart Browser/1.0',       // Custom user agent string
};

// =============================================================================
// Security Constants
// =============================================================================

export const SECURITY = {
    // Selector validation pattern
    SAFE_SELECTOR_PATTERN: /^[a-zA-Z0-9\s\.\#\[\]\=\-\_\>\+\~\*\:\(\)\"\']+$/,

    // Scroll limits (prevent DOS via infinite scroll)
    MAX_SCROLL_AMOUNT: 10000,
    MIN_SCROLL_AMOUNT: -10000,

    // Text content sanitization
    DANGEROUS_HTML_PATTERN: /[<>]/g,
};

// =============================================================================
// Video Intelligence
// =============================================================================

export const VIDEO_INTEL = {
    MAX_CHAT_SESSIONS: 10,                 // Maximum cached Gemini sessions
    SESSION_TIMEOUT_MS: 30 * 60 * 1000,    // Session expiry time (30 minutes)
    DEFAULT_MODEL: 'gemini-2.0-flash-exp', // Gemini model for video explanations
};

// =============================================================================
// UI Configuration
// =============================================================================

export const UI = {
    MIN_WINDOW_WIDTH: 1000,
    MIN_WINDOW_HEIGHT: 700,
    DEFAULT_WINDOW_WIDTH: 1400,
    DEFAULT_WINDOW_HEIGHT: 900,

    // Slot dimensions
    TITLE_BAR_HEIGHT: 32,
    COMMAND_BAR_HEIGHT: 60,
    STATUS_BAR_HEIGHT: 24,
    HEADER_OFFSET: 112,  // Title + Command bar approximate height
};

// =============================================================================
// Planner Configuration
// =============================================================================

export const PLANNER = {
    DEFAULT_PROVIDER: 'groq',
    DEFAULT_MODEL: 'llama-3.3-70b-versatile',
    TIMEOUT_MS: 30000,
};

// =============================================================================
// Logging
// =============================================================================

export const LOG = {
    MAX_AUDIT_ENTRIES: 1000,               // Maximum entries in audit log
    LOG_LEVELS: ['debug', 'info', 'warn', 'error'],
};

// =============================================================================
// Export all constants as a single object
// =============================================================================

export const CONFIG = {
    TIMING,
    AGENT,
    SECURITY,
    VIDEO_INTEL,
    UI,
    PLANNER,
    LOG,
};

export default CONFIG;
