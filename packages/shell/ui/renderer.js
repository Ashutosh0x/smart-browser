/**
 * Smart Browser Renderer Script
 * 
 * With hover + fullscreen interaction physics
 */

// =============================================================================
// State
// =============================================================================

const agents = new Map();
let activeAgentId = null;
let fullscreenSlot = null;
let nextSlotIndex = 0; // Round-robin slot allocation

// URL pattern detection
const URL_PATTERN = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?$/i;

// =============================================================================
// UI Elements
// =============================================================================

const commandInput = document.getElementById('commandInput');
const executeBtn = document.getElementById('executeBtn');
const agentList = document.getElementById('agentList');
const agentCount = document.getElementById('agentCount');
const auditLog = document.getElementById('auditLog');
const workspaceGrid = document.getElementById('workspaceGrid');
const newAgentBtn = document.getElementById('newAgentBtn');
const mainLayout = document.querySelector('.main-layout');

// =============================================================================
// Logging
// =============================================================================

function log(message, type = 'info') {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-text">${message}</span>`;
    auditLog.appendChild(entry);
    auditLog.scrollTop = auditLog.scrollHeight;
}

// =============================================================================
// Bounds Calculation
// =============================================================================

function getSlotBounds(slot) {
    const slotEl = workspaceGrid.querySelector(`[data-slot="${slot}"]`);
    if (!slotEl) return null;

    const contentEl = slotEl.querySelector('.slot-content');
    if (!contentEl) return null;

    const rect = contentEl.getBoundingClientRect();

    return {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
    };
}

// =============================================================================
// Fullscreen Mode
// =============================================================================

function enterFullscreen(slot) {
    const slotEl = workspaceGrid.querySelector(`[data-slot="${slot}"]`);
    if (!slotEl) return;

    fullscreenSlot = slot;

    // Add fullscreen classes
    workspaceGrid.classList.add('has-fullscreen');
    mainLayout.classList.add('fullscreen-mode');
    slotEl.classList.add('fullscreen');

    // Update BrowserView bounds after transition
    setTimeout(() => {
        const agentData = Array.from(agents.values()).find(a => a.slot === slot);
        if (agentData) {
            const agentId = Array.from(agents.entries()).find(([id, data]) => data.slot === slot)?.[0];
            if (agentId) {
                const newBounds = getSlotBounds(slot);
                if (newBounds) {
                    window.abos.setBounds(agentId, newBounds);
                }
            }
        }
    }, 220);

    log(`Focused: Slot ${slot}`, 'success');
}

function exitFullscreen() {
    if (fullscreenSlot === null) return;

    const slotEl = workspaceGrid.querySelector(`[data-slot="${fullscreenSlot}"]`);

    // Remove fullscreen classes
    workspaceGrid.classList.remove('has-fullscreen');
    mainLayout.classList.remove('fullscreen-mode');
    if (slotEl) slotEl.classList.remove('fullscreen');

    const previousSlot = fullscreenSlot;
    fullscreenSlot = null;

    // Update all BrowserView bounds after transition
    setTimeout(() => {
        agents.forEach((data, agentId) => {
            const newBounds = getSlotBounds(data.slot);
            if (newBounds) {
                window.abos.setBounds(agentId, newBounds);
            }
        });
    }, 220);

    log(`Exited focus mode`);
}

function toggleFullscreen(slot) {
    if (fullscreenSlot === slot) {
        exitFullscreen();
    } else {
        if (fullscreenSlot !== null) exitFullscreen();
        setTimeout(() => enterFullscreen(slot), 50);
    }
}

// Esc key to exit fullscreen
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && fullscreenSlot !== null) {
        exitFullscreen();
    }
});

// =============================================================================
// Agent Management
// =============================================================================

async function createAgent(slot) {
    const agentId = `agent-${Date.now()}`;

    await new Promise(r => requestAnimationFrame(r));

    const bounds = getSlotBounds(slot);
    if (!bounds || bounds.width < 10 || bounds.height < 10) {
        log(`Invalid bounds for slot ${slot}`, 'error');
        return null;
    }

    log(`Creating agent in slot ${slot}...`);

    try {
        await window.abos.createAgent(agentId, bounds);

        const slotEl = workspaceGrid.querySelector(`[data-slot="${slot}"]`);

        agents.set(agentId, { slot, url: null, bounds });
        slotEl.classList.add('active');
        slotEl.querySelector('.slot-status').textContent = '[Ready]';
        slotEl.querySelector('.slot-status').className = 'slot-status running';
        slotEl.querySelector('.slot-content').dataset.agent = agentId;

        updateAgentList();
        log(`Agent created in slot ${slot}`, 'success');

        activeAgentId = agentId;
        return agentId;
    } catch (error) {
        log(`Failed: ${error.message}`, 'error');
        return null;
    }
}

async function navigateAgent(agentId, url) {
    if (!url.match(/^https?:\/\//)) {
        url = 'https://' + url;
    }

    log(`Loading ${url}...`, 'navigate');

    try {
        await window.abos.navigate(agentId, url);

        const agentData = agents.get(agentId);
        if (agentData) {
            agentData.url = url;

            const slotEl = workspaceGrid.querySelector(`[data-slot="${agentData.slot}"]`);
            if (slotEl) {
                try {
                    const domain = new URL(url).hostname;
                    slotEl.querySelector('.slot-title').textContent = domain;
                } catch (e) { }
            }
        }
        updateAgentList();
    } catch (error) {
        log(`Navigation failed: ${error.message}`, 'error');
    }
}

// Round-robin navigation - each URL goes to the next available slot
async function navigateToNextSlot(url) {
    const MAX_SLOTS = 4;

    // Find or create agent in the next slot
    let targetAgentId = null;
    const slotIndex = nextSlotIndex % MAX_SLOTS;

    // Check if there's already an agent in this slot
    const existingAgent = Array.from(agents.entries()).find(([id, data]) => data.slot === slotIndex);

    if (existingAgent) {
        targetAgentId = existingAgent[0];
        log(`Using existing Agent ${slotIndex + 1}`, 'info');
    } else {
        // Create new agent in this slot
        targetAgentId = await createAgent(slotIndex);
        if (!targetAgentId) {
            log(`Failed to create agent in slot ${slotIndex}`, 'error');
            return;
        }
        await new Promise(r => setTimeout(r, 100)); // Wait for agent to initialize
    }

    // Navigate the agent
    await navigateAgent(targetAgentId, url);

    // Move to next slot for the next URL
    nextSlotIndex = (nextSlotIndex + 1) % MAX_SLOTS;

    // Update active agent
    activeAgentId = targetAgentId;

    // Highlight the slot
    document.querySelectorAll('.workspace-slot').forEach(s => s.classList.remove('active'));
    const slotEl = workspaceGrid.querySelector(`[data-slot="${slotIndex}"]`);
    if (slotEl) slotEl.classList.add('active');

    updateAgentList();
}

// Destroy an agent and reset its slot
async function destroyAgent(slotIndex) {
    const agentEntry = Array.from(agents.entries()).find(([id, data]) => data.slot === slotIndex);
    if (!agentEntry) {
        log(`No agent in slot ${slotIndex + 1}`, 'warning');
        return;
    }

    const [agentId, agentData] = agentEntry;

    try {
        // Call main process to destroy the BrowserView
        await window.abos.destroyAgent(agentId);

        // Remove from local state
        agents.delete(agentId);

        // Reset slot UI
        const slotEl = workspaceGrid.querySelector(`[data-slot="${slotIndex}"]`);
        if (slotEl) {
            slotEl.classList.remove('active');
            slotEl.querySelector('.slot-title').textContent = `Agent ${slotIndex + 1}`;
            slotEl.querySelector('.slot-status').textContent = 'Idle';
            slotEl.querySelector('.slot-status').className = 'slot-status idle';
        }

        // Clear active if this was the active agent
        if (activeAgentId === agentId) {
            activeAgentId = null;
        }

        log(`Agent ${slotIndex + 1} closed`, 'info');
        updateAgentList();
    } catch (error) {
        log(`Failed to close agent: ${error.message}`, 'error');
    }
}

function updateAgentList() {
    agentCount.textContent = agents.size;

    if (agents.size === 0) {
        agentList.innerHTML = '<div class="empty-state">No agents</div>';
        return;
    }

    agentList.innerHTML = '';
    agents.forEach((data, id) => {
        const card = document.createElement('div');
        card.className = `agent-card ${id === activeAgentId ? 'active' : ''}`;

        let displayUrl = 'No page';
        if (data.url) {
            try {
                displayUrl = new URL(data.url).hostname;
            } catch (e) {
                displayUrl = data.url.slice(0, 20);
            }
        }

        card.innerHTML = `
      <div class="agent-name">Slot ${data.slot}</div>
      <div class="agent-url">${displayUrl}</div>
    `;
        card.onclick = () => {
            activeAgentId = id;
            updateAgentList();
        };
        // Double-click to fullscreen
        card.ondblclick = () => toggleFullscreen(data.slot);
        agentList.appendChild(card);
    });
}

// =============================================================================
// Double-Click Handler for Workspace Slots
// =============================================================================

workspaceGrid.querySelectorAll('.workspace-slot').forEach(slot => {
    const slotIndex = parseInt(slot.dataset.slot);

    // Double-click anywhere on slot to fullscreen (including header)
    slot.addEventListener('dblclick', (e) => {
        // Don't trigger on close button clicks
        if (e.target.closest('.slot-close-btn')) return;
        toggleFullscreen(slotIndex);
    });

    // Single click to select
    slot.addEventListener('click', (e) => {
        if (e.target.closest('.slot-close-btn') || e.target.closest('.exit-fullscreen-btn')) return;

        const agentId = Array.from(agents.entries()).find(([id, data]) => data.slot === slotIndex)?.[0];
        if (agentId) {
            activeAgentId = agentId;
            document.querySelectorAll('.workspace-slot').forEach(s => s.classList.remove('active'));
            slot.classList.add('active');
            updateAgentList();
        }
    });

    // Close button handler
    const closeBtn = slot.querySelector('.slot-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            destroyAgent(slotIndex);
        });
    }
});

// =============================================================================
// Command Execution
// =============================================================================

async function executeCommand() {
    const command = commandInput.value.trim();
    if (!command) return;

    log(`> ${command}`);
    commandInput.value = '';

    const words = command.toLowerCase().split(' ');

    // "go to [url]" or "open [url]"
    if (words[0] === 'go' || words[0] === 'open') {
        const url = command.split(' ').slice(words[0] === 'go' ? 2 : 1).join(' ');
        await navigateToNextSlot(url);
        return;
    }

    // Auto-detect URL input (e.g. "google.com" or "youtube.com")
    if (URL_PATTERN.test(command)) {
        await navigateToNextSlot(command);
        return;
    }

    // "new"
    if (words[0] === 'new') {
        for (let i = 0; i < 4; i++) {
            const slotUsed = Array.from(agents.values()).some(a => a.slot === i);
            if (!slotUsed) {
                await createAgent(i);
                return;
            }
        }
        log('All slots full', 'error');
        return;
    }

    // "focus [0-3]"
    if (words[0] === 'focus' && words[1]) {
        const slot = parseInt(words[1]);
        if (slot >= 0 && slot <= 3) {
            toggleFullscreen(slot);
        }
        return;
    }

    // "screenshot"
    if (words[0] === 'screenshot' && activeAgentId) {
        log('Taking screenshot...');
        const result = await window.abos.screenshot(activeAgentId);
        log(result.success ? 'Screenshot captured' : 'Failed', result.success ? 'success' : 'error');
        return;
    }

    // Fallback: Smart AI Command
    if (activeAgentId) {
        log(`AI Thinking: ${command}...`, 'info');
        const statusItem = document.querySelector('.status-item');
        if (statusItem) statusItem.innerHTML = `<i data-lucide="loader" class="icon spin"></i> Planning...`;
        if (window.lucide) lucide.createIcons();

        try {
            const response = await window.abos.smartCommand(activeAgentId, command);
            if (response.success) {
                log('Task completed successfully', 'success');
            } else {
                log(`Task failed: ${response.error}`, 'error');
            }
        } catch (error) {
            log(`AI Error: ${error.message}`, 'error');
        } finally {
            if (statusItem) statusItem.innerHTML = `<i data-lucide="check-circle" class="icon"></i> Ready`;
            if (window.lucide) lucide.createIcons();
        }
    } else {
        log('No active agent for smart command. Create one first.', 'warning');
    }
}


// =============================================================================
// Event Listeners
// =============================================================================

executeBtn.addEventListener('click', executeCommand);
commandInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') executeCommand();
});

newAgentBtn.addEventListener('click', async () => {
    for (let i = 0; i < 4; i++) {
        const slotUsed = Array.from(agents.values()).some(a => a.slot === i);
        if (!slotUsed) {
            await createAgent(i);
            return;
        }
    }
    log('All slots full', 'error');
});

// Agent events
window.abos.onAgentNavigated((data) => {
    log(`Loaded: ${data.url}`, 'navigate');
    if (agents.has(data.agentId)) {
        agents.get(data.agentId).url = data.url;
        updateAgentList();
    }
});

window.abos.onAgentLoaded((data) => {
    const agentData = agents.get(data.agentId);
    if (agentData) {
        const slotEl = workspaceGrid.querySelector(`[data-slot="${agentData.slot}"]`);
        if (slotEl) {
            slotEl.querySelector('.slot-status').textContent = '[Loaded]';
            slotEl.querySelector('.slot-status').className = 'slot-status success';
        }
    }
});

window.abos.onAgentStatus((data) => {
    log(data.status, 'info');

    // Update status in slot
    const agentData = agents.get(data.agentId);
    if (agentData) {
        const slotEl = workspaceGrid.querySelector(`[data-slot="${agentData.slot}"]`);
        if (slotEl) {
            const statusEl = slotEl.querySelector('.slot-status');
            statusEl.textContent = data.status;
            statusEl.className = 'slot-status running';
        }
    }
});

// Resize handling
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        agents.forEach((data, agentId) => {
            const newBounds = getSlotBounds(data.slot);
            if (newBounds) {
                window.abos.setBounds(agentId, newBounds);
            }
        });
    }, 100);
});

// =============================================================================
// Init
// =============================================================================

log('Smart Browser ready');
log('Type "go to example.com"');
log('Double-click slot for fullscreen');
