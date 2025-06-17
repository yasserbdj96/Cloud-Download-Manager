const eventSource = new EventSource('/updates');
const activeList = document.getElementById('active-downloads');
const completedList = document.getElementById('completed-downloads');
let currentDownloads = [];
let tooltipInstances = [];

// Theme handling
const themeToggle = document.getElementById('themeToggle');
const currentTheme = localStorage.getItem('theme') || 'light';
document.body.setAttribute('data-theme', currentTheme);
updateThemeIcon();

themeToggle.addEventListener('click', () => {
    const newTheme = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon();
});

function updateThemeIcon() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    themeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    themeToggle.classList.toggle('btn-dark', isDark);
    themeToggle.classList.toggle('btn-secondary', !isDark);
}

// Utility functions
function formatSpeed(bytesPerSec) {
    if(bytesPerSec === 0) return '0 KB/s';
    const kb = bytesPerSec / 1024;
    return `${kb.toFixed(1)} KB/s`;
}

function formatFileSize(bytes) {
    if(bytes === 0 || !bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function formatTimeRemaining(seconds) {
    if(!seconds || seconds < 0) return '--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${secs}s`;
}

function formatCompletionTime(isoString) {
    if(!isoString) return '--';
    const date = new Date(isoString);
    return date.toLocaleString();
}

// Rendering functions
function renderDownloads(downloads) {
    currentDownloads = downloads;
    const [activeDownloads, completedDownloads] = downloads.reduce((acc, download) => {
        acc[download.status === 'completed' ? 1 : 0].push(download);
        return acc;
    }, [[], []]);

    activeList.innerHTML = activeDownloads.map(download => createDownloadItem(download)).join('');
    completedList.innerHTML = completedDownloads.map(download => createDownloadItem(download)).join('');

    tooltipInstances.forEach(instance => instance.dispose());
    tooltipInstances = [];

    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipTriggerList.forEach(triggerEl => {
        const tooltip = new bootstrap.Tooltip(triggerEl, {
            trigger: 'hover',
            delay: { show: 100, hide: 50 },
            placement: 'top'
        });
        tooltipInstances.push(tooltip);
    });
}

function createDownloadItem(download) {
    return `
    <div class="list-group-item download-item mb-2" data-id="${download.id}">
        <div class="d-flex justify-content-between align-items-center mb-2">
            <div class="d-flex align-items-center" style="min-width: 0;">
                ${getStatusIcon(download)}
                <div style="min-width: 0;">
                    <h5 class="mb-0 filename" title="${download.filename}">${download.filename}</h5>
                    <small class="text-muted url-text" 
                           data-bs-toggle="tooltip" 
                           data-bs-placement="top"
                           title="${download.url}">${download.url}</small>
                    <div class="d-flex gap-2 flex-wrap">
                        ${download.status === 'downloading' ? `
                            <div class="speed-display mt-1">
                                Speed: ${formatSpeed(download.speed)}
                            </div>
                            <div class="time-info mt-1">
                                Remaining: ${formatTimeRemaining(download.time_remaining)}
                            </div>
                        ` : ''}
                        ${download.status === 'completed' ? `
                            <div class="time-info mt-1">
                                Completed: ${formatCompletionTime(download.completed_at)}
                            </div>
                        ` : ''}
                        <div class="size-info mt-1">
                            ${download.size ? 
                             `${formatFileSize(download.downloaded)} of ${formatFileSize(download.size)}` : 
                             formatFileSize(download.downloaded)}
                        </div>
                    </div>
                </div>
            </div>
            <div class="btn-group">
                ${getActionButtons(download)}
            </div>
        </div>
        <div class="d-flex justify-content-between align-items-center">
            <div class="progress flex-grow-1 me-3">
                <div class="progress-bar ${getProgressBarClass(download)}" 
                    role="progressbar" 
                    style="width: ${download.progress}%">
                    ${download.progress}%
                </div>
            </div>
            <span class="badge status-badge ${getStatusClass(download)}">
                ${download.status.split(':')[0]}
            </span>
        </div>
    </div>
    `;
}

function getStatusIcon(download) {
    const status = download.status.split(':')[0];
    if (status === 'completed') 
        return '<i class="fas fa-check-circle text-success me-3 fs-4"></i>';
    if (status === 'failed') 
        return '<i class="fas fa-times-circle text-danger me-3 fs-4"></i>';
    if (status === 'downloading') 
        return '<i class="fas fa-spinner spinner"></i>';
    if (status === 'paused') 
        return '<i class="fas fa-pause-circle text-warning me-3 fs-4"></i>';
    return '<i class="fas fa-clock me-3 fs-4"></i>';
}

function getActionButtons(download) {
    let buttons = '';
    const status = download.status.split(':')[0];
    
    if (status === 'downloading') {
        buttons += '<button class="btn btn-sm btn-warning pause-btn"><i class="fas fa-pause"></i></button>';
    } else if (['paused', 'failed'].includes(status)) {
        buttons += '<button class="btn btn-sm btn-success resume-btn"><i class="fas fa-play"></i></button>';
    }
    
    if (status !== 'completed') {
        buttons += `
            <button class="btn btn-sm btn-info ms-2 edit-btn">
                <i class="fas fa-edit"></i>
            </button>
        `;
    }
    
    if (status === 'completed') {
        buttons += `
            <button class="btn btn-sm btn-success open-file-btn ms-2">
                <i class="fas fa-file me-1"></i>Open
            </button>
            <button class="btn btn-sm btn-secondary open-folder-btn ms-2">
                <i class="fas fa-folder-open me-1"></i>Folder
            </button>
        `;
    }
    
    buttons += `
        <button class="btn btn-sm btn-danger ms-2 delete-btn">
            <i class="fas fa-trash"></i>
        </button>
    `;
    return buttons;
}

function getProgressBarClass(download) {
    const status = download.status.split(':')[0];
    if (status === 'completed') return 'bg-success';
    if (status === 'failed') return 'bg-danger';
    if (status === 'paused') return 'bg-warning';
    return 'bg-info';
}

function getStatusClass(download) {
    const status = download.status.split(':')[0];
    if (status === 'completed') return 'bg-success';
    if (status === 'failed') return 'bg-danger';
    if (status === 'paused') return 'bg-warning';
    if (status === 'downloading') return 'bg-info';
    return 'bg-secondary';
}

// Event listeners
eventSource.onmessage = (e) => renderDownloads(JSON.parse(e.data));

document.getElementById('addForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    await fetch('/add', { method: 'POST', body: formData });
    e.target.reset();
});

document.getElementById('configForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    // Add path validation if needed
    const downloadPath = formData.get('download_path');
    if (!downloadPath || downloadPath.trim() === '') {
        alert('Download path cannot be empty.');
        return;
    }

    await fetch('/config', { method: 'POST', body: formData });
    bootstrap.Modal.getInstance(document.getElementById('settingsModal')).hide();
});

document.addEventListener('click', (e) => {
    const downloadItem = e.target.closest('.download-item');
    if (!downloadItem) return;
    
    const downloadId = parseInt(downloadItem.dataset.id);
    
    if (e.target.closest('.pause-btn')) {
        fetch(`/pause/${downloadId}`);
    } else if (e.target.closest('.resume-btn')) {
        fetch(`/resume/${downloadId}`);
    } else if (e.target.closest('.delete-btn')) {
        fetch(`/remove/${downloadId}`, { method: 'DELETE' });
    } else if (e.target.closest('.edit-btn')) {
        const download = currentDownloads.find(d => d.id === downloadId);
        const form = document.getElementById('editForm');
        form.elements.url.value = download.url;
        form.elements.speed_limit.value = Math.round((download.speed_limit || 0) / 1024);
        form.elements.download_id.value = downloadId;
        new bootstrap.Modal(document.getElementById('editModal')).show();
    } else if (e.target.closest('.open-file-btn')) {
        fetch(`/open_file/${downloadId}`);
    } else if (e.target.closest('.open-folder-btn')) {
        fetch(`/open_folder/${downloadId}`);
    }
});

document.getElementById('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    await fetch(`/edit/${formData.get('download_id')}`, {
        method: 'POST',
        body: new URLSearchParams(formData)
    });
    bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
});