let API_BASE = ''; // Initialize as empty
let eventSource = null;

document.addEventListener('DOMContentLoaded', async () => {
  initializeUI();
  setupEventListeners();
  await loadInitialData();
  await checkServerStatus(); // Update the status indicator on load
});

function initializeUI() {
  const statusIndicator = document.createElement('div');
  statusIndicator.className = 'status-indicator';
  document.body.prepend(statusIndicator);
}

function setupEventListeners() {
  document.getElementById('downloadBtn').addEventListener('click', handleAddDownload);
  document.getElementById('saveConfig').addEventListener('click', handleSaveConfig);
  document.getElementById('interceptToggle').addEventListener('change', handleToggleChange);
  document.getElementById('saveApiUrl').addEventListener('click', handleSaveApiUrl);
  document.getElementById('deleteApiUrl').addEventListener('click', handleDeleteApiUrl);
  document.getElementById('activeDownloads').addEventListener('click', handleDownloadAction);
  document.querySelectorAll('.section-toggle').forEach(toggle => {
    toggle.addEventListener('click', handleSectionToggle);
  });
}

async function loadInitialData() {
  await loadApiUrl(); // Load API URL first
  if (!API_BASE) {
    promptForApiUrl(); // Prompt user if API URL is not set
    return;
  }
  await loadConfig();
  setupSSE();
  await loadSectionStates();
  chrome.storage.local.get(['interceptEnabled'], (result) => {
    document.getElementById('interceptToggle').checked = result.interceptEnabled ?? false;
  });
}

async function loadConfig() {
  try {
    const response = await fetch(`${API_BASE}/config`);
    const config = await response.json();
    document.getElementById('maxConcurrent').value = config.max_concurrent;
    document.getElementById('speedLimit').value = config.download_speed;
    document.getElementById('downloadPath').value = config.download_path; // Added line
  } catch (error) {
    showMessage('Failed to load settings', 'error');
  }
}

function setupSSE() {
  if (eventSource) eventSource.close();

  eventSource = new EventSource(`${API_BASE}/updates`);

  eventSource.onmessage = (event) => {
    try {
      const allDownloads = JSON.parse(event.data);
      const active = allDownloads.filter(d => d.status !== 'completed');
      const completed = allDownloads.filter(d => d.status === 'completed');
      renderDownloads(active, completed);
    } catch (error) {
      console.error('SSE Error:', error);
    }
  };

  eventSource.onerror = () => {
    setTimeout(setupSSE, 3000);
  };
}

function renderDownloads(active, completed) {
  const activeContainer = document.getElementById('activeDownloads');
  const completedContainer = document.getElementById('completedDownloads');

  activeContainer.innerHTML = active.length > 0 ? 
    active.map(createActiveDownloadItem).join('') :
    '<div class="empty-state">No active downloads</div>';

  completedContainer.innerHTML = completed.length > 0 ? 
    completed.map(createCompletedDownloadItem).join('') :
    '<div class="empty-state">No completed downloads yet</div>';
  
  // Only update visibility if section is expanded
  ['active', 'completed'].forEach(section => {
    const header = document.querySelector(`.section-toggle[data-section="${section}"]`);
    if (!header.getAttribute('aria-expanded')) return;
    const content = header.nextElementSibling;
    content.style.height = content.scrollHeight + 'px';
  });
}

function createActiveDownloadItem(download) {
  return `
    <div class="download-item" data-id="${download.id}">
      <div class="download-info">
        <div class="filename">${download.filename}</div>
        <div class="progress-container">
          <div class="progress-bar" style="width: ${download.progress}%"></div>
        </div>
        <div class="meta-info">
          <span>${formatBytes(download.downloaded)}/${formatBytes(download.size)}</span>
          <span>${formatSpeed(download.speed)}</span>
          <span>${formatTime(download.time_remaining)}</span>
        </div>
      </div>
      <div class="action-buttons">
        ${download.status === 'downloading' ? 
          '<button class="pause-btn"><i class="fas fa-pause"></i> Pause</button>' : 
          '<button class="resume-btn"><i class="fas fa-play"></i> Resume</button>'}
        <button class="remove-btn"><i class="fas fa-trash"></i> Remove</button>
      </div>
    </div>
  `;
}

function createCompletedDownloadItem(download) {
  return `
    <div class="completed-item">
      <div class="filename">${download.filename}</div>
      <div class="completed-info">
        <span>${formatBytes(download.size)}</span>
        <span>${new Date(download.completed_at).toLocaleDateString()}</span>
      </div>
    </div>
  `;
}

// Keep all other functions (handleDownloadAction, handleAddDownload, etc.) the same as previous version



// Download Actions
async function handleDownloadAction(event) {
  const button = event.target.closest('button');
  if (!button) return;

  const downloadItem = button.closest('.download-item');
  const downloadId = downloadItem?.dataset.id;
  if (!downloadId) return;

  try {
    if (button.classList.contains('pause-btn')) {
      await fetch(`${API_BASE}/pause/${downloadId}`);
      showMessage('Download paused', 'success');
    } 
    else if (button.classList.contains('resume-btn')) {
      await fetch(`${API_BASE}/resume/${downloadId}`);
      showMessage('Download resumed', 'success');
    } 
    else if (button.classList.contains('remove-btn')) {
      await fetch(`${API_BASE}/remove/${downloadId}`, { method: 'DELETE' });
      showMessage('Download removed', 'success');
    }
  } catch (error) {
    showMessage(`Action failed: ${error.message}`, 'error');
  }
}

// Add New Download
async function handleAddDownload() {
  const urlInput = document.getElementById('urlInput');
  const url = urlInput.value.trim();
  if (!url) return;

  try {
    const response = await fetch(`${API_BASE}/add`, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: `url=${encodeURIComponent(url)}`
    });

    if (!response.ok) throw new Error('Failed to add download');
    
    urlInput.value = '';
    showMessage('Download added to queue', 'success');
  } catch (error) {
    showMessage(`Add failed: ${error.message}`, 'error');
  }
}

// Configuration Saving
async function handleSaveConfig() {
  const max = parseInt(document.getElementById('maxConcurrent').value) || 3;
  const speed = parseInt(document.getElementById('speedLimit').value) || 0;
  const downloadPath = document.getElementById('downloadPath').value.trim(); // Added line

  try {
    const response = await fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: `max_concurrent=${max}&download_speed=${speed * 1024}&download_path=${encodeURIComponent(downloadPath)}` // Updated line
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Save failed');
    }

    showMessage('Settings saved successfully', 'success');
    await loadConfig();
  } catch (error) {
    showMessage(`Save failed: ${error.message}`, 'error');
  }
}

// Status Indicator
async function checkServerStatus() {
  try {
    const response = await fetch(`${API_BASE}/status`);
    updateStatusIndicator(response.ok);
  } catch (error) {
    updateStatusIndicator(false);
  }
}

function updateStatusIndicator(serverActive) {
  const indicator = document.querySelector('.status-indicator');
  if (!indicator) return;

  indicator.style.backgroundColor = serverActive ? '#4CAF50' : '#f44336'; // Green for active, red for inactive
}

// Toggle Handler
function handleToggleChange(event) {
  const isChecked = event.target.checked;
  // Save state to storage
  chrome.storage.local.set({ interceptEnabled: isChecked });

  chrome.runtime.sendMessage({
    type: 'toggleInterception',
    value: isChecked
  }, (response) => {
    if (chrome.runtime.lastError || !response?.success) {
      showMessage('Failed to update interception', 'error');
      event.target.checked = !isChecked;
      chrome.storage.local.set({ interceptEnabled: !isChecked }); // Revert storage
    }
  });
}

// Helper Functions
function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function formatSpeed(bytesPerSec) {
  return bytesPerSec ? `${formatBytes(bytesPerSec)}/s` : '';
}

function formatTime(seconds) {
  if (!seconds || seconds < 0) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m remaining`;
}

function showMessage(text, type) {
  const message = document.createElement('div');
  message.className = `message ${type}`;
  message.textContent = text;
  document.body.appendChild(message);
  setTimeout(() => message.remove(), 3000);
}


// popup.js
function createActiveDownloadItem(download) {
  const statusClass = download.status.startsWith('failed') ? 'failed' :
  download.status === 'paused' ? 'paused' :
  download.status === 'downloading' ? 'downloading' :
  'queued';

const statusText = download.status.startsWith('failed') ? 'Failed' :
  download.status === 'paused' ? 'Paused' :
  download.status === 'downloading' ? 'Downloading' :
  'Queued';

  return `
    <div class="download-item" data-id="${download.id}">
      <div class="filename">${download.filename}</div>
      <div class="status-message ${statusClass}">
        ${statusText}
      </div>
      <div class="progress-container">
        <div class="progress-bar" style="width: ${download.progress}%"></div>
      </div>
      <div class="download-meta">
        <span>${formatBytes(download.downloaded)}/${formatBytes(download.size)}</span>
        <span>${formatSpeed(download.speed)}</span>
        <span>${formatTime(download.time_remaining)}</span>
      </div>
      <div class="action-buttons">
        ${download.status === 'downloading' ? 
          '<button class="pause-btn"><i class="fas fa-pause"></i> Pause</button>' : 
          '<button class="resume-btn"><i class="fas fa-play"></i> Resume</button>'}
        <button class="remove-btn"><i class="fas fa-trash"></i> Remove</button>
      </div>
    </div>
  `;
}

function createCompletedDownloadItem(download) {
  return `
    <div class="download-item">
      <div class="filename">${download.filename}</div>
      <div class="download-meta">
        <span>${formatBytes(download.size)}</span>
        <span>${new Date(download.completed_at).toLocaleDateString()}</span>
      </div>
    </div>
  `;
}

// Add these constants at the top
const SECTION_STATES = {
  active: true,
  completed: false,
  settings: false
};

// Add these new functions
function handleSectionToggle(event) {
  const header = event.target.closest('.section-toggle');
  const section = header.dataset.section;
  const content = header.nextElementSibling;
  const isVisible = content.classList.toggle('is-visible');
  
  // Update aria attribute
  header.setAttribute('aria-expanded', isVisible);
  
  // Save state
  chrome.storage.local.set({ [section]: isVisible });
}

async function loadSectionStates() {
  return new Promise(resolve => {
    chrome.storage.local.get(Object.keys(SECTION_STATES), result => {
      Object.entries(SECTION_STATES).forEach(([section, defaultValue]) => {
        const isVisible = result[section] ?? defaultValue;
        const header = document.querySelector(`.section-toggle[data-section="${section}"]`);
        const content = header.nextElementSibling;
        
        content.classList.toggle('is-visible', isVisible);
        header.setAttribute('aria-expanded', isVisible);
      });
      resolve();
    });
  });
}

function promptForApiUrl() {
  const apiUrlInput = document.getElementById('apiUrlInput');
  apiUrlInput.focus();
  showMessage('Please enter the API URL to use the extension', 'info');
}

async function loadApiUrl() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['apiUrl'], (result) => {
      API_BASE = result.apiUrl || '';
      document.getElementById('apiUrlInput').value = API_BASE;
      resolve();
    });
  });
}

function handleSaveApiUrl() {
  const apiUrlInput = document.getElementById('apiUrlInput');
  const newApiUrl = apiUrlInput.value.trim();
  if (!newApiUrl) {
    showMessage('API URL cannot be empty', 'error');
    return;
  }
  API_BASE = newApiUrl;
  chrome.storage.local.set({ apiUrl: newApiUrl }, () => {
    showMessage('API URL saved successfully. Restarting extension...', 'success');
    setTimeout(() => {
      chrome.runtime.reload(); // Reload the extension
    }, 1000); // Add a short delay to show the success message
  });
}

function handleDeleteApiUrl() {
  chrome.storage.local.remove(['apiUrl'], () => {
    API_BASE = '';
    document.getElementById('apiUrlInput').value = '';
    showMessage('API URL deleted. Please set a new URL to continue.', 'success');
    setTimeout(() => {
      chrome.runtime.reload(); // Reload the extension
    }, 1000); // Add a short delay to show the success message
    promptForApiUrl();
  });
}