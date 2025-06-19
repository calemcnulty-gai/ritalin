// media/main.js
(function () {
    const vscode = acquireVsCodeApi();
    
    function debug(message) {
        vscode.postMessage({ command: 'debug', text: message });
    }
    
    debug("Script loaded.");

    const recommendedGameCard = document.getElementById('recommended-game-card');
    const downloadDieButton = document.getElementById('download-die');
    const searchInput = document.getElementById('game-search-input');
    const searchResultsContainer = document.getElementById('search-results');
    const popularGamesContainer = document.getElementById('popular-games-list');

    let searchTimeout;
    let recommendedGameInfo = null;

    // --- INITIALIZATION ---
    function initialize() {
        debug('initialize() called');
        if (recommendedGameCard) {
            const recommendedGameTitle = recommendedGameCard.dataset.gameTitle;
            if(recommendedGameTitle) {
                debug(`Requesting recommended game: ${recommendedGameTitle}`);
                vscode.postMessage({ command: 'searchGames', query: recommendedGameTitle, source: 'recommended' });
            }
        }
        initializePopularGames();
    }

    function initializePopularGames() {
        debug('initializePopularGames() called');
        popularGamesContainer.innerHTML = '<p>Loading popular games...</p>';
        debug('Sending getPopularGames message to extension');
        vscode.postMessage({ command: 'getPopularGames' });
    }

    function createGameCard(game, selectedGameId = null) {
        debug(`Creating card for ${game.title} with image: ${game.cover_image}`);
        const card = document.createElement('div');
        card.className = 'game-card';
        
        const gameJson = JSON.stringify(game).replace(/'/g, "&apos;");

        // Handle missing cover image
        const imageUrl = game.cover_image || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzE1IiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzE1IiBoZWlnaHQ9IjI1MCIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+';

        // Determine button state
        let buttonText, buttonDisabled, buttonAction;
        if (selectedGameId && game.id === selectedGameId) {
            // Currently selected
            buttonText = '✓ Selected';
            buttonDisabled = true;
            buttonAction = null;
        } else if (game.isDownloaded) {
            // Downloaded but not selected
            buttonText = 'Select';
            buttonDisabled = false;
            buttonAction = 'select';
        } else {
            // Not downloaded
            buttonText = 'Download';
            buttonDisabled = false;
            buttonAction = 'download';
        }

        card.innerHTML = `
            <img src="${imageUrl}" alt="${game.title}" class="game-thumbnail">
            <div class="game-info">
                <h3 class="game-title">${game.title}</h3>
                <p class="game-author">by ${game.author}</p>
                <button class="download-btn" data-game='${gameJson}' data-action="${buttonAction}" ${buttonDisabled ? 'disabled' : ''}>
                    ${buttonText}
                </button>
            </div>
        `;

        const button = card.querySelector('.download-btn');
        if (!buttonDisabled && buttonAction) {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                if (buttonAction === 'download') {
                    button.disabled = true;
                    button.textContent = 'Downloading...';
                    vscode.postMessage({ command: 'downloadGame', game: game });
                } else if (buttonAction === 'select') {
                    button.disabled = true;
                    button.textContent = 'Selecting...';
                    vscode.postMessage({ command: 'selectGame', gameId: game.id });
                }
            });
        }
        return card;
    }

    function renderGames(container, games, selectedGameId = null) {
        debug(`renderGames called with ${games?.length || 0} games`);
        container.innerHTML = '';
        if (!games || games.length === 0) {
            debug('No games to render');
            container.innerHTML = '<p>No games found.</p>';
            return;
        }
        debug(`Rendering ${games.length} games`);
        games.forEach(game => {
            debug(`Creating card for: ${game.title}`);
            const card = createGameCard(game, selectedGameId);
            container.appendChild(card);
        });
        debug('Finished rendering games');
    }

    function updateCardOnDownload(game) {
        document.querySelectorAll('.download-btn').forEach(button => {
            const gameData = JSON.parse(button.dataset.game);
            if (gameData.id === game.id) {
                button.textContent = 'Select';
                button.disabled = false;
                button.dataset.action = 'select';
                // Update click handler
                const newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);
                newButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    newButton.disabled = true;
                    newButton.textContent = 'Selecting...';
                    vscode.postMessage({ command: 'selectGame', gameId: game.id });
                });
            }
        });
    }

    function updateButtonsAfterSelection(selectedGameId) {
        document.querySelectorAll('.download-btn').forEach(button => {
            const gameData = JSON.parse(button.dataset.game);
            if (gameData.id === selectedGameId) {
                // This game is now selected
                button.textContent = '✓ Selected';
                button.disabled = true;
                button.dataset.action = '';
            } else if (button.dataset.action === 'select' || button.textContent === '✓ Selected') {
                // This game was previously selected or is selectable, update to Select
                button.textContent = 'Select';
                button.disabled = false;
                button.dataset.action = 'select';
                // Update click handler
                const newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);
                newButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    newButton.disabled = true;
                    newButton.textContent = 'Selecting...';
                    vscode.postMessage({ command: 'selectGame', gameId: gameData.id });
                });
            }
        });
    }

    // --- EVENT LISTENERS ---
    if (downloadDieButton) {
        downloadDieButton.addEventListener('click', () => {
            if (recommendedGameInfo) {
                downloadDieButton.disabled = true;
                downloadDieButton.textContent = 'Downloading...';
                vscode.postMessage({ command: 'downloadGame', game: recommendedGameInfo });
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const query = e.target.value;
                if (query && query.length > 2) {
                    if (searchResultsContainer) {
                        searchResultsContainer.innerHTML = '<p>Searching...</p>';
                    }
                    vscode.postMessage({ command: 'searchGames', query: query });
                } else {
                    if (searchResultsContainer) {
                        searchResultsContainer.innerHTML = '';
                    }
                }
            }, 300); // 300ms debounce
        });
    }

    window.addEventListener('message', event => {
        const message = event.data;
        debug(`Received message: ${message.command}`);

        switch (message.command) {
            case 'searchResults':
                debug(`Handling search results for source: ${message.source}`);
                if (message.source) {
                    switch(message.source) {
                        case 'recommended':
                            if (message.results && message.results.length > 0 && recommendedGameCard) {
                                const game = message.results.find(g => g.title === recommendedGameCard.dataset.gameTitle);
                                if (game) handleRecommendedGame(game);
                            }
                            break;
                        case 'popular':
                            if (message.results && message.results.length > 0) {
                                debug(`Handling popular game result for query: ${message.query}`);
                                const game = message.results.find(g => g.title === message.query) || message.results[0];
                                handlePopularGameResult(game, message.query);
                            }
                            break;
                    }
                } else {
                    // User search results (no source property)
                    renderSearchResults(message.games, message.selectedGameId);
                }
                break;
            case 'downloadFinished':
                if (recommendedGameInfo && message.game.id === recommendedGameInfo.id) {
                    updateRecommendedGameCard(message.game);
                }
                updateSearchResultItem(message.game);
                updatePopularGameCard(message.game);
                break;
            case 'popularGames':
                debug(`Received popularGames: ${message.games?.length || 0} games`);
                renderGames(popularGamesContainer, message.games, message.selectedGameId);
                break;
            case 'gameSelected':
                debug(`Game selected: ${message.gameId}`);
                updateButtonsAfterSelection(message.gameId);
                break;
        }
    });

    // --- UI FUNCTIONS ---
    
    function handleRecommendedGame(game) {
        recommendedGameInfo = game;
        if (recommendedGameCard) {
            const authorEl = recommendedGameCard.querySelector('.author');
            if (authorEl) {
                authorEl.textContent = `by ${game.author}`;
            }
        }
        if (game.isDownloaded) {
            updateRecommendedGameCard(game);
        } else if (downloadDieButton) {
            downloadDieButton.disabled = false;
        }
    }

    function handlePopularGameResult(game, query) {
        popularGamesContainer.querySelectorAll('.game-card').forEach(card => {
            if (card.querySelector('.game-title').textContent === query) {
                const authorEl = card.querySelector('.game-author');
                authorEl.textContent = `by ${game.author}`;
                
                const button = card.querySelector('.download-btn');
                button.dataset.game = JSON.stringify(game).replace(/'/g, "&apos;");
    
                if (game.isDownloaded) {
                    button.textContent = '✓ Downloaded';
                    button.disabled = true;
                } else {
                    button.textContent = 'Download';
                    button.disabled = false;
                }
                
                if(!button.disabled){
                    button.addEventListener('click', () => {
                        button.disabled = true;
                        button.textContent = 'Downloading...';
                        vscode.postMessage({ command: 'downloadGame', game: game });
                    }, { once: true }); // Avoid adding multiple listeners
                }
            }
        });
    }

    function updateRecommendedGameCard(game) {
        if (downloadDieButton) {
            downloadDieButton.disabled = true;
            downloadDieButton.textContent = '✓ Downloaded';
        }
    }

    function updatePopularGameCard(game) {
        popularGamesContainer.querySelectorAll('.game-card').forEach(card => {
            const button = card.querySelector('.download-btn');
            if (button.dataset.game) {
                const gameData = JSON.parse(button.dataset.game);
                if (gameData.id === game.id) {
                    button.textContent = 'Select';
                    button.disabled = false;
                    button.dataset.action = 'select';
                    // Update click handler
                    const newButton = button.cloneNode(true);
                    button.parentNode.replaceChild(newButton, button);
                    newButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        newButton.disabled = true;
                        newButton.textContent = 'Selecting...';
                        vscode.postMessage({ command: 'selectGame', gameId: game.id });
                    });
                }
            }
        });
    }
    
    function renderSearchResults(games, selectedGameId = null) {
        if (!searchResultsContainer) return;
        
        searchResultsContainer.innerHTML = '';
        if (!games || games.length === 0) {
            searchResultsContainer.innerHTML = '<p>No games found.</p>';
            return;
        }

        for (const game of games) {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            
            const gameJson = JSON.stringify(game).replace(/'/g, "&apos;");

            // Determine button state
            let buttonText, buttonDisabled, buttonAction;
            if (selectedGameId && game.id === selectedGameId) {
                // Currently selected
                buttonText = '✓ Selected';
                buttonDisabled = true;
                buttonAction = null;
            } else if (game.isDownloaded) {
                // Downloaded but not selected
                buttonText = 'Select';
                buttonDisabled = false;
                buttonAction = 'select';
            } else {
                // Not downloaded
                buttonText = 'Download';
                buttonDisabled = false;
                buttonAction = 'download';
            }

            item.innerHTML = `
                <div class="details">
                    <span class="title">${game.title}</span>
                    <span class="author">by ${game.author}</span>
                </div>
                <button class="download-btn" data-game='${gameJson}' data-action="${buttonAction}" ${buttonDisabled ? 'disabled' : ''}>${buttonText}</button>
            `;
            
            searchResultsContainer.appendChild(item);
        }
        
        // Add event listeners to new buttons
        searchResultsContainer.querySelectorAll('.download-btn').forEach(button => {
            if(button.disabled) return;
            const buttonAction = button.dataset.action;
            button.addEventListener('click', () => {
                const gameData = JSON.parse(button.dataset.game);
                if (buttonAction === 'download') {
                    button.disabled = true;
                    button.textContent = 'Downloading...';
                    vscode.postMessage({ command: 'downloadGame', game: gameData });
                } else if (buttonAction === 'select') {
                    button.disabled = true;
                    button.textContent = 'Selecting...';
                    vscode.postMessage({ command: 'selectGame', gameId: gameData.id });
                }
            });
        });

    }
    
    function updateSearchResultItem(game) {
        if (!searchResultsContainer) return;
        
        const buttons = searchResultsContainer.querySelectorAll('.download-btn');
        buttons.forEach(button => {
            const gameData = JSON.parse(button.dataset.game);
            if (gameData.id === game.id) {
                button.textContent = 'Select';
                button.disabled = false;
                button.dataset.action = 'select';
                // Update click handler
                const newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);
                newButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    newButton.disabled = true;
                    newButton.textContent = 'Selecting...';
                    vscode.postMessage({ command: 'selectGame', gameId: game.id });
                });
            }
        });
    }

    // --- START ---
    initialize();

}()); 