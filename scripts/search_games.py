#!/usr/bin/env python3
"""
Get curated itch.io Unity WebGL games
Usage: python3 search_games.py [filter]
"""

import sys
import json
import os
from pathlib import Path

def load_curated_games():
    """Load the curated games list"""
    script_dir = Path(__file__).parent
    games_file = script_dir / 'curated_games.json'
    
    try:
        with open(games_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading curated games: {e}", file=sys.stderr)
        return {"games": [], "default_game": None}

def filter_games(games_data, filter_term=None):
    """Filter games by search term or return all"""
    games = games_data.get('games', [])
    
    if not filter_term:
        return games
    
    filter_term = filter_term.lower()
    filtered = []
    
    for game in games:
        # Search in title, author, description, and tags
        searchable_text = ' '.join([
            game.get('title', ''),
            game.get('author', ''),
            game.get('description', ''),
            ' '.join(game.get('tags', []))
        ]).lower()
        
        if filter_term in searchable_text:
            filtered.append(game)
    
    return filtered

def get_default_game(games_data):
    """Get the default game"""
    default_id = games_data.get('default_game')
    if not default_id:
        return None
    
    for game in games_data.get('games', []):
        if game.get('id') == default_id:
            return game
    
    return None

def main():
    # Load curated games
    games_data = load_curated_games()
    
    # Apply filter if provided
    filter_term = sys.argv[1] if len(sys.argv) > 1 else None
    filtered_games = filter_games(games_data, filter_term)
    
    # If no filter provided, include default game info
    result = {
        'games': filtered_games,
        'default_game': get_default_game(games_data) if not filter_term else None,
        'total': len(filtered_games)
    }
    
    # Output as JSON
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main() 