# Smart Tabs - AI-Native Tab Management
# Implementation Plan & Architecture

**Status:** 🚧 In Development  
**Priority:** HIGH  
**Target:** Next Major Release (v0.2.0)

---

## 🎯 Vision

Transform Smart Browser from multi-agent browsing into the world's first **AI-native tab management system** with semantic understanding, automated organization, and power-user workflows.

---

## 📋 Feature Breakdown

### Phase 1: Foundation (Week 1-2) - **PRIORITY**
- [ ] Tab metadata system
- [ ] Tab grouping engine
- [ ] Session storage & restoration
- [ ] Basic tab search

### Phase 2: AI Integration (Week 3-4)
- [ ] Intent-based tab classification
- [ ] Semantic tab search
- [ ] Tab summarization
- [ ] AI Tab Copilot

### Phase 3: Power Features (Week 5-6)
- [ ] Command palette (Ctrl+K)
- [ ] Tab timeline
- [ ] Performance monitoring
- [ ] Resource management

### Phase 4: Visual Excellence (Week 7-8)
- [ ] Advanced theming engine
- [ ] Custom tab UI
- [ ] New Tab Page dashboard
- [ ] Contextual NTP

### Phase 5: Security & Dev Tools (Week 9-10)
- [ ] Isolated security tabs
- [ ] Per-tab proxy/VPN
- [ ] Network monitor
- [ ] Diff view

---

## 🏗️ Architecture

```
packages/
├── smart-tabs/              # NEW - Core tab intelligence
│   ├── src/
│   │   ├── index.ts
│   │   ├── tab-manager.ts         # Tab lifecycle & metadata
│   │   ├── tab-classifier.ts      # AI-based classification
│   │   ├── tab-groups.ts          # Auto-grouping engine
│   │   ├── session-manager.ts     # Save/restore sessions
│   │   ├── tab-search.ts          # Semantic search
│   │   └── types.ts
│   ├── package.json
│   └── tsconfig.json
│
├── tab-copilot/             # NEW - AI assistant for tabs
│   ├── src/
│   │   ├── index.ts
│   │   ├── copilot.ts             # Natural language commands
│   │   ├── summarizer.ts          # Tab content summarization
│   │   ├── knowledge-graph.ts     # Cross-tab intelligence
│   │   └── prompts.ts
│   └── package.json
│
├── command-palette/         # NEW - Ctrl+K interface
│   ├── src/
│   │   ├── index.ts
│   │   ├── palette.ts
│   │   ├── commands.ts
│   │   └── fuzzy-search.ts
│   └── package.json
│
├── theme-engine/            # NEW - Advanced theming
│   ├── src/
│   │   ├── index.ts
│   │   ├── theme-manager.ts
│   │   ├── adaptive-themes.ts
│   │   └── presets.ts
│   └── package.json
│
└── shell/                   # UPDATED - Integration
    ├── ui/
    │   ├── ntp/             # New Tab Page
    │   ├── tab-strip/       # Enhanced tab UI
    │   ├── command-palette/ # Command palette UI
    │   └── smart-tabs/      # Tab management UI
```

---

## 📊 Data Models

### Tab Metadata
```typescript
interface SmartTab {
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
    
    // Performance
    memoryUsage: number;
    cpuUsage: number;
    lastActive: number;
    
    // Organization
    groupId?: string;
    isPinned: boolean;
    isSleeping: boolean;
    
    // Session
    sessionId?: string;
    temporaryData?: any;
}

type TabCategory = 
    | 'work' 
    | 'research' 
    | 'shopping' 
    | 'social' 
    | 'entertainment' 
    | 'development' 
    | 'security'
    | 'productivity';

type TabIntent = 
    | 'reading' 
    | 'coding' 
    | 'debugging' 
    | 'researching' 
    | 'communicating'
    | 'monitoring'
    | 'learning';
```

### Tab Group
```typescript
interface TabGroup {
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
}

interface GroupRule {
    type: 'domain' | 'keyword' | 'category';
    pattern: string;
    confidence: number;
}
```

### Session
```typescript
interface BrowserSession {
    id: string;
    name: string;
    timestamp: number;
    
    // Tab state
    tabs: SmartTab[];
    groups: TabGroup[];
    activeTabId: string;
    
    // Context
    description?: string;
    tags: string[];
    
    // Auto-save
    autoSaved: boolean;
    lastModified: number;
}
```

---

## 🤖 AI Classification Pipeline

```typescript
// How tabs get classified
class TabClassifier {
    async classifyTab(tab: { url: string; title: string; content?: string }): Promise<TabMetadata> {
        // Step 1: Domain-based classification
        const domainCategory = this.classifyByDomain(tab.url);
        
        // Step 2: Content analysis (if available)
        let contentCategory;
        if (tab.content) {
            contentCategory = await this.analyzeContent(tab.content);
        }
        
        // Step 3: Gemini-based classification for ambiguous cases
        if (domainCategory.confidence < 0.7) {
            contentCategory = await this.classifyWithGemini(tab);
        }
        
        // Step 4: Merge classifications
        return this.mergeClassifications(domainCategory, contentCategory);
    }
    
    private classifyByDomain(url: string): Classification {
        const rules = {
            'github.com': { category: 'development', intent: 'coding', confidence: 0.9 },
            'stackoverflow.com': { category: 'development', intent: 'debugging', confidence: 0.9 },
            'gmail.com': { category: 'productivity', intent: 'communicating', confidence: 0.95 },
            'aws.amazon.com': { category: 'work', intent: 'researching', confidence: 0.8 },
            'youtube.com': { category: 'entertainment', intent: 'learning', confidence: 0.6 },
            // ... hundreds more
        };
        
        // Match URL against rules
        for (const [domain, classification] of Object.entries(rules)) {
            if (url.includes(domain)) {
                return classification;
            }
        }
        
        return { category: 'research', intent: 'reading', confidence: 0.5 };
    }
}
```

---

## 🎨 UI Components

### 1. Smart Tab Strip
```
┌─────────────────────────────────────────────────────────────┐
│ [🏠] [Work ▼ 3] [Research ▼ 5] [Shopping ▼ 2]    [⚡][🔍][⚙️] │
│  ├─ GitHub Issue #123                                        │
│  ├─ AWS Console                                              │
│  └─ Jira Dashboard                                           │
└─────────────────────────────────────────────────────────────┘
```

### 2. Command Palette
```
┌─────────────────────────────────────────────────────────────┐
│ > Close all shopping tabs                                    │
├─────────────────────────────────────────────────────────────┤
│ > 🔥 Close Tabs                 Ctrl+W                     │ │
│ > 📂 Close Group                Alt+Shift+W                │ │
│ > 🧹 Close Inactive Tabs        Alt+Shift+Q                │ │
│   💰 Close Shopping Tabs        (Custom)                   │ │
└─────────────────────────────────────────────────────────────┘
```

### 3. New Tab Page
```
┌─────────────────────────────────────────────────────────────┐
│  Good morning, Ashutosh                    🌅 6:30 AM       │
├─────────────────────────────────────────────────────────────┤
│  📋 Today's Tasks           🧠 Recent                        │
│  • Review PR #456           • AWS IAM Docs                   │
│  • Fix CORS bug             • GitHub Actions                 │
│  • Security scan            • HackerOne Reports              │
│                                                               │
│  💼 Quick Workflows                                          │
│  [Bug Bounty Hunt] [Cloud Research] [Startup Analysis]      │
│                                                               │
│  📌 Pinned                                                   │
│  GitHub • AWS • Jira • Notion                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔥 Feature Implementations

### Feature 1: Auto Tab Grouping

```typescript
class AutoGrouper {
    async analyzeAndGroup(tabs: SmartTab[]): Promise<TabGroup[]> {
        const groups: TabGroup[] = [];
        
        // Group by category
        const categorized = _.groupBy(tabs, 'category');
        
        for (const [category, categoryTabs] of Object.entries(categorized)) {
            // Further group by domain similarity
            const domainGroups = this.clusterByDomain(categoryTabs);
            
            for (const cluster of domainGroups) {
                groups.push({
                    id: uuid(),
                    name: this.generateGroupName(cluster),
                    color: this.getCategoryColor(category),
                    category: category as TabCategory,
                    tabs: cluster.map(t => t.id),
                    autoGrouped: true,
                    collapsed: false
                });
            }
        }
        
        return groups;
    }
    
    private generateGroupName(tabs: SmartTab[]): string {
        // Use Gemini to generate smart group names
        const domains = [...new Set(tabs.map(t => new URL(t.url).hostname))];
        
        if (domains.length === 1) {
            return this.prettifyDomain(domains[0]);
        }
        
        // Multiple domains - use AI
        return this.aiGenerateGroupName(tabs);
    }
}
```

### Feature 2: Session Management

```typescript
class SessionManager {
    async saveSession(name: string): Promise<void> {
        const tabs = await this.getAllTabs();
        const groups = await this.getAllGroups();
        
        const session: BrowserSession = {
            id: uuid(),
            name,
            timestamp: Date.now(),
            tabs,
            groups,
            activeTabId: this.getActiveTabId(),
            tags: this.generateTags(tabs),
            autoSaved: false,
            lastModified: Date.now()
        };
        
        await this.storage.save(`session_${session.id}`, session);
    }
    
    async restoreSession(sessionId: string): Promise<void> {
        const session = await this.storage.load(`session_${sessionId}`);
        
        // Close all current tabs
        await this.closeTabs(await this.getAllTabs());
        
        // Restore groups
        for (const group of session.groups) {
            await this.createGroup(group);
        }
        
        // Restore tabs in order
        for (const tab of session.tabs) {
            await this.createTab(tab);
        }
        
        // Activate the previously active tab
        await this.activateTab(session.activeTabId);
    }
    
    async resumeYesterday(): Promise<void> {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        // Find auto-saved session from yesterday
        const sessions = await this.storage.listSessions();
        const yesterdaySessions = sessions.filter(s => 
            new Date(s.timestamp).toDateString() === yesterday.toDateString()
        );
        
        if (yesterdaySessions.length > 0) {
            // Get the last session from yesterday
            const lastSession = yesterdaySessions[yesterdaySessions.length - 1];
            await this.restoreSession(lastSession.id);
        }
    }
}
```

### Feature 3: Semantic Tab Search

```typescript
class TabSearch {
    async search(query: string): Promise<SmartTab[]> {
        const tabs = await this.getAllTabs();
        
        // Step 1: Traditional keyword search
        const keywordMatches = this.keywordSearch(tabs, query);
        
        // Step 2: Semantic search with Gemini
        const semanticMatches = await this.semanticSearch(tabs, query);
        
        // Step 3: Merge and rank
        return this.rankResults(keywordMatches, semanticMatches, query);
    }
    
    private async semanticSearch(tabs: SmartTab[], query: string): Promise<SmartTab[]> {
        // Use Gemini to understand intent
        const intent = await this.analyzeSearchIntent(query);
        
        // Match tabs by intent
        return tabs.filter(tab => {
            // Check if tab matches the search intent
            return this.matchesIntent(tab, intent);
        });
    }
    
    private async analyzeSearchIntent(query: string): Promise<SearchIntent> {
        const prompt = `Analyze this tab search query and extract the intent:
Query: "${query}"

Extract:
- What type of content is the user looking for?
- What keywords/topics are relevant?
- What timeframe? (recent, today, yesterday, earlier)
- What action? (view, close, group, etc.)

Return JSON.`;
        
        const response = await geminiClient.analyze(prompt);
        return JSON.parse(response);
    }
}
```

### Feature 4: Command Palette

```typescript
interface Command {
    id: string;
    label: string;
    description: string;
    shortcut?: string;
    category: 'tabs' | 'groups' | 'search' | 'session' | 'ai';
    action: (args?: any) => Promise<void>;
}

class CommandPalette {
    private commands: Command[] = [
        {
            id: 'close-all-tabs',
            label: 'Close All Tabs',
            description: 'Close all open tabs',
            shortcut: 'Ctrl+Shift+W',
            category: 'tabs',
            action: async () => await this.closeAllTabs()
        },
        {
            id: 'group-by-category',
            label: 'Auto-Group Tabs',
            description: 'Group tabs by AI-detected category',
            category: 'groups',
            action: async () => await this.autoGroupTabs()
        },
        {
            id: 'save-session',
            label: 'Save Session',
            description: 'Save current tab layout',
            shortcut: 'Ctrl+Shift+S',
            category: 'session',
            action: async () => await this.saveSession()
        },
        {
            id: 'resume-yesterday',
            label: 'Resume Yesterday',
            description: 'Restore yesterday\'s tabs',
            category: 'session',
            action: async () => await this.resumeYesterday()
        },
        // ... AI commands
        {
            id: 'ai-summarize-tabs',
            label: 'Summarize Open Tabs',
            description: 'AI summary of all open tabs',
            category: 'ai',
            action: async () => await this.summarizeAllTabs()
        }
    ];
    
    async execute(query: string): Promise<void> {
        // Try to parse as natural language first
        if (this.isNaturalLanguage(query)) {
            await this.handleNaturalLanguage(query);
            return;
        }
        
        // Fuzzy search commands
        const matches = this.fuzzySearch(query, this.commands);
        
        if (matches.length > 0) {
            await matches[0].action();
        }
    }
    
    private async handleNaturalLanguage(query: string): Promise<void> {
        // Examples:
        // "Close all shopping tabs"
        // "Group cloud-related pages"
        // "Which tab has AWS IAM policy?"
        
        const prompt = `Convert this user command into actions:
Command: "${query}"

Available actions:
- close_tabs(filter) - Close tabs matching filter
- group_tabs(category) - Group tabs by category
- search_tabs(query) - Find specific tabs
- summarize_tabs(filter) - Summarize tab content

Return JSON with action and parameters.`;
        
        const response = await this.tabCopilot.execute(prompt);
        await this.executeAction(response);
    }
}
```

---

## 🎯 Implementation Priorities

### P0 (Must Have - Week 1-2)
1. **Tab metadata system** - Foundation for everything
2. **Basic tab grouping** - Manual groups first
3. **Session save/restore** - Critical for "Resume yesterday"
4. **Command palette** - Power-user entry point

### P1 (Should Have - Week 3-4)
1. **AI classification** - Auto-detect categories
2. **Auto-grouping** - AI-powered organization
3. **Semantic search** - "Find AWS pricing page"
4. **Tab summarization** - Hover tooltips

### P2 (Nice to Have - Week 5-6)
1. **Tab timeline** - Visual history
2. **Performance monitor** - CPU/RAM usage
3. **Auto-sleep** - Freeze inactive tabs
4. **New Tab Page** - Dashboard

### P3 (Future - Week 7+)
1. **Advanced themes** - HSL/RGB customization
2. **Security tabs** - Sandboxed mode
3. **Per-tab proxy** - Network isolation
4. **Diff view** - Page comparison

---

## 🔧 Technical Challenges

### Challenge 1: Tab State Management
**Problem:** BrowserView doesn't expose tab metadata  
**Solution:** Maintain parallel metadata store + sync events

### Challenge 2: Content Analysis Performance
**Problem:** Analyzing every page slows navigation  
**Solution:** 
- Lazy analysis (on-demand)
- Background processing
- Cache results
- Use domain rules first, AI as fallback

### Challenge 3: Session Persistence
**Problem:** Restoring tabs with full state  
**Solution:**
- Save URL + cookies + localStorage
- Use Electron's `session` API
- Incremental restoration

### Challenge 4: AI Cost
**Problem:** Too many Gemini API calls  
**Solution:**
- Domain-based rules (95% accuracy)
- Batch processing
- Cache classifications
- Only use AI for ambiguous cases

---

## 📦 Package Dependencies

```json
// packages/smart-tabs/package.json
{
  "dependencies": {
    "uuid": "^9.0.0",
    "lodash": "^4.17.21",
    "fuse.js": "^7.0.0",        // Fuzzy search
    "hotkeys-js": "^3.12.0",    // Keyboard shortcuts
    "date-fns": "^2.30.0",      // Time handling
    "@google/generative-ai": "^0.1.0"  // Already have
  }
}
```

---

## 🎨 UI/UX Mockups

### Tab Strip with Groups
```css
.tab-strip {
    display: flex;
    gap: 4px;
    padding: 8px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.tab-group {
    display: flex;
    flex-direction: column;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
}

.tab-group-header {
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 600;
    color: white;
    cursor: pointer;
}

.tab {
    padding: 8px 16px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.9);
    transition: all 0.2s ease;
}

.tab:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
```

---

## 🚀 Getting Started

### Step 1: Create Smart Tabs Package
```bash
cd packages
mkdir smart-tabs
cd smart-tabs
npm init -y
npm install uuid lodash fuse.js
```

### Step 2: Implement Core
```typescript
// packages/smart-tabs/src/index.ts
export { TabManager } from './tab-manager';
export { TabClassifier } from './tab-classifier';
export { SessionManager } from './session-manager';
export { TabSearch } from './tab-search';
export * from './types';
```

### Step 3: Integrate with Shell
```javascript
// packages/shell/main.js
const { TabManager } = require('../smart-tabs/dist/index');

const tabManager = new TabManager();

// Hook into agent creation
ipcMain.handle('agent:create', async (event, { agentId, bounds }) => {
    const result = await agentManager.createAgent(agentId, bounds);
    
    // Register tab with smart tabs
    await tabManager.registerTab({
        id: agentId,
        agentId,
        url: 'about:blank',
        title: 'New Tab',
        category: 'research',
        intent: 'reading'
    });
    
    return result;
});
```

---

## 📊 Success Metrics

- **Tab organization**: 90% of tabs auto-grouped correctly
- **Search accuracy**: Find target tab in <3 keystrokes
- **Session restore**: <5 seconds for 50 tabs
- **Performance**: <100MB RAM for metadata
- **User satisfaction**: "Best tab management I've used"

---

## 🎯 Next Steps

1. **Review this plan** - Adjust priorities
2. **Create packages** - Set up infrastructure
3. **Build P0 features** - Foundation first
4. **Iterate with testing** - Get user feedback
5. **Scale AI features** - Once foundation is solid

---

**Ready to build the future of tab management!** 🚀
