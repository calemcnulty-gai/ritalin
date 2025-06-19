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

def get_hardcoded_popular_games():
    """Returns hardcoded popular games from itch.io turn-based category."""
    return [
        {
            'id': 'dungeon-deck',
            'title': 'Dungeon Deck',
            'author': 'Incinious',
            'url': 'https://incinious.itch.io/dungeon-deck',
            'cover_image': 'game-images/dungeon-deck.png',
            'isDownloaded': False
        },
        {
            'id': 'folder-dungeon',
            'title': 'Folder Dungeon',
            'author': 'Ravernt',
            'url': 'https://ravernt.itch.io/folder-dungeon',
            'cover_image': 'game-images/folder-dungeon.png',
            'isDownloaded': False
        },
        {
            'id': 'slipways',
            'title': 'Slipways Classic',
            'author': 'Jakub Wasilewski',
            'url': 'https://krajzeg.itch.io/slipways',
            'cover_image': 'game-images/slipways-classic.png',
            'isDownloaded': False
        },
        {
            'id': 'shogunshowdown',
            'title': 'Shogun Showdown - Alpha',
            'author': 'Roboatino',
            'url': 'https://roboatino.itch.io/shogunshowdown',
            'cover_image': 'game-images/shogun-showdown.png',
            'isDownloaded': False
        },
        {
            'id': 'average-routine',
            'title': 'Average Routine',
            'author': 'ColorlessWing_Studio',
            'url': 'https://colorlesswing-studio.itch.io/average-routine',
            'cover_image': 'game-images/average-routine.png',
            'isDownloaded': False
        },
        {
            'id': 'frasier-fantasy',
            'title': 'Frasier Fantasy: The Director\'s Cut',
            'author': 'Edward La Barbera',
            'url': 'https://edward-la-barbera.itch.io/frasier-fantasy',
            'cover_image': 'game-images/frasier-fantasy.png',
            'isDownloaded': False
        },
        {
            'id': 'into-ruins',
            'title': 'Into Ruins',
            'author': 'SPARSE//GameDev',
            'url': 'https://sparsegamedev.itch.io/into-ruins',
            'cover_image': 'game-images/into-ruins.png',
            'isDownloaded': False
        },
        {
            'id': 'persona-4-gb-demo',
            'title': 'Persona 4 GB [DEMO]',
            'author': 'SeanSS',
            'url': 'https://seanss.itch.io/persona-4-gb-demo',
            'cover_image': 'game-images/persona-4-gb.png',
            'isDownloaded': False
        },
        {
            'id': 'backpack-hero',
            'title': 'Backpack Hero',
            'author': 'Thejaspel',
            'url': 'https://thejaspel.itch.io/backpack-hero',
            'cover_image': 'game-images/backpack-hero.png',
            'isDownloaded': False
        },
        {
            'id': 'hungry-horrors',
            'title': 'Hungry Horrors (demo)',
            'author': 'Clumsy Bear Studio',
            'url': 'https://clumsy-bear-studio.itch.io/hungry-horrors',
            'cover_image': 'game-images/hungry-horrors.png',
            'isDownloaded': False
        },
        {
            'id': 'porklike',
            'title': 'Porklike',
            'author': 'Krystman',
            'url': 'https://krystman.itch.io/porklike',
            'cover_image': 'game-images/porklike.png',
            'isDownloaded': False
        },
        {
            'id': 'solitomb',
            'title': 'Solitomb',
            'author': 'Jakub Wasilewski',
            'url': 'https://krajzeg.itch.io/solitomb',
            'cover_image': 'game-images/solitomb.png',
            'isDownloaded': False
        }
    ]

def main():
    """Main execution function."""
    base_search_url = 'https://itch.io/games/platform-web/'
    
    # If a search term is provided, use it. Otherwise, get popular games.
    if len(sys.argv) > 1:
        query = sys.argv[1]
        search_url = f"{base_search_url}q/{query}"
        games_list = scrape_itch_page(search_url)
    else:
        # No query, return hardcoded popular turn-based games
        print("[DEBUG] Using hardcoded popular games", file=sys.stderr)
        games_list = get_hardcoded_popular_games()

    result = {
        'games': games_list,
        'total': len(games_list)
    }
    
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main() 