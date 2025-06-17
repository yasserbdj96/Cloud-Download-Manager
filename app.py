import os
import json
import re
import threading
import time
from flask import Flask, render_template, request, jsonify, Response
import requests
from pathlib import Path
from datetime import datetime
from flask_cors import CORS
import socket
import subprocess

import platform
import subprocess

app = Flask(__name__)
CORS(app)
#app.config['DOWNLOAD_FOLDER'] = 'downloads'
#Path(app.config['DOWNLOAD_FOLDER']).mkdir(exist_ok=True)

data_lock = threading.Lock()
DATA_FILE = 'downloads.json'
CONFIG_FILE = 'config.json'

class DownloadManager:
    def __init__(self):
        self.config = {
            'max_concurrent': 3,
            'download_speed': 0,
            'download_path': 'downloads'
        }
        #Path(self.config['download_path']).mkdir(exist_ok=True)

        self.downloads = {}
        self.active_threads = {}
        self.load_config()
        self.load_downloads()
        self.verify_downloads()
        self.current_id = max(self.downloads.keys(), default=0) + 1
        self._running = True
        self.queue_thread = threading.Thread(target=self.process_queue, daemon=True)
        self.queue_thread.start()

    def load_config(self):
        try:
            with open(CONFIG_FILE, 'r') as f:
                self.config.update(json.load(f))
        except (FileNotFoundError, json.JSONDecodeError):
            pass

    def save_config(self):
        with open(CONFIG_FILE, 'w') as f:
            json.dump(self.config, f, indent=2)

    def load_downloads(self):
        try:
            with data_lock, open(DATA_FILE, 'r') as f:
                raw_data = json.load(f)
                self.downloads = {int(k): v for k, v in raw_data.items()}
                for d in self.downloads.values():
                    if d['status'] == 'downloading':
                        d['status'] = 'paused'
        except (FileNotFoundError, json.JSONDecodeError):
            self.downloads = {}

    def save_downloads(self):
        with data_lock, open(DATA_FILE, 'w') as f:
            json.dump(self.downloads, f, indent=2)

    def verify_downloads(self):
        for download_id, data in list(self.downloads.items()):
            file_path = os.path.join(self.config['download_path'], data['filename'])
            
            if not os.path.exists(file_path):
                if data['status'] == 'completed':
                    data['status'] = 'failed: file missing'
                elif data['status'] != 'queued':
                    data['status'] = 'paused'
                continue

            actual_size = os.path.getsize(file_path)
            
            if data['status'] == 'completed':
                if data['size'] is None or actual_size != data['size']:
                    data['status'] = 'paused'
                    data['downloaded'] = actual_size
                    data['size'] = None
            elif data['status'] in ['paused', 'queued']:
                data['downloaded'] = actual_size
                if data['size'] is not None and actual_size >= data['size']:
                    data['status'] = 'completed'
                    data['progress'] = 100
                else:
                    data['status'] = 'paused'
            
            if data['status'] == 'completed' and (data['size'] is None or actual_size != data['size']):
                data['status'] = 'paused'
                data['downloaded'] = actual_size
                data['size'] = None

            self.save_downloads()

    def add_download(self, url):
        download_id = self.current_id
        self.current_id += 1
        filename = url.split('/')[-1] or f"file_{download_id}"
        self.downloads[download_id] = {
            'id': download_id,
            'url': url,
            'filename': filename,
            'status': 'queued',
            'progress': 0,
            'downloaded': 0,
            'size': None,
            'added_at': datetime.now().isoformat(),
            'speed': 0,
            'time_remaining': None,
            'completed_at': None,
            'speed_limit': 0
        }
        self.save_downloads()
        return download_id

    def process_queue(self):
        while self._running:
            active_downloads = sum(1 for d in self.downloads.values() 
                              if d['status'] == 'downloading')
            
            for download_id, data in list(self.downloads.items()):
                if data['status'] == 'queued' and \
                   active_downloads < self.config['max_concurrent'] and \
                   download_id not in self.active_threads:
                    self.start_download(download_id)
                    active_downloads += 1
            time.sleep(1)

    def start_download(self, download_id):
        data = self.downloads[download_id]
        file_path = os.path.join(self.config['download_path'], data['filename'])
        
        if os.path.exists(file_path):
            actual_size = os.path.getsize(file_path)
            if data['downloaded'] != actual_size:
                data['downloaded'] = actual_size
                data['status'] = 'paused'
                self.save_downloads()
                return

        data['status'] = 'downloading'
        self.save_downloads()
        thread = threading.Thread(target=self.download_file, args=(download_id,))
        self.active_threads[download_id] = thread
        thread.start()

    def download_file(self, download_id):
        data = self.downloads[download_id]
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Referer': data['url']
            }
            file_path = os.path.join(self.config['download_path'], data['filename'])
            
            try:
                final_url = data['url']
                final_filename = data['filename']
                
                try:
                    with requests.head(data['url'], headers=headers, allow_redirects=True, timeout=10) as r:
                        final_url = r.url
                        content_disposition = r.headers.get('Content-Disposition', '')
                except (requests.exceptions.Timeout, requests.exceptions.SSLError):
                    with requests.get(data['url'], headers=headers, stream=True, allow_redirects=True, timeout=30) as r:
                        final_url = r.url
                        content_disposition = r.headers.get('Content-Disposition', '')
                        r.close()

                if 'filename=' in content_disposition:
                    final_filename = re.findall('filename=(.+)', content_disposition)[0].strip('"')
                else:
                    final_filename = final_url.split('/')[-1].split('?')[0] or f"file_{download_id}"
                
                final_filename = re.sub(r'[\\/*?:"<>|]', "", final_filename).strip()

            except Exception as e:
                raise Exception(f"Redirect resolution failed: {str(e)}")

            if final_url != data['url'] or final_filename != data['filename']:
                old_path = os.path.join(self.config['download_path'], data['filename'])
                new_path = os.path.join(self.config['download_path'], final_filename)
                
                if os.path.exists(old_path) and old_path != new_path:
                    os.rename(old_path, new_path)
                
                data['url'] = final_url
                data['filename'] = final_filename
                self.save_downloads()
                file_path = new_path

            if data['downloaded'] > 0:
                headers['Range'] = f'bytes={data["downloaded"]}-'
                with requests.head(data['url'], headers=headers, timeout=10) as check_resp:
                    if check_resp.status_code != 206:
                        raise Exception("Server doesn't support resume")

            with requests.get(data['url'], headers=headers, stream=True, timeout=30) as r:
                r.raise_for_status()
                
                if data['downloaded'] == 0:
                    data['size'] = int(r.headers.get('content-length', 0))
                elif r.status_code == 206:
                    content_range = r.headers.get('Content-Range', '')
                    data['size'] = int(content_range.split('/')[-1]) if '/' in content_range else data['size']

                if data['size'] and data['downloaded'] >= data['size']:
                    data['status'] = 'completed'
                    data['completed_at'] = datetime.now().isoformat()
                    self.save_downloads()
                    return

                mode = 'ab' if data['downloaded'] > 0 else 'wb'
                with open(file_path, mode) as f:
                    start_time = time.time()
                    downloaded_this_session = 0
                    
                    for chunk in r.iter_content(chunk_size=8192):
                        if not self._running or data['status'] == 'paused':
                            break
                            
                        if chunk:
                            # Get current speed limit (per-download or global)
                            current_speed_limit = data.get('speed_limit', 0) or self.config['download_speed']
                            
                            if current_speed_limit > 0:
                                elapsed = time.time() - start_time
                                if elapsed > 0:
                                    current_speed = downloaded_this_session / elapsed
                                    if current_speed > current_speed_limit:
                                        sleep_time = (downloaded_this_session / 
                                                    current_speed_limit) - elapsed
                                        if sleep_time > 0:
                                            time.sleep(sleep_time)
                            
                            f.write(chunk)
                            chunk_size = len(chunk)
                            data['downloaded'] += chunk_size
                            downloaded_this_session += chunk_size
                            
                            # Calculate time remaining
                            if data['speed'] > 0 and data['size']:
                                remaining_bytes = data['size'] - data['downloaded']
                                data['time_remaining'] = remaining_bytes / data['speed']
                            else:
                                data['time_remaining'] = None
                            
                            if data['size'] and data['downloaded'] >= data['size']:
                                data['progress'] = 100
                                data['status'] = 'completed'
                                data['completed_at'] = datetime.now().isoformat()
                                break
                                
                            if data['size'] > 0:
                                data['progress'] = int((data['downloaded'] / data['size']) * 100)
                            
                            data['speed'] = downloaded_this_session / (time.time() - start_time) if (time.time() - start_time) > 0 else 0
                            self.save_downloads()

            if data['status'] == 'completed':
                final_size = os.path.getsize(file_path)
                if final_size != data['size']:
                    data['status'] = 'failed: size mismatch'
                    data['progress'] = int((final_size / data['size']) * 100) if data['size'] else 0

        except Exception as e:
            data['status'] = f'failed: {str(e)}'
            data['speed'] = 0
        finally:
            self.save_downloads()
            self.active_threads.pop(download_id, None)

    def pause_download(self, download_id):
        if download_id in self.downloads:
            self.downloads[download_id]['status'] = 'paused'
            self.save_downloads()

    def resume_download(self, download_id):
        if download_id in self.downloads:
            self.downloads[download_id]['status'] = 'queued'
            self.save_downloads()

    def remove_download(self, download_id):
        if download_id in self.downloads:
            file_path = os.path.join(self.config['download_path'], 
                                    self.downloads[download_id]['filename'])
            if os.path.exists(file_path):
                os.remove(file_path)
            del self.downloads[download_id]
            self.save_downloads()

    def edit_download(self, download_id, new_url, new_speed_limit):
        if download_id in self.downloads:
            data = self.downloads[download_id]
            data['url'] = new_url
            data['speed_limit'] = new_speed_limit * 1024  # Convert KB/s to bytes/s
            self.save_downloads()

    def retry_download(self, download_id):
        if download_id in self.downloads:
            data = self.downloads[download_id]
            file_path = os.path.join(self.config['download_path'], data['filename'])
            if os.path.exists(file_path):
                os.remove(file_path)
            data.update({
                'status': 'queued',
                'progress': 0,
                'downloaded': 0,
                'size': None,
                'speed': 0,
                'time_remaining': None,
                'completed_at': None
            })
            self.save_downloads()

    def update_config(self, max_concurrent, download_speed):
        self.config['max_concurrent'] = max_concurrent
        self.config['download_speed'] = download_speed * 1024
        self.save_config()

    def stop(self):
        self._running = False
        for thread in self.active_threads.values():
            thread.join()

manager = DownloadManager()

@app.route('/')
def index():
    return render_template('index.html',
                           max_concurrent=manager.config['max_concurrent'],
                           download_speed=manager.config['download_speed'] // 1024,
                           config=manager.config)  # Pass the config object

@app.route('/add', methods=['POST'])
def add_download():
    url = request.form.get('url')
    if url:
        manager.add_download(url)
    return jsonify(success=True)

@app.route('/pause/<int:download_id>')
def pause_download(download_id):
    manager.pause_download(download_id)
    return jsonify(success=True)

@app.route('/resume/<int:download_id>')
def resume_download(download_id):
    if manager.downloads[download_id]['status'].startswith('failed'):
        manager.retry_download(download_id)
    else:
        manager.resume_download(download_id)
    return jsonify(success=True)

@app.route('/remove/<int:download_id>', methods=['DELETE'])
def remove_download(download_id):
    manager.remove_download(download_id)
    return jsonify(success=True)

@app.route('/edit/<int:download_id>', methods=['POST'])
def edit_download(download_id):
    new_url = request.form.get('url')
    new_speed_limit = int(request.form.get('speed_limit', 0))
    if download_id in manager.downloads and new_url:
        manager.edit_download(download_id, new_url, new_speed_limit)
    return jsonify(success=True)

@app.route('/retry/<int:download_id>')
def retry_download(download_id):
    manager.retry_download(download_id)
    return jsonify(success=True)

@app.route('/config', methods=['GET', 'POST'])
def handle_config():
    if request.method == 'GET':
        try:
            with open(CONFIG_FILE, 'r') as f:
                config = json.load(f)
                return jsonify({
                    'max_concurrent': config['max_concurrent'],
                    'download_speed': config['download_speed'] // 1024,
                    'download_path': config['download_path']  # Added line
                })
        except Exception as e:
            return jsonify(error=str(e)), 500

    elif request.method == 'POST':
        try:
            new_config = {
                'max_concurrent': int(request.form.get('max_concurrent', 3)),
                'download_speed': int(request.form.get('download_speed', 0)) * 1024,
                'download_path': request.form.get('download_path', 'downloads')  # Added line
            }
            
            # Create directory if it doesn't exist
            Path(new_config['download_path']).mkdir(parents=True, exist_ok=True)  # Added line

            # Update manager and save to file
            manager.config.update(new_config)
            manager.save_config()

            return jsonify(success=True)
        except Exception as e:
            return jsonify(error=str(e)), 400

@app.route('/updates')
def updates():
    def generate():
        while True:
            with data_lock:
                data = list(manager.downloads.values())
            yield f"data: {json.dumps(data)}\n\n"
            time.sleep(1)
    return Response(generate(), mimetype='text/event-stream')

# Add health check endpoint for icon status
@app.route('/status')
def health_check():
    return jsonify(status='running')

@app.route('/open_file/<int:download_id>')
def open_file(download_id):
    if download_id in manager.downloads:
        data = manager.downloads[download_id]
        file_path = os.path.join(manager.config['download_path'], data['filename'])
        if os.path.exists(file_path):
            try:
                if platform.system() == 'Darwin':  # macOS
                    subprocess.run(['open', file_path])
                elif platform.system() == 'Windows':
                    os.startfile(file_path)
                else:  # Linux variants
                    subprocess.run(['xdg-open', file_path])
            except Exception as e:
                return jsonify(error=str(e)), 500
    return jsonify(success=True)

@app.route('/open_folder/<int:download_id>')
def open_folder(download_id):
    folder_path = os.path.abspath(manager.config['download_path'])
    try:
        if platform.system() == 'Darwin':
            subprocess.run(['open', folder_path])
        elif platform.system() == 'Windows':
            os.startfile(folder_path)
        else:
            subprocess.run(['xdg-open', folder_path])
    except Exception as e:
        return jsonify(error=str(e)), 500
    return jsonify(success=True)


def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect(("8.8.8.8", 80))
    ip = s.getsockname()[0]
    s.close()
    return ip

def get_public_ip():
    try:
        ip = subprocess.check_output(['curl', 'ifconfig.me']).decode().strip()
        return ip
    except Exception as e:
        return f"Error: {e}"

if __name__ == '__main__':
    try:
        port=5000
        local_ip = get_local_ip()
        print(" * Running on", 'http://'+get_public_ip()+':'+str(port))
        #print(f"Running on: http://{local_ip}:5000/")
        app.run(host='0.0.0.0', port=port, debug=True)
    finally:
        manager.stop()
