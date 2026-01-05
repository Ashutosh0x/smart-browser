# Kernel ABI Documentation

## Overview

This document describes the AB-OS Kernel Application Binary Interface (ABI). The ABI defines how the Agent Runtime communicates with the Kernel to execute browser operations.

---

## Protocol

The ABI uses Protocol Buffers (protobuf) over gRPC for communication. See [kernel_syscall.proto](kernel_syscall.proto) for the full schema.

---

## Capability Requirements

Each syscall requires specific capabilities in the token:

| Syscall | Required Capability |
|---------|---------------------|
| `Snapshot` | `CAP_READ` |
| `Click` | `CAP_INTERACT` |
| `Type` | `CAP_INTERACT` |
| `Hover` | `CAP_INTERACT` |
| `Scroll` | `CAP_INTERACT` |
| `Extract` | `CAP_READ` |
| `Navigate` | `CAP_NAVIGATE` |
| `Wait` | `CAP_READ` |
| `Screenshot` | `CAP_READ` |

---

## Syscall Reference

### Snapshot

Captures the current DOM state.

**Request:**
```protobuf
message SnapshotRequest {
  CapabilityToken capability = 1;
  string agent_id = 2;
  bool include_styles = 3;      // Include computed styles
  bool include_layout = 4;       // Include layout geometry
  repeated string exclude_selectors = 5;  // Exclude elements (privacy)
}
```

**Response:**
```protobuf
message SnapshotResponse {
  bool success = 1;
  string error = 2;
  bytes dom_data = 3;           // Serialized DOM
  string content_hash = 4;       // SHA-256 hash
  int64 capture_timestamp = 5;   // Unix timestamp
}
```

### Click

Clicks an element.

**Request:**
```protobuf
message ClickRequest {
  CapabilityToken capability = 1;
  string agent_id = 2;
  Selector target = 3;           // CSS/XPath/text selector
  string button = 4;             // left, right, middle
  int32 click_count = 5;         // 1=single, 2=double
}
```

**Response:**
```protobuf
message ClickResponse {
  bool success = 1;
  string error = 2;
  Rect element_bounds = 3;       // Element position
  string content_hash_before = 4;
  string content_hash_after = 5;
}
```

### Type

Types text into an input element.

**Request:**
```protobuf
message TypeRequest {
  CapabilityToken capability = 1;
  string agent_id = 2;
  Selector target = 3;
  string text = 4;               // Text to type
  bool clear_first = 5;          // Clear existing content
  int32 delay_ms = 6;            // Delay between keystrokes
}
```

### Navigate

Navigates to a URL.

**Request:**
```protobuf
message NavigateRequest {
  CapabilityToken capability = 1;
  string agent_id = 2;
  string url = 3;
  int32 timeout_ms = 4;
  string wait_until = 5;         // load, domcontentloaded, networkidle
}
```

### Screenshot

Captures a screenshot.

**Request:**
```protobuf
message ScreenshotRequest {
  CapabilityToken capability = 1;
  string agent_id = 2;
  Rect clip = 3;                 // Optional clip region
  bool full_page = 4;            // Capture full page
  string format = 5;             // png, jpeg, webp
  int32 quality = 6;             // 0-100 for jpeg/webp
}
```

---

## Error Handling

Errors are returned in the `error` field:

| Error Code | Description |
|------------|-------------|
| `UNAUTHORIZED` | Invalid or missing capability |
| `TOKEN_EXPIRED` | Capability token expired |
| `ELEMENT_NOT_FOUND` | Selector didn't match |
| `TIMEOUT` | Operation timed out |
| `NETWORK_ERROR` | Network request failed |
| `INTERNAL_ERROR` | Kernel internal error |

---

## Content Hashing

Content hashes are computed using SHA-256 over:
1. Serialized DOM structure
2. Key attribute values
3. Form state

This enables deterministic replay verification.

---

## References

- [Kernel README](../README.md)
- [Kernel Design](../design.md)
