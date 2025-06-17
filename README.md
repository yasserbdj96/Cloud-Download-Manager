<div align="center">
  <img src="https://raw.githubusercontent.com/yasserbdj96/Cloud-Download-Manager/main/Screenshots/logo.png" alt="hiphp by yasserbdj96" height="300">
</div>

# 🌩️ Cloud Download Manager 
An advanced download manager with browser integration that allows you to manage downloads in the cloud. Features include pause/resume, speed limiting, concurrent downloads, and browser extension integration.

## ✨ Features 

- **Browser Integration**: Chrome extension to intercept and manage downloads
- **Pause/Resume**: Control active downloads anytime
- **Speed Limiting**: Set global or per-download speed limits
- **Concurrent Downloads**: Manage multiple simultaneous downloads
- **Cross-platform**: Works on Windows, macOS, and Linux
- **Dark/Light Theme**: User-friendly interface with theme support
- **File Management**: Open files/folders directly from the interface

## 🛠️ Tech Stack 

- **Backend**: Python Flask
- **Frontend**: Bootstrap, JavaScript, HTML/CSS
- **Browser Extension**: Chrome Manifest V3
- **Data Storage**: JSON files
- **Networking**: SSE for real-time updates

## 🚀 Installation 
There is no way to install yet


### Prerequisites
- Python 3.8+
- Chrome browser

### Backend Setup
```bash
# Clone repository
git clone https://github.com/yourusername/cloud-download-manager.git
cd cloud-download-manager

# Install dependencies
pip install -r requirements.txt

# Start server
python app.py
```

## Chrome Extension Setup
- Open Chrome and go to chrome://extensions
- Enable "Developer mode"
- Click "Load unpacked" and select the /extension directory
- Set API URL in extension popup to http://localhost:5000

## ⚙️ Configuration 
Edit config.json to customize:
```bash
{
  "max_concurrent": 3,
  "download_speed": 0,
  "download_path": "D:\\Cloud Download Manager"
}
```

## 📖 Usage 
- Access web interface at http://localhost:5000
- Add download URLs via the web interface or browser extension
- Manage downloads through the web dashboard:
  - Pause/resume downloads
  - Set speed limits
  - View download progress
  - Open downloaded files

## 📂 Project Structure 
```bash
cloud-download-manager/
├── app.py                 # Flask application
├── config.json            # Configuration file
├── requirements.txt       # Python dependencies
├── static/                # Static assets
│   ├── script.js          # Main JavaScript
│   ├── style.css          # CSS styles
│   └── logo.png           # Application logo
├── templates/             # HTML templates
│   └── index.html         # Main interface
├── extension/             # Chrome extension
│   ├── background.js      # Extension background script
│   ├── manifest.json      # Extension manifest
│   ├── popup.html         # Extension popup
│   ├── popup.js           # Popup JavaScript
│   └── styles.css         # Popup styles
└── README.md              # This file
```

  # Screenshots

<div align="center">
    <a href="https://raw.githubusercontent.com/yasserbdj96/Cloud-Download-Manager/main/Screenshots/Screenshot_1.png">
        <img height="100" src="https://raw.githubusercontent.com/yasserbdj96/Cloud-Download-Manager/main/Screenshots/Screenshot_1.png" alt="">
    </a>
<a href="https://raw.githubusercontent.com/yasserbdj96/Cloud-Download-Manager/main/Screenshots/Screenshot_2.png">
        <img height="100" src="https://raw.githubusercontent.com/yasserbdj96/Cloud-Download-Manager/main/Screenshots/Screenshot_2.png" alt="">
    </a>
  <a href="https://raw.githubusercontent.com/yasserbdj96/Cloud-Download-Manager/main/Screenshots/Screenshot_3.png">
        <img height="100" src="https://raw.githubusercontent.com/yasserbdj96/Cloud-Download-Manager/main/Screenshots/Screenshot_3.png" alt="">
    </a>
  <a href="https://raw.githubusercontent.com/yasserbdj96/Cloud-Download-Manager/main/Screenshots/Screenshot_4.png">
        <img height="100" src="https://raw.githubusercontent.com/yasserbdj96/Cloud-Download-Manager/main/Screenshots/Screenshot_4.png" alt="">
    </a>
  <a href="https://raw.githubusercontent.com/yasserbdj96/Cloud-Download-Manager/main/Screenshots/Screenshot_5.png">
        <img height="100" src="https://raw.githubusercontent.com/yasserbdj96/Cloud-Download-Manager/main/Screenshots/Screenshot_5.png" alt="">
    </a>
  <a href="https://raw.githubusercontent.com/yasserbdj96/Cloud-Download-Manager/main/Screenshots/Screenshot_6.png">
        <img height="100" src="https://raw.githubusercontent.com/yasserbdj96/Cloud-Download-Manager/main/Screenshots/Screenshot_6.png" alt="">
    </a>
  <a href="https://raw.githubusercontent.com/yasserbdj96/Cloud-Download-Manager/main/Screenshots/Screenshot_7.png">
        <img height="100" src="https://raw.githubusercontent.com/yasserbdj96/Cloud-Download-Manager/main/Screenshots/Screenshot_7.png" alt="">
    </a>
  <a href="https://raw.githubusercontent.com/yasserbdj96/Cloud-Download-Manager/main/Screenshots/Screenshot_8.png">
        <img height="100" src="https://raw.githubusercontent.com/yasserbdj96/Cloud-Download-Manager/main/Screenshots/Screenshot_8.png" alt="">
    </a>
</div>

  # License
  MIT License - Free for personal and commercial use
