/**
 * Smart Browser Renderer Script
 * 
 * With hover + fullscreen interaction physics
 */

// Import configuration constants
const CONFIG = {
    TIMING: {
        FULLSCREEN_TRANSITION_DELAY: 220,
        FULLSCREEN_ENTER_DELAY: 50,
        RESIZE_DEBOUNCE_DELAY: 100,
        AGENT_INIT_DELAY: 100,
        STEP_EXECUTION_DELAY: 1000,
    },
    AGENT: {
        MAX_AGENTS: 4,
    }
};

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

    // Move ALL other agents off-screen, and set focused agent bounds
    setTimeout(() => {
        agents.forEach((data, agentId) => {
            if (data.slot === slot) {
                const newBounds = getSlotBounds(slot);
                if (newBounds) {
                    window.abos.setBounds(agentId, newBounds);
                }
            } else {
                // Move off-screen
                window.abos.setBounds(agentId, { x: -9999, y: -9999, width: 1, height: 1 });
            }
        });
    }, CONFIG.TIMING.FULLSCREEN_TRANSITION_DELAY);

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
    }, CONFIG.TIMING.FULLSCREEN_TRANSITION_DELAY);

    log(`Exited focus mode`);
}

function toggleFullscreen(slot) {
    if (fullscreenSlot === slot) {
        exitFullscreen();
    } else {
        if (fullscreenSlot !== null) exitFullscreen();
        setTimeout(() => enterFullscreen(slot), CONFIG.TIMING.FULLSCREEN_ENTER_DELAY);
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

    // Wait for DOM to be ready
    await new Promise(r => requestAnimationFrame(r));

    const bounds = getSlotBounds(slot);
    if (!bounds || bounds.width < 10 || bounds.height < 10) {
        log(`Invalid bounds for slot ${slot}`, 'error');
        return null;
    }

    log(`Creating agent in slot ${slot}...`);

    try {
        // Create the agent in main process
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

        // Wait a bit to ensure BrowserView is fully attached
        await new Promise(r => setTimeout(r, CONFIG.TIMING.AGENT_INIT_DELAY));

        return agentId;
    } catch (error) {
        log(`Failed: ${error.message}`, 'error');
        console.error('[Renderer] Agent creation failed:', error);
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
                } catch (e) {
                    console.error('[Renderer] Failed to parse URL for display:', e.message);
                    slotEl.querySelector('.slot-title').textContent = 'Loading...';
                }
            }
        }
        updateAgentList();
    } catch (error) {
        log(`Navigation failed: ${error.message}`, 'error');
    }
}

// Round-robin navigation - each URL goes to the next available slot
async function navigateToNextSlot(url) {
    const MAX_SLOTS = CONFIG.AGENT.MAX_AGENTS;

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
        await new Promise(r => setTimeout(r, CONFIG.TIMING.AGENT_INIT_DELAY)); // Wait for agent to initialize
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
    // Note: agentCount element was removed from UI
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
                console.error('[Renderer] Failed to parse agent URL:', e.message);
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

// =============================================================================
// Tab Navigation Handling
// =============================================================================

function setupTabNavigation() {
    const tabsContainer = document.getElementById('tabsContainer');
    const addTabBtn = document.getElementById('addTabBtn');

    // Tab switching logic
    tabsContainer.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab');
        if (!tab) return;

        // Close button logic
        if (e.target.closest('.tab-close')) {
            const slot = parseInt(tab.dataset.slot);
            destroyAgent(slot);
            tab.remove();
            return;
        }

        // Switch agents
        const slot = parseInt(tab.dataset.slot);
        const agentId = Array.from(agents.entries()).find(([id, data]) => data.slot === slot)?.[0];
        if (agentId) {
            setActiveAgent(agentId, slot);
        }
    });

    addTabBtn.addEventListener('click', async () => {
        for (let i = 0; i < CONFIG.AGENT.MAX_AGENTS; i++) {
            const slotUsed = Array.from(agents.values()).some(a => a.slot === i);
            if (!slotUsed) {
                await createAgent(i);
                createTab(i, 'New Tab', 'https://www.google.com/favicon.ico');
                return;
            }
        }
        log('All slots full', 'error');
    });
}

function createTab(slot, title, favicon) {
    const tabsContainer = document.getElementById('tabsContainer');
    const colors = ['#4285f4', '#0077b5', '#ea4335', '#f4b400', '#0f9d58', '#ab47bc'];
    const color = colors[slot % colors.length];

    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.dataset.slot = slot;
    tab.style.setProperty('--tab-color', color);
    tab.innerHTML = `
        <img src="${favicon || 'logo.svg'}" class="tab-favicon" onerror="this.src='logo.svg'">
        <span class="tab-title">${title}</span>
        <button class="tab-close">×</button>
    `;

    tabsContainer.appendChild(tab);
    return tab;
}

function setActiveAgent(agentId, slot) {
    activeAgentId = agentId;

    // Update Tabs UI
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    const tabEl = document.querySelector(`.tab[data-slot="${slot}"]`);
    if (tabEl) tabEl.classList.add('active');

    // Update Workspace UI
    document.querySelectorAll('.workspace-slot').forEach(s => s.classList.remove('active'));
    const slotEl = workspaceGrid.querySelector(`[data-slot="${slot}"]`);
    if (slotEl) {
        slotEl.classList.add('active');
        // If in fullscreen mode, switch to this slot
        if (mainLayout.classList.contains('fullscreen-mode')) {
            enterFullscreen(slot);
        }
    }

    updateAgentList();
}

function updateTabInfo(slot, title, url) {
    const tabEl = document.querySelector(`.tab[data-slot="${slot}"]`);
    if (tabEl) {
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname;

            if (title) tabEl.querySelector('.tab-title').textContent = title;
            else if (domain) tabEl.querySelector('.tab-title').textContent = domain;
            else if (url === 'about:blank') tabEl.querySelector('.tab-title').textContent = 'New Tab';

            const faviconImg = tabEl.querySelector('.tab-favicon');
            if (domain) {
                faviconImg.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
            } else {
                faviconImg.src = 'logo.svg';
            }
        } catch (e) {
            tabEl.querySelector('.tab-title').textContent = title || 'Smart Browser';
            tabEl.querySelector('.tab-favicon').src = 'logo.svg';
        }
    }
}

// Update the workspace slot double-click handler
function setupWorkspaceEvents() {
    workspaceGrid.querySelectorAll('.workspace-slot').forEach(slot => {
        const slotIndex = parseInt(slot.dataset.slot);

        slot.addEventListener('dblclick', (e) => {
            if (e.target.closest('.slot-close-btn')) return;
            toggleFullscreen(slotIndex);
        });

        slot.addEventListener('click', (e) => {
            if (e.target.closest('.slot-close-btn') || e.target.closest('.exit-fullscreen-btn')) return;

            const agentId = Array.from(agents.entries()).find(([id, data]) => data.slot === slotIndex)?.[0];
            if (agentId) {
                setActiveAgent(agentId, slotIndex);
            }
        });

        const closeBtn = slot.querySelector('.slot-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                destroyAgent(slotIndex);
                const tabEl = document.querySelector(`.tab[data-slot="${slotIndex}"]`);
                if (tabEl) tabEl.remove();
            });
        }
    });

    // Collapsible Log Panel
    const toggleLogBtn = document.getElementById('toggleLogBtn');
    const auditPanel = document.getElementById('auditPanel');
    if (toggleLogBtn && auditPanel) {
        toggleLogBtn.addEventListener('click', () => {
            auditPanel.classList.toggle('collapsed');
        });
    }

    // Advanced Mode Toggle
    const advancedToggle = document.getElementById('advancedModeToggle');
    if (advancedToggle) {
        advancedToggle.addEventListener('change', (e) => {
            const isAdvanced = e.target.checked;
            document.body.classList.toggle('advanced-mode', isAdvanced);
            log(`Switched to ${isAdvanced ? 'Advanced' : 'Simple'} mode`, 'info');

            // In simple mode, we might want to hide the agent list or log panel
            if (!isAdvanced) {
                auditPanel.classList.add('collapsed');
            } else {
                auditPanel.classList.remove('collapsed');
            }
        });
    }
}

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
        const agentData = agents.get(data.agentId);
        agentData.url = data.url;
        updateAgentList();
        updateTabInfo(agentData.slot, null, data.url);

        // Hide placeholder
        const slotEl = workspaceGrid.querySelector(`[data-slot="${agentData.slot}"]`);
        if (slotEl) {
            const contentEl = slotEl.querySelector('.slot-content');
            if (contentEl) contentEl.classList.remove('empty');
        }
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
    }, CONFIG.TIMING.RESIZE_DEBOUNCE_DELAY);
});


// =============================================================================
// Init
// =============================================================================

async function initializeDefaultAgents() {
    log('Initializing Smart Workspace...', 'info');
    document.getElementById('tabsContainer').innerHTML = ''; // Clear demo tabs

    // Create 4 initial agents - one for each slot
    for (let i = 0; i < CONFIG.AGENT.MAX_AGENTS; i++) {
        const agentId = await createAgent(i);
        createTab(i, `Agent ${i + 1}`, 'logo.svg'); // Placeholder

        // Small delay to prevent race conditions on startup
        await new Promise(r => setTimeout(r, 50));
    }

    // Set first one active
    const firstAgentId = Array.from(agents.entries()).find(([id, data]) => data.slot === 0)?.[0];
    if (firstAgentId) setActiveAgent(firstAgentId, 0);

    updateAgentList();
}

// Global UI Handlers
function setupSecureUI() {
    const walletBtn = document.getElementById('walletBtn');
    const profileBtn = document.getElementById('profileBtn');
    const profileDropdown = document.getElementById('profileDropdown');
    const appLauncherBtn = document.getElementById('appLauncherBtn');
    const launcher = document.getElementById('secureLauncher');

    const micBtn = document.getElementById('micBtn');

    setupTabNavigation(); // Initialize Tab System

    // Mic Button (Voice Commands)
    if (micBtn) {
        micBtn.addEventListener('click', () => {
            log('Listening for voice commands...', 'info');
        });
    }

    // App Launcher (9-dot grid)
    if (appLauncherBtn) {
        appLauncherBtn.addEventListener('click', () => {
            log('Opening Secure App Suite...', 'info');
            if (launcher) launcher.open();
        });
    }

    // Wallet Panel Toggle
    const walletPanel = document.getElementById('walletPanel');
    if (walletBtn && walletPanel) {
        walletBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = walletPanel.classList.toggle('open');
            log(isOpen ? 'Opening Secure Wallet...' : 'Closing Wallet', 'info');

            // Close profile if open
            if (isOpen && profileDropdown) profileDropdown.classList.remove('open');

            // Hide/Show BrowserViews
            if (window.electronAPI && window.electronAPI.toggleViews) {
                window.electronAPI.toggleViews(!isOpen);
            }
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (walletPanel.classList.contains('open') && !walletPanel.contains(e.target)) {
                walletPanel.classList.remove('open');
                if (window.electronAPI && window.electronAPI.toggleViews) {
                    window.electronAPI.toggleViews(true);
                }
            }
        });
    }

    // Profile Dropdown Toggle
    if (profileBtn && profileDropdown) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = profileDropdown.classList.toggle('open');
            log(isOpen ? 'Accessing Identity Vault...' : 'Closing Profile', 'info');

            // Close wallet if open
            if (isOpen && walletPanel) walletPanel.classList.remove('open');

            // Hide/Show BrowserViews to prevent overlapping
            if (window.electronAPI && window.electronAPI.toggleViews) {
                window.electronAPI.toggleViews(!isOpen);
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (profileDropdown.classList.contains('open') && !profileDropdown.contains(e.target)) {
                profileDropdown.classList.remove('open');
                if (window.electronAPI && window.electronAPI.toggleViews) {
                    window.electronAPI.toggleViews(true);
                }
            }
        });
    }

    // Folder Sidebar Toggle
    const foldersSidebar = document.getElementById('foldersSidebar');

    if (folderBtn && foldersSidebar) {
        folderBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = foldersSidebar.classList.toggle('open');
            log(isOpen ? 'Opening Secure Storage...' : 'Closing Storage', 'info');

            // Close others if opening
            if (isOpen) {
                if (walletPanel) walletPanel.classList.remove('open');
                if (profileDropdown) profileDropdown.classList.remove('open');
            }

            // Hide/Show BrowserViews
            if (window.electronAPI && window.electronAPI.toggleViews) {
                window.electronAPI.toggleViews(!isOpen);
            }
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (foldersSidebar.classList.contains('open') && !foldersSidebar.contains(e.target)) {
                foldersSidebar.classList.remove('open');
                if (window.electronAPI && window.electronAPI.toggleViews) {
                    window.electronAPI.toggleViews(true);
                }
            }
        });
    }

    // Keyboard shortcut: Ctrl/Cmd + K
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            log('Hotkey: Opening Launcher', 'info');
            if (launcher) launcher.open();
        }
    });
}

// Start everything
document.addEventListener('DOMContentLoaded', () => {
    // Initial Lucide icons
    if (window.lucide) {
        lucide.createIcons();
    }

    setupSecureUI();
    setupWorkspaceEvents();

    initializeDefaultAgents()
        .then(() => {
            log('Smart Browser ready', 'success');
            // Focus command bar on launch
            if (commandInput) commandInput.focus();
        })
        .catch(err => log(`Startup error: ${err.message}`, 'error'));

    // Secure Launcher Event Listeners
    const launcher = document.getElementById('secureLauncher');
    if (launcher) {
        launcher.addEventListener('launcher-open', () => {
            log('Secure Layer Active', 'info');
            if (window.electronAPI && window.electronAPI.toggleViews) {
                window.electronAPI.toggleViews(false);
            }
        });

        launcher.addEventListener('launcher-close', () => {
            log('Secure Layer Closed', 'info');
            if (window.electronAPI && window.electronAPI.toggleViews) {
                window.electronAPI.toggleViews(true);
            }
        });

        launcher.addEventListener('app-launch', async (e) => {
            const { appId, riskLevel } = e.detail;
            log(`Secure Launch: ${appId} (Risk: ${riskLevel})`, 'info');

            if (window.abos && window.abos.launchSecureApp) {
                await window.abos.launchSecureApp(appId, riskLevel);
            }
        });
    }

    // Periodically refresh icons for dynamically added content
    setInterval(() => {
        if (window.lucide) lucide.createIcons();
    }, 1000);
});
