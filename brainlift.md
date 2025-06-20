# Ritalin for Cursor

- Owners
  - Cale McNulty
- Purpose
  - Developers waste 5-10 minutes per context switch when waiting for AI code generation, destroying flow state and productivity. Current wait times of 15-60 seconds trigger habitual tab switching to social media.
  - We'll keep developers focused by automatically displaying engaging mini-games during AI generation periods, transforming dead time into productive micro-gaming sessions without leaving the IDE.
  - In scope
    - Detecting Cursor AI generation states
    - Embedding web-based games in VS Code WebViews
    - State persistence between gaming sessions
    - Focus metrics and productivity tracking
  - Out of scope
    - Other AI coding assistants (GitHub Copilot, etc.)
    - Desktop/mobile apps outside VS Code
    - Building custom games (using existing web games)
    - Multiplayer or social features (MVP)
- Experts
  - VS Code Extension Development
    - [VS Code Extension API Docs](https://code.visualstudio.com/api)
    - [WebView API Guide](https://code.visualstudio.com/api/extension-guides/webview)
  - Game Embedding & Web Technologies
    - [itch.io Embedding Guide](https://itch.io/docs/creators/widget)
    - [BeautifulSoup Documentation](https://www.crummy.com/software/BeautifulSoup/bs4/doc/) - HTML parsing for game extraction
    - [Unity WebGL Build Settings](https://docs.unity3d.com/Manual/webgl-building.html) - Understanding game structure
  - Productivity & Flow State
    - Cal Newport - Deep Work concepts
    - Mihaly Csikszentmihalyi - Flow state research
  - Cursor AI Integration
    - [Cursor Forums](https://forum.cursor.sh/)
    - Cursor Discord community
- Knowledge Tree
  - Detection Methods
    - DOM Monitoring: Watch for Cursor AI UI elements appearing/disappearing
    - API Hooks: Investigate if Cursor exposes any events or APIs (unlikely)
    - Editor State: Monitor workspace changes as proxy for AI activity
  - Game Integration Approaches
    - Iframe: For embedding external content (itch.io games)
      - CORS Challenge: Many sites block embedding, need Cross-Origin-Resource-Policy
      - Workaround: Bundle games locally or use permissive hosts
    - Direct HTML: For custom mini-games
    - Canvas/WebGL: For performance-critical games
  - State Management
    - WebView State: Use vscode.setState() for game progress persistence
    - Extension State: context.workspaceState for statistics and settings
    - Auto-pause: Implement when WebView is hidden to save resources
  - Performance Optimization
    - Lazy load game resources
    - Dispose WebViews when not needed
    - Limit concurrent WebView instances
    - Use local resources whenever possible
  - Security
    - Always validate message data between WebView and extension
    - Use strict CSP policies
    - Limit localResourceRoots to specific directories
    - Sanitize any user input
- Insights
  - The problem isn't the wait time itself, it's what developers do during the wait time
  - Micro-gaming sessions can maintain cognitive engagement without deep context switching
  - VS Code WebViews are powerful but have security restrictions that need creative solutions
  - Game state persistence is crucial - nobody wants to restart from level 1 every time
  - Attention != Productivity: Sometimes a strategic distraction improves overall output
  - Flow State Preservation: Games can maintain engagement during necessary waits
  - WebView Limitations: CORS and security policies make external game embedding challenging
  - Local First Strategy: Bundle games with extension to avoid CORS issues
  - State Management Critical: Must handle show/hide cycles gracefully
  - **CORS is Absolute**: itch.io and most game hosts have strict CSP policies that cannot be bypassed through browser tricks
  - **Local Hosting is Perfect**: Self-hosting Unity WebGL games eliminates all CORS issues and provides full control
  - **Game Size Acceptable**: Unity WebGL games (~50-100MB) are reasonable for local storage in modern development environments
  - **Automation Possible**: Can reliably extract and download games from itch.io using iframe URL detection and asset parsing
- Spiky POVs
  - Most "productivity" tools try to eliminate distractions, but strategic distraction within the IDE is actually better than uncontrolled context switching
  - The future of AI coding isn't faster generation, it's better utilization of generation time
  - Gamification of waiting could become a standard IDE feature, not just an extension
  - This could evolve into a platform for indie game developers to reach programmer audiences
  - The data on "productive waiting time" could reveal insights about AI coding patterns and optimal work sessions
- Other Brainlifts
  - [To be added as project evolves]

## Technical Discoveries

### itch.io Game Extraction (NEW)
- **iframe Detection**: itch.io embeds games in iframe elements with specific URL patterns
- **Asset Parsing**: Unity WebGL games have predictable asset structure (.loader.js, .framework.js.gz, .data.gz, .wasm.gz)
- **URL Encoding**: Build directory often contains URL-encoded filenames that need decoding
- **Dependency Removal**: itch.io scripts can be safely removed for standalone operation
- **BeautifulSoup Parsing**: Python script can reliably extract embedded game URLs and download assets

### Unity WebGL Architecture
- **Self-Contained**: Once downloaded, games are completely self-contained
- **CORS Headers**: Local test server needs specific headers for proper WebAssembly loading
- **File Structure**: Predictable build output makes automation possible
- **Resource Loading**: All assets load via relative paths, making local hosting straightforward

### WebView Architecture
- Nested iframe structure provides best control
- Service workers can implement virtual endpoints for resource loading
- CSP inheritance can be problematic for inline content

### Performance Optimizations
- Lazy load game resources
- Dispose WebViews when not needed
- Limit concurrent WebView instances
- Use local resources whenever possible

### Security Considerations
- Always validate message data between WebView and extension
- Use strict CSP policies
- Limit localResourceRoots to specific directories
- Sanitize any user input 