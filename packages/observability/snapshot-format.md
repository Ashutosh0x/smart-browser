# DOM Snapshot Format

## Overview

This document specifies the format for deterministic DOM snapshots used in AB-OS for state capture and replay.

---

## Snapshot Structure

```typescript
interface DOMSnapshot {
  // Metadata
  id: string;
  sessionId: string;
  agentId: string;
  capturedAt: string;  // ISO 8601
  
  // Document info
  document: {
    url: string;
    title: string;
    charset: string;
  };
  
  // DOM tree
  nodes: DOMNode[];
  
  // Layout information
  layout: LayoutObject[];
  
  // Form state
  formData: FormEntry[];
  
  // Integrity
  contentHash: string;  // SHA-256
}

interface DOMNode {
  nodeId: number;
  parentId: number | null;
  nodeType: NodeType;
  localName?: string;
  attributes?: Attribute[];
  textContent?: string;
  children?: number[];  // Child node IDs
}

type NodeType = 
  | 'element'
  | 'text'
  | 'comment'
  | 'document'
  | 'doctype';

interface Attribute {
  name: string;
  value: string;
}

interface LayoutObject {
  nodeId: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isVisible: boolean;
  zIndex: number;
}

interface FormEntry {
  selector: string;
  inputType: string;
  value: string;
  checked?: boolean;
  selectedIndex?: number;
}
```

---

## JSON Example

```json
{
  "id": "snap-abc123",
  "sessionId": "session-456",
  "agentId": "agent-789",
  "capturedAt": "2026-01-04T21:15:00.000Z",
  "document": {
    "url": "https://open.spotify.com/collection/tracks",
    "title": "Liked Songs - Spotify",
    "charset": "UTF-8"
  },
  "nodes": [
    {
      "nodeId": 1,
      "parentId": null,
      "nodeType": "document"
    },
    {
      "nodeId": 2,
      "parentId": 1,
      "nodeType": "element",
      "localName": "html",
      "attributes": [
        { "name": "lang", "value": "en" }
      ],
      "children": [3, 10]
    },
    {
      "nodeId": 3,
      "parentId": 2,
      "nodeType": "element",
      "localName": "head",
      "children": [4, 5, 6]
    }
  ],
  "layout": [
    {
      "nodeId": 50,
      "boundingBox": {
        "x": 100,
        "y": 200,
        "width": 120,
        "height": 40
      },
      "isVisible": true,
      "zIndex": 1
    }
  ],
  "formData": [],
  "contentHash": "sha256:abc123def456..."
}
```

---

## Content Hash Computation

The content hash ensures snapshot integrity:

```typescript
function computeContentHash(snapshot: DOMSnapshot): string {
  // Exclude volatile fields
  const stable = {
    document: snapshot.document,
    nodes: snapshot.nodes,
    formData: snapshot.formData,
  };
  
  // Serialize deterministically
  const json = JSON.stringify(stable, Object.keys(stable).sort());
  
  // Hash
  return crypto.createHash('sha256').update(json).digest('hex');
}
```

---

## Storage

Snapshots are stored in content-addressed storage:

```
/snapshots/
  /{sessionId}/
    /{timestamp}-{sequence}.json.gz
```

---

## Compression

Snapshots are compressed with gzip:
- Typical compression ratio: 10-20x
- Average compressed size: 50-200 KB

---

## References

- [Observability README](README.md)
- [Replay Engine Design](replay-engine-design.md)
