#!/opt/homebrew/anaconda3/bin/python

"""
Ritalin Game Grabber - Download Unity WebGL games from itch.io for local hosting
Usage: python3 grab_itch_game.py <itch_game_url> [game_name]
"""

import os
import sys
import json
import shutil
import tempfile
import urllib.request
import urllib.parse
import zipfile
import re
from pathlib import Path
from datetime import datetime, timezone
from bs4 import BeautifulSoup

class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'  # No Color

def print_status(msg):
    print(f"{Colors.BLUE}[INFO]{Colors.NC} {msg}")

def print_success(msg):
    print(f"{Colors.GREEN}[SUCCESS]{Colors.NC} {msg}")

def print_warning(msg):
    print(f"{Colors.YELLOW}[WARNING]{Colors.NC} {msg}")

def print_error(msg):
    print(f"{Colors.RED}[ERROR]{Colors.NC} {msg}")

def extract_game_name_from_url(url):
    """Extract game name from itch.io URL"""
    # Extract from URL pattern: https://username.itch.io/game-name
    match = re.search(r'\.itch\.io/([^/?]+)', url)
    if match:
        return match.group(1)
    
    # Fallback: use last part of path
    return url.rstrip('/').split('/')[-1]

def find_embedded_game_url(game_url):
    """Find the embedded HTML5 game URL from the itch.io page"""
    print_status(f"Fetching game page: {game_url}")
    
    try:
        with urllib.request.urlopen(game_url) as response:
            html = response.read().decode('utf-8')
    except Exception as e:
        print_error(f"Failed to fetch game page: {e}")
        return None
    
    # Parse HTML to find embedded game iframe
    soup = BeautifulSoup(html, 'html.parser')
    
    # Look for iframe with embedded game
    iframe_patterns = [
        'iframe[src*="html-classic.itch.zone"]',
        'iframe[src*="itch.zone"]',
        'iframe[id="game_drop"]'
    ]
    
    for pattern in iframe_patterns:
        iframe = soup.select_one(pattern)
        if iframe and iframe.get('src'):
            game_iframe_url = iframe.get('src')
            print_status(f"Found embedded game URL: {game_iframe_url}")
            return game_iframe_url
    
    # Also check for data-iframe attribute (some games use this)
    placeholder = soup.select_one('.iframe_placeholder')
    if placeholder and placeholder.get('data-iframe'):
        iframe_html = placeholder.get('data-iframe')
        # Parse the iframe HTML to extract src
        iframe_soup = BeautifulSoup(iframe_html, 'html.parser')
        iframe = iframe_soup.find('iframe')
        if iframe and iframe.get('src'):
            game_iframe_url = iframe.get('src')
            print_status(f"Found embedded game URL in data-iframe: {game_iframe_url}")
            return game_iframe_url
    
    print_error("Could not find embedded HTML5 game. Game might not have a web version.")
    return None

def download_and_extract_embedded_game(game_iframe_url, temp_dir):
    """Download the HTML5 game files from the embedded URL"""
    print_status(f"Downloading embedded game from: {game_iframe_url}")
    
    # URL encode the iframe URL to handle spaces and special characters
    encoded_url = urllib.parse.quote(game_iframe_url, safe=':/?#[]@!$&\'()*+,;=')
    
    try:
        # Get the game's index.html
        with urllib.request.urlopen(encoded_url) as response:
            html_content = response.read().decode('utf-8')
    except Exception as e:
        print_error(f"Failed to download game HTML: {e}")
        return None
    
    # Parse the HTML to find all assets (JS, WASM, data files)
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Extract base URL from the iframe URL (removing query params and filename)
    base_url = '/'.join(game_iframe_url.split('?')[0].split('/')[:-1]) + '/'
    
    # Create game directory structure
    game_files_dir = os.path.join(temp_dir, "game_files")
    build_dir = os.path.join(game_files_dir, "Build")
    os.makedirs(build_dir, exist_ok=True)
    
    # Save the main HTML file
    html_path = os.path.join(game_files_dir, "index.html")
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    # Find and download all Unity WebGL assets
    assets_to_download = []
    
    # Look for script tags with src attributes (loader.js)
    for script in soup.find_all('script', src=True):
        src = script.get('src')
        if src and src.startswith('Build/'):
            assets_to_download.append(src)
    
    # Parse the Unity config object for other assets
    script_content = str(soup)
    
    # Extract URLs from config object
    config_patterns = [
        r'dataUrl:\s*["\']([^"\']+)["\']',
        r'frameworkUrl:\s*["\']([^"\']+)["\']',
        r'codeUrl:\s*["\']([^"\']+)["\']'
    ]
    
    for pattern in config_patterns:
        matches = re.findall(pattern, script_content)
        for match in matches:
            if match.startswith('Build/'):
                assets_to_download.append(match)
    
    print_status(f"Found {len(assets_to_download)} assets to download")
    
    # Download all assets
    for asset_url in assets_to_download:
        # Construct full URL
        full_url = base_url + asset_url
        
        # URL encode the full URL to handle spaces
        encoded_asset_url = urllib.parse.quote(full_url, safe=':/?#[]@!$&\'()*+,;=')
        
        # Determine local path
        local_path = os.path.join(game_files_dir, asset_url)
        
        # Create directory if needed
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        
        try:
            print_status(f"Downloading: {asset_url}")
            urllib.request.urlretrieve(encoded_asset_url, local_path)
        except Exception as e:
            print_warning(f"Failed to download {asset_url}: {e}")
    
    return game_files_dir

def find_html_file(directory):
    """Find the main HTML file in the extracted game"""
    html_files = list(Path(directory).rglob("*.html"))
    
    if not html_files:
        return None
    
    # Prefer index.html if it exists
    for html_file in html_files:
        if html_file.name.lower() == 'index.html':
            return str(html_file)
    
    # Otherwise return the first HTML file
    return str(html_files[0])

def fix_url_encoded_filenames(build_dir):
    """Fix URL-encoded filenames in the Build directory and create simplified copies"""
    if not os.path.exists(build_dir):
        return
    
    print_status("Fixing URL-encoded filenames and creating simplified copies...")
    
    # First pass: fix URL encoding
    for filename in os.listdir(build_dir):
        if '%' in filename:
            decoded_name = urllib.parse.unquote(filename)
            old_path = os.path.join(build_dir, filename)
            new_path = os.path.join(build_dir, decoded_name)
            os.rename(old_path, new_path)
            print_status(f"Renamed: {filename} -> {decoded_name}")
    
    # Second pass: create simplified filename copies
    for filename in os.listdir(build_dir):
        old_path = os.path.join(build_dir, filename)
        
        # Create simplified filenames
        simple_filename = None
        if '.loader.js' in filename.lower():
            simple_filename = 'loader.js'
        elif '.framework.js' in filename.lower():
            simple_filename = 'framework.js.gz' if filename.endswith('.gz') else 'framework.js'
        elif '.data' in filename.lower():
            simple_filename = 'data.gz' if filename.endswith('.gz') else 'data'
        elif '.wasm' in filename.lower():
            simple_filename = 'wasm.gz' if filename.endswith('.gz') else 'wasm'
        
        if simple_filename:
            simple_path = os.path.join(build_dir, simple_filename)
            if not os.path.exists(simple_path):  # Don't overwrite if already exists
                shutil.copy2(old_path, simple_path)
                print_status(f"Created simplified copy: {filename} -> {simple_filename}")

def create_standalone_html(original_html_path, standalone_html_path):
    """Create standalone HTML without itch.io dependencies and with simplified file references"""
    with open(original_html_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove itch.io script references
    content = re.sub(r'<script[^>]*itch\.io[^>]*>.*?</script>', '', content, flags=re.DOTALL)
    content = re.sub(r'<script[^>]*htmlgame\.js[^>]*>.*?</script>', '', content, flags=re.DOTALL)
    
    # Replace complex Unity filenames with simplified ones
    # Match Unity file patterns and replace with simplified names
    replacements = [
        (r'Build/[^"\']*\.loader\.js[^"\']*', 'Build/loader.js'),
        (r'Build/[^"\']*\.framework\.js\.gz[^"\']*', 'Build/framework.js.gz'),
        (r'Build/[^"\']*\.framework\.js[^"\']*(?!\.gz)', 'Build/framework.js'),
        (r'Build/[^"\']*\.data\.gz[^"\']*', 'Build/data.gz'),
        (r'Build/[^"\']*\.data[^"\']*(?!\.gz)', 'Build/data'),
        (r'Build/[^"\']*\.wasm\.gz[^"\']*', 'Build/wasm.gz'),
        (r'Build/[^"\']*\.wasm[^"\']*(?!\.gz)', 'Build/wasm')
    ]
    
    for pattern, replacement in replacements:
        content = re.sub(pattern, replacement, content)
    
    with open(standalone_html_path, 'w', encoding='utf-8') as f:
        f.write(content)

def create_launcher_html(game_dir):
    """Create a launcher HTML optimized for VS Code extension"""
    launcher_content = '''<!DOCTYPE html>
<html lang="en-us">
<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <title>Game Launcher</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #000;
            overflow: hidden;
        }
        iframe {
            width: 100vw;
            height: 100vh;
            border: none;
        }
    </style>
</head>
<body>
    <iframe src="standalone.html"></iframe>
</body>
</html>'''
    
    launcher_path = os.path.join(game_dir, "launcher.html")
    with open(launcher_path, 'w', encoding='utf-8') as f:
        f.write(launcher_content)

def create_test_server(game_dir):
    """Create a test server script for local testing"""
    server_content = '''#!/usr/bin/env python3
import http.server
import socketserver
import webbrowser
import os

PORT = 8080

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        super().end_headers()

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
        print(f"Server running at http://localhost:{PORT}/")
        print(f"Open: http://localhost:{PORT}/launcher.html")
        webbrowser.open(f"http://localhost:{PORT}/launcher.html")
        httpd.serve_forever()
'''
    
    server_path = os.path.join(game_dir, "test_server.py")
    with open(server_path, 'w', encoding='utf-8') as f:
        f.write(server_content)
    os.chmod(server_path, 0o755)

def create_game_info(game_dir, game_name, game_url, original_html):
    """Create game info JSON file"""
    info = {
        "name": game_name,
        "source_url": game_url,
        "download_date": datetime.now(timezone.utc).isoformat(),
        "html_files": {
            "original": os.path.basename(original_html),
            "standalone": "standalone.html",
            "launcher": "launcher.html"
        },
        "type": "unity_webgl"
    }
    
    info_path = os.path.join(game_dir, "game_info.json")
    with open(info_path, 'w', encoding='utf-8') as f:
        json.dump(info, f, indent=2)

def main():
    if len(sys.argv) < 2:
        print_error("Usage: python3 grab_itch_game.py <itch_game_url> [game_name]")
        print_error("Example: python3 grab_itch_game.py https://game-dev.itch.io/die-in-the-dungeon die-in-the-dungeon")
        sys.exit(1)
    
    game_url = sys.argv[1]
    game_name = sys.argv[2] if len(sys.argv) > 2 else extract_game_name_from_url(game_url)
    
    print_status(f"Starting download for: {game_name}")
    print_status(f"URL: {game_url}")
    
    # Setup directories
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    games_dir = project_root / "games"
    game_dir = games_dir / game_name
    
    games_dir.mkdir(exist_ok=True)
    
    # Remove existing game directory if it exists
    if game_dir.exists():
        shutil.rmtree(game_dir)
    
    with tempfile.TemporaryDirectory() as temp_dir:
        # Find and download the game
        game_iframe_url = find_embedded_game_url(game_url)
        if not game_iframe_url:
            sys.exit(1)
        
        extracted_dir = download_and_extract_embedded_game(game_iframe_url, temp_dir)
        if not extracted_dir:
            sys.exit(1)
        
        # Verify we have the main HTML file
        html_file = os.path.join(extracted_dir, "index.html")
        if not os.path.exists(html_file):
            print_error("No index.html found. This might not be a Unity WebGL game.")
            sys.exit(1)
        
        print_status("Found embedded game files")
        
        # Copy all files to game directory
        game_dir.mkdir(parents=True)
        
        # Copy the extracted game files to our game directory
        shutil.copytree(extracted_dir, game_dir, dirs_exist_ok=True)
        
        # Fix URL-encoded filenames
        build_dir = game_dir / "Build"
        fix_url_encoded_filenames(str(build_dir))
        
        # Create standalone version
        original_html = game_dir / "index.html"
        standalone_html = game_dir / "standalone.html"
        create_standalone_html(str(original_html), str(standalone_html))
        
        # Create launcher and support files
        create_launcher_html(str(game_dir))
        create_test_server(str(game_dir))
        create_game_info(str(game_dir), game_name, game_url, str(original_html))
        
        print_success("Game successfully downloaded and set up!")
        print_success(f"Location: {game_dir}")
        print_status("Files created:")
        print_status("  - index.html (original)")
        print_status("  - standalone.html (no itch.io deps)")
        print_status("  - launcher.html (extension-ready)")
        print_status("  - game_info.json (metadata)")
        print_status("  - test_server.py (test locally)")
        print_status("")
        print_status("To test the game:")
        print_status(f"  cd '{game_dir}'")
        print_status("  python3 test_server.py")
        print_status("")
        print_status("Or use the launcher in your VS Code extension:")
        print_status(f"  File: {game_dir}/launcher.html")

if __name__ == "__main__":
    main() 