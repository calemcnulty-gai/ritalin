#!/usr/bin/env python3

"""
Ritalin Game Grabber - Download games from itch.io for local hosting
Supports Unity WebGL, PICO-8, Construct, GameMaker, and other HTML5 engines
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
    match = re.search(r'\.itch\.io/([^/?]+)', url)
    if match:
        return match.group(1)
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
    
    print_error("Could not find embedded HTML5 game.")
    return None

def detect_game_engine(html_content):
    """Detect the game engine from HTML content"""
    html_lower = html_content.lower()
    
    # Engine detection patterns with priority
    engines = {
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
        'gamemaker': {
            'indicators': [
                'gamemaker',
                'gms2',
                'runner.js',
                'audiogroup',
                'gm_runtime'
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
    # var config = { dataUrl: buildUrl + "/game.data.gz", frameworkUrl: buildUrl + "/game.framework.js.gz", ... }
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
    
    # Format 5: Look for loaderUrl variable definition
    loader_url_match = re.search(r'var\s+loaderUrl\s*=\s*buildUrl\s*\+\s*["\']([^"\']+)["\']', html_content)
    if loader_url_match and not assets['loader'] and assets['build_url']:
        assets['loader'] = assets['build_url'] + loader_url_match.group(1)
        print_status(f"Found loader from loaderUrl var: {assets['loader']}")
    
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
    
    # Parse Unity configuration - this is the key part that was failing
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
        
        # Look for Unity loader script directly
        loader_patterns = [
            r'<script[^>]*src=["\']([^"\']*\.loader\.js)["\']',
            r'loaderUrl\s*=\s*["\']([^"\']*\.loader\.js)["\']',
            r'["\']([^"\']*\.loader\.js)["\']'
        ]
        
        for pattern in loader_patterns:
            matches = re.findall(pattern, html_content)
            for match in matches:
                if match not in assets_to_download:
                    assets_to_download.append(match)
                    print_status(f"Found loader via pattern: {match}")
        
        # Look for Unity build files with common patterns
        build_patterns = [
            r'["\']([^"\']*\.data\.gz?)["\']',
            r'["\']([^"\']*\.framework\.js\.gz?)["\']',
            r'["\']([^"\']*\.wasm\.gz?)["\']',
            r'["\']([^"\']*\.data)["\']',
            r'["\']([^"\']*\.framework\.js)["\']',
            r'["\']([^"\']*\.wasm)["\']'
        ]
        
        for pattern in build_patterns:
            matches = re.findall(pattern, html_content)
            for match in matches:
                if match not in assets_to_download:
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
    
    # Style tags with background images
    for style in soup.find_all('style'):
        if style.string:
            bg_images = re.findall(r'url\(["\']?([^"\'()]+)["\']?\)', style.string)
            for img in bg_images:
                if img not in assets_to_download:
                    assets_to_download.append(img)
                    print_status(f"Found style asset: {img}")
    
    # Look for Unity UI assets that are commonly missing
    unity_ui_patterns = [
        r'["\']([^"\']*unity-logo[^"\']*\.png)["\']',
        r'["\']([^"\']*progress-bar[^"\']*\.png)["\']',
        r'["\']([^"\']*webgl-logo[^"\']*\.png)["\']',
        r'["\']([^"\']*fullscreen-button[^"\']*\.png)["\']',
        r'["\']([^"\']*favicon[^"\']*\.ico)["\']'
    ]
    
    for pattern in unity_ui_patterns:
        matches = re.findall(pattern, html_content)
        for match in matches:
            if match not in assets_to_download:
                assets_to_download.append(match)
                print_status(f"Found Unity UI asset: {match}")
    
    # Also look for Unity UI assets in CSS files (they're often referenced there)
    css_ui_patterns = [
        r"url\(['\"]?([^'\"]*unity-logo[^'\"]*\.png)['\"]?\)",
        r"url\(['\"]?([^'\"]*progress-bar[^'\"]*\.png)['\"]?\)",
        r"url\(['\"]?([^'\"]*webgl-logo[^'\"]*\.png)['\"]?\)",
        r"url\(['\"]?([^'\"]*fullscreen-button[^'\"]*\.png)['\"]?\)"
    ]
    
    for pattern in css_ui_patterns:
        matches = re.findall(pattern, html_content)
        for match in matches:
            if match not in assets_to_download:
                assets_to_download.append(match)
                print_status(f"Found Unity UI asset (CSS): {match}")
    
    # Also check for common Unity UI assets that might be missing
    common_unity_ui_assets = [
        "TemplateData/unity-logo-dark.png",
        "TemplateData/progress-bar-empty-dark.png", 
        "TemplateData/progress-bar-full-dark.png",
        "TemplateData/webgl-logo.png",
        "TemplateData/fullscreen-button.png"
    ]
    
    for asset in common_unity_ui_assets:
        if asset not in assets_to_download:
            assets_to_download.append(asset)
            print_status(f"Added common Unity UI asset: {asset}")
    
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
            urllib.request.urlretrieve(full_url, local_path)
            downloaded_count += 1
        except Exception as e:
            print_warning(f"Failed to download {asset_url}: {e}")
            failed_assets.append(asset_url)
    
    print_status(f"Successfully downloaded {downloaded_count}/{len(assets_to_download)} assets")
    
    if failed_assets:
        print_warning("Failed assets:")
        for asset in failed_assets:
            print_warning(f"  - {asset}")
    
    # Verify critical Unity files are present
    critical_files = [
        os.path.join(build_dir, "*.loader.js"),
        os.path.join(build_dir, "*.data*"),
        os.path.join(build_dir, "*.framework.js*"),
        os.path.join(build_dir, "*.wasm*")
    ]
    
    missing_critical = []
    for pattern in critical_files:
        if not glob.glob(pattern):
            missing_critical.append(os.path.basename(pattern))
    
    if missing_critical:
        print_warning("Missing critical Unity files:")
        for file in missing_critical:
            print_warning(f"  - {file}")
    
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
    
    # Look for PICO-8 specific patterns in inline scripts
    for script in soup.find_all('script'):
        if script.string and 'pico8' in script.string.lower():
            # Extract any referenced .js files
            js_refs = re.findall(r'["\']([^"\']+\.js)["\']', script.string)
            for js_ref in js_refs:
                if js_ref not in assets_to_download and not js_ref.startswith('http'):
                    assets_to_download.append(js_ref)
                    print_status(f"Found referenced JS: {js_ref}")
    
    print_status(f"Found {len(assets_to_download)} assets to download")
    
    # Download all assets
    downloaded_count = 0
    for asset_url in assets_to_download:
        full_url = urllib.parse.urljoin(base_url, asset_url)
        local_path = os.path.join(game_files_dir, asset_url.lstrip('/'))
        
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        
        try:
            print_status(f"Downloading: {asset_url}")
            urllib.request.urlretrieve(full_url, local_path)
            downloaded_count += 1
        except Exception as e:
            print_warning(f"Failed to download {asset_url}: {e}")
    
    print_status(f"Successfully downloaded {downloaded_count}/{len(assets_to_download)} assets")
    return game_files_dir

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
    # Scripts
    for script in soup.find_all('script', src=True):
        src = script.get('src')
        if src and not src.startswith('http'):
            assets_to_download.append(src)
    
    # Stylesheets
    for link in soup.find_all('link', rel='stylesheet'):
        href = link.get('href')
        if href and not href.startswith('http'):
            assets_to_download.append(href)
    
    # Images
    for img in soup.find_all('img'):
        src = img.get('src')
        if src and not src.startswith('http'):
            assets_to_download.append(src)
    
    # Audio
    for audio in soup.find_all(['audio', 'source']):
        src = audio.get('src')
        if src and not src.startswith('http'):
            assets_to_download.append(src)
    
    # Remove duplicates
    assets_to_download = list(set(assets_to_download))
    print_status(f"Found {len(assets_to_download)} unique assets to download")
    
    # Download all assets
    downloaded_count = 0
    for asset_url in assets_to_download:
        full_url = urllib.parse.urljoin(base_url, asset_url)
        local_path = os.path.join(game_files_dir, asset_url.lstrip('/'))
        
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        
        try:
            print_status(f"Downloading: {asset_url}")
            urllib.request.urlretrieve(full_url, local_path)
            downloaded_count += 1
        except Exception as e:
            print_warning(f"Failed to download {asset_url}: {e}")
    
    print_status(f"Successfully downloaded {downloaded_count}/{len(assets_to_download)} assets")
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
    
    print_status(f"Creating standalone HTML for {engine} engine")
    
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
    <iframe src="standalone.html" allow="autoplay; fullscreen"></iframe>
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
            "original": os.path.basename(original_html),
            "standalone": "standalone.html",
            "launcher": "launcher.html"
        },
        "engine": engine,
        "version": "2.0"  # Script version
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
    
    # Setup directories
    game_dir = Path(output_dir)
    game_dir.parent.mkdir(parents=True, exist_ok=True)
    
    # Remove existing game directory if it exists
    if game_dir.exists():
        shutil.rmtree(game_dir)
    
    with tempfile.TemporaryDirectory() as temp_dir:
        # Find embedded game URL
        game_iframe_url = find_embedded_game_url(game_url)
        if not game_iframe_url:
            sys.exit(1)
        
        # Download the game HTML
        try:
            with urllib.request.urlopen(game_iframe_url) as response:
                html_content = response.read().decode('utf-8')
        except Exception as e:
            print_error(f"Failed to download game HTML: {e}")
            sys.exit(1)
        
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
        else:
            # For all other engines, use generic downloader
            extracted_dir = download_generic_game(game_iframe_url, temp_dir, html_content)
        
        if not extracted_dir:
            print_error("Failed to download game assets")
            sys.exit(1)
        
        # Verify we have the main HTML file
        html_file = os.path.join(extracted_dir, "index.html")
        if not os.path.exists(html_file):
            print_error("No index.html found after download")
            sys.exit(1)
        
        print_status("Successfully downloaded game files")
        
        # Copy all files to game directory
        game_dir.mkdir(parents=True)
        shutil.copytree(extracted_dir, game_dir, dirs_exist_ok=True)
        
        # Create standalone version
        original_html = game_dir / "index.html"
        standalone_html = game_dir / "standalone.html"
        create_standalone_html(str(original_html), str(standalone_html), engine)
        
        # Create launcher and support files
        create_launcher_html(str(game_dir))
        create_game_info(str(game_dir), game_name, game_url, str(original_html), engine)
        
        print_success("Game successfully downloaded and set up!")
        print_success(f"Location: {game_dir}")
        print_status("Files created:")
        print_status("  - index.html (original)")
        print_status("  - standalone.html (no itch.io deps)")
        print_status("  - launcher.html (extension-ready)")
        print_status("  - game_info.json (metadata)")
        print_status("")
        print_status(f"Engine: {engine}")
        print_status("Use the launcher in your VS Code extension:")
        print_status(f"  File: {game_dir}/launcher.html")

if __name__ == "__main__":
    main() 