/**
 * Smart Browser Hamburger Menu System
 * Using Lucide icons
 */

let menuOpen = false;
let advancedOpen = false;

const hamburgerBtn = document.getElementById('hamburgerBtn');
const hamburgerMenu = document.getElementById('hamburgerMenu');
const modalOverlay = document.getElementById('modalOverlay');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalContent = document.getElementById('modalContent');
const modalClose = document.getElementById('modalClose');
const advancedSubmenu = document.getElementById('advancedSubmenu');
const appContainer = document.querySelector('.app-container');

// Session Settings State
const currentSettings = {
  theme: 'dark-neon',
  tone: 'teal',
  reducedMotion: false,
  blurEnabled: true,
  wallpaper: null
};

function toggleMenu() {
  menuOpen = !menuOpen;
  hamburgerMenu.classList.toggle('open', menuOpen);
  hamburgerBtn.classList.toggle('active', menuOpen);
  // Hide BrowserViews when menu is open so they don't overlap
  if (window.electronAPI && window.electronAPI.toggleViews) {
    window.electronAPI.toggleViews(!menuOpen);
  }
}

function closeMenu() {
  menuOpen = false;
  hamburgerMenu.classList.remove('open');
  hamburgerBtn.classList.remove('active');
  // Show BrowserViews when menu closes
  if (window.electronAPI && window.electronAPI.toggleViews) {
    window.electronAPI.toggleViews(true);
  }
}

hamburgerBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleMenu();
});

document.addEventListener('click', (e) => {
  if (menuOpen && !hamburgerMenu.contains(e.target)) closeMenu();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (modalOverlay.classList.contains('open')) closeModal();
    else if (menuOpen) closeMenu();
  }
});

function openModal(title, content) {
  modalTitle.textContent = title;
  modalContent.innerHTML = content;
  modalOverlay.classList.add('open');
  closeMenu();
  // Re-init icons in modal
  if (window.lucide) lucide.createIcons();
}

function closeModal() {
  modalOverlay.classList.remove('open');
}

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

const menuActions = {
  profile: () => openModal('Profile', `
    <div class="settings-section">
      <h4>Current Profile</h4>
      <div class="profile-card">
        <div class="profile-avatar"><i data-lucide="user-circle"></i></div>
        <div>
          <div class="profile-name">Default</div>
          <div class="profile-type">Personal</div>
        </div>
      </div>
      <button class="settings-btn">Switch Profile</button>
      <button class="settings-btn">Create New</button>
    </div>`),

  security: () => openModal('Security & Passkeys', `
    <div class="settings-section">
      <h4>Passkeys</h4>
      <div class="passkey-item">
        <i data-lucide="key-round"></i>
        <span>Windows Hello</span>
        <button class="btn-small">Revoke</button>
      </div>
      <button class="settings-btn primary">Add Passkey</button>
    </div>
    <div class="settings-section">
      <h4>Approval Rules</h4>
      <div class="toggle-row"><span>Require passkey for purchases</span><input type="checkbox" checked></div>
    </div>`),

  appearance: () => {
    openModal('Appearance', `
      <div class="appearance-grid">
        <div class="appearance-section">
          <div class="appearance-section-title">
            <span>Theme</span>
            <i data-lucide="paintbrush" class="icon-small"></i>
          </div>
          <div class="theme-selector">
            <div class="theme-card ${currentSettings.theme === 'dark-neon' ? 'active' : ''}" data-theme="dark-neon">
              <div class="theme-preview dark"></div>
              <span class="theme-label">Dark Neon</span>
            </div>
            <div class="theme-card ${currentSettings.theme === 'light-glass' ? 'active' : ''}" data-theme="light-glass">
              <div class="theme-preview light"></div>
              <span class="theme-label">Light Glass</span>
            </div>
          </div>
        </div>

        <div class="appearance-section">
          <div class="appearance-section-title">
            <span>Effects</span>
            <i data-lucide="settings-2" class="icon-small"></i>
          </div>
          <div class="effects-list">
            <div class="effect-item">
              <span class="effect-label">Reduced Motion</span>
              <label class="toggle-switch">
                <input type="checkbox" id="toggleReducedMotion" ${currentSettings.reducedMotion ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
            </div>
            <div class="effect-item">
              <span class="effect-label">Background Blur</span>
              <label class="toggle-switch">
                <input type="checkbox" id="toggleBlur" ${currentSettings.blurEnabled ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
            </div>
          </div>
        </div>

        <div class="appearance-section">
          <div class="appearance-section-title">
            <span>Wallpaper</span>
            <i data-lucide="image" class="icon-small"></i>
          </div>
          <div class="wallpaper-box">
            <div class="wallpaper-preview" id="wallpaperPreview" style="background-image: ${currentSettings.wallpaper ? `url(${currentSettings.wallpaper})` : 'none'}"></div>
            <button class="action-btn" id="uploadWallpaperBtn">Change Wallpaper</button>
            <input type="file" id="wallpaperInput" accept="image/*" style="display: none">
          </div>
        </div>

        <div class="appearance-section">
          <div class="appearance-section-title">
            <span>Color Tones</span>
            <i data-lucide="palette" class="icon-small"></i>
          </div>
          <div class="tone-selector">
            <div class="tone-swatch ${currentSettings.tone === 'blue' ? 'active' : ''}" data-tone="blue"><span class="tone-label-text">Blue</span></div>
            <div class="tone-swatch ${currentSettings.tone === 'teal' ? 'active' : ''}" data-tone="teal"><span class="tone-label-text">Teal</span></div>
            <div class="tone-swatch ${currentSettings.tone === 'purple' ? 'active' : ''}" data-tone="purple"><span class="tone-label-text">Purple</span></div>
            <div class="tone-swatch ${currentSettings.tone === 'gold' ? 'active' : ''}" data-tone="gold"><span class="tone-label-text">Gold</span></div>
            <div class="tone-swatch ${currentSettings.tone === 'white' ? 'active' : ''}" data-tone="white"><span class="tone-label-text">White</span></div>
          </div>
        </div>
      </div>
    `);

    // Attach logic
    const themeCards = modalContent.querySelectorAll('.theme-card');
    themeCards.forEach(card => {
      card.onclick = () => {
        themeCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        currentSettings.theme = card.dataset.theme;
        document.documentElement.setAttribute('data-theme', currentSettings.theme);
      };
    });

    const toneSwatches = modalContent.querySelectorAll('.tone-swatch');
    toneSwatches.forEach(swatch => {
      swatch.onclick = () => {
        toneSwatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        currentSettings.tone = swatch.dataset.tone;
        document.documentElement.setAttribute('data-tone', currentSettings.tone);
      };
    });

    const toggleReduced = modalContent.querySelector('#toggleReducedMotion');
    toggleReduced.onchange = () => {
      currentSettings.reducedMotion = toggleReduced.checked;
      document.body.classList.toggle('reduced-motion', currentSettings.reducedMotion);
    };

    const toggleBlur = modalContent.querySelector('#toggleBlur');
    toggleBlur.onchange = () => {
      currentSettings.blurEnabled = toggleBlur.checked;
      appContainer.classList.toggle('blur-enabled', currentSettings.blurEnabled);
    };

    const wallpaperInput = modalContent.querySelector('#wallpaperInput');
    const uploadBtn = modalContent.querySelector('#uploadWallpaperBtn');
    const wallPreview = modalContent.querySelector('#wallpaperPreview');

    uploadBtn.onclick = () => wallpaperInput.click();
    wallpaperInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (re) => {
          currentSettings.wallpaper = re.target.result;
          wallPreview.style.backgroundImage = `url(${currentSettings.wallpaper})`;
          document.body.style.backgroundImage = `url(${currentSettings.wallpaper})`;
          document.body.style.backgroundSize = 'cover';
          document.body.style.backgroundPosition = 'center';
        };
        reader.readAsDataURL(file);
      }
    };
  },

  layout: () => openModal('Layout & Interaction', `
    <div class="settings-section">
      <h4>Hover</h4>
      <div class="toggle-row"><span>Hover zoom on windows</span><input type="checkbox" checked></div>
    </div>
    <div class="settings-section">
      <h4>Fullscreen</h4>
      <div class="toggle-row"><span>Double-click for fullscreen</span><input type="checkbox" checked></div>
    </div>`),

  agents: () => openModal('Agent Manager', `
    <div class="settings-section">
      <h4>Limits</h4>
      <div class="slider-row"><span>Max Parallel Agents</span><input type="range" min="1" max="8" value="4"></div>
    </div>
    <div class="settings-section">
      <h4>Permissions</h4>
      <div class="toggle-row"><span>Allow navigation</span><input type="checkbox" checked></div>
      <div class="toggle-row"><span>Allow purchases (passkey)</span><input type="checkbox"></div>
    </div>`),

  automation: () => openModal('Automation Rules', `
    <div class="settings-section">
      <h4>Saved Prompts</h4>
      <p class="settings-hint">No automations yet</p>
      <button class="settings-btn primary">Create Automation</button>
    </div>`),

  policies: () => openModal('Policies', `
    <div class="settings-section">
      <h4>Active Policies</h4>
      <div class="policy-item">
        <i data-lucide="shield"></i>
        <span>Purchase Limit · $50</span>
        <span class="badge">Active</span>
      </div>
      <div class="policy-item">
        <i data-lucide="mail"></i>
        <span>Email Read-Only</span>
        <span class="badge">Active</span>
      </div>
      <button class="settings-btn primary">Create Policy</button>
    </div>`),

  audit: () => openModal('Audit & Logs', `
    <div class="settings-section">
      <h4>Recent Actions</h4>
      <div class="audit-item">Navigate · google.com · 01:35:22</div>
      <button class="settings-btn">Export Audit Data</button>
    </div>`),

  'browser-settings': () => openModal('Browser Settings', `
    <div class="settings-section">
      <h4>Privacy</h4>
      <div class="toggle-row"><span>Block third-party cookies</span><input type="checkbox" checked></div>
      <div class="toggle-row"><span>Block dangerous downloads</span><input type="checkbox" checked></div>
    </div>`),

  storage: () => openModal('Data & Storage', `
    <div class="settings-section">
      <h4>Storage</h4>
      <div class="storage-bar"><div class="storage-fill" style="width:23%"></div></div>
      <p class="settings-hint">127 MB used</p>
      <button class="settings-btn">Clear Cache</button>
      <button class="settings-btn danger">Reset All</button>
    </div>`),

  'toggle-advanced': () => {
    advancedOpen = !advancedOpen;
    advancedSubmenu.classList.toggle('open', advancedOpen);
  },

  about: () => openModal('Smart Browser', `
    <div class="about-content">
      <div class="about-logo"><i data-lucide="flame"></i></div>
      <h2>Smart Browser</h2>
      <p>Version 0.1.0</p>
      <p>Chromium v120 · Electron v28</p>
      <p class="about-copyright">© 2026 Smart Browser</p>
    </div>`),

  quit: () => { if (confirm('Quit Smart Browser?')) window.close(); },
};

hamburgerMenu.addEventListener('click', (e) => {
  const item = e.target.closest('.menu-item');
  if (item && menuActions[item.dataset.action]) {
    menuActions[item.dataset.action]();
  }
});

console.log('[Menu] Loaded');
