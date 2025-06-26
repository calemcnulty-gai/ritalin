#!/usr/bin/env python3
import json
import requests
import re
from bs4 import BeautifulSoup
import time
from urllib.parse import urljoin, urlparse
import os

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
        print(f"Error fetching {url}: {e}")
        return None

def extract_detailed_game_info(html, game_url):
    """Extract detailed game information from itch.io page HTML"""
    if not html:
        return {}
    
    soup = BeautifulSoup(html, 'html.parser')
    info = {}
    
    # Extract description
    description_elem = soup.find('div', class_='formatted_description')
    if description_elem:
        info['description'] = description_elem.get_text(strip=True)[:500] + "..." if len(description_elem.get_text(strip=True)) > 500 else description_elem.get_text(strip=True)
    
    # Extract tags
    tags = []
    tag_elements = soup.find_all('a', class_='tag')
    for tag in tag_elements:
        tag_text = tag.get_text(strip=True)
        if tag_text:
            tags.append(tag_text.lower().replace(' ', '-'))
    if tags:
        info['tags'] = tags
    
    # Extract download links and assets
    download_links = []
    asset_links = []
    unity_assets = []
    pico8_assets = []
    
    # Look for download buttons
    download_buttons = soup.find_all('a', class_='download_btn')
    for btn in download_buttons:
        href = btn.get('href')
        if href and href != 'javascript:void(0);':
            full_url = urljoin(game_url, href)
            download_links.append(full_url)
    
    # Look for WebGL/HTML5 play links
    play_buttons = soup.find_all('a', class_='play_btn')
    for btn in play_buttons:
        href = btn.get('href')
        if href:
            full_url = urljoin(game_url, href)
            asset_links.append(full_url)
    
    # Look for iframe embeds (PICO-8 games often use these)
    iframes = soup.find_all('iframe')
    for iframe in iframes:
        src = iframe.get('src')
        if src:
            full_url = urljoin(game_url, src)
            if 'html-classic.itch.zone' in full_url:
                pico8_assets.append(full_url)
            else:
                asset_links.append(full_url)
    
    # Look for Unity WebGL specific elements
    unity_elements = soup.find_all('script', src=re.compile(r'\.unity3d|\.data|\.framework|\.loader'))
    for script in unity_elements:
        src = script.get('src')
        if src:
            full_url = urljoin(game_url, src)
            unity_assets.append(full_url)
    
    # Look for data files in links
    data_links = soup.find_all('a', href=re.compile(r'\.data|\.unity3d|\.framework|\.loader'))
    for link in data_links:
        href = link.get('href')
        if href:
            full_url = urljoin(game_url, href)
            unity_assets.append(full_url)
    
    # Look for PICO-8 specific files
    pico8_links = soup.find_all('a', href=re.compile(r'\.p8|\.p8.png'))
    for link in pico8_links:
        href = link.get('href')
        if href:
            full_url = urljoin(game_url, href)
            pico8_assets.append(full_url)
    
    # Look for ROM files (for GameBoy games)
    rom_links = soup.find_all('a', href=re.compile(r'\.gb|\.gbc|\.rom'))
    for link in rom_links:
        href = link.get('href')
        if href:
            full_url = urljoin(game_url, href)
            download_links.append(full_url)
    
    # Look for ZIP files
    zip_links = soup.find_all('a', href=re.compile(r'\.zip'))
    for link in zip_links:
        href = link.get('href')
        if href:
            full_url = urljoin(game_url, href)
            download_links.append(full_url)
    
    # Store the asset information
    if download_links:
        info['download_links'] = download_links
    if asset_links:
        info['asset_links'] = asset_links
    if unity_assets:
        info['unity_assets'] = unity_assets
    if pico8_assets:
        info['pico8_assets'] = pico8_assets
    
    # Extract rating/score if available
    rating_elem = soup.find('span', class_='rating')
    if rating_elem:
        info['rating'] = rating_elem.get_text(strip=True)
    
    # Extract file size if available
    size_elem = soup.find('span', class_='file_size')
    if size_elem:
        info['file_size'] = size_elem.get_text(strip=True)
    
    # Determine game type based on assets
    if unity_assets:
        info['game_type'] = 'unity_webgl'
    elif pico8_assets:
        info['game_type'] = 'pico8'
    elif any('html' in link for link in asset_links):
        info['game_type'] = 'html5'
    else:
        info['game_type'] = 'downloadable'
    
    return info

def update_curated_games_enhanced():
    """Update the curated games JSON with enhanced fetched information"""
    
    # Load current curated games
    with open('curated_games.json', 'r') as f:
        curated_games = json.load(f)
    
    updated_games = []
    
    for game in curated_games['games']:
        print(f"Processing: {game['title']} ({game['url']})")
        
        # Fetch the itch.io page
        html = fetch_itch_page(game['url'])
        
        if html:
            # Extract detailed information
            game_info = extract_detailed_game_info(html, game['url'])
            
            # Update the game entry
            updated_game = game.copy()
            updated_game.update(game_info)
            
            # Ensure we have required fields
            if 'description' not in updated_game:
                updated_game['description'] = f"A game by {game['author']}"
            
            if 'tags' not in updated_game:
                updated_game['tags'] = []
            
            # Add asset requirements based on game type
            if 'game_type' in updated_game:
                if updated_game['game_type'] == 'unity_webgl':
                    updated_game['requirements'] = {
                        'type': 'unity_webgl',
                        'assets': updated_game.get('unity_assets', []),
                        'main_file': 'index.html',
                        'data_files': [asset for asset in updated_game.get('unity_assets', []) if '.data' in asset],
                        'framework_files': [asset for asset in updated_game.get('unity_assets', []) if '.framework' in asset],
                        'loader_files': [asset for asset in updated_game.get('unity_assets', []) if '.loader' in asset]
                    }
                elif updated_game['game_type'] == 'pico8':
                    updated_game['requirements'] = {
                        'type': 'pico8',
                        'assets': updated_game.get('pico8_assets', []),
                        'main_file': 'index.html',
                        'p8_file': [asset for asset in updated_game.get('pico8_assets', []) if '.p8' in asset]
                    }
                elif updated_game['game_type'] == 'html5':
                    updated_game['requirements'] = {
                        'type': 'html5',
                        'assets': updated_game.get('asset_links', []),
                        'main_file': 'index.html'
                    }
                else:
                    updated_game['requirements'] = {
                        'type': 'downloadable',
                        'downloads': updated_game.get('download_links', [])
                    }
            
            updated_games.append(updated_game)
            print(f"  ✓ Updated with {len(game_info)} new fields")
            if 'game_type' in game_info:
                print(f"  ✓ Game type: {game_info['game_type']}")
        else:
            print(f"  ✗ Failed to fetch page")
            updated_games.append(game)
        
        # Be respectful with rate limiting
        time.sleep(2)
    
    # Update the curated games
    curated_games['games'] = updated_games
    
    # Save the updated file
    with open('curated_games_enhanced.json', 'w') as f:
        json.dump(curated_games, f, indent=2)
    
    print(f"\nUpdated {len(updated_games)} games with enhanced information")
    print("Results saved to curated_games_enhanced.json")

if __name__ == "__main__":
    update_curated_games_enhanced() 