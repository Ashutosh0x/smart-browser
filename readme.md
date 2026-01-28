# Smart Browser

<div align="center">

![Electron](https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=Electron&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Chromium](https://img.shields.io/badge/Chromium-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google%20Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)

**An AI-native browser operating system with multi-agent browsing and Gemini-powered video intelligence.**
<img width="2816" height="1536" alt="Gemini_Generated_Image_gsixjygsixjygsix" src="https://github.com/user-attachments/assets/ce1592ce-28d6-48d8-b9d8-bd7d00dd6e3b" />
<img width="1734" height="1072" alt="image" src="https://github.com/user-attachments/assets/9e74fb46-c446-42d0-8aed-df4d1e50d3f5" />


</div>

---

## Overview

Smart Browser is an Electron-based browser that reimagines web browsing as an operating system. It features a multi-agent workspace where up to 4 browser agents can run simultaneously, each in its own isolated BrowserView. The browser integrates AI capabilities including natural language commands and Gemini-powered video explanations.


---

## Features

### Multi-Agent Workspace

- **4 Independent Browser Agents**: Run up to 4 browser sessions simultaneously in a 2x2 grid layout
- **Round-Robin Navigation**: URLs automatically distribute across available agent slots
- **Fullscreen Focus Mode**: Double-click any agent slot to expand it to full view
- **Agent Lifecycle Management**: Create, navigate, and destroy agents independently
- **Real-time Status Updates**: Visual indicators for loading states and navigation

### Video Intelligence (Gemini-Powered)

- **Automatic Caption Extraction**: Captures YouTube captions via network interception
- **AI-Generated Summaries**: One-click video summaries powered by Gemini 2.0 Flash
- **Detailed Explanations**: Beginner-friendly and technical explanation modes
- **Context-Aware Q&A**: Ask follow-up questions grounded in video transcripts
- **Session Management**: Per-agent, per-video chat history with conversational memory

### Adblock Engine

- **URL-Based Blocking**: Pattern-matching rules for ad network domains
- **Response Inspection**: Strips ad fields from YouTube player API responses
- **Manifest Rewriting**: Removes ad segments from DASH/HLS video manifests
- **Multiple Modes**: Strict, Balanced, Allowlist-only, and Off modes

### Smart Commands

- **Natural Language Input**: Type commands like "go to youtube.com" or just "google.com"
- **AI Task Planning**: Complex commands are parsed and executed by the Planner module
- **DOM Interaction**: Click, type, scroll, and extract data from web pages

---

## Architecture

```
Smart Browser
├── packages/
│   ├── shell/              # Electron main process and UI
│   │   ├── main.js         # Main process, AgentManager, IPC handlers
│   │   ├── preload.js      # Secure bridge between renderer and main
│   │   └── ui/             # HTML, CSS, JavaScript for shell UI
│   │
│   ├── video-intelligence/ # Gemini-powered video explanations
│   │   ├── caption-extractor.ts   # Network-based caption capture
│   │   ├── transcript-store.ts    # Per-agent transcript storage
│   │   ├── explain-session.ts     # Window-scoped Gemini sessions
│   │   └── gemini-client.ts       # Gemini API integration
│   │
│   ├── adblock/            # Ad blocking engine
│   │   ├── rule-engine.ts         # Trie-based URL matching
│   │   ├── filter-parser.ts       # AdBlock Plus filter syntax
│   │   ├── response-inspector.ts  # API response modification
│   │   └── manifest-rewriter.ts   # DASH/HLS ad removal
│   │
│   ├── planner/            # AI task planning
│   │   └── index.ts        # Gemini-based command parsing
│   │
│   └── kernel/             # Core abstractions
│       └── abi/            # Protocol buffer definitions
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Electron 28+ with Chromium |
| Language | TypeScript, JavaScript |
| AI Model | Google Gemini 2.0 Flash |
| Build | Node.js, npm workspaces |
| Styling | CSS with custom design tokens |
| IPC | Electron contextBridge |

---

## Installation

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- Google Gemini API key

### Setup

1. Clone the repository:
```bash
git clone https://github.com/ashutosh0x/smart-browser.git
cd smart-browser
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
echo "GEMINI_API_KEY=your_api_key_here" > .env
```

4. Build packages:
```bash
npm run build -w packages/video-intelligence
npm run build -w packages/adblock
npm run build -w packages/planner
```

5. Start the browser:
```bash
npm start -w packages/shell
```

---

## Usage

### Navigation

| Command | Action |
|---------|--------|
| `go to example.com` | Navigate to URL in next available slot |
| `example.com` | Auto-detect URL and navigate |
| `new` | Create a new agent in empty slot |
| `focus 0` | Toggle fullscreen for slot 0 |

### Video Intelligence

1. Navigate to a YouTube video
2. Click the "Explain" button in the slot header
3. View the Summary or Explained tabs
4. Ask follow-up questions in the Ask tab

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Execute command |
| `Escape` | Exit fullscreen mode |
| `Double-click` | Toggle fullscreen on slot |

---

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key for video intelligence |

### Adblock Modes

| Mode | Description |
|------|-------------|
| Strict | Block all ad-related requests |
| Balanced | Default mode with common ad networks |
| Allowlist | Only block explicitly listed domains |
| Off | Disable adblocking |

---

## Development

### Project Structure

```bash
# Build all packages
npm run build --workspaces

# Run tests
npm test -w packages/adblock
npm test -w packages/video-intelligence

# Start in development mode
npm start -w packages/shell
```

### Adding New Features

1. Create a new package in `packages/`
2. Add TypeScript configuration
3. Export interfaces via `src/index.ts`
4. Import in shell's `main.js`

---

## Security

- **Context Isolation**: Renderer processes use strict context isolation
- **Preload Scripts**: Only approved APIs exposed via contextBridge
- **No Node Integration**: Web content cannot access Node.js APIs
- **API Key Protection**: Gemini API key never exposed to renderer

---

## License

MIT License

---

## Author

Ashutosh Kumar Singh  
ashutoshkumarsingh0x@gmail.com


