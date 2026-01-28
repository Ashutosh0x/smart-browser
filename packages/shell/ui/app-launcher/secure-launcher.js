/**
 * Secure App Launcher - Web Component Implementation
 * 
 * Ultra-fast UI with:
 * - Native Web Components (no framework)
 * - Shadow DOM (encapsulation)
 * - GPU-accelerated animations
 * - Zero dependencies
 * - <30ms render time
 */

class SecureLauncher extends HTMLElement {
    constructor() {
        super();

        // Closed shadow root - maximum security
        this.attachShadow({ mode: 'closed' });

        // Pre-render state
        this.isOpen = false;
        this.activeApp = null;

        // Performance: Pre-create DOM once
        this.render();
        this.attachEventListeners();
    }

    connectedCallback() {
        // Component added to DOM
        console.log('[SecureLauncher] Initialized');
    }

    disconnectedCallback() {
        // Memory cleanup
        this.cleanup();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                /* === RESET === */
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                /* === HOST === */
                :host {
                    display: block;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    z-index: 999999;
                    pointer-events: none;
                    
                    /* CSS Variables - Design System */
                    --bg-overlay: rgba(0, 0, 0, 0.85);
                    --bg-panel: rgba(20, 20, 25, 0.95);
                    --bg-card: rgba(30, 30, 35, 0.98);
                    --bg-hover: rgba(50, 50, 60, 1);
                    --bg-active: rgba(60, 60, 70, 1);
                    
                    --text-primary: rgba(255, 255, 255, 0.95);
                    --text-secondary: rgba(255, 255, 255, 0.7);
                    --text-muted: rgba(255, 255, 255, 0.5);
                    
                    --border: rgba(255, 255, 255, 0.1);
                    --border-hover: rgba(255, 255, 255, 0.2);
                    
                    --accent-blue: #3b82f6;
                    --accent-green: #10b981;
                    --accent-purple: #8b5cf6;
                    --accent-red: #ef4444;
                    --accent-yellow: #f59e0b;
                    
                    --radius: 12px;
                    --shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                }
                
                :host(.open) {
                    pointer-events: all;
                }
                
                /* === OVERLAY === */
                .overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: var(--bg-overlay);
                    backdrop-filter: blur(20px) saturate(180%);
                    opacity: 0;
                    /* GPU acceleration */
                    transform: translate3d(0, 0, 0);
                    transition: opacity 0.2s ease;
                }
                
                :host(.open) .overlay {
                    opacity: 1;
                }
                
                /* === LAUNCHER PANEL === */
                .launcher {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    width: 800px;
                    max-width: 90vw;
                    max-height: 80vh;
                    background: var(--bg-panel);
                    border: 1px solid var(--border);
                    border-radius: var(--radius);
                    box-shadow: var(--shadow);
                    
                    /* GPU-only animation */
                    transform: translate3d(-50%, -50%, 0) scale(0.95);
                    opacity: 0;
                    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
                                opacity 0.25s ease;
                    
                    overflow: hidden;
                }
                
                :host(.open) .launcher {
                    transform: translate3d(-50%, -50%, 0) scale(1);
                    opacity: 1;
                }
                
                /* === HEADER === */
                .header {
                    padding: 20px 24px;
                    border-bottom: 1px solid var(--border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .header h2 {
                    font-size: 18px;
                    font-weight: 600;
                    color: var(--text-primary);
                    letter-spacing: -0.02em;
                }
                
                .close-btn {
                    width: 32px;
                    height: 32px;
                    border: none;
                    background: transparent;
                    color: var(--text-secondary);
                    border-radius: 6px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.15s ease, color 0.15s ease;
                }
                
                .close-btn:hover {
                    background: var(--bg-hover);
                    color: var(--text-primary);
                }
                
                /* === CONTENT === */
                .content {
                    padding: 24px;
                    overflow-y: auto;
                    max-height: calc(80vh - 80px);
                }
                
                /* === SECTIONS === */
                .section {
                    margin-bottom: 32px;
                }
                
                .section:last-child {
                    margin-bottom: 0;
                }
                
                .section-title {
                    font-size: 12px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    color: var(--text-muted);
                    margin-bottom: 12px;
                }
                
                /* === APP GRID === */
                .app-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                    gap: 12px;
                }
                
                /* === APP CARD === */
                .app-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    padding: 20px 16px;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    overflow: hidden;
                }
                
                .app-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(135deg, transparent, rgba(255,255,255,0.05));
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }
                
                .app-card:hover {
                    background: var(--bg-hover);
                    border-color: var(--border-hover);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                }
                
                .app-card:hover::before {
                    opacity: 1;
                }
                
                .app-card:active {
                    transform: translateY(0);
                }
                
                /* === APP ICON === */
                .app-icon {
                    width: 48px;
                    height: 48px;
                    font-size: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 10px;
                    background: linear-gradient(135deg, var(--icon-color-1), var(--icon-color-2));
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                }
                
                /* Icon colors per app */
                .app-card[data-app="wallet"] {
                    --icon-color-1: #f59e0b;
                    --icon-color-2: #d97706;
                }
                
                .app-card[data-app="passwords"] {
                    --icon-color-1: #3b82f6;
                    --icon-color-2: #2563eb;
                }
                
                .app-card[data-app="vpn"] {
                    --icon-color-1: #10b981;
                    --icon-color-2: #059669;
                }
                
                .app-card[data-app="identity"] {
                    --icon-color-1: #8b5cf6;
                    --icon-color-2: #7c3aed;
                }
                
                .app-card[data-app="extensions"] {
                    --icon-color-1: #6366f1;
                    --icon-color-2: #4f46e5;
                }
                
                .app-card[data-app="profiles"] {
                    --icon-color-1: #ec4899;
                    --icon-color-2: #db2777;
                }
                
                .app-card[data-app="notes"] {
                    --icon-color-1: #f59e0b;
                    --icon-color-2: #d97706;
                }
                
                .app-card[data-app="storage"] {
                    --icon-color-1: #06b6d4;
                    --icon-color-2: #0891b2;
                }
                
                .app-card[data-app="permissions"] {
                    --icon-color-1: #ef4444;
                    --icon-color-2: #dc2626;
                }
                
                .app-card[data-app="network"] {
                    --icon-color-1: #14b8a6;
                    --icon-color-2: #0d9488;
                }
                
                .app-card[data-app="updates"] {
                    --icon-color-1: #8b5cf6;
                    --icon-color-2: #7c3aed;
                }
                
                .app-card[data-app="settings"] {
                    --icon-color-1: #64748b;
                    --icon-color-2: #475569;
                }
                
                /* === APP LABEL === */
                .app-label {
                    font-size: 13px;
                    font-weight: 500;
                    color: var(--text-primary);
                    text-align: center;
                    line-height: 1.3;
                }
                
                .app-description {
                    font-size: 11px;
                    color: var(--text-muted);
                    text-align: center;
                    line-height: 1.3;
                    display: none;
                }
                
                .app-card:hover .app-description {
                    display: block;
                }
                
                /* === SCROLLBAR === */
                .content::-webkit-scrollbar {
                    width: 8px;
                }
                
                .content::-webkit-scrollbar-track {
                    background: transparent;
                }
                
                .content::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 4px;
                }
                
                .content::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.3);
                }
                
                /* === ANIMATIONS === */
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes scaleIn {
                    from { transform: scale(0.9); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
            </style>
            
            <div class="overlay" part="overlay"></div>
            
            <div class="launcher" part="launcher">
                <div class="header">
                    <h2>🔒 Secure Apps</h2>
                    <button class="close-btn" aria-label="Close">✕</button>
                </div>
                
                <div class="content">
                    <!-- Secure Apps Section -->
                    <div class="section">
                        <div class="section-title">🔐 Security</div>
                        <div class="app-grid">
                            <div class="app-card" data-app="wallet" data-risk="high">
                                <div class="app-icon">🔑</div>
                                <div class="app-label">Wallet</div>
                                <div class="app-description">Web3 wallet (all chains)</div>
                            </div>
                            
                            <div class="app-card" data-app="passwords" data-risk="high">
                                <div class="app-icon">🔐</div>
                                <div class="app-label">Passwords</div>
                                <div class="app-description">Zero-knowledge vault</div>
                            </div>
                            
                            <div class="app-card" data-app="vpn" data-risk="medium">
                                <div class="app-icon">🌐</div>
                                <div class="app-label">VPN</div>
                                <div class="app-description">WireGuard tunnel</div>
                            </div>
                            
                            <div class="app-card" data-app="identity" data-risk="high">
                                <div class="app-icon">👤</div>
                                <div class="app-label">Identity</div>
                                <div class="app-description">Passkeys & WebAuthn</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Utilities Section -->
                    <div class="section">
                        <div class="section-title">🧩 Utilities</div>
                        <div class="app-grid">
                            <div class="app-card" data-app="extensions" data-risk="low">
                                <div class="app-icon">🧩</div>
                                <div class="app-label">Extensions</div>
                                <div class="app-description">Manage extensions</div>
                            </div>
                            
                            <div class="app-card" data-app="profiles" data-risk="low">
                                <div class="app-icon">👥</div>
                                <div class="app-label">Profiles</div>
                                <div class="app-description">Work, personal, anonymous</div>
                            </div>
                            
                            <div class="app-card" data-app="notes" data-risk="medium">
                                <div class="app-icon">📝</div>
                                <div class="app-label">Secure Notes</div>
                                <div class="app-description">Encrypted notes</div>
                            </div>
                            
                            <div class="app-card" data-app="storage" data-risk="medium">
                                <div class="app-icon">💾</div>
                                <div class="app-label">Storage</div>
                                <div class="app-description">Encrypted files</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- System Section -->
                    <div class="section">
                        <div class="section-title">⚙️ System</div>
                        <div class="app-grid">
                            <div class="app-card" data-app="permissions" data-risk="low">
                                <div class="app-icon">🛡️</div>
                                <div class="app-label">Permissions</div>
                                <div class="app-description">Manage access</div>
                            </div>
                            
                            <div class="app-card" data-app="network" data-risk="low">
                                <div class="app-icon">🌐</div>
                                <div class="app-label">Network</div>
                                <div class="app-description">DNS, proxy, routing</div>
                            </div>
                            
                            <div class="app-card" data-app="updates" data-risk="low">
                                <div class="app-icon">🔄</div>
                                <div class="app-label">Updates</div>
                                <div class="app-description">Check for updates</div>
                            </div>
                            
                            <div class="app-card" data-app="settings" data-risk="low">
                                <div class="app-icon">⚙️</div>
                                <div class="app-label">Settings</div>
                                <div class="app-description">Browser settings</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        const shadow = this.shadowRoot;

        // Close button
        const closeBtn = shadow.querySelector('.close-btn');
        const overlay = shadow.querySelector('.overlay');

        closeBtn?.addEventListener('click', () => this.close());
        overlay?.addEventListener('click', () => this.close());

        // App cards
        const appCards = shadow.querySelectorAll('.app-card');
        appCards.forEach(card => {
            card.addEventListener('click', (e) => {
                const appId = card.getAttribute('data-app');
                const risk = card.getAttribute('data-risk');
                this.launchApp(appId, risk);
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    // Public API
    open() {
        this.isOpen = true;
        this.classList.add('open');
        this.dispatchEvent(new CustomEvent('launcher-open'));
    }

    close() {
        this.isOpen = false;
        this.classList.remove('open');
        this.dispatchEvent(new CustomEvent('launcher-close'));

        // Security: Clear any sensitive state
        this.activeApp = null;
    }

    async launchApp(appId, riskLevel) {
        console.log(`[SecureLauncher] Launching app: ${appId} (risk: ${riskLevel})`);

        // Dispatch event for parent to handle
        this.dispatchEvent(new CustomEvent('app-launch', {
            detail: { appId, riskLevel }
        }));

        // Close launcher after launch
        this.close();
    }

    cleanup() {
        // Memory cleanup
        this.activeApp = null;
        console.log('[SecureLauncher] Cleaned up');
    }
}

// Register the custom element
customElements.define('secure-launcher', SecureLauncher);

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecureLauncher;
}
