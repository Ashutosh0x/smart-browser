/**
 * AB-OS Universal Agent Model
 * 
 * The UI is APP-INDEPENDENT. Agents can control any web application.
 * Spotify, Gmail, Amazon are examples - not hardcoded apps.
 */

// =============================================================================
// Core Agent Types
// =============================================================================

export type AgentStatus =
    | 'running'       // Active, executing actions
    | 'waiting'       // Waiting for response or condition
    | 'needs_approval'// Blocked on human approval
    | 'completed'     // Task finished successfully
    | 'error'         // Task failed
    | 'paused'        // User paused execution
    | 'idle';         // Ready but not active

export type Capability =
    | 'CAP_READ'      // Read page content
    | 'CAP_NAVIGATE'  // Navigate to URLs
    | 'CAP_INTERACT'  // Click, type, scroll
    | 'CAP_WRITE'     // Modify form data
    | 'CAP_SUBMIT'    // Submit forms
    | 'CAP_PURCHASE'  // Financial transactions
    | 'CAP_EXPORT'    // Export/download data
    | 'CAP_UPLOAD'    // Upload files
    | 'CAP_AUTH'      // Authentication actions
    | 'CAP_PLAYBACK'  // Media playback control
    | 'CAP_MESSAGING' // Send messages/emails
    | 'CAP_DELETE';   // Delete actions

export interface IconRef {
    type: 'url' | 'lucide' | 'svg' | 'emoji';
    value: string;  // URL, icon name, SVG string, or emoji
    fallback?: string;  // Fallback emoji or icon
}

// =============================================================================
// Universal Agent Contract (UI-facing)
// =============================================================================

export interface Agent {
    // Identity
    agent_id: string;

    // App metadata (dynamic, not hardcoded)
    app_name: string;       // "Spotify", "Notion", "AWS Console", "Internal CRM"
    app_icon: IconRef;      // Dynamic icon
    app_domain: string;     // "spotify.com", "notion.so", "aws.amazon.com"

    // State
    status: AgentStatus;
    status_text: string;    // Human-readable status

    // Security
    capabilities: Capability[];
    trust_level: 'trusted' | 'standard' | 'restricted' | 'untrusted';

    // Intelligence
    confidence_score?: number;  // 0-1, agent's confidence in current action
    risk_level?: 'low' | 'medium' | 'high';

    // Task
    task_description?: string;
    progress_percent?: number;

    // Timestamps
    started_at: string;
    last_action_at?: string;
}

// =============================================================================
// Workspace Window (Any App)
// =============================================================================

export interface WorkspaceWindow {
    window_id: string;
    agent_id: string;

    // Current page
    title: string;
    url: string;
    favicon?: string;

    // Visual
    thumbnail?: string;  // Live screenshot
    is_active: boolean;

    // Rendering
    viewport_width: number;
    viewport_height: number;
}

// =============================================================================
// Timeline Entry (App-Agnostic)
// =============================================================================

export interface TimelineEntry {
    id: string;
    timestamp: string;
    agent_id: string;
    agent_name: string;  // Dynamic, not hardcoded

    // Action (generic, not app-specific)
    action_type:
    | 'navigate'
    | 'read'
    | 'interact'
    | 'submit'
    | 'approve'
    | 'escalate'
    | 'complete'
    | 'error';

    action_description: string;

    // Policy
    policy_name?: string;
    policy_status?: 'allowed' | 'blocked' | 'approval_required' | 'read_only';

    // Detail
    target_url?: string;
    target_element?: string;
}

// =============================================================================
// Policy (Domain-based, not App-based)
// =============================================================================

export interface PolicyRule {
    name: string;
    description?: string;

    // Conditions (all must match)
    conditions: {
        domains?: string[];       // ["*.bank.com", "salesforce.com"]
        capabilities?: Capability[];
        trust_levels?: string[];
        risk_levels?: string[];
    };

    // Actions
    actions: {
        allow?: boolean;
        deny?: boolean;
        require_approval?: boolean;
        log_level?: 'none' | 'basic' | 'detailed' | 'full';
    };
}

// =============================================================================
// Site Adapter (Optional Enhancement)
// =============================================================================

export interface SiteAdapter {
    domain_pattern: string;  // "*.spotify.com"

    // Semantic hints for faster understanding
    semantic_hints?: {
        play_button?: string;    // CSS selector or semantic description
        search_input?: string;
        main_content?: string;
    };

    // Known UI patterns
    known_patterns?: {
        login_flow?: boolean;
        two_factor?: boolean;
        captcha?: boolean;
    };

    // Common actions
    common_actions?: string[];  // ["play", "pause", "search", "like"]
}

// =============================================================================
// App Registry (Optional, Improves UX)
// =============================================================================

export interface KnownApp {
    domain: string;
    name: string;
    icon: IconRef;
    category: 'productivity' | 'communication' | 'entertainment' | 'finance' |
    'development' | 'social' | 'ecommerce' | 'enterprise' | 'other';
    default_capabilities: Capability[];
    adapter_available: boolean;
}

// Well-known apps (examples, not exhaustive)
export const KNOWN_APPS: KnownApp[] = [
    {
        domain: 'spotify.com',
        name: 'Spotify',
        icon: { type: 'emoji', value: '[Music]' },
        category: 'entertainment',
        default_capabilities: ['CAP_READ', 'CAP_INTERACT', 'CAP_PLAYBACK'],
        adapter_available: true,
    },
    {
        domain: 'mail.google.com',
        name: 'Gmail',
        icon: { type: 'emoji', value: '[Mail]' },
        category: 'communication',
        default_capabilities: ['CAP_READ', 'CAP_INTERACT', 'CAP_MESSAGING'],
        adapter_available: true,
    },
    {
        domain: 'amazon.com',
        name: 'Amazon',
        icon: { type: 'emoji', value: '[Cart]' },
        category: 'ecommerce',
        default_capabilities: ['CAP_READ', 'CAP_INTERACT', 'CAP_PURCHASE'],
        adapter_available: true,
    },
    // ... Any app can be added
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get app info from domain, falls back to generic if unknown
 */
export function getAppInfo(domain: string): Partial<KnownApp> {
    const known = KNOWN_APPS.find(app =>
        domain.includes(app.domain) ||
        domain.endsWith(`.${app.domain}`)
    );

    if (known) return known;

    // Generic fallback
    return {
        domain,
        name: domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1),
        icon: { type: 'lucide', value: 'Globe', fallback: '[Web]' },
        category: 'other',
    };
}

/**
 * Get status display properties
 */
export function getStatusDisplay(status: AgentStatus): {
    color: string;
    text: string;
    animate: boolean;
} {
    switch (status) {
        case 'running':
            return { color: 'var(--status-running)', text: 'Running', animate: true };
        case 'waiting':
            return { color: 'var(--status-idle)', text: 'Waiting', animate: false };
        case 'needs_approval':
            return { color: 'var(--status-warning)', text: 'Needs Approval', animate: true };
        case 'completed':
            return { color: 'var(--status-success)', text: 'Completed', animate: false };
        case 'error':
            return { color: 'var(--status-error)', text: 'Error', animate: false };
        case 'paused':
            return { color: 'var(--status-idle)', text: 'Paused', animate: false };
        default:
            return { color: 'var(--status-idle)', text: 'Idle', animate: false };
    }
}
