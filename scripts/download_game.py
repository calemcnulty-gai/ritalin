#!/usr/bin/env python3
"""
Download and extract Unity WebGL game from itch.io
Usage: python3 download_game.py "game_url" "output_directory"
"""

import sys
import os
import json
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import tempfile
import shutil
import zipfile
from pathlib import Path

def extract_game_iframe_url(game_url):
    """Extract the iframe URL from the itch.io game page"""
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
        
        response = requests.get(game_url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Find the game iframe
        iframe = soup.find('iframe', {'class': 'game_frame'}) or soup.find('iframe')
        
        if iframe and iframe.get('src'):
            iframe_url = iframe['src']
            if iframe_url.startswith('//'):
                iframe_url = 'https:' + iframe_url
            elif iframe_url.startswith('/'):
                iframe_url = urljoin(game_url, iframe_url)
                
            return iframe_url
        
        raise Exception("No game iframe found")
        
    except Exception as e:
        raise Exception(f"Failed to extract iframe URL: {e}")

def download_unity_game(iframe_url, output_dir):
    """Download Unity WebGL game files from iframe URL"""
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
        
        # Get the iframe content
        response = requests.get(iframe_url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Extract Unity build files
        unity_files = {}
        scripts = soup.find_all('script')
        
        for script in scripts:
            if script.get('src'):
                src = script['src']
                if any(ext in src for ext in ['.loader.js', '.framework.js', '.data', '.wasm']):
                    full_url = urljoin(iframe_url, src)
                    filename = os.path.basename(urlparse(src).path)
                    unity_files[filename] = full_url
        
        # Also look for config object in script content
        config_data = None
        for script in scripts:
            if script.string and 'buildUrl' in script.string:
                # Try to extract Unity config
                content = script.string
                lines = content.split('\n')
                for line in lines:
                    if 'buildUrl' in line or 'dataUrl' in line:
                        # Extract URLs from config
                        import re
                        urls = re.findall(r'"([^"]*\.(?:js|wasm|data)(?:\.gz)?)"', line)
                        for url in urls:
                            full_url = urljoin(iframe_url, url)
                            filename = os.path.basename(urlparse(url).path)
                            unity_files[filename] = full_url
        
        if not unity_files:
            raise Exception("No Unity build files found")
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        # Download all Unity files
        print(f"Downloading {len(unity_files)} Unity files...", file=sys.stderr)
        
        for filename, url in unity_files.items():
            print(f"Downloading {filename}...", file=sys.stderr)
            file_response = requests.get(url, headers=headers, timeout=30)
            file_response.raise_for_status()
            
            file_path = os.path.join(output_dir, filename)
            with open(file_path, 'wb') as f:
                f.write(file_response.content)
        
        # Create standalone HTML file
        create_standalone_html(output_dir, unity_files, iframe_url)
        
        return True
        
    except Exception as e:
        raise Exception(f"Failed to download Unity game: {e}")

def create_standalone_html(output_dir, unity_files, base_url):
    """Create a standalone HTML file to run the Unity game"""
    
    # Find the main Unity files
    loader_file = next((f for f in unity_files.keys() if '.loader.js' in f), None)
    data_file = next((f for f in unity_files.keys() if '.data' in f), None)
    framework_file = next((f for f in unity_files.keys() if '.framework.js' in f), None)
    wasm_file = next((f for f in unity_files.keys() if '.wasm' in f), None)
    
    if not loader_file:
        raise Exception("Loader file not found")
    
    # Extract game title from one of the filenames
    game_name = loader_file.replace('.loader.js', '').replace('.gz', '')
    
    html_content = f"""<!DOCTYPE html>
<html lang="en-us">
<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <title>{game_name}</title>
    <style>
        html, body {{
            background: #000000;
            width: 100%;
            height: 100%;
            overflow: hidden;
            padding: 0;
            margin: 0;
            font-family: Arial, sans-serif;
        }}
        
        #gameContainer {{
            background: transparent !important;
            position: absolute;
            width: 100%;
            height: 100%;
        }}
        
        #gameContainer canvas {{
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
        }}
        
        .loading {{
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            color: #666;
        }}
        
        .progress {{
            background: #333;
            border-radius: 4px;
            overflow: hidden;
            margin: 10px 0;
            width: 300px;
            height: 20px;
        }}
        
        .progress-bar {{
            background: linear-gradient(90deg, #4CAF50, #45a049);
            height: 100%;
            width: 0%;
            transition: width 0.3s ease;
        }}
    </style>
</head>
<body>
    <div class="loading" id="loading">
        <p>Loading {game_name}...</p>
        <div class="progress">
            <div class="progress-bar" id="progressBar"></div>
        </div>
        <p id="loadingText">Initializing Unity...</p>
    </div>
    
    <div id="gameContainer" style="display: none;">
        <canvas id="unity-canvas"></canvas>
    </div>

    <script>
        let unityInstance = null;

        function updateProgress(progress) {{
            const percent = Math.round(progress * 100);
            const progressBar = document.getElementById('progressBar');
            const loadingText = document.getElementById('loadingText');
            
            if (progressBar) {{
                progressBar.style.width = percent + '%';
            }}
            
            if (loadingText) {{
                loadingText.textContent = 'Loading Unity WebGL... ' + percent + '%';
            }}
        }}

        function onUnityLoaded(instance) {{
            console.log('Unity instance loaded successfully');
            unityInstance = instance;
            
            document.getElementById('loading').style.display = 'none';
            document.getElementById('gameContainer').style.display = 'block';
            
            // Auto-resize
            window.addEventListener('resize', onResize);
            onResize();
        }}

        function onUnityError(message) {{
            console.error('Unity loading error:', message);
            document.getElementById('loadingText').textContent = 'Error: ' + message;
        }}

        function onResize() {{
            if (!unityInstance) return;
            
            const canvas = document.getElementById('unity-canvas');
            if (!canvas) return;
            
            const w = window.innerWidth;
            const h = window.innerHeight;
            const aspectRatio = 16 / 9; // Default Unity aspect ratio
            
            let gameW = w;
            let gameH = h;
            
            if (w / h > aspectRatio) {{
                gameW = h * aspectRatio;
            }} else {{
                gameH = w / aspectRatio;
            }}
            
            canvas.style.width = gameW + "px";
            canvas.style.height = gameH + "px";
        }}

        function loadUnityGame() {{
            const canvas = document.querySelector("#unity-canvas");
            const config = {{
                dataUrl: "{data_file or ''}",
                frameworkUrl: "{framework_file or ''}",
                codeUrl: "{wasm_file or ''}",
                companyName: "Game Company",
                productName: "{game_name}",
                productVersion: "1.0",
            }};

            // Load Unity loader script
            const script = document.createElement('script');
            script.src = "{loader_file}";
            script.onload = function() {{
                if (typeof createUnityInstance !== 'undefined') {{
                    createUnityInstance(canvas, config, updateProgress)
                        .then(onUnityLoaded)
                        .catch(onUnityError);
                }} else {{
                    onUnityError('createUnityInstance function not available');
                }}
            }};
            script.onerror = function() {{
                onUnityError('Failed to load Unity loader script');
            }};
            
            document.head.appendChild(script);
        }}

        // Start loading when page loads
        window.addEventListener('load', loadUnityGame);
    </script>
</body>
</html>"""
    
    html_path = os.path.join(output_dir, 'standalone.html')
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"Created standalone.html", file=sys.stderr)

def main():
    if len(sys.argv) != 3:
        print("Usage: python3 download_game.py 'game_url' 'output_directory'", file=sys.stderr)
        sys.exit(1)
    
    game_url = sys.argv[1]
    output_dir = sys.argv[2]
    
    try:
        # Extract iframe URL
        print(f"Extracting game iframe from {game_url}...", file=sys.stderr)
        iframe_url = extract_game_iframe_url(game_url)
        print(f"Found iframe: {iframe_url}", file=sys.stderr)
        
        # Download the game
        print(f"Downloading Unity game to {output_dir}...", file=sys.stderr)
        download_unity_game(iframe_url, output_dir)
        
        print("Game download completed successfully!", file=sys.stderr)
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main() 