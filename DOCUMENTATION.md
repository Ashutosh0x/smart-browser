# Smart Browser - Technical Documentation

## Table of Contents

1. [Introduction](#introduction)
2. [System Requirements](#system-requirements)
3. [Architecture Overview](#architecture-overview)
4. [Package Structure](#package-structure)
5. [Core Components](#core-components)
6. [Video Intelligence System](#video-intelligence-system)
7. [Adblock Engine](#adblock-engine)
8. [AI Planner Module](#ai-planner-module)
9. [IPC Communication](#ipc-communication)
10. [Security Model](#security-model)
11. [Build and Deployment](#build-and-deployment)
12. [API Reference](#api-reference)
13. [Troubleshooting](#troubleshooting)

---

## Introduction

Smart Browser is an AI-native browser operating system built on Electron and Chromium. It extends the traditional browser paradigm by introducing multi-agent browsing, where multiple independent browser sessions run simultaneously in a unified workspace. The browser integrates Google Gemini for natural language commands and video intelligence capabilities.

### Design Philosophy

1. **Agent-Based Architecture**: Each browsing session is an isolated "agent" with its own state
2. **AI-First Interaction**: Natural language commands as the primary input method
3. **Kernel Abstraction**: Core browser primitives exposed through a clean ABI layer
4. **Security by Default**: Context isolation and minimal privilege exposure

---

## System Requirements

### Minimum Requirements

| Component | Requirement |
|-----------|-------------|
| Operating System | Windows 10/11, macOS 10.14+, Ubuntu 18.04+ |
| Node.js | 18.0.0 or higher |
| RAM | 4 GB |
| Disk Space | 500 MB |
| Internet | Required for Gemini API |

### Recommended Requirements

| Component | Requirement |
|-----------|-------------|
| Node.js | 20.x LTS |
| RAM | 8 GB or more |
| Display | 1920x1080 or higher |

---

## Architecture Overview

```
+------------------------------------------------------------------+
|                        Smart Browser Shell                        |
|  +------------------------------------------------------------+  |
|  |                      Title Bar + Menu                       |  |
|  +------------------------------------------------------------+  |
|  |                       Command Bar                           |  |
|  |  [AI Icon] "Tell Smart Browser what to do..."    [Search]  |  |
|  +------------------------------------------------------------+  |
|  |  Agent  |                                         |  Audit  |  |
|  |  Panel  |            Workspace Grid               |   Log   |  |
|  |         |  +----------+  +----------+             |         |  |
|  |  Slot 0 |  | Agent 1  |  | Agent 2  |             |  [Log]  |  |
|  |  Slot 1 |  | Browser  |  | Browser  |             |  [Log]  |  |
|  |  Slot 2 |  |  View    |  |  View    |             |  [Log]  |  |
|  |  Slot 3 |  +----------+  +----------+             |         |  |
|  |         |  +----------+  +----------+             |         |  |
|  |  [New]  |  | Agent 3  |  | Agent 4  |             |         |  |
|  |         |  | Browser  |  | Browser  |             |         |  |
|  |         |  |  View    |  |  View    |             |         |  |
|  |         |  +----------+  +----------+             |         |  |
|  +------------------------------------------------------------+  |
|  |                       Status Bar                            |  |
+------------------------------------------------------------------+
```

### Process Model

```
Main Process (Node.js)
├── AgentManager
│   ├── BrowserView 1 (Agent 1)
│   ├── BrowserView 2 (Agent 2)
│   ├── BrowserView 3 (Agent 3)
│   └── BrowserView 4 (Agent 4)
├── Video Intelligence
│   ├── CaptionExtractor
│   ├── TranscriptStore
│   └── SessionManager
├── Adblock Engine
│   ├── RuleEngine
│   ├── ResponseInspector
│   └── ManifestRewriter
└── IPC Handlers

Renderer Process (Chromium)
├── Shell UI (index.html)
├── renderer.js
├── menu.js
└── video-intelligence.js
```

---

## Package Structure

### packages/shell

The main Electron application containing the browser shell.

```
shell/
├── main.js              # Main process entry point
├── preload.js           # Secure context bridge
├── package.json         # Dependencies and scripts
└── ui/
    ├── index.html       # Shell markup
    ├── styles.css       # Design system
    ├── renderer.js      # UI logic
    ├── menu.js          # Hamburger menu
    └── video-intelligence.js  # Intel panel handler
```

**Key Responsibilities:**
- Window management
- BrowserView lifecycle
- IPC handler registration
- Network request interception

### packages/video-intelligence

Gemini-powered video explanation system.

```
video-intelligence/
├── src/
│   ├── index.ts              # Public exports
│   ├── caption-extractor.ts  # Network caption capture
│   ├── transcript-store.ts   # Per-agent storage
│   ├── explain-session.ts    # Window-scoped sessions
│   └── gemini-client.ts      # API wrapper
├── tsconfig.json
└── package.json
```

**Key Classes:**
- `CaptionExtractor`: Parses YouTube timedtext JSON responses
- `TranscriptStore`: Stores segments with timestamps per agent/video
- `ExplainSession`: Binds Gemini to a specific video context
- `SessionManager`: Manages multiple sessions

### packages/adblock

Ad blocking engine with response modification.

```
adblock/
├── src/
│   ├── index.ts              # Factory function
│   ├── types.ts              # Type definitions
│   ├── filter-parser.ts      # AdBlock Plus syntax
│   ├── rule-engine.ts        # Trie-based matching
│   ├── network-interceptor.ts # Request blocking
│   ├── response-inspector.ts  # API response stripping
│   └── manifest-rewriter.ts   # DASH/HLS modification
├── tsconfig.json
└── package.json
```

**Blocking Stages:**
1. URL Pattern Matching
2. Response Body Inspection
3. Video Manifest Rewriting

### packages/planner

AI-powered command planning.

```
planner/
├── src/
│   └── index.ts         # Planner class
├── tsconfig.json
└── package.json
```

**Features:**
- Natural language parsing
- Multi-step action planning
- DOM interaction primitives

---

## Core Components

### AgentManager

Located in `main.js`, manages the lifecycle of browser agents.

```javascript
class AgentManager {
    constructor(mainWindow)
    createAgent(agentId, bounds)
    navigate(agentId, url)
    destroyAgent(agentId)
    updateBounds(agentId, bounds)
    executeAction(agentId, action, target, params)
}
```

**Agent State:**
```javascript
{
    view: BrowserView,
    bounds: { x, y, width, height },
    currentUrl: string,
    status: 'idle' | 'loading' | 'loaded' | 'error'
}
```

### Command Execution

The command bar accepts natural language and URL inputs:

1. **URL Detection**: Regex pattern matches domain-like strings
2. **Prefix Commands**: `go to`, `open`, `new`, `focus`
3. **AI Fallback**: Unrecognized commands sent to Planner

```javascript
// URL pattern
const URL_PATTERN = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+/i;

// Command parsing
if (command.startsWith('go to')) { navigate() }
else if (URL_PATTERN.test(command)) { navigate() }
else { aiPlan() }
```

---

## Video Intelligence System

### Caption Extraction Pipeline

```
YouTube Video Page
       │
       v
┌─────────────────────────────┐
│  webRequest.onCompleted     │  <- Intercepts timedtext requests
│  (timedtext URL filter)     │
└─────────────────────────────┘
       │
       v
┌─────────────────────────────┐
│  CaptionExtractor           │  <- Parses JSON3 format
│  .ingestFromNetwork()       │
└─────────────────────────────┘
       │
       v
┌─────────────────────────────┐
│  TranscriptStore            │  <- Stores per agent/video
│  .store(agentId, videoId,   │
│         segments)           │
└─────────────────────────────┘
       │
       v
┌─────────────────────────────┐
│  ExplainSession             │  <- Binds Gemini context
│  .explain(mode)             │
│  .ask(question)             │
└─────────────────────────────┘
       │
       v
┌─────────────────────────────┐
│  Gemini API                 │  <- Generates response
│  (gemini-2.0-flash-exp)     │
└─────────────────────────────┘
```

### Transcript Segment Format

```typescript
interface TranscriptSegment {
    start: number;   // Start time in seconds
    end: number;     // End time in seconds
    text: string;    // Caption text
}
```

### Session Management

Each ExplainSession maintains:
- Transcript reference (from TranscriptStore)
- Explanation cache (per mode: summary, explain)
- Q&A history (conversational memory)

```typescript
interface ExplainSession {
    agentId: string;
    videoId: string;
    transcript: TranscriptSegment[];
    explanationCache: Map<ExplainMode, string>;
    history: ChatMessage[];
}
```

---

## Adblock Engine

### Rule Matching Algorithm

The RuleEngine uses a reverse-domain trie for O(k) hostname lookups:

```
Trie Structure:
root
├── com
│   ├── doubleclick -> [BLOCK]
│   ├── googlesyndication -> [BLOCK]
│   └── google
│       └── ads -> [BLOCK]
├── net
│   └── adservice -> [BLOCK]
```

### Response Inspection

For YouTube, the ResponseInspector strips ad-related JSON fields:

```javascript
const AD_FIELDS = [
    'adPlacements',
    'playerAds', 
    'adSlots',
    'adBreakParams',
    'adBreakHeartbeatParams'
];
```

### Manifest Rewriting

DASH manifests (MPD) and HLS playlists (m3u8) are modified to remove:

```
- EXT-X-DISCONTINUITY markers (ad insertion points)
- Periods with ad-related IDs
- Segments from ad CDNs
```

---

## IPC Communication

### Exposed APIs

**abos namespace** (preload.js):
```javascript
window.abos = {
    createAgent(agentId, bounds),
    removeAgent(agentId),
    destroyAgent(agentId),
    navigate(agentId, url),
    executeAction(agentId, action, target, params),
    setBounds(agentId, bounds),
    screenshot(agentId),
    smartCommand(agentId, intent),
    onAgentNavigated(callback),
    onAgentLoaded(callback),
    onAgentStatus(callback)
}
```

**electronAPI namespace**:
```javascript
window.electronAPI = {
    toggleViews(visible),
    explainVideo(params),
    askVideoQuestion(params),
    getVideoContext(slotIndex),
    onVideoDetected(callback),
    onVideoContext(callback)
}
```

### IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `agent:create` | Renderer -> Main | Create new BrowserView |
| `agent:navigate` | Renderer -> Main | Load URL in agent |
| `agent:destroy` | Renderer -> Main | Remove agent |
| `agent-navigated` | Main -> Renderer | URL changed |
| `agent-loaded` | Main -> Renderer | Page finished loading |
| `video-detected` | Main -> Renderer | YouTube video found |
| `intel:explain` | Renderer -> Main | Generate explanation |
| `intel:ask` | Renderer -> Main | Q&A follow-up |

---

## Security Model

### Context Isolation

All renderer processes run with:
```javascript
webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    preload: 'preload.js'
}
```

### API Key Protection

- GEMINI_API_KEY loaded only in main process
- Never exposed to renderer via IPC
- Stored in `.env` file (gitignored)

### Window Open Handling

New window requests from web content are blocked:
```javascript
app.on('web-contents-created', (event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});
```

---

## Build and Deployment

### Development Build

```bash
# Install dependencies
npm install

# Build TypeScript packages
npm run build -w packages/video-intelligence
npm run build -w packages/adblock
npm run build -w packages/planner

# Start development
npm start -w packages/shell
```

### Production Build

```bash
# Install electron-builder
npm install -g electron-builder

# Build for Windows
cd packages/shell
npx electron-builder --win

# Output: dist/Smart Browser Setup.exe
```

### Build Configuration

```json
// package.json (shell)
{
    "build": {
        "appId": "com.abos.smartbrowser",
        "productName": "Smart Browser",
        "directories": {
            "output": "dist"
        },
        "win": {
            "target": "nsis",
            "icon": "assets/icon.ico"
        }
    }
}
```

---

## API Reference

### CaptionExtractor

```typescript
class CaptionExtractor {
    // Parse YouTube JSON3 timedtext response
    ingestFromNetwork(
        agentId: string,
        videoId: string,
        responseBody: string,
        metadata: { language?: string }
    ): void;

    // Parse VTT format captions
    ingestVTT(
        agentId: string,
        videoId: string,
        vttContent: string
    ): void;
}
```

### TranscriptStore

```typescript
class TranscriptStore {
    // Check if transcript exists
    has(agentId: string, videoId: string): boolean;

    // Get stored transcript
    get(agentId: string, videoId: string): StoredTranscript | undefined;

    // Get full transcript text
    getFullText(agentId: string, videoId: string): string;

    // Get segments in time range
    getSegmentsInRange(
        agentId: string,
        videoId: string,
        startTime: number,
        endTime: number
    ): TranscriptSegment[];
}
```

### ExplainSession

```typescript
class ExplainSession {
    // Generate explanation
    async explain(mode: 'summary' | 'explain'): Promise<string>;

    // Ask follow-up question
    async ask(question: string): Promise<string>;

    // Check if transcript loaded
    hasTranscript(): boolean;

    // Get Q&A history
    getHistory(): ChatMessage[];
}
```

---

## Troubleshooting

### Common Issues

**1. "GEMINI_API_KEY not found"**
- Ensure `.env` file exists in project root
- Format: `GEMINI_API_KEY=your_key_here`

**2. "No captions available"**
- Video must have captions (CC icon visible)
- Check console for `[VideoIntel] Timedtext intercept` logs

**3. "Agent not rendering"**
- Check DevTools for JavaScript errors
- Verify bounds calculation is correct
- Ensure BrowserView is added to window

**4. "Adblock not working"**
- Check `[Adblock]` logs in console
- Verify rules are parsing correctly
- Some ads require response inspection

### Debug Logging

Enable verbose logging:
```javascript
// In main.js
const DEBUG = true;
if (DEBUG) console.log('[Component]', message);
```

### DevTools

Open DevTools for shell UI:
```javascript
mainWindow.webContents.openDevTools();
```

Open DevTools for agent:
```javascript
agent.view.webContents.openDevTools();
```

---

## License

MIT License - See LICENSE file for details.

## Contributors

- Ashutosh Kumar Singh (ashutoshkumarsingh0x@gmail.com)
