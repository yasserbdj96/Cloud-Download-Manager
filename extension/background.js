let API_BASE = ''; // Initialize as empty
let isServerActive = false;
let isInterceptionEnabled = true;
const pendingDownloads = new Map();

// Load API URL from storage on startup
chrome.storage.local.get(['apiUrl'], (result) => {
  API_BASE = result.apiUrl || '';
  if (!API_BASE) {
    console.error('API URL is not set. Please configure it in the extension settings.');
  }
});

// Initialize with stored value on service worker startup
chrome.storage.local.get(['interceptEnabled'], (result) => {
  isInterceptionEnabled = result.interceptEnabled ?? true;
  updateIcon();
});

// Server status management
async function checkServerStatus() {
  if (!API_BASE) return; // Skip if API URL is not set
  try {
    const response = await fetch(`${API_BASE}/status`);
    isServerActive = response.ok;
  } catch (error) {
    isServerActive = false;
  }
  updateIcon();
}

function updateIcon() {
  const iconState = isServerActive ? 'active' : 'inactive';
  chrome.action.setIcon({
    path: {
      16: `icons/${iconState}16.png`,
      32: `icons/${iconState}32.png`,
      48: `icons/${iconState}48.png`,
      128: `icons/${iconState}128.png`
    }
  });
}

async function handleDownloadInterception(downloadItem) {
  if (!isInterceptionEnabled || !isServerActive || !API_BASE) return;
  if (!downloadItem.url.startsWith('http')) return;

  try {
    await chrome.downloads.cancel(downloadItem.id);
    const notificationId = `dl-${Date.now()}`;
    
    // Extract filename from URL if not provided
    const filename = downloadItem.filename || extractFilenameFromUrl(downloadItem.url);
    
    pendingDownloads.set(notificationId, {
      url: downloadItem.url,
      filename: filename
    });

    chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: 'icons/active128.png',
      title: 'Cloud Download Manager',
      message: `Download "${filename}"?`, // Use extracted filename
      buttons: [
        { title: 'Download', iconUrl: 'icons/active32.png' }
      ],
      priority: 2
    });
  } catch (error) {
    console.error('Interception failed:', error);
  }
}

// Add this helper function
function extractFilenameFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split('/').pop() || 'download';
  } catch {
    return 'download';
  }
}

// Context menu
function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "downloadWithManager",
      title: "Download with Cloud Manager",
      contexts: ["link"]
    });
  });
}

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case 'toggleInterception':
      isInterceptionEnabled = request.value;
      chrome.storage.local.set({ interceptEnabled: request.value });
      updateIcon(); // Keep icon in sync
      sendResponse({ success: true });
      break;
      
    case 'getStatus':
      sendResponse({ 
        isActive: isServerActive && isInterceptionEnabled 
      });
      break;
      
    default:
      sendResponse({ error: 'Invalid message type' });
  }
  return true;
});

// Notification handling
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  const download = pendingDownloads.get(notificationId);
  if (!download) return;

  try {
    if (buttonIndex === 0) {
      await fetch(`${API_BASE}/add`, {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: `url=${encodeURIComponent(download.url)}`
      });
    } else {
      await chrome.downloads.download({
        url: download.url,
        filename: download.filename,
        conflictAction: 'uniquify'
      });
    }
  } catch (error) {
    console.error('Download handling failed:', error);
  } finally {
    pendingDownloads.delete(notificationId);
    chrome.notifications.clear(notificationId);
  }
});

// Event listeners
chrome.runtime.onInstalled.addListener(() => {
  setupContextMenu();
  chrome.alarms.create('statusCheck', { periodInMinutes: 0.083 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'statusCheck') checkServerStatus();
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "downloadWithManager" && info.linkUrl) {
    fetch(`${API_BASE}/add`, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: `url=${encodeURIComponent(info.linkUrl)}`
    }).catch(console.error);
  }
});

chrome.downloads.onCreated.addListener(handleDownloadInterception);

// Initial setup
checkServerStatus();
setupContextMenu();