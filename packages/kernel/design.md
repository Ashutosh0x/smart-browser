# AB-OS Kernel Design

## Overview

The AB-OS Kernel transforms a Chromium browser into an operating system kernel for AI agents. It exposes browser primitives (DOM manipulation, navigation, input) as syscalls with deterministic replay support.

---

## Design Principles

1. **Minimal Invasive Patches** - Keep changes isolated to new modules
2. **Deterministic Replay** - All state changes must be reproducable
3. **Capability-Based Security** - Every syscall requires a capability token
4. **Audit Everything** - All operations logged to append-only ledger

---

## Component Architecture

### Syscall Layer

The syscall layer provides a high-level API over Chromium internals:

```cpp
namespace abos {
namespace kernel {

class SyscallHandler {
 public:
  // DOM Operations
  SnapshotResult Snapshot(const SnapshotRequest& request);
  ClickResult Click(const ClickRequest& request);
  TypeResult Type(const TypeRequest& request);
  
  // Navigation
  NavigateResult Navigate(const NavigateRequest& request);
  
  // Capture
  ScreenshotResult Screenshot(const ScreenshotRequest& request);
  
 private:
  // Verify capability token before execution
  bool VerifyCapability(const CapabilityToken& token, 
                        SyscallType type);
};

}  // namespace kernel
}  // namespace abos
```

### DOM Snapshotting

Deterministic DOM snapshots capture:
- Full DOM tree structure
- Computed styles
- Layout geometry
- Form state
- Iframes (recursive)

```cpp
struct DOMSnapshot {
  std::string document_url;
  int64_t capture_timestamp;
  std::vector<DOMNode> nodes;
  std::vector<LayoutObject> layout;
  std::string content_hash;  // SHA-256 of serialized content
};
```

### Event Virtualization

Events are captured and can be replayed deterministically:

```cpp
struct VirtualEvent {
  EventType type;  // click, keydown, scroll, etc.
  std::string target_selector;
  int64_t timestamp;
  EventData data;  // Type-specific payload
  std::string content_hash_before;
  std::string content_hash_after;
};
```

### Network Interception

All network requests pass through the interception layer:

```cpp
class NetworkInterceptor {
 public:
  // Called before request is sent
  InterceptResult OnBeforeRequest(const URLRequest& request);
  
  // Called when response headers received
  InterceptResult OnResponseHeadersReceived(const URLResponse& response);
  
  // Called with response body
  InterceptResult OnResponseBody(const URLResponse& response,
                                 const std::string& body);
};
```

---

## Determinism Guarantees

### Sources of Non-Determinism

| Source | Mitigation |
|--------|------------|
| Timestamps | Virtualized clock |
| Random numbers | Seeded PRNG per session |
| Network timing | Recorded + replayed |
| Animations | Frame-by-frame capture |
| Lazy loading | Forced synchronous load |

### Replay Verification

```cpp
// During replay, verify each step produces expected state
bool VerifyReplayStep(const RecordedStep& step,
                      const CurrentState& state) {
  std::string current_hash = ComputeContentHash(state);
  return current_hash == step.expected_hash_after;
}
```

---

## Memory Model

### Per-Context Isolation

Each agent runs in an isolated browser context:

```cpp
class AgentContext {
  std::unique_ptr<content::BrowserContext> browser_context;
  std::unique_ptr<MemoryStore> memory_store;
  std::string agent_id;
  CapabilitySet capabilities;
};
```

### Warm Pool

Pre-created contexts for fast agent startup:

```cpp
class WarmPool {
 public:
  std::unique_ptr<AgentContext> Acquire();
  void Release(std::unique_ptr<AgentContext> context);
  
 private:
  size_t pool_size_ = 10;
  std::queue<std::unique_ptr<AgentContext>> available_;
};
```

---

## Security Considerations

### Capability Verification

Every syscall verifies the capability token:

```cpp
SyscallResult ExecuteSyscall(const SyscallRequest& request,
                             const CapabilityToken& token) {
  // 1. Verify token signature
  if (!VerifyTokenSignature(token)) {
    return SyscallResult::Unauthorized("Invalid token signature");
  }
  
  // 2. Check token expiration
  if (IsTokenExpired(token)) {
    return SyscallResult::Unauthorized("Token expired");
  }
  
  // 3. Check capability for this syscall
  if (!token.HasCapability(request.required_capability())) {
    return SyscallResult::Unauthorized("Missing capability");
  }
  
  // 4. Execute syscall
  return DoExecuteSyscall(request);
}
```

### Sandbox Integration

The kernel runs within Chromium's sandbox:
- Renderer processes are sandboxed
- Network access via broker
- File access via broker

---

## Observability Hooks

### Audit Logging

```cpp
void LogSyscallAudit(const SyscallRequest& request,
                     const SyscallResult& result,
                     const CapabilityToken& token) {
  AuditEntry entry;
  entry.timestamp = GetCurrentTime();
  entry.agent_id = token.agent_id();
  entry.syscall_type = request.type();
  entry.target = request.target();
  entry.success = result.ok();
  entry.token_jti = token.jti();
  
  audit_ledger_->Append(entry);
}
```

### Metrics

```cpp
// Exported Prometheus metrics
DEFINE_COUNTER(abos_syscall_total, "Total syscalls executed");
DEFINE_HISTOGRAM(abos_syscall_duration_seconds, "Syscall latency");
DEFINE_COUNTER(abos_syscall_errors_total, "Syscall errors");
```

---

## References

- [README](README.md)
- [ABI Specification](abi/kernel_syscall.md)
- [Build Instructions](build/BUILD.md)
