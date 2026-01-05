/**
 * AB-OS Preload Script
 * 
 * Secure bridge between renderer and main process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to renderer
contextBridge.exposeInMainWorld('abos', {
    // Agent lifecycle
    createAgent: (agentId, bounds) =>
        ipcRenderer.invoke('agent:create', { agentId, bounds }),

    removeAgent: (agentId) =>
        ipcRenderer.invoke('agent:remove', { agentId }),

    destroyAgent: (agentId) =>
        ipcRenderer.invoke('agent:destroy', { agentId }),

    // Navigation
    navigate: (agentId, url) =>
        ipcRenderer.invoke('agent:navigate', { agentId, url }),

    // Actions
    executeAction: (agentId, action, target, params) =>
        ipcRenderer.invoke('agent:action', { agentId, action, target, params }),

    // Window management
    setBounds: (agentId, bounds) =>
        ipcRenderer.invoke('agent:bounds', { agentId, bounds }),

    // Screenshot
    screenshot: (agentId) =>
        ipcRenderer.invoke('agent:screenshot', { agentId }),

    // Smart AI Command
    smartCommand: (agentId, intent) =>
        ipcRenderer.invoke('agent:smart-command', { agentId, intent }),

    // Event listeners
    onAgentNavigated: (callback) =>
        ipcRenderer.on('agent-navigated', (event, data) => callback(data)),

    onAgentLoaded: (callback) =>
        ipcRenderer.on('agent-loaded', (event, data) => callback(data)),

    onAgentStatus: (callback) =>
        ipcRenderer.on('agent-status', (event, data) => callback(data)),
});

// Expose electronAPI for menu control and video intelligence
contextBridge.exposeInMainWorld('electronAPI', {
    toggleViews: (visible) => ipcRenderer.invoke('views:toggle', { visible }),

    // Video Intelligence (Production - session-scoped)
    explainVideo: (params) => ipcRenderer.invoke('intel:explain', params),
    askVideoQuestion: (params) => ipcRenderer.invoke('intel:ask', params),
    getVideoContext: (slotIndex) => ipcRenderer.invoke('intel:getContext', { slotIndex }),

    // Video detection events
    onVideoDetected: (callback) => ipcRenderer.on('video-detected', (event, data) => callback(data)),
    onVideoContext: (callback) => ipcRenderer.on('video-context', (event, data) => callback(data)),
});

console.log('[AB-OS] Preload script loaded');
