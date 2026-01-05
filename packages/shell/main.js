/**
 * AB-OS Smart Browser Shell
 * 
 * Real Chromium browser with embedded WebContents per agent
 * FIX: Properly position BrowserViews over workspace slots
 */

const { app, BrowserWindow, BrowserView, ipcMain, Menu } = require('electron');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Video Intelligence (production caption capture)
let CaptionExtractor, transcriptStore, SessionManager, GeminiClient;
let captionExtractor, sessionManager, geminiClient;

try {
    const videoIntel = require('../video-intelligence/dist/index');
    CaptionExtractor = videoIntel.CaptionExtractor;
    transcriptStore = videoIntel.transcriptStore;
    SessionManager = videoIntel.SessionManager;
    GeminiClient = videoIntel.GeminiClient;

    captionExtractor = new CaptionExtractor();
    geminiClient = new GeminiClient();

    // Initialize Gemini with API key
    if (process.env.GEMINI_API_KEY) {
        geminiClient.initialize(process.env.GEMINI_API_KEY);
        sessionManager = new SessionManager(geminiClient);
        console.log('[VideoIntel] Production pipeline initialized');
    } else {
        console.warn('[VideoIntel] GEMINI_API_KEY not set');
    }
} catch (err) {
    console.error('[VideoIntel] Failed to load:', err.message);
}

// Dynamically import Planner (ESM)
let Planner;
const setupPlanner = async () => {
    const plannerModule = await import('../planner/dist/index.js');
    Planner = plannerModule.Planner;
};
setupPlanner();


// =============================================================================
// Agent WebContents Manager
// =============================================================================

class AgentManager {
    constructor() {
        this.agents = new Map(); // agentId -> { view, bounds }
        this.mainWindow = null;
    }

    setMainWindow(win) {
        this.mainWindow = win;
    }

    // Create a real browser view for an agent
    createAgent(agentId, bounds) {
        console.log(`[AgentManager] Creating agent ${agentId} with bounds:`, bounds);

        const view = new BrowserView({
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                webSecurity: true,
                allowRunningInsecureContent: false,
            }
        });

        // CRITICAL: Add view to window FIRST
        this.mainWindow.addBrowserView(view);

        // CRITICAL: Set bounds AFTER adding to window
        // Add offset for title bar and command bar (approx 112px)
        const adjustedBounds = {
            x: Math.round(bounds.x),
            y: Math.round(bounds.y),
            width: Math.round(bounds.width),
            height: Math.round(bounds.height),
        };

        console.log(`[AgentManager] Setting bounds:`, adjustedBounds);
        view.setBounds(adjustedBounds);

        // Enable auto resize
        view.setAutoResize({
            width: false,
            height: false,
            horizontal: false,
            vertical: false,
        });

        // Make sure it's visible
        view.setBackgroundColor('#ffffff');

        this.agents.set(agentId, { view, bounds: adjustedBounds });

        // Log navigation for audit
        view.webContents.on('did-start-navigation', (event, url) => {
            console.log(`[Agent ${agentId}] Starting navigation to: ${url}`);
        });

        view.webContents.on('did-navigate', (event, url) => {
            console.log(`[Agent ${agentId}] Navigated to: ${url}`);
            this.mainWindow.webContents.send('agent-navigated', { agentId, url });
        });

        view.webContents.on('did-finish-load', () => {
            console.log(`[Agent ${agentId}] Page finished loading`);
            this.mainWindow.webContents.send('agent-loaded', { agentId });
        });

        view.webContents.on('did-fail-load', (event, code, desc) => {
            console.log(`[Agent ${agentId}] Load failed: ${code} - ${desc}`);
        });

        // VIDEO INTELLIGENCE: Intercept YouTube timedtext captions
        view.webContents.session.webRequest.onCompleted(
            { urls: ['*://www.youtube.com/api/timedtext*'] },
            async (details) => {
                console.log(`[Agent ${agentId}] Timedtext intercept: ${details.url}`);

                // Extract video ID from referer or URL
                const agent = this.agents.get(agentId);
                if (agent && agent.currentUrl) {
                    const match = agent.currentUrl.match(/[?&]v=([^&]+)/);
                    const videoId = match ? match[1] : null;

                    if (videoId && captionExtractor) {
                        // We need to re-fetch the timedtext with fmt=json3
                        try {
                            const url = new URL(details.url);
                            url.searchParams.set('fmt', 'json3');

                            const response = await fetch(url.toString());
                            if (response.ok) {
                                const body = await response.text();
                                captionExtractor.ingestFromNetwork(
                                    agentId,
                                    videoId,
                                    body,
                                    { title: '', language: url.searchParams.get('lang') || 'en' }
                                );

                                // Notify UI that captions are available
                                this.mainWindow.webContents.send('video-context', {
                                    agentId,
                                    videoId,
                                    captionsAvailable: true,
                                });
                            }
                        } catch (err) {
                            console.error('[VideoIntel] Caption fetch error:', err);
                        }
                    }
                }
            }
        );

        // Track current URL for caption extraction
        view.webContents.on('did-navigate', (event, url) => {
            const agent = this.agents.get(agentId);
            if (agent) {
                agent.currentUrl = url;
            }
            this.mainWindow.webContents.send('agent-navigated', { agentId, url });

            // Check if it's YouTube and notify UI
            if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
                const match = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/);
                const videoId = match ? match[1] : null;

                this.mainWindow.webContents.send('video-detected', {
                    agentId, videoId, url
                });
            }
        });

        // Load a test page immediately to verify rendering
        view.webContents.loadURL('about:blank');

        return view;
    }

    // Navigate agent to URL and wait for load
    async navigate(agentId, url) {
        const agent = this.agents.get(agentId);
        if (agent) {
            console.log(`[Agent ${agentId}] Navigating to: ${url}`);
            const wc = agent.view.webContents;

            return new Promise((resolve) => {
                const onLoaded = () => {
                    wc.removeListener('did-finish-load', onLoaded);
                    wc.removeListener('did-fail-load', onLoaded);
                    resolve({ success: true });
                };
                wc.once('did-finish-load', onLoaded);
                wc.once('did-fail-load', onLoaded);
                wc.loadURL(url).catch(e => resolve({ success: false, error: e.message }));
            });
        } else {
            console.log(`[Agent ${agentId}] NOT FOUND for navigation`);
            return { success: false, error: 'Agent not found' };
        }
    }

    // Destroy an agent
    destroyAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (agent) {
            console.log(`[Agent ${agentId}] Destroying...`);
            this.mainWindow.removeBrowserView(agent.view);
            agent.view.webContents.destroy();
            this.agents.delete(agentId);
            console.log(`[Agent ${agentId}] Destroyed successfully`);
            return { success: true };
        } else {
            console.log(`[Agent ${agentId}] NOT FOUND for destruction`);
            return { success: false, error: 'Agent not found' };
        }
    }

    // Execute action on agent
    async executeAction(agentId, action, target, params) {
        const agent = this.agents.get(agentId);
        if (!agent) return { success: false, error: 'Agent not found' };

        const wc = agent.view.webContents;

        try {
            switch (action) {
                case 'click':
                    await wc.executeJavaScript(`
                        (function() {
                            const el = document.querySelector(${JSON.stringify(target)});
                            if (el) {
                                el.focus();
                                el.click();
                                return true;
                            }
                            return false;
                        })()
                    `);
                    break;
                case 'type':
                    await wc.executeJavaScript(`
                        (function() {
                            const el = document.querySelector(${JSON.stringify(target)});
                            if (el) {
                                el.focus();
                                el.value = ${JSON.stringify(params.text)};
                                el.dispatchEvent(new Event('input', { bubbles: true }));
                                el.dispatchEvent(new Event('change', { bubbles: true }));
                                // Also dispatch keyboard events for React/Vue sensitivity
                                el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
                                el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
                                return true;
                            }
                            return false;
                        })()
                    `);
                    break;
                case 'scroll':
                    await wc.executeJavaScript(`window.scrollBy({ top: ${params.y || 400}, behavior: 'smooth' })`);
                    break;
                case 'screenshot':
                    const image = await wc.capturePage();
                    return { success: true, data: image.toPNG().toString('base64') };
                case 'extract':
                    const extractResult = await wc.executeJavaScript(`
                        JSON.stringify(Array.from(document.querySelectorAll(${JSON.stringify(target)})).map(el => el.textContent))
                    `);
                    return { success: true, data: JSON.parse(extractResult) };
                case 'navigate':
                    return await this.navigate(agentId, target || params.url);
                default:
                    return { success: false, error: `Unknown action: ${action}` };
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Update agent window bounds
    setBounds(agentId, bounds) {
        const agent = this.agents.get(agentId);
        if (agent) {
            const adjustedBounds = {
                x: Math.round(bounds.x),
                y: Math.round(bounds.y),
                width: Math.round(bounds.width),
                height: Math.round(bounds.height),
            };
            console.log(`[Agent ${agentId}] Updating bounds:`, adjustedBounds);
            agent.view.setBounds(adjustedBounds);
            agent.bounds = adjustedBounds;
        }
    }

    // Remove agent
    removeAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (agent) {
            this.mainWindow.removeBrowserView(agent.view);
            this.agents.delete(agentId);
        }
    }

    // Get agent count
    getAgentCount() {
        return this.agents.size;
    }
}

const agentManager = new AgentManager();

// =============================================================================
// Smart Planner & Executor
// =============================================================================

class SmartExecutor {
    constructor(agentManager) {
        this.agentManager = agentManager;
        this.planner = null;
    }

    async init() {
        if (!Planner) {
            await setupPlanner();
        }
        this.planner = new Planner({
            provider: process.env.PLANNER_PROVIDER || 'groq',
            model: process.env.PLANNER_MODEL || 'llama-3.3-70b-versatile',
            apiKey: process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY
        });
    }

    async handleSmartCommand(agentId, intent) {
        if (!this.planner) await this.init();

        const agent = this.agentManager.agents.get(agentId);
        const currentUrl = agent ? agent.view.webContents.getURL() : null;

        console.log(`[SmartExecutor] Generating plan for: "${intent}" (URL: ${currentUrl})`);

        const response = await this.planner.createPlan({
            intent,
            context: { currentUrl }
        });

        if (!response.success) {
            console.error('[SmartExecutor] Planning failed:', response.error);
            return { success: false, error: response.error };
        }

        const plan = response.plan;
        console.log(`[SmartExecutor] Plan generated with ${plan.steps.length} steps`);

        // Execute top-level steps (those with or without dependencies)
        // For now, simple sequential execution of steps in order
        for (const step of plan.steps) {
            console.log(`[SmartExecutor] Executing step ${step.step_id}: ${step.description}`);

            // Send status update to UI
            this.agentManager.mainWindow.webContents.send('agent-status', {
                agentId,
                status: `Executing: ${step.description}`,
                stepId: step.step_id
            });

            const result = await this.agentManager.executeAction(agentId, step.action, step.target, step.params);

            if (!result.success) {
                console.error(`[SmartExecutor] Step ${step.step_id} failed:`, result.error);
                return { success: false, error: `Step ${step.step_id} failed: ${result.error}`, partialPlan: plan };
            }

            // Wait a bit between steps
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return { success: true, plan };
    }
}

const smartExecutor = new SmartExecutor(agentManager);
smartExecutor.init();


// =============================================================================
// Main Window (Control Plane UI)
// =============================================================================

function createMainWindow() {
    const mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        title: 'Smart Browser',
        backgroundColor: '#0a0e14',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        // Hide native menu
        frame: true,
        autoHideMenuBar: true,
    });

    Menu.setApplicationMenu(null);

    agentManager.setMainWindow(mainWindow);

    // Load the control plane UI
    mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));

    // Open DevTools in dev mode
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    return mainWindow;
}

// =============================================================================
// IPC Handlers (Bridge between UI and Agent WebContents)
// =============================================================================

ipcMain.handle('agent:create', async (event, { agentId, bounds }) => {
    console.log('[IPC] agent:create', agentId, bounds);
    agentManager.createAgent(agentId, bounds);
    return { success: true, agentId };
});

ipcMain.handle('agent:navigate', async (event, { agentId, url }) => {
    console.log('[IPC] agent:navigate', agentId, url);
    agentManager.navigate(agentId, url);
    return { success: true };
});

ipcMain.handle('agent:action', async (event, { agentId, action, target, params }) => {
    return agentManager.executeAction(agentId, action, target, params);
});

ipcMain.handle('agent:bounds', async (event, { agentId, bounds }) => {
    agentManager.setBounds(agentId, bounds);
    return { success: true };
});

ipcMain.handle('agent:remove', async (event, { agentId }) => {
    console.log('[IPC] agent:remove', agentId);
    return agentManager.destroyAgent(agentId);
});

ipcMain.handle('agent:destroy', async (event, { agentId }) => {
    console.log('[IPC] agent:destroy', agentId);
    return agentManager.destroyAgent(agentId);
});

ipcMain.handle('agent:screenshot', async (event, { agentId }) => {
    return agentManager.executeAction(agentId, 'screenshot', null, null);
});

ipcMain.handle('agent:smart-command', async (event, { agentId, intent }) => {
    console.log('[IPC] agent:smart-command', agentId, intent);
    return smartExecutor.handleSmartCommand(agentId, intent);
});

// Toggle BrowserView visibility (for hamburger menu overlap fix)
ipcMain.handle('views:toggle', async (event, { visible }) => {
    console.log('[IPC] views:toggle', visible);
    for (const [agentId, agent] of agentManager.agents) {
        if (visible) {
            // Restore bounds
            if (agent.savedBounds) {
                agent.view.setBounds(agent.savedBounds);
            }
        } else {
            // Save bounds and move off-screen
            agent.savedBounds = agent.view.getBounds();
            agent.view.setBounds({ x: -9999, y: -9999, width: 1, height: 1 });
        }
    }
    return { success: true };
});


// =============================================================================
// Video Intelligence IPC (Production - Session-Based)
// =============================================================================

// IPC: Explain a video (uses TranscriptStore + SessionManager)
ipcMain.handle('intel:explain', async (event, { videoId, mode, agentId }) => {
    console.log('[VideoIntel] Explain request:', agentId, videoId, mode);

    if (!sessionManager || !transcriptStore) {
        return { success: false, error: 'Video Intelligence not initialized' };
    }

    // Check if we have transcript from network capture
    const hasTranscript = transcriptStore.has(agentId, videoId);

    if (!hasTranscript) {
        // Try to fetch from page if not captured
        const agent = agentManager.agents.get(agentId);
        if (agent) {
            try {
                const captionTracks = await agent.view.webContents.executeJavaScript(`
                    (function() {
                        try {
                            const ytPlayer = document.getElementById('movie_player');
                            if (ytPlayer && ytPlayer.getPlayerResponse) {
                                const pr = ytPlayer.getPlayerResponse();
                                return pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
                            }
                        } catch (e) {}
                        return [];
                    })()
                `);

                if (captionTracks.length > 0) {
                    // Fetch first available track
                    const track = captionTracks[0];
                    const url = new URL(track.baseUrl);
                    url.searchParams.set('fmt', 'json3');

                    const response = await fetch(url.toString());
                    if (response.ok) {
                        const body = await response.text();
                        captionExtractor.ingestFromNetwork(agentId, videoId, body, {
                            language: track.languageCode,
                        });
                    }
                }
            } catch (err) {
                console.error('[VideoIntel] Fallback caption fetch failed:', err);
            }
        }
    }

    // Get session and explain
    try {
        const session = sessionManager.getSession(agentId, videoId);

        if (!session.hasTranscript()) {
            return { success: false, error: 'No captions available for this video' };
        }

        const content = await session.explain(mode || 'summary');

        return {
            success: true,
            videoId,
            [mode === 'summary' ? 'summary' : 'explanation']: content,
        };
    } catch (error) {
        console.error('[VideoIntel] Explain error:', error);
        return { success: false, error: error.message };
    }
});

// IPC: Ask a follow-up question (session-scoped)
ipcMain.handle('intel:ask', async (event, { videoId, question, agentId }) => {
    console.log('[VideoIntel] Ask question:', agentId, question);

    if (!sessionManager) {
        return 'Video Intelligence not initialized';
    }

    try {
        const session = sessionManager.getSession(agentId, videoId);

        if (!session.hasTranscript()) {
            return 'No transcript available for this video';
        }

        return await session.ask(question);
    } catch (error) {
        return `Error: ${error.message}`;
    }
});

// IPC: Get video context from a slot
ipcMain.handle('intel:getContext', async (event, { slotIndex }) => {
    console.log('[VideoIntel] Get context for slot:', slotIndex);

    const agentId = `agent-${slotIndex + 1}`;
    const agent = agentManager.agents.get(agentId);

    if (!agent || !agent.currentUrl) {
        return null;
    }

    // Check if it's a YouTube video
    if (!agent.currentUrl.includes('youtube.com/watch') && !agent.currentUrl.includes('youtu.be/')) {
        return null;
    }

    // Extract video ID
    const match = agent.currentUrl.match(/[?&]v=([^&]+)/) || agent.currentUrl.match(/youtu\.be\/([^?]+)/);
    const videoId = match ? match[1] : null;

    if (!videoId) return null;

    // Check if we have transcript
    const hasTranscript = transcriptStore?.has(agentId, videoId) || false;

    // Get title from page
    const title = await agent.view.webContents.executeJavaScript(`document.title || ''`);

    return {
        agentId,
        videoId,
        title: title.replace(' - YouTube', ''),
        url: agent.currentUrl,
        captionsAvailable: hasTranscript,
    };
});
// =============================================================================
// App Lifecycle
// =============================================================================

app.whenReady().then(() => {
    console.log('Smart Browser starting...');
    createMainWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Security: Block new windows from web content
app.on('web-contents-created', (event, contents) => {
    contents.setWindowOpenHandler(() => {
        return { action: 'deny' };
    });
});

console.log('Shell module loaded');

