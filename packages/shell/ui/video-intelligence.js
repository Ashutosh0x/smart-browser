/**
 * Video Intelligence UI Handler
 * 
 * Handles the "Explain" button and Intelligence Panel interactions.
 * Communicates with main process for caption extraction and Gemini API.
 */

(function () {
    'use strict';

    // =============================================================================
    // State
    // =============================================================================

    let currentVideoId = null;
    let currentAgentId = null;
    let currentTranscript = null;
    let chatHistory = [];
    let activeTab = 'summary';

    // =============================================================================
    // DOM References
    // =============================================================================

    const panel = document.getElementById('intelligencePanel');
    const closeBtn = document.getElementById('closeIntelPanel');
    const videoInfo = document.getElementById('intelVideoInfo');
    const content = document.getElementById('intelContent');
    const chatInput = document.getElementById('intelChatInput');
    const sendBtn = document.getElementById('intelSendBtn');
    const tabs = document.querySelectorAll('.intel-tab');

    // =============================================================================
    // Panel Controls
    // =============================================================================

    function openPanel() {
        panel?.classList.remove('hidden');
    }

    function closePanel() {
        panel?.classList.add('hidden');
    }

    closeBtn?.addEventListener('click', closePanel);

    // =============================================================================
    // Tab Switching
    // =============================================================================

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchTab(tabName);
        });
    });

    function switchTab(tabName) {
        activeTab = tabName;

        // Update tab buttons
        tabs.forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tabName);
        });

        // Load content for tab
        if (currentVideoId) {
            loadTabContent(tabName);
        }
    }

    async function loadTabContent(tabName) {
        if (tabName === 'chat') {
            showChatView();
            return;
        }

        showLoading();

        try {
            const mode = tabName === 'summary' ? 'summary' : 'explain';
            const result = await window.electronAPI?.explainVideo?.({
                videoId: currentVideoId,
                agentId: currentAgentId,
                mode
            });

            if (result?.success) {
                showExplanation(result.summary || result.explanation);
            } else {
                showError(result?.error || 'Failed to generate explanation');
            }
        } catch (error) {
            console.error('[VideoIntel] Failed to load tab content:', tabName, error);
            showError(error.message || 'Failed to generate explanation');
        }
    }

    // =============================================================================
    // Content Display
    // =============================================================================

    function showLoading() {
        if (!content) return;
        content.innerHTML = `
            <div class="intel-loading">
                <div class="loading-spinner"></div>
                <span>Analyzing video...</span>
            </div>
        `;
    }

    function showExplanation(text) {
        if (!content) return;

        // Convert markdown-like bullets to HTML
        const html = text
            .replace(/^\* /gm, '• ')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');

        content.innerHTML = `<p>${html}</p>`;
    }

    function showError(message) {
        if (!content) return;
        content.innerHTML = `
            <div class="intel-error" style="color: var(--error); text-align: center; padding: 40px;">
                <p>⚠️ ${message}</p>
                <p style="font-size: 11px; color: var(--text-muted); margin-top: 12px;">
                    Make sure the video has captions enabled.
                </p>
            </div>
        `;
    }

    function showChatView() {
        if (!content) return;

        if (chatHistory.length === 0) {
            content.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); padding: 40px;">
                    <p>Ask questions about this video</p>
                    <p style="font-size: 11px; margin-top: 8px;">
                        Try: "Explain the main concept" or "Give me examples"
                    </p>
                </div>
            `;
        } else {
            content.innerHTML = `
                <div class="intel-chat-messages">
                    ${chatHistory.map(msg => `
                        <div class="intel-message ${msg.role}">
                            ${msg.content}
                        </div>
                    `).join('')}
                </div>
            `;
            content.scrollTop = content.scrollHeight;
        }
    }

    // =============================================================================
    // Chat Functionality
    // =============================================================================

    async function sendMessage() {
        const question = chatInput?.value?.trim();
        if (!question || !currentVideoId) return;

        // Add user message
        chatHistory.push({ role: 'user', content: question });
        chatInput.value = '';
        showChatView();

        try {
            const response = await window.electronAPI?.askVideoQuestion?.({
                videoId: currentVideoId,
                agentId: currentAgentId,
                question
            });
            chatHistory.push({ role: 'ai', content: response || 'No response' });
        } catch (error) {
            console.error('[VideoIntel] Failed to send chat message:', error);
            chatHistory.push({ role: 'ai', content: `Error: ${error.message}` });
        }

        showChatView();
    }

    sendBtn?.addEventListener('click', sendMessage);
    chatInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // =============================================================================
    // Explain Button Handler (called from slot headers)
    // =============================================================================

    window.handleExplainClick = async function (slotIndex) {
        // Get video info from agent
        const videoContext = await window.electronAPI?.getVideoContext?.(slotIndex);

        if (!videoContext) {
            console.warn('[VideoIntel] No video context for slot', slotIndex);
            return;
        }

        // Reset state
        currentVideoId = videoContext.videoId;
        currentAgentId = videoContext.agentId;
        currentTranscript = null;
        chatHistory = [];
        activeTab = 'summary';

        // Update video info
        if (videoInfo) {
            videoInfo.querySelector('.video-title').textContent = videoContext.title || 'Loading...';
        }

        // Reset tabs
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'summary'));

        // Open panel and load content
        openPanel();
        loadTabContent('summary');
    };

    // =============================================================================
    // YouTube Detection (show/hide Explain buttons)
    // =============================================================================

    window.updateExplainButtons = function (slotIndex, url) {
        const slot = document.querySelector(`.workspace-slot[data-slot="${slotIndex}"]`);
        const explainBtn = slot?.querySelector('.slot-explain-btn');

        if (explainBtn) {
            const isYouTube = url?.includes('youtube.com/watch') || url?.includes('youtu.be/');
            explainBtn.classList.toggle('hidden', !isYouTube);
        }
    };

    // =============================================================================
    // Initialize
    // =============================================================================

    document.addEventListener('DOMContentLoaded', () => {
        // Attach click handlers to explain buttons
        document.querySelectorAll('.slot-explain-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const slotIndex = parseInt(btn.dataset.slot, 10);
                window.handleExplainClick(slotIndex);
            });
        });

        // Listen for video detection events from main process
        window.electronAPI?.onVideoDetected?.((data) => {
            console.log('[VideoIntel] Video detected:', data);
            const { agentId, videoId, url } = data;

            // Look up slot from renderer's agents Map (via global window.agents if exposed)
            // Or find from slot-content's data-agent attribute
            const slots = document.querySelectorAll('.workspace-slot');
            for (const slot of slots) {
                const contentEl = slot.querySelector('.slot-content');
                if (contentEl?.dataset?.agent === agentId) {
                    const slotIndex = parseInt(slot.dataset.slot, 10);
                    window.updateExplainButtons(slotIndex, url);
                    console.log('[VideoIntel] Showing Explain button for slot', slotIndex);
                    return;
                }
            }

            // Fallback: show on first slot if agent not found 
            console.log('[VideoIntel] Agent slot not found, checking all YouTube slots');
            slots.forEach((slot, index) => {
                const slotTitle = slot.querySelector('.slot-title')?.textContent;
                if (slotTitle?.includes('youtube')) {
                    window.updateExplainButtons(index, url);
                }
            });
        });

        // Listen for captions available
        window.electronAPI?.onVideoContext?.((data) => {
            console.log('[VideoIntel] Captions available:', data);
        });

        console.log('[VideoIntel] UI handler initialized');
    });
})();
