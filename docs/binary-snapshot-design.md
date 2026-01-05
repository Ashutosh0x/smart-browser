# Binary DOM Snapshot Design

## Overview

Binary DOM snapshots enable <100ms page restore vs 500-2000ms full page load, critical for warm pools and deterministic replay.

---

## Format Specification

### Header (32 bytes)

```
┌─────────────────────────────────────────────────────────────┐
│ Magic (4B) │ Version (2B) │ Flags (2B) │ Timestamp (8B)    │
├─────────────────────────────────────────────────────────────┤
│ Node Count (4B) │ Layout Count (4B) │ Form Count (4B)      │
├─────────────────────────────────────────────────────────────┤
│ Content Hash (SHA-256) - first 4 bytes for quick compare   │
└─────────────────────────────────────────────────────────────┘
```

### Flags

| Bit | Meaning |
|-----|---------|
| 0 | Compressed (Brotli) |
| 1 | Includes layout |
| 2 | Includes form state |
| 3 | Includes computed styles |
| 4 | COW-compatible |

---

## Struct-of-Arrays Layout

Instead of object-per-node, we use columnar layout for cache efficiency:

```typescript
interface BinarySnapshot {
  // Header
  magic: Uint8Array;  // "ABOS"
  version: number;
  flags: number;
  timestamp: bigint;
  
  // Document metadata (variable length, null-terminated strings)
  documentUrl: string;
  documentTitle: string;
  documentCharset: string;
  
  // Node arrays (struct-of-arrays for cache efficiency)
  nodeIds: Uint32Array;           // Node IDs
  parentIds: Int32Array;          // Parent IDs (-1 for root)
  nodeTypes: Uint8Array;          // 0=element, 1=text, 2=comment
  localNameOffsets: Uint32Array;  // Offset into string table
  textContentOffsets: Uint32Array;// Offset into string table
  childCounts: Uint16Array;       // Number of children
  attributeCounts: Uint8Array;    // Number of attributes
  
  // Attribute arrays
  attrNodeIds: Uint32Array;       // Which node this attr belongs to
  attrNameOffsets: Uint32Array;   // Offset into string table
  attrValueOffsets: Uint32Array;  // Offset into string table
  
  // Layout arrays (if flag set)
  layoutNodeIds: Uint32Array;
  layoutX: Float32Array;
  layoutY: Float32Array;
  layoutWidth: Float32Array;
  layoutHeight: Float32Array;
  layoutVisible: Uint8Array;      // Boolean packed
  
  // Form state arrays (if flag set)
  formNodeIds: Uint32Array;
  formValueOffsets: Uint32Array;
  formChecked: Uint8Array;        // Boolean packed
  
  // String table (deduplicated)
  stringTable: Uint8Array;        // Null-terminated strings
  stringOffsets: Uint32Array;     // Start of each string
}
```

---

## Serialization

```typescript
class SnapshotSerializer {
  private stringTable: Map<string, number> = new Map();
  private strings: string[] = [];
  
  serialize(document: Document): ArrayBuffer {
    // Pass 1: Collect all strings, build string table
    this.walkTreeForStrings(document.documentElement);
    
    // Pass 2: Build node arrays
    const nodes = this.serializeNodes(document.documentElement);
    
    // Pass 3: Layout capture
    const layout = this.captureLayout(document);
    
    // Pass 4: Form state
    const formState = this.captureFormState(document);
    
    // Combine into binary buffer
    return this.packBuffer(nodes, layout, formState);
  }
  
  private internString(s: string): number {
    if (this.stringTable.has(s)) {
      return this.stringTable.get(s)!;
    }
    const offset = this.strings.length;
    this.stringTable.set(s, offset);
    this.strings.push(s);
    return offset;
  }
}
```

---

## Deserialization & Restore

```typescript
class SnapshotRestorer {
  async restore(snapshot: ArrayBuffer, page: Page): Promise<void> {
    const data = this.parseSnapshot(snapshot);
    
    // Build DOM tree from arrays
    const html = this.reconstructHTML(data);
    
    // Set page content
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    
    // Restore form state
    await this.restoreFormState(page, data.formState);
    
    // Scroll to saved position
    if (data.scrollPosition) {
      await page.evaluate((pos) => {
        window.scrollTo(pos.x, pos.y);
      }, data.scrollPosition);
    }
  }
  
  private reconstructHTML(data: ParsedSnapshot): string {
    // Use typed arrays for fast reconstruction
    const builder: string[] = [];
    
    for (let i = 0; i < data.nodeCount; i++) {
      const nodeType = data.nodeTypes[i];
      
      if (nodeType === 0) {  // Element
        const tagName = data.getString(data.localNameOffsets[i]);
        builder.push(`<${tagName}`);
        
        // Add attributes
        this.appendAttributes(builder, data, i);
        
        builder.push('>');
      } else if (nodeType === 1) {  // Text
        const text = data.getString(data.textContentOffsets[i]);
        builder.push(this.escapeHTML(text));
      }
    }
    
    return builder.join('');
  }
}
```

---

## Copy-on-Write (COW) Support

For memory-efficient snapshots:

```typescript
interface COWSnapshot {
  baseSnapshot: ArrayBuffer;
  patches: SnapshotPatch[];
}

interface SnapshotPatch {
  offset: number;
  oldData: ArrayBuffer;
  newData: ArrayBuffer;
}

function createCOWSnapshot(
  base: ArrayBuffer,
  current: ArrayBuffer
): COWSnapshot {
  const patches: SnapshotPatch[] = [];
  const baseView = new Uint8Array(base);
  const currentView = new Uint8Array(current);
  
  let patchStart = -1;
  
  for (let i = 0; i < currentView.length; i++) {
    if (baseView[i] !== currentView[i]) {
      if (patchStart === -1) patchStart = i;
    } else if (patchStart !== -1) {
      // End of patch
      patches.push({
        offset: patchStart,
        oldData: base.slice(patchStart, i),
        newData: current.slice(patchStart, i),
      });
      patchStart = -1;
    }
  }
  
  return { baseSnapshot: base, patches };
}
```

---

## Size Comparison

| Page | HTML Size | Binary Snapshot | Compressed | Ratio |
|------|-----------|-----------------|------------|-------|
| Google Search | 250KB | 120KB | 25KB | 10x |
| Gmail Inbox | 1.5MB | 600KB | 80KB | 18x |
| Spotify Player | 800KB | 350KB | 50KB | 16x |

---

## Performance Targets

| Operation | Target | Method |
|-----------|--------|--------|
| Serialize | <50ms | Struct-of-arrays, string interning |
| Compress | <20ms | Brotli level 4 |
| Decompress | <10ms | Brotli |
| Restore | <100ms | Bulk DOM construction |
| COW delta | <5ms | Byte-level diff |

---

## References

- [Performance Architecture](performance-architecture.md)
- [Snapshot Format](../packages/observability/snapshot-format.md)
