#!/usr/bin/env python3
"""
Scrapes itch.io for games based on a query or a specific URL.

Usage:
- For search: python3 search_games.py "search query"
- For popular turn-based: python3 search_games.py
"""

import sys
import json
import requests
from bs4 import BeautifulSoup
import os

def scrape_itch_page(url, limit=10):
    """Scrapes a given itch.io game list page."""
    try:
        response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'})
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching {url}: {e}", file=sys.stderr)
        return []

    soup = BeautifulSoup(response.text, 'html.parser')
    games = []
    
    game_cells = soup.find_all('div', class_='game_cell', limit=limit)

    for cell in game_cells:
        title_link = cell.find('a', class_='title')
        thumb_div = cell.find('div', class_='game_thumb')

        if title_link and thumb_div:
            game_url = title_link.get('href')
            game_title = title_link.text.strip()
            
            # Find author link - it's usually the last link in the cell without classes
            all_links = cell.find_all('a')
            author_link = None
            for link in reversed(all_links):  # Check from end
                if not link.get('class') and link.get('href') and link.text.strip():
                    author_link = link
                    break
            
            game_author = author_link.text.strip() if author_link else 'Unknown'
            
            # Try different thumbnail strategies
            thumbnail_url = thumb_div.get('data-background_image')
            
            if not thumbnail_url:
                # Look for img tag with data-lazy_src
                img_tag = thumb_div.find('img')
                if img_tag:
                    thumbnail_url = img_tag.get('data-lazy_src') or img_tag.get('src')
            
            if not thumbnail_url:
                # Try background-image style
                style = thumb_div.get('style', '')
                if 'background-image:url(' in style:
                    start = style.find('background-image:url(') + len('background-image:url(')
                    end = style.find(')', start)
                    thumbnail_url = style[start:end].strip('\'"')
                
            # If still no thumbnail, use a placeholder or None
            if not thumbnail_url:
                thumbnail_url = None

            games.append({
                'id': game_url.split('/')[-1] if game_url else game_title,
                'title': game_title,
                'author': game_author,
                'url': game_url,
                'cover_image': thumbnail_url,
                'isDownloaded': False # This will be checked by the extension
            })
    
    return games

def get_curated_games():
    """Returns curated games from curated_games.json."""
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    curated_games_path = os.path.join(script_dir, 'curated_games.json')
    
    try:
        with open(curated_games_path, 'r') as f:
            data = json.load(f)
            games = data.get('games', [])
            # Transform to match expected format
            return [{
                'id': game['id'],
                'title': game['title'],
                'author': game['author'],
                'url': game['url'],
                'cover_image': game.get('cover_image', ''),
                'isDownloaded': False
            } for game in games]
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error reading curated_games.json: {e}", file=sys.stderr)
        return []

def main():
    """Main execution function."""
    base_search_url = 'https://itch.io/games/platform-web/'
    
    # If a search term is provided, use it. Otherwise, get popular games.
    if len(sys.argv) > 1:
        query = sys.argv[1]
        search_url = f"{base_search_url}q/{query}"
        games_list = scrape_itch_page(search_url)
    else:
        # No query, return curated games from JSON file
        print("[DEBUG] Using curated games from JSON file", file=sys.stderr)
        games_list = get_curated_games()

    result = {
        'games': games_list,
        'total': len(games_list)
    }
    
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main() 