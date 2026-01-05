# AB-OS Kernel

## Overview

The AB-OS Kernel is a Chromium fork that exposes browser primitives as kernel syscalls. It provides deterministic DOM snapshotting, event virtualization, and network interception for AI agent control.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      AB-OS Kernel                            │
├─────────────────────────────────────────────────────────────┤
│  Syscall Layer                                               │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐   │
│  │ snapshot  │ │  click    │ │   type    │ │ navigate  │   │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘   │
├─────────────────────────────────────────────────────────────┤
│  Event Virtualization                                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Capture → Serialize → Replay                         │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  Chromium Base (Blink + V8)                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Syscalls

| Syscall | Description | Capability |
|---------|-------------|------------|
| `snapshot()` | Capture DOM state | `CAP_READ` |
| `click(selector)` | Click element | `CAP_INTERACT` |
| `type(selector, text)` | Type into input | `CAP_INTERACT` |
| `navigate(url)` | Navigate to URL | `CAP_NAVIGATE` |
| `screenshot()` | Capture screenshot | `CAP_READ` |
| `scroll(x, y)` | Scroll page | `CAP_INTERACT` |
| `hover(selector)` | Hover over element | `CAP_INTERACT` |
| `wait(condition)` | Wait for condition | `CAP_READ` |

---

## Building

See [BUILD.md](build/BUILD.md) for complete build instructions.

### Quick Start

```bash
# Requirements
# - 16GB+ RAM
# - 100GB+ disk
# - Python 3.11+
# - Git

# Get depot_tools
git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git
export PATH="$PATH:$(pwd)/depot_tools"

# Fetch Chromium
mkdir abos-chromium && cd abos-chromium
fetch chromium
cd src

# Apply AB-OS patches
git apply ../../packages/kernel/patches/*.diff

# Generate build files
gn gen out/Release --args='is_debug=false'

# Build
autoninja -C out/Release chrome
```

---

## Patches

Patches are stored in `patches/` and applied on top of upstream Chromium:

| Patch | Description |
|-------|-------------|
| `dom_snapshot_patch.diff` | Adds snapshot syscall to Blink |
| `event_virtualization.diff` | Event capture and replay |
| `network_intercept.diff` | Network request hooks |
| `abos_module.diff` | AB-OS native module |

---

## ABI

The kernel ABI is defined in `abi/kernel_syscall.proto`. See [ABI Documentation](abi/kernel_syscall.md).

---

## References

- [Design Document](design.md)
- [Build Instructions](build/BUILD.md)
- [ABI Specification](abi/kernel_syscall.md)
