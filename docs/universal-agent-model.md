# Universal Agent Model

> **Smart Browser is not an app browser. It is an AI operating system for the web.**

---

## Core Principle

The Smart Browser UI is **APP-INDEPENDENT**:

- Spotify, Gmail, Amazon are **examples**
- They are **not hardcoded**
- The UI is driven by **Agent Metadata**, not app names

```
[Wrong] Spotify Agent, Gmail Agent, Amazon Agent
[Correct] Agent { app_name: "Spotify", app_domain: "spotify.com" }
```

---

## Universal Agent Contract

```typescript
interface Agent {
  agent_id: string;
  
  // Dynamic app metadata (not hardcoded)
  app_name: string;       // "Spotify", "Notion", "AWS Console"
  app_icon: IconRef;      // Dynamic
  app_domain: string;     // For trust & policy
  
  // State
  status: 'running' | 'waiting' | 'needs_approval' | 'completed' | 'error';
  
  // Security
  capabilities: Capability[];
  trust_level: 'trusted' | 'standard' | 'restricted';
  
  // Intelligence
  confidence_score?: number;  // 0-1
  risk_level?: 'low' | 'medium' | 'high';
}
```

---

## What This Means for UI

### Agent Console
- Icons and names are **dynamic**
- Status logic is **generic**
- Any app renders the same way:

```
[Notion]  Notion Agent       Running
[AWS]     AWS Console Agent  Needs Approval
[Chart]   Tableau Agent      Completed
[Stripe]  Stripe Agent       Read-Only
[CRM]     Internal CRM       Running
```

### Workspace Windows
- Loads **any** web app
- Controlled by kernel syscalls
- Framed by agent metadata

### Intelligence Panel
- Timeline entries are **generic**:
```
[09:12:44] Agent accessed page
[09:12:47] Agent read structured data
[09:12:50] Agent attempted sensitive action
```

---

## Policy System (Domain-based)

Policies operate on **capabilities and domains**, not apps:

```yaml
# Blocks write on any bank site
- when:
    domain: "*.bank.com"
    capability: CAP_WRITE
  then:
    require_approval: true

# Blocks export from any site
- when:
    capability: CAP_EXPORT
  then:
    deny: true
```

Works for Gmail, Salesforce, Jira, any internal app.

---

## Site Adapter (Optional)

For faster/smarter operation on known sites:

```typescript
interface SiteAdapter {
  domain_pattern: "*.spotify.com";
  semantic_hints: {
    play_button: "[data-testid='play-button']",
    search_input: "[role='search'] input",
  };
  common_actions: ["play", "pause", "search", "like"];
}
```

**If adapter exists**: Faster & smarter  
**If not**: Agent still works via DOM + vision

---

## App Registry (Optional)

Improves UX with known app icons and defaults:

```typescript
const KNOWN_APPS = [
  { domain: 'spotify.com', name: 'Spotify', icon: 'music' },
  { domain: 'notion.so', name: 'Notion', icon: 'file-text' },
  { domain: 'github.com', name: 'GitHub', icon: 'git-branch' },
  // Any app can be added...
];
```

Unknown apps get generic icon + domain-based name.

---

## Theme System (Unchanged)

Themes apply to:
- Agent cards
- Workspace frames
- Audit panel
- Command bar

**Never to app content** - Apps render exactly as they are.

---

## Summary

| Aspect | Status |
|--------|--------|
| UI supports any app | Yes |
| Layout changes per app | No |
| Hardcoded app logic | None |
| Policies work on any site | Yes |
| Themes apply to any app | Yes |
