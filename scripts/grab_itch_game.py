#!/usr/bin/env python3

"""
Ritalin Game Grabber - Download games from itch.io for local hosting
Supports Unity WebGL, PICO-8, Construct, GameMaker, and other HTML5 engines
Also handles downloadable games (ZIP files)
Usage: python3 grab_itch_game.py <itch_game_url> <game_name> <output_dir> [engine_type]
"""

import os
import sys
import json
import shutil
import tempfile
import urllib.request
import urllib.parse
import re
import glob
import zipfile
import requests
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

def fetch_itch_page(url):
    """Fetch an itch.io page and return the HTML content"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        return response.text
    except Exception as e:
        print_error(f"Failed to fetch game page: {e}")
        return None

def extract_game_name_from_url(url):
    """Extract game name from itch.io URL"""
    match = re.search(r'\.itch\.io/([^/?]+)', url)
    if match:
        return match.group(1)
    return url.rstrip('/').split('/')[-1]

def get_game_metadata_from_json(game_url):
    """Get game metadata from curated_games.json if available"""
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        curated_games_path = os.path.join(script_dir, 'curated_games.json')
        
        with open(curated_games_path, 'r') as f:
            data = json.load(f)
            
        for game in data.get('games', []):
            if game['url'] == game_url:
                return game
                
    except Exception as e:
        print_warning(f"Could not load game metadata: {e}")
    
    return None

def find_embedded_game_url(game_url):
    """Find the embedded HTML5 game URL from the itch.io page"""
    print_status(f"Fetching game page: {game_url}")
    
    html = fetch_itch_page(game_url)
    if not html:
        return None
    
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
    
    # Also check for data-iframe attribute
    placeholder = soup.select_one('.iframe_placeholder')
    if placeholder and placeholder.get('data-iframe'):
        iframe_html = placeholder.get('data-iframe')
        iframe_soup = BeautifulSoup(iframe_html, 'html.parser')
        iframe = iframe_soup.find('iframe')
        if iframe and iframe.get('src'):
            game_iframe_url = iframe.get('src')
            print_status(f"Found embedded game URL in data-iframe: {game_iframe_url}")
            return game_iframe_url
    
    return None

def find_download_links(game_url):
    """Find download links from the itch.io page"""
    print_status(f"Looking for download links on: {game_url}")
    
    html = fetch_itch_page(game_url)
    if not html:
        return []
    
    soup = BeautifulSoup(html, 'html.parser')
    download_links = []
    
    # Look for download buttons
    download_buttons = soup.find_all('a', class_='download_btn')
    for btn in download_buttons:
        href = btn.get('href')
        if href and href != 'javascript:void(0);':
            full_url = urllib.parse.urljoin(game_url, href)
            download_links.append(full_url)
            print_status(f"Found download link: {full_url}")
    
    # Look for direct file links (ZIP, etc.)
    file_links = soup.find_all('a', href=re.compile(r'\.(zip|rar|7z|tar\.gz)$', re.I))
    for link in file_links:
        href = link.get('href')
        if href:
            full_url = urllib.parse.urljoin(game_url, href)
            if full_url not in download_links:
                download_links.append(full_url)
                print_status(f"Found file link: {full_url}")
    
    return download_links

def detect_game_engine(html_content):
    """Detect the game engine from HTML content"""
    html_lower = html_content.lower()
    
    # Engine detection patterns with priority
    engines = {
        'gamemaker': {
            'indicators': [
                'gamemaker_init',
                'html5game/',
                'gms2',
                'runner.js',
                'audiogroup',
                'gm_runtime',
                'gamemaker',
                'window.onload = gamemaker_init'
            ],
            'min_score': 1
        },
        'unity': {
            'indicators': [
                'unityinstance',
                'createunityinstance',
                'unity webgl player',
                'build.loader.js',
                'unity-container',
                'unity-canvas',
                'unityloader'
            ],
            'min_score': 2
        },
        'pico8': {
            'indicators': [
                'pico-8',
                'pico8',
                'module.canvas',
                'pico8_',
                'zepto.min.js',
                'p8_run_cart'
            ],
            'min_score': 1
        },
        'construct': {
            'indicators': [
                'c2runtime.js',
                'c3runtime.js',
                'construct 2',
                'construct 3',
                'c2canvas',
                'c3canvas'
            ],
            'min_score': 1
        },
        'godot': {
            'indicators': [
                'godot',
                'engine.js',
                'godot.js',
                'godot.wasm'
            ],
            'min_score': 1
        },
        'phaser': {
            'indicators': [
                'phaser.js',
                'phaser.min.js',
                'phaser'
            ],
            'min_score': 1
        }
    }
    
    scores = {}
    for engine, config in engines.items():
        score = sum(1 for indicator in config['indicators'] if indicator in html_lower)
        if score >= config['min_score']:
            scores[engine] = score
    
    print_status(f"Engine detection scores: {scores}")
    
    if scores:
        # Return engine with highest score
        return max(scores, key=scores.get)
    else:
        return "generic"

def download_file_with_progress(url, destination):
    """Download a file with progress indication"""
    try:
        response = requests.get(url, stream=True, timeout=30)
        response.raise_for_status()
        
        total_size = int(response.headers.get('content-length', 0))
        downloaded_size = 0
        
        with open(destination, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    downloaded_size += len(chunk)
                    if total_size > 0:
                        progress = (downloaded_size / total_size) * 100
                        print(f"\r  Progress: {progress:.1f}%", end='', flush=True)
        
        print()  # New line after progress
        return True
    except Exception as e:
        print_error(f"Failed to download {url}: {e}")
        return False

def extract_zip_file(zip_path, extract_to):
    """Extract ZIP file and return the extracted directory"""
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            # Get list of files to find the main directory
            file_list = zip_ref.namelist()
            
            # Extract all files
            zip_ref.extractall(extract_to)
            
            # Find the main game directory (usually the first directory in the ZIP)
            main_dirs = set()
            for file_path in file_list:
                if '/' in file_path:
                    main_dir = file_path.split('/')[0]
                    main_dirs.add(main_dir)
            
            if len(main_dirs) == 1:
                main_dir = main_dirs.pop()
                return os.path.join(extract_to, main_dir)
            else:
                # If multiple directories or files at root, return extract_to
                return extract_to
                
    except Exception as e:
        print_error(f"Failed to extract ZIP file: {e}")
        return None

def download_from_zip(download_links, temp_dir):
    """Download and extract game from ZIP file"""
    print_status("Attempting to download game from ZIP file...")
    
    for download_url in download_links:
        try:
            print_status(f"Downloading: {download_url}")
            
            # Download the ZIP file
            zip_filename = os.path.basename(urllib.parse.urlparse(download_url).path)
            if not zip_filename.endswith('.zip'):
                zip_filename += '.zip'
            
            zip_path = os.path.join(temp_dir, zip_filename)
            
            if download_file_with_progress(download_url, zip_path):
                print_status("Download completed, extracting...")
                
                # Extract the ZIP file
                extract_dir = os.path.join(temp_dir, "extracted")
                os.makedirs(extract_dir, exist_ok=True)
                
                game_dir = extract_zip_file(zip_path, extract_dir)
                if game_dir and os.path.exists(game_dir):
                    print_status(f"Extracted to: {game_dir}")
                    
                    # Look for HTML files in the extracted directory
                    html_files = glob.glob(os.path.join(game_dir, "*.html"))
                    if html_files:
                        print_status(f"Found HTML files: {[os.path.basename(f) for f in html_files]}")
                        return game_dir
                    
                    # Look for executable files or other game files
                    exe_files = glob.glob(os.path.join(game_dir, "*.exe"))
                    if exe_files:
                        print_status(f"Found executable files: {[os.path.basename(f) for f in exe_files]}")
                        return game_dir
                    
                    print_warning("No HTML or executable files found in extracted directory")
                    return game_dir  # Return anyway, might be useful
                
        except Exception as e:
            print_warning(f"Failed to download from {download_url}: {e}")
            continue
    
    return None

def parse_unity_config(html_content):
    """Parse Unity configuration from HTML to extract actual asset filenames"""
    assets = {
        'loader': None,
        'data': None,
        'framework': None,
        'wasm': None,
        'build_url': None
    }
    
    # Try to find Unity configuration in various formats
    
    # Format 1: var buildUrl = "Build"; var loaderUrl = buildUrl + "/game.loader.js";
    build_url_match = re.search(r'var\s+buildUrl\s*=\s*["\']([^"\']+)["\']', html_content)
    if build_url_match:
        assets['build_url'] = build_url_match.group(1)
        print_status(f"Found buildUrl: {assets['build_url']}")
    
    # Format 2: Direct config object with buildUrl concatenation
    config_match = re.search(r'var\s+config\s*=\s*\{([^}]+)\}', html_content, re.DOTALL)
    if config_match:
        config_text = config_match.group(1)
        
        # Extract URLs from config with buildUrl concatenation
        patterns = {
            'data': r'dataUrl\s*:\s*buildUrl\s*\+\s*["\']([^"\']+)["\']',
            'framework': r'frameworkUrl\s*:\s*buildUrl\s*\+\s*["\']([^"\']+)["\']',
            'wasm': r'codeUrl\s*:\s*buildUrl\s*\+\s*["\']([^"\']+)["\']',
            'loader': r'loaderUrl\s*:\s*buildUrl\s*\+\s*["\']([^"\']+)["\']'
        }
        
        for asset_type, pattern in patterns.items():
            match = re.search(pattern, config_text)
            if match:
                if assets['build_url']:
                    assets[asset_type] = assets['build_url'] + match.group(1)
                    print_status(f"Found {asset_type} (buildUrl concat): {assets[asset_type]}")
        
        # Also check for direct URLs (without buildUrl concatenation)
        direct_patterns = {
            'data': r'dataUrl\s*:\s*["\']([^"\']+)["\']',
            'framework': r'frameworkUrl\s*:\s*["\']([^"\']+)["\']',
            'wasm': r'codeUrl\s*:\s*["\']([^"\']+)["\']',
            'loader': r'loaderUrl\s*:\s*["\']([^"\']+)["\']'
        }
        
        for asset_type, pattern in direct_patterns.items():
            if not assets[asset_type]:  # Only if we didn't find it with buildUrl
                match = re.search(pattern, config_text)
                if match:
                    assets[asset_type] = match.group(1)
                    print_status(f"Found {asset_type} (direct): {assets[asset_type]}")
    
    # Format 3: createUnityInstance with inline config
    unity_instance_match = re.search(r'createUnityInstance\s*\([^,]+,\s*\{([^}]+)\}', html_content, re.DOTALL)
    if unity_instance_match and not any(assets.values()):
        config_text = unity_instance_match.group(1)
        patterns = {
            'data': r'dataUrl\s*:\s*["\']([^"\']+)["\']',
            'framework': r'frameworkUrl\s*:\s*["\']([^"\']+)["\']',
            'wasm': r'codeUrl\s*:\s*["\']([^"\']+)["\']'
        }
        
        for asset_type, pattern in patterns.items():
            if not assets[asset_type]:  # Only if we didn't find it already
                match = re.search(pattern, config_text)
                if match:
                    assets[asset_type] = match.group(1)
                    print_status(f"Found {asset_type} (createUnityInstance): {assets[asset_type]}")
    
    # Format 4: Look for .loader.js script tags
    loader_match = re.search(r'<script\s+src=["\']([^"\']+\.loader\.js)["\']', html_content)
    if loader_match and not assets['loader']:
        assets['loader'] = loader_match.group(1)
        print_status(f"Found loader from script tag: {assets['loader']}")
    
    return assets

def download_unity_game(game_iframe_url, temp_dir, html_content):
    """Download Unity WebGL game assets with improved parsing"""
    print_status("Downloading Unity WebGL game...")
    
    soup = BeautifulSoup(html_content, 'html.parser')
    base_url = '/'.join(game_iframe_url.split('?')[0].split('/')[:-1]) + '/'
    
    # Create game directory structure
    game_files_dir = os.path.join(temp_dir, "game_files")
    build_dir = os.path.join(game_files_dir, "Build")
    template_dir = os.path.join(game_files_dir, "TemplateData")
    os.makedirs(build_dir, exist_ok=True)
    os.makedirs(template_dir, exist_ok=True)
    
    # Save the main HTML file
    html_path = os.path.join(game_files_dir, "index.html")
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    # Parse Unity configuration
    unity_assets = parse_unity_config(html_content)
    assets_to_download = []
    
    # Add parsed Unity assets to download list
    for asset_type, asset_path in unity_assets.items():
        if asset_path and asset_type != 'build_url':
            assets_to_download.append(asset_path)
            print_status(f"Found Unity asset ({asset_type}): {asset_path}")
    
    # If we didn't find Unity assets through config parsing, try alternative methods
    if not assets_to_download:
        print_warning("Unity config parsing failed, trying alternative asset discovery...")
        
        # Look for Unity build files with common patterns
        build_patterns = [
            r'["\']([^"\']*\.data\.gz?)["\']',
            r'["\']([^"\']*\.framework\.js\.gz?)["\']',
            r'["\']([^"\']*\.wasm\.gz?)["\']',
            r'["\']([^"\']*\.loader\.js)["\']'
        ]
        
        for pattern in build_patterns:
            matches = re.findall(pattern, html_content)
            for match in matches:
                if match not in assets_to_download and not match.startswith('http'):
                    assets_to_download.append(match)
                    print_status(f"Found build file via pattern: {match}")
    
    # Find additional assets from HTML
    # Script tags
    for script in soup.find_all('script', src=True):
        src = script.get('src')
        if src and (src.endswith('.js') or 'Build/' in src) and src not in assets_to_download:
            assets_to_download.append(src)
            print_status(f"Found script asset: {src}")
    
    # TemplateData assets (CSS, images, etc.)
    for element in soup.find_all(['link', 'img']):
        resource = element.get('href') or element.get('src')
        if resource and ('TemplateData/' in resource or 'template' in resource.lower()):
            if resource not in assets_to_download:
                assets_to_download.append(resource)
                print_status(f"Found template asset: {resource}")
    
    # Remove duplicates and filter out empty entries
    assets_to_download = list(set([asset for asset in assets_to_download if asset.strip()]))
    
    print_status(f"Found {len(assets_to_download)} assets to download")
    
    # Download all assets
    downloaded_count = 0
    failed_assets = []
    
    for asset_url in assets_to_download:
        # Handle relative URLs
        if not asset_url.startswith('http'):
            full_url = urllib.parse.urljoin(base_url, asset_url)
        else:
            full_url = asset_url
            
        # Create local path, handling Build/ directory structure
        if asset_url.startswith('Build/'):
            local_path = os.path.join(game_files_dir, asset_url)
        else:
            local_path = os.path.join(game_files_dir, asset_url.lstrip('/'))
        
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        
        try:
            print_status(f"Downloading: {asset_url}")
            if download_file_with_progress(full_url, local_path):
                downloaded_count += 1
        except Exception as e:
            print_warning(f"Failed to download {asset_url}: {e}")
            failed_assets.append(asset_url)
    
    print_status(f"Successfully downloaded {downloaded_count}/{len(assets_to_download)} assets")
    
    if failed_assets:
        print_warning("Failed assets:")
        for asset in failed_assets:
            print_warning(f"  - {asset}")
    
    return game_files_dir if downloaded_count > 0 else None

def download_pico8_game(game_iframe_url, temp_dir, html_content):
    """Download PICO-8 game assets"""
    print_status("Downloading PICO-8 game...")
    
    soup = BeautifulSoup(html_content, 'html.parser')
    base_url = '/'.join(game_iframe_url.split('?')[0].split('/')[:-1]) + '/'
    
    # Create game directory
    game_files_dir = os.path.join(temp_dir, "game_files")
    os.makedirs(game_files_dir, exist_ok=True)
    
    # Save the main HTML file
    html_path = os.path.join(game_files_dir, "index.html")
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    # Find JavaScript files (PICO-8 games typically have a main .js file)
    assets_to_download = []
    
    # Look for script tags
    for script in soup.find_all('script', src=True):
        src = script.get('src')
        if src and not src.startswith('http'):
            assets_to_download.append(src)
            print_status(f"Found JS asset: {src}")
    
    print_status(f"Found {len(assets_to_download)} assets to download")
    
    # Download all assets
    downloaded_count = 0
    for asset_url in assets_to_download:
        full_url = urllib.parse.urljoin(base_url, asset_url)
        local_path = os.path.join(game_files_dir, asset_url.lstrip('/'))
        
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        
        try:
            print_status(f"Downloading: {asset_url}")
            if download_file_with_progress(full_url, local_path):
                downloaded_count += 1
        except Exception as e:
            print_warning(f"Failed to download {asset_url}: {e}")
    
    print_status(f"Successfully downloaded {downloaded_count}/{len(assets_to_download)} assets")
    return game_files_dir

def clean_filename(filename):
    """Clean up filename by removing URL parameters and fixing encoding"""
    # Remove URL parameters
    if '?' in filename:
        filename = filename.split('?')[0]
    
    # URL decode
    filename = urllib.parse.unquote(filename)
    
    return filename

def download_gamemaker_game(game_iframe_url, temp_dir, html_content):
    """Download GameMaker Studio game assets"""
    print_status("Downloading GameMaker Studio game...")
    
    soup = BeautifulSoup(html_content, 'html.parser')
    base_url = '/'.join(game_iframe_url.split('?')[0].split('/')[:-1]) + '/'
    
    # Create game directory structure
    game_files_dir = os.path.join(temp_dir, "game_files")
    html5game_dir = os.path.join(game_files_dir, "html5game")
    os.makedirs(html5game_dir, exist_ok=True)
    
    # Save the main HTML file
    html_path = os.path.join(game_files_dir, "index.html")
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    assets_to_download = []
    
    # Look for GameMaker-specific script references
    for script in soup.find_all('script', src=True):
        src = script.get('src')
        if src and not src.startswith('http'):
            assets_to_download.append(src)
            print_status(f"Found GameMaker asset: {src}")
    
    # Look for html5game directory references specifically
    gamemaker_patterns = [
        r'["\']html5game/([^"\']+)["\']',
        r'src=["\']html5game/([^"\']+)["\']'
    ]
    
    for pattern in gamemaker_patterns:
        matches = re.findall(pattern, html_content)
        for match in matches:
            asset_path = f"html5game/{match}"
            if asset_path not in assets_to_download:
                assets_to_download.append(asset_path)
                print_status(f"Found html5game asset: {asset_path}")
    
    # Look for other linked resources
    for link in soup.find_all('link', rel='stylesheet'):
        href = link.get('href')
        if href and not href.startswith('http'):
            assets_to_download.append(href)
            print_status(f"Found CSS asset: {href}")
    
    for img in soup.find_all('img'):
        src = img.get('src')
        if src and not src.startswith('http'):
            assets_to_download.append(src)
            print_status(f"Found image asset: {src}")
    
    # Remove duplicates
    assets_to_download = list(set(assets_to_download))
    print_status(f"Found {len(assets_to_download)} unique assets to download")
    
    # Download all assets
    downloaded_count = 0
    failed_assets = []
    
    for asset_url in assets_to_download:
        full_url = urllib.parse.urljoin(base_url, asset_url)
        
        # Clean up the local filename
        clean_asset_path = clean_filename(asset_url.lstrip('/'))
        local_path = os.path.join(game_files_dir, clean_asset_path)
        
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        
        try:
            print_status(f"Downloading: {asset_url} -> {clean_asset_path}")
            if download_file_with_progress(full_url, local_path):
                downloaded_count += 1
        except Exception as e:
            print_warning(f"Failed to download {asset_url}: {e}")
            failed_assets.append(asset_url)
    
    print_status(f"Successfully downloaded {downloaded_count}/{len(assets_to_download)} assets")
    
    if failed_assets:
        print_warning("Failed assets:")
        for asset in failed_assets:
            print_warning(f"  - {asset}")
    
    # Fix the standalone HTML to reference clean filenames
    if downloaded_count > 0:
        standalone_path = os.path.join(game_files_dir, "standalone_temp.html")
        with open(os.path.join(game_files_dir, "index.html"), 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace asset references with clean filenames
        for asset_url in assets_to_download:
            clean_asset_path = clean_filename(asset_url.lstrip('/'))
            if asset_url != clean_asset_path:
                content = content.replace(asset_url, clean_asset_path)
                print_status(f"Fixed reference: {asset_url} -> {clean_asset_path}")
        
        # Save the fixed HTML
        with open(os.path.join(game_files_dir, "index.html"), 'w', encoding='utf-8') as f:
            f.write(content)
    
    return game_files_dir if downloaded_count > 0 else None

def download_generic_game(game_iframe_url, temp_dir, html_content):
    """Download generic HTML5 game assets"""
    print_status("Downloading generic HTML5 game...")
    
    soup = BeautifulSoup(html_content, 'html.parser')
    base_url = '/'.join(game_iframe_url.split('?')[0].split('/')[:-1]) + '/'
    
    # Create game directory
    game_files_dir = os.path.join(temp_dir, "game_files")
    os.makedirs(game_files_dir, exist_ok=True)
    
    # Save the main HTML file
    html_path = os.path.join(game_files_dir, "index.html")
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    assets_to_download = []
    
    # Find all linked resources
    for script in soup.find_all('script', src=True):
        src = script.get('src')
        if src and not src.startswith('http'):
            assets_to_download.append(src)
    
    for link in soup.find_all('link', rel='stylesheet'):
        href = link.get('href')
        if href and not href.startswith('http'):
            assets_to_download.append(href)
    
    for img in soup.find_all('img'):
        src = img.get('src')
        if src and not src.startswith('http'):
            assets_to_download.append(src)
    
    for audio in soup.find_all(['audio', 'source']):
        src = audio.get('src')
        if src and not src.startswith('http'):
            assets_to_download.append(src)
    
    # CRITICAL: Download JavaScript files FIRST so we can scan them for imports
    js_files_to_scan = [src for src in assets_to_download if src.endswith('.js')]
    
    # Download JS files first to scan for dependencies
    for js_file in js_files_to_scan:
        full_url = urllib.parse.urljoin(base_url, js_file)
        try:
            print_status(f"Pre-downloading JS file to scan for imports: {js_file}")
            response = requests.get(full_url, timeout=10)
            if response.status_code == 200:
                all_js_content += "\n" + response.text
                
                # Look for ES6 imports in this file
                import_patterns = [
                    r'import\s+(?:\{[^}]+\}|\*\s+as\s+\w+|[\w\$]+)\s+from\s+["\']([^"\']+)["\']',
                    r'import\s+["\']([^"\']+)["\']',
                    r'export\s+.*\s+from\s+["\']([^"\']+)["\']',
                    r'import\(["\']([^"\']+)["\']\)'  # Dynamic imports
                ]
                
                for pattern in import_patterns:
                    matches = re.findall(pattern, response.text)
                    for match in matches:
                        if match and not match.startswith('http') and not match.startswith('data:'):
                            clean_match = match.replace('./', '')
                            if clean_match not in assets_to_download:
                                assets_to_download.append(clean_match)
                                print_status(f"Found JS import: {clean_match}")
                
                # Also look for service worker registration
                sw_patterns = [
                    r'navigator\.serviceWorker\.register\(["\']([^"\']+)["\']\)',
                    r'serviceWorker\.register\(["\']([^"\']+)["\']\)'
                ]
                
                for pattern in sw_patterns:
                    matches = re.findall(pattern, response.text)
                    for match in matches:
                        if match and not match.startswith('http'):
                            clean_match = match.replace('./', '')
                            if clean_match not in assets_to_download:
                                assets_to_download.append(clean_match)
                                print_status(f"Found service worker: {clean_match}")
                                
        except Exception as e:
            print_warning(f"Could not pre-scan JS file {js_file}: {e}")
    
    # Look for assets referenced in JavaScript code
    # This includes SVGs, images, audio files, etc. that might be loaded dynamically
    asset_patterns = [
        # Image patterns
        r'["\']([^"\']+\.(?:png|jpg|jpeg|gif|svg|webp|ico))["\']',
        # Audio patterns
        r'["\']([^"\']+\.(?:mp3|wav|ogg|m4a|webm))["\']',
        # Font patterns
        r'["\']([^"\']+\.(?:ttf|otf|woff|woff2|eot))["\']',
        # Data patterns
        r'["\']([^"\']+\.(?:json|xml|txt|csv))["\']',
        # Chess-specific patterns (pieces directory)
        r'["\'](?:\.\/)?pieces\/[^"\']+\.svg["\']',
        # General path patterns that might contain assets
        r'(?:src|href|url)\s*[:=]\s*["\']([^"\']+\.[a-zA-Z]{2,4})["\']',
        # Look for @-prefixed URLs (like @https://...)
        r'@(https?://[^"\'\s]+\.(?:svg|png|jpg|jpeg|gif|webp))',
        # Stockfish patterns
        r'["\']([^"\']+stockfish[^"\']*\.js)["\']',
        r'["\']([^"\']+stockfish[^"\']*\.wasm)["\']',
        r'new Worker\(["\']([^"\']+\.js)["\']',
        # Service worker patterns
        r'["\']([^"\']+sw\.js)["\']',
        r'navigator\.serviceWorker\.register\(["\']([^"\']+)["\']'
    ]
    
    # Search through all script content (inline and external)
    all_js_content = html_content
    
    # Also search through external JS files we've already identified
    for script_src in [src for src in assets_to_download if src.endswith('.js')]:
        try:
            script_url = urllib.parse.urljoin(base_url, script_src)
            response = requests.get(script_url, timeout=10)
            if response.status_code == 200:
                all_js_content += "\n" + response.text
                print_status(f"Scanning JS file for assets: {script_src}")
        except Exception as e:
            print_warning(f"Could not scan JS file {script_src}: {e}")
    
    # Find all potential assets using patterns
    for pattern in asset_patterns:
        matches = re.findall(pattern, all_js_content, re.IGNORECASE)
        for match in matches:
            # Clean up the match
            if match and not match.startswith('data:'):
                if match.startswith('http'):
                    # Handle absolute URLs - extract the path relative to the game
                    if base_url.replace('https://', '').replace('http://', '') in match:
                        # This is a URL from the same domain, extract relative path
                        relative_path = match.split(base_url)[-1].lstrip('/')
                        if relative_path and relative_path not in assets_to_download:
                            assets_to_download.append(relative_path)
                            print_status(f"Found asset via absolute URL: {relative_path}")
                else:
                    # Handle relative paths
                    clean_match = match.replace('./', '')
                    if clean_match not in assets_to_download:
                        assets_to_download.append(clean_match)
                        print_status(f"Found asset via pattern: {clean_match}")
    
    # Look for ES6 imports in JavaScript files
    import_patterns = [
        r'import\s+(?:\{[^}]+\}|\*\s+as\s+\w+|[\w\$]+)\s+from\s+["\']([^"\']+)["\']',
        r'import\s+["\']([^"\']+)["\']',
        r'export\s+.*\s+from\s+["\']([^"\']+)["\']'
    ]
    
    for pattern in import_patterns:
        matches = re.findall(pattern, all_js_content)
        for match in matches:
            if match and not match.startswith('http') and not match.startswith('data:'):
                # Handle relative imports
                clean_match = match.replace('./', '')
                if clean_match not in assets_to_download:
                    assets_to_download.append(clean_match)
                    print_status(f"Found JS import: {clean_match}")
    
    # Detect if this is a chess game
    is_chess_game = any(pattern in all_js_content.lower() for pattern in [
        'chess', 'chessboard', 'chess.js', 'pieces/light', 'pieces/dark', 
        'pieces/white', 'pieces/black', 'wk.svg', 'bk.svg'
    ])
    
    if is_chess_game:
        print_status("Detected chess game, adding standard chess piece assets")
        # Add all standard chess pieces
        piece_colors = ['light', 'dark']
        piece_names = ['wk', 'wq', 'wr', 'wb', 'wn', 'wp', 'bk', 'bq', 'br', 'bb', 'bn', 'bp']
        
        for color in piece_colors:
            for piece_name in piece_names:
                svg_path = f"pieces/{color}/{piece_name}.svg"
                if svg_path not in assets_to_download:
                    assets_to_download.append(svg_path)
                    print_status(f"Adding chess piece: {svg_path}")
    
    # Look for directory references that might contain multiple assets
    dir_patterns = [
        r'["\'](?:\.\/)?pieces\/["\']',  # Chess pieces directory
        r'["\'](?:\.\/)?images\/["\']',   # Images directory
        r'["\'](?:\.\/)?assets\/["\']',   # Assets directory
        r'["\'](?:\.\/)?sounds\/["\']',   # Sounds directory
    ]
    
    for pattern in dir_patterns:
        if re.search(pattern, all_js_content, re.IGNORECASE):
            dir_name = pattern.split('/')[-2]  # Extract directory name
            print_status(f"Found reference to {dir_name}/ directory, will try to download common files")
            
            # For chess games, try to download all piece SVGs
            if dir_name == 'pieces':
                piece_colors = ['light', 'dark', 'white', 'black']
                piece_types = ['k', 'q', 'r', 'b', 'n', 'p']  # king, queen, rook, bishop, knight, pawn
                
                # Try different naming conventions
                for color in piece_colors:
                    for piece in piece_types:
                        # Standard path: pieces/color/piece.svg
                        svg_path = f"pieces/{color}/{piece}.svg"
                        if svg_path not in assets_to_download:
                            assets_to_download.append(svg_path)
                            print_status(f"Adding chess piece: {svg_path}")
                        
                        # Color prefix: pieces/color/wk.svg, bk.svg, etc.
                        if color in ['light', 'white']:
                            color_prefix = 'w'
                        else:
                            color_prefix = 'b'
                        svg_path_alt = f"pieces/{color}/{color_prefix}{piece}.svg"
                        if svg_path_alt not in assets_to_download:
                            assets_to_download.append(svg_path_alt)
                
                # Also try without subdirectories: pieces/wk.svg, pieces/bk.svg
                for color_prefix in ['w', 'b']:
                    for piece in piece_types:
                        svg_path_flat = f"pieces/{color_prefix}{piece}.svg"
                        if svg_path_flat not in assets_to_download:
                            assets_to_download.append(svg_path_flat)
                            print_status(f"Adding chess piece (flat): {svg_path_flat}")
    
    # Remove duplicates
    assets_to_download = list(set(assets_to_download))
    print_status(f"Found {len(assets_to_download)} unique assets to download")
    
    # Download all assets
    downloaded_count = 0
    failed_assets = []
    
    for asset_url in assets_to_download:
        full_url = urllib.parse.urljoin(base_url, asset_url)
        local_path = os.path.join(game_files_dir, asset_url.lstrip('/'))
        
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        
        try:
            print_status(f"Downloading: {asset_url}")
            if download_file_with_progress(full_url, local_path):
                downloaded_count += 1
        except Exception as e:
            print_warning(f"Failed to download {asset_url}: {e}")
            failed_assets.append(asset_url)
    
    # If we found chess pieces but failed to download them with one naming scheme, try another
    if 'pieces' in str(failed_assets):
        print_status("Retrying chess pieces with alternative naming scheme...")
        for failed in failed_assets[:]:  # Copy list to modify during iteration
            if 'pieces/' in failed:
                # Try without the color subdirectory
                alt_path = failed.replace('pieces/light/', 'pieces/').replace('pieces/dark/', 'pieces/')
                if alt_path != failed:
                    full_url = urllib.parse.urljoin(base_url, alt_path)
                    local_path = os.path.join(game_files_dir, failed.lstrip('/'))
                    
                    try:
                        print_status(f"Retrying with alt path: {alt_path}")
                        if download_file_with_progress(full_url, local_path):
                            downloaded_count += 1
                            failed_assets.remove(failed)
                    except:
                        pass
    
    print_status(f"Successfully downloaded {downloaded_count}/{len(assets_to_download)} assets")
    
    if failed_assets:
        print_warning("Failed assets:")
        for asset in failed_assets:
            print_warning(f"  - {asset}")
    
    return game_files_dir

def create_standalone_html(original_html_path, standalone_html_path, engine):
    """Create standalone HTML without itch.io dependencies"""
    with open(original_html_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove itch.io script references
    content = re.sub(r'<script[^>]*itch\.io[^>]*>.*?</script>', '', content, flags=re.DOTALL)
    content = re.sub(r'<script[^>]*htmlgame\.js[^>]*>.*?</script>', '', content, flags=re.DOTALL)
    
    # Remove itch.io analytics
    content = re.sub(r'<script[^>]*analytics[^>]*>.*?</script>', '', content, flags=re.DOTALL)
    
    # Remove external SDK scripts (CrazyGames, Kongregate, etc.)
    content = re.sub(r'<script[^>]*src=["\']https?://[^"\']*(?:crazygames|kongregate|newgrounds|gamejolt)[^"\']*\.js["\'][^>]*>.*?</script>', '', content, flags=re.DOTALL)
    
    # Remove any remaining external scripts that aren't local resources
    content = re.sub(r'<script[^>]*src=["\']https?://(?!localhost)[^"\']+["\'][^>]*>.*?</script>', '', content, flags=re.DOTALL)
    
    # Check if this might be a chess game or uses ES6 modules
    if 'type="module"' in content or 'import ' in content or 'chess' in content.lower():
        print_status("Detected ES6 modules, checking for missing dependencies")
        
        # Read the main JS file to check imports
        main_js_files = re.findall(r'<script[^>]*type=["\']module["\'][^>]*src=["\']([^"\']+)["\'][^>]*>', content)
        if not main_js_files:
            main_js_files = re.findall(r'<script[^>]*src=["\']([^"\']+\.js)["\'][^>]*>', content)
        
        if main_js_files:
            main_js = main_js_files[0]
            js_path = os.path.join(os.path.dirname(original_html_path), main_js)
            
            if os.path.exists(js_path):
                with open(js_path, 'r', encoding='utf-8') as f:
                    js_content = f.read()
                
                # Check for missing imports
                import_matches = re.findall(r'import\s+.*?\s+from\s+["\']([^"\']+)["\']', js_content)
                
                for import_file in import_matches:
                    import_path = os.path.join(os.path.dirname(original_html_path), import_file)
                    if not os.path.exists(import_path):
                        print_warning(f"Missing import detected: {import_file}")
                        print_warning("The game may not work properly without this file")
    
    print_status(f"Creating standalone HTML for {engine} engine")
    
    with open(standalone_html_path, 'w', encoding='utf-8') as f:
        f.write(content)

def create_launcher_html(game_dir, main_html_file="standalone.html"):
    """Create a launcher HTML optimized for VS Code extension"""
    launcher_content = f'''<!DOCTYPE html>
<html lang="en-us">
<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <title>Game Launcher</title>
    <style>
        body {{
            margin: 0;
            padding: 0;
            background: #000;
            overflow: hidden;
        }}
        iframe {{
            width: 100vw;
            height: 100vh;
            border: none;
        }}
    </style>
</head>
<body>
    <iframe src="{main_html_file}" allow="autoplay; fullscreen"></iframe>
</body>
</html>'''
    
    launcher_path = os.path.join(game_dir, "launcher.html")
    with open(launcher_path, 'w', encoding='utf-8') as f:
        f.write(launcher_content)

def create_game_info(game_dir, game_name, game_url, original_html, engine):
    """Create game info JSON file"""
    info = {
        "name": game_name,
        "source_url": game_url,
        "download_date": datetime.now(timezone.utc).isoformat(),
        "html_files": {
            "original": os.path.basename(original_html) if original_html else None,
            "standalone": "standalone.html",
            "launcher": "launcher.html"
        },
        "engine": engine,
        "version": "3.0"  # Script version
    }
    
    info_path = os.path.join(game_dir, "game_info.json")
    with open(info_path, 'w', encoding='utf-8') as f:
        json.dump(info, f, indent=2)

def main():
    if len(sys.argv) < 4:
        print_error("Usage: python3 grab_itch_game.py <itch_game_url> <game_name> <output_dir> [engine_type]")
        print_error("Example: python3 grab_itch_game.py https://game-dev.itch.io/die-in-the-dungeon die-in-the-dungeon /path/to/output unity")
        print_error("Supported engines: unity, pico8, construct, gamemaker, godot, phaser, generic")
        sys.exit(1)
    
    game_url = sys.argv[1]
    game_name = sys.argv[2]
    output_dir = sys.argv[3]
    engine_hint = sys.argv[4].lower() if len(sys.argv) > 4 else None
    
    print_status(f"Starting download for: {game_name}")
    print_status(f"URL: {game_url}")
    if engine_hint:
        print_status(f"Engine hint: {engine_hint}")
    
    # Get game metadata from JSON if available
    game_metadata = get_game_metadata_from_json(game_url)
    if game_metadata:
        print_status(f"Found game metadata: {game_metadata.get('game_type', 'unknown')} type")
        if not engine_hint and game_metadata.get('engine'):
            engine_hint = game_metadata['engine']
            print_status(f"Using engine from metadata: {engine_hint}")
    
    # Setup directories
    game_dir = Path(output_dir)
    game_dir.parent.mkdir(parents=True, exist_ok=True)
    
    # Remove existing game directory if it exists
    if game_dir.exists():
        shutil.rmtree(game_dir)
    
    with tempfile.TemporaryDirectory() as temp_dir:
        extracted_dir = None
        engine = engine_hint or "generic"
        
        # Try embedded game first (for browser-playable games)
        if game_metadata and game_metadata.get('iframe_url'):
            # Use direct iframe URL from metadata
            game_iframe_url = game_metadata['iframe_url']
            print_status(f"Using iframe URL from metadata: {game_iframe_url}")
        else:
            # Try to find embedded game URL
            game_iframe_url = find_embedded_game_url(game_url)
        
        if game_iframe_url:
            # Download the game HTML
            try:
                print_status(f"Downloading game HTML from: {game_iframe_url}")
                response = requests.get(game_iframe_url, timeout=15)
                response.raise_for_status()
                html_content = response.text
                
                # Detect engine if not provided
                if not engine_hint:
                    engine = detect_game_engine(html_content)
                else:
                    engine = engine_hint
                
                print_status(f"Using engine: {engine}")
                
                # Download based on engine type
                if engine == "unity":
                    extracted_dir = download_unity_game(game_iframe_url, temp_dir, html_content)
                elif engine == "pico8":
                    extracted_dir = download_pico8_game(game_iframe_url, temp_dir, html_content)
                elif engine == "gamemaker":
                    extracted_dir = download_gamemaker_game(game_iframe_url, temp_dir, html_content)
                else:
                    # For all other engines, use generic downloader
                    extracted_dir = download_generic_game(game_iframe_url, temp_dir, html_content)
                    
            except Exception as e:
                print_warning(f"Failed to download embedded game: {e}")
        
        # If embedded game download failed, try downloading from ZIP files
        if not extracted_dir:
            print_status("Embedded game download failed, trying ZIP download...")
            download_links = find_download_links(game_url)
            
            if download_links:
                extracted_dir = download_from_zip(download_links, temp_dir)
            else:
                print_error("No download links found")
        
        if not extracted_dir:
            print_error("Failed to download game assets")
            sys.exit(1)
        
        # Find the main HTML file
        html_files = glob.glob(os.path.join(extracted_dir, "*.html"))
        main_html_file = None
        
        if html_files:
            # Prefer index.html, otherwise use the first HTML file
            for html_file in html_files:
                if os.path.basename(html_file).lower() == 'index.html':
                    main_html_file = html_file
                    break
            if not main_html_file:
                main_html_file = html_files[0]
        
        print_status("Successfully downloaded game files")
        
        # Copy all files to game directory
        game_dir.mkdir(parents=True)
        shutil.copytree(extracted_dir, game_dir, dirs_exist_ok=True)
        
        # Create standalone version if we have an HTML file
        if main_html_file:
            original_html = game_dir / os.path.basename(main_html_file)
            standalone_html = game_dir / "standalone.html"
            create_standalone_html(str(original_html), str(standalone_html), engine)
            
            # Create launcher
            create_launcher_html(str(game_dir), "standalone.html")
        else:
            # No HTML file found, create a basic launcher that lists available files
            print_warning("No HTML file found, creating file browser launcher")
            create_launcher_html(str(game_dir), "index.html")
        
        # Create game info
        create_game_info(str(game_dir), game_name, game_url, main_html_file, engine)
        
        print_success("Game successfully downloaded and set up!")
        print_success(f"Location: {game_dir}")
        print_status("Files created:")
        if main_html_file:
            print_status(f"  - {os.path.basename(main_html_file)} (original)")
            print_status("  - standalone.html (no itch.io deps)")
        print_status("  - launcher.html (extension-ready)")
        print_status("  - game_info.json (metadata)")
        print_status("")
        print_status(f"Engine: {engine}")
        print_status("Use the launcher in your VS Code extension:")
        print_status(f"  File: {game_dir}/launcher.html")

if __name__ == "__main__":
    main() 