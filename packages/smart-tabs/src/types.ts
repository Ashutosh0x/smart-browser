/**
 * Smart Tabs - Type Definitions
 * 
 * Core types for AI-native tab management
 */

// =============================================================================
// Tab Categories & Intents
// =============================================================================

export type TabCategory =
    | 'work'
    | '

research' 
    | 'shopping'
    | 'social'
    | 'entertainment'
    | 'development'
    | 'security'
    | 'productivity'
    | 'communication'
    | 'learning'
    | 'finance'
    | 'news'
    | 'other';

export type TabIntent =
    | 'reading'
    | 'coding'
    | 'debugging'
    | 'researching'
    | 'communicating'
    | 'monitoring'
    | 'learning'
    | 'shopping'
    | 'watching'
    | 'listening'
    | 'writing'
    | 'analyzing';

// =============================================================================
// Tab Metadata
// =============================================================================

export interface SmartTab {
    // Identity
    id: string;
    agentId: string;
    url: string;
    title: string;
    favicon?: string;

    // AI-powered metadata
    category: TabCategory;
    intent: TabIntent;
    summary?: string;
    keywords: string[];
    confidence: number; // 0-1, how sure we are about classification

    // Performance tracking
    memoryUsage: number; // bytes
    cpuUsage: number;    // percentage
    lastActive: number;  // timestamp
    createdAt: number;   // timestamp

    // Organization
    groupId?: string;
    isPinned: boolean;
    isSleeping: boolean;

    // Session
    sessionId?: string;
    temporaryData?: Record<string, any>;

    // Content
    pageContent?: string; // For analysis
    metaTags?: Record<string, string>;
}

// =============================================================================
// Tab Groups
// =============================================================================

export interface TabGroup {
    id: string;
    name: string;
    color: string;
    category: TabCategory;
    tabs: string[]; // Tab IDs

    // Auto-grouping
    autoGrouped: boolean;
    rules?: GroupRule[];

    // Visual
    collapsed: boolean;
    icon?: string;

    // Metadata
    createdAt: number;
    lastModified: number;
}

export interface GroupRule {
    type: 'domain' | 'keyword' | 'category' | 'intent';
    pattern: string | RegExp;
    confidence: number;
}

// =============================================================================
// Browser Sessions
// =============================================================================

export interface BrowserSession {
    id: string;
    name: string;
    description?: string;
    timestamp: number;

    // Tab state
    tabs: SmartTab[];
    groups: TabGroup[];
    activeTabId: string;

    // Context
    tags: string[];
    category?: TabCategory;

    // Auto-save
    autoSaved: boolean;
    lastModified: number;
}

// =============================================================================
// Classification
// =============================================================================

export interface Classification {
    category: TabCategory;
    intent: TabIntent;
    keywords: string[];
    confidence: number;
    source: 'domain' | 'content' | 'ai' | 'manual';
}

export interface DomainRule {
    pattern: string | RegExp;
    category: TabCategory;
    intent: TabIntent;
    confidence: number;
    keywords?: string[];
}

// =============================================================================
// Search
// =============================================================================

export interface SearchResult {
    tab: SmartTab;
    score: number;
    matches: SearchMatch[];
}

export interface SearchMatch {
    field: 'title' | 'url' | 'content' | 'keywords';
    text: string;
    indices: [number, number][];
}

export interface SearchIntent {
    query: string;
    categories?: TabCategory[];
    intents?: TabIntent[];
    keywords: string[];
    timeframe?: 'recent' | 'today' | 'yesterday' | 'this-week' | 'earlier';
    action?: 'view' | 'close' | 'group' | 'summarize';
}

// =============================================================================
// Performance
// =============================================================================

export interface TabPerformance {
    tabId: string;
    memoryUsage: number;
    cpuUsage: number;
    networkActivity: number;
    lastUpdated: number;
}

export interface PerformanceThresholds {
    maxMemoryMB: number;
    maxCpuPercent: number;
    sleepAfterSeconds: number;
}

// =============================================================================
// Command Palette
// =============================================================================

export interface Command {
    id: string;
    label: string;
    description: string;
    shortcut?: string;
    category: 'tabs' | 'groups' | 'search' | 'session' | 'ai' | 'navigation';
    icon?: string;
    action: (args?: any) => Promise<void>;
    enabled?: () => boolean;
}

// =============================================================================
// Events
// =============================================================================

export interface TabEvent {
    type: 'created' | 'updated' | 'closed' | 'activated' | 'grouped' | 'sleep' | 'wake';
    tabId: string;
    timestamp: number;
    data?: any;
}

export interface GroupEvent {
    type: 'created' | 'updated' | 'deleted' | 'collapsed' | 'expanded';
    groupId: string;
    timestamp: number;
    data?: any;
}

// =============================================================================
// Manager Options
// =============================================================================

export interface TabManagerOptions {
    autoGroup?: boolean;
    autoClassify?: boolean;
    autoSleep?: boolean;
    performanceMonitoring?: boolean;
    maxTabs?: number;
}

export interface ClassifierOptions {
    useAI?: boolean;
    confidenceThreshold?: number;
    cacheClassifications?: boolean;
}

export interface SessionManagerOptions {
    autoSave?: boolean;
    autoSaveInterval?: number; // milliseconds
    maxSessions?: number;
}
