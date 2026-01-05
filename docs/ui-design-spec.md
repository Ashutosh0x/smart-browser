# Smart Browser UI Design Specification

## Design Philosophy

> "The user feels like they are **commanding a system**, not operating a tool."

---

## Core Layout (Never Changes)

```
+------------------------------------------------------------------+
|                    Command Bar (Floating Glass Pill)              |
|              "Tell Smart Browser what to do..."                   |
+------------------------------------------------------------------+
|                                                                    |
| +----------------+ +-------------------------+ +------------------+|
| | Agent Console  | |    Main Workspace       | | Intelligence &   ||
| |                | |                         | | Audit View       ||
| | [Agent Cards]  | | [Agent Windows Grid]    | |                  ||
| |                | |                         | | [Live Timeline]  ||
| | - Spotify      | | +-------+ +-------+     | |                  ||
| | - Gmail        | | |Agent 1| |Agent 2|     | | [Network Prov.]  ||
| | - Amazon       | | +-------+ +-------+     | |                  ||
| | - Photos       | | +-------+ +-------+     | | [DOM Prov.]      ||
| |                | | |Agent 3| |Agent 4|     | |                  ||
| +----------------+ +-------------------------+ +------------------+|
|                                                                    |
+------------------------------------------------------------------+
|  [>] Replay ----o------------------- | Fork Execution | [Thumbs] |
+------------------------------------------------------------------+
| Policy: [Purchase Allowed] [Read-Only] [Approval Required]        |
+------------------------------------------------------------------+
```

---

## Theme System Architecture

### Token Categories

```css
:root {
  /* Background Colors */
  --bg-primary: ...;
  --bg-secondary: ...;
  --bg-tertiary: ...;
  
  /* Panel & Glass */
  --panel-glass: ...;
  --panel-glass-hover: ...;
  --panel-border: ...;
  
  /* Accent Colors */
  --accent-primary: ...;
  --accent-secondary: ...;
  --accent-glow: ...;
  
  /* Status Colors */
  --status-running: ...;
  --status-warning: ...;
  --status-success: ...;
  --status-error: ...;
  
  /* Text Colors */
  --text-primary: ...;
  --text-secondary: ...;
  --text-muted: ...;
  
  /* Effects */
  --glow-intensity: ...;
  --blur-radius: ...;
  --shadow-soft: ...;
  --shadow-deep: ...;
  
  /* Typography */
  --font-family: 'Inter', -apple-system, sans-serif;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 600;
  --font-size-xs: 11px;
  --font-size-sm: 13px;
  --font-size-md: 15px;
  --font-size-lg: 18px;
  --font-size-command: 16px;
  
  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  
  /* Border Radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-pill: 9999px;
}
```

---

## Theme Profiles

### Theme 1: Light Glass

![Light Glass Theme](file:///C:/Users/ashut/.gemini/antigravity/brain/37c7015f-bd14-4491-9933-79e42388ff60/uploaded_image_1_1767552474981.png)

**Characteristics:**
- Frosted white / light gray background
- Soft cyan glow
- Low contrast
- Minimal shadows
- Calm, productivity-focused

**Tokens:**
```css
[data-theme="light-glass"] {
  --bg-primary: #f8fafb;
  --bg-secondary: #ffffff;
  --bg-tertiary: #f0f4f7;
  
  --panel-glass: rgba(255, 255, 255, 0.75);
  --panel-glass-hover: rgba(255, 255, 255, 0.85);
  --panel-border: rgba(0, 200, 200, 0.2);
  
  --accent-primary: #00c8c8;
  --accent-secondary: #7dd3fc;
  --accent-glow: rgba(0, 200, 200, 0.3);
  
  --status-running: #00c8c8;
  --status-warning: #f59e0b;
  --status-success: #22c55e;
  --status-error: #ef4444;
  
  --text-primary: #1e293b;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  
  --glow-intensity: 0.15;
  --blur-radius: 20px;
  --shadow-soft: 0 4px 20px rgba(0, 0, 0, 0.05);
  --shadow-deep: 0 8px 32px rgba(0, 0, 0, 0.1);
}
```

**Use Case:** Daytime work, long sessions, enterprise users

---

### Theme 2: Dark Neon

![Dark Neon Theme](file:///C:/Users/ashut/.gemini/antigravity/brain/37c7015f-bd14-4491-9933-79e42388ff60/uploaded_image_0_1767552474981.png)

**Characteristics:**
- Deep charcoal / near-black background
- Cyan + violet neon edges
- Higher contrast
- Strong glow lines around panels
- Cinematic feel

**Tokens:**
```css
[data-theme="dark-neon"] {
  --bg-primary: #0a0e14;
  --bg-secondary: #131920;
  --bg-tertiary: #1a2028;
  
  --panel-glass: rgba(26, 32, 40, 0.85);
  --panel-glass-hover: rgba(26, 32, 40, 0.95);
  --panel-border: rgba(0, 200, 200, 0.4);
  
  --accent-primary: #00d4d4;
  --accent-secondary: #a78bfa;
  --accent-glow: rgba(0, 212, 212, 0.5);
  
  --status-running: #00d4d4;
  --status-warning: #fbbf24;
  --status-success: #4ade80;
  --status-error: #f87171;
  
  --text-primary: #f1f5f9;
  --text-secondary: #cbd5e1;
  --text-muted: #64748b;
  
  --glow-intensity: 0.5;
  --blur-radius: 16px;
  --shadow-soft: 0 4px 20px rgba(0, 0, 0, 0.3);
  --shadow-deep: 0 8px 32px rgba(0, 0, 0, 0.5);
}
```

**Use Case:** Night mode, power users, demos/presentations

---

## Component Specifications

### Command Bar
```
+----------------------------------------------------------+
|  [Icon] "Tell Smart Browser what to do..."      [Search] |
+----------------------------------------------------------+
```

- Floating glass pill
- Centered at top
- Soft glow on focus
- No hard borders
- Backdrop blur: var(--blur-radius)
- Border: 1px solid var(--panel-border)

### Agent Console (Left Panel)

```
+------------------+
| Agent Console    |
+------------------+
| [Icon] Spotify   |
|   Running        |
|   [||] [■] [Q]   |
+------------------+
| [Icon] Gmail     |
|   Running        |
|   [||] [■] [Q]   |
+------------------+
```

- Glass card per agent
- Status glow color by state:
  - Running: var(--status-running)
  - Warning: var(--status-warning)
  - Success: var(--status-success)
- Pulse animation when running
- Controls: Pause, Stop, Expand

### Workspace Grid (Center)

```
+---------------------------+
|  Main Workspace           |
+-------------+-------------+
| Agent 1     | Agent 2     |
| [Live View] | [Live View] |
+-------------+-------------+
| Agent 3     | Agent 4     |
| [Live View] | [Live View] |
+-------------+-------------+
```

- 2x2 grid (responsive)
- Thin neon border per agent window
- Subtle inner shadow
- Active window glows more
- Header: Agent name + status

### Intelligence Panel (Right)

```
+------------------------+
| Intelligence & Audit   |
+------------------------+
| Live action timeline   |
| ○ [09:45:10] Spotify.. |
| ○ [09:45:12] Gmail...  |
| ○ [09:45:15] Amazon... |
+------------------------+
| Network Provenance     |
| [Chart]                |
+------------------------+
| DOM Provenance         |
| [Chart]                |
+------------------------+
```

- Darker glass than workspace
- Clear typography
- Accent color for policy badges
- Scrollable timeline

### Replay Bar (Bottom)

```
+----------------------------------------------------------+
| [>] Replay -------o----------------- | Fork | [Thumbs]   |
+----------------------------------------------------------+
```

- Timeline scrubber
- Fork Execution button
- Thumbnail previews
- Glass background

### Policy Badges

```
[Purchase Allowed] [Read-Only] [Approval Required]
```

- Pill-shaped badges
- Color-coded by policy type
- Accent border glow

---

## Profile Settings Structure

```
Profile Settings
├── Account
├── Security
├── Agents
├── Policies
└── Appearance
    ├── Theme Selector
    │   ├── Light Glass
    │   └── Dark Neon
    ├── Accent Color
    │   ├── Cyan (default)
    │   ├── Blue
    │   ├── Violet
    │   ├── Green
    │   └── Custom (hex)
    ├── Effects
    │   ├── Glass blur: Low/Medium/High
    │   ├── Glow intensity: Low/Medium/High
    │   └── Motion effects: On/Reduced
    └── Per-Profile Settings
        └── [Enable separate theme per profile]
```

---

## Animation Specifications

### Agent Status Pulse
```css
@keyframes agent-pulse {
  0%, 100% { box-shadow: 0 0 0 0 var(--accent-glow); }
  50% { box-shadow: 0 0 0 8px transparent; }
}
```

### Window Focus Glow
```css
.agent-window.active {
  box-shadow: 0 0 20px var(--accent-glow);
  transition: box-shadow 0.2s ease;
}
```

### Glass Hover
```css
.glass-panel:hover {
  background: var(--panel-glass-hover);
  border-color: var(--accent-primary);
  transition: all 0.15s ease;
}
```

---

## Typography Scale

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Command Input | 16px | 400 | --text-primary |
| Panel Title | 15px | 600 | --text-primary |
| Agent Name | 14px | 500 | --text-primary |
| Agent Status | 12px | 400 | --text-secondary |
| Timeline Entry | 12px | 400 | --text-secondary |
| Policy Badge | 11px | 500 | --text-primary |

---

## Responsiveness

| Breakpoint | Workspace Grid |
|------------|----------------|
| > 1400px | 2x2 grid |
| 1000-1400px | 2x1 grid |
| < 1000px | 1x1 (stacked) |

---

## Accessibility

- Focus rings use var(--accent-primary)
- High contrast mode increases text contrast
- Reduced motion respects prefers-reduced-motion
- Keyboard navigation for all controls

---

## Files to Create

1. `packages/ide/src/styles/tokens.css` - Theme tokens
2. `packages/ide/src/styles/themes/light-glass.css` - Light theme
3. `packages/ide/src/styles/themes/dark-neon.css` - Dark theme
4. `packages/ide/src/components/` - React components
5. `packages/ide/src/hooks/useTheme.ts` - Theme hook
