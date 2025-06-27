# Game Download Investigation

## ANALYSIS COMPLETE ✅

The `grab_itch_game.py` script has **fundamental design flaws** that prevent it from downloading games correctly:

### Core Problems:

1. **Unity WebGL Pattern Matching**: The script uses generic regex patterns (`.loader.js`, `.data`, `.wasm`) instead of parsing the actual Unity configuration object. Real Unity games use specific filenames like `WebGLBuild2.loader.js` or `ShogunShowdown_WebGL.loader.js`.

2. **Single Engine Assumption**: The script only handles Unity WebGL games and fails completely with other engines like PICO-8, Construct, GameMaker, etc.

3. **Missing Asset Dependencies**: Even when the HTML is downloaded, required CSS, images, and other assets are ignored.

### Required Fix:
The script needs to be rewritten to:
- Parse Unity config objects to extract actual filenames
- Detect different game engines and handle each appropriately  
- Download all dependencies (CSS, images, fonts, etc.)
- Validate downloads by checking file existence

---

### Game: Folder Dungeon ✅ ANALYZED
- **Author**: Ravernt
- **Source URL**: https://ravernt.itch.io/folder-dungeon
- **Game Engine**: Unity WebGL
- **Iframe URL**: `https://html-classic.itch.zone/html/8580978/index.html?v=1732313627`
- **Problem**: Script downloads HTML but finds "0 assets" because it looks for generic patterns instead of parsing Unity config
- **Required Assets**:
  ```
  Build/WebGLBuild2.loader.js    ✅ EXISTS
  Build/WebGLBuild2.data         ✅ EXISTS  
  Build/WebGLBuild2.framework.js ✅ EXISTS
  Build/WebGLBuild2.wasm         ✅ EXISTS
  TemplateData/favicon.ico       ✅ EXISTS
  TemplateData/style.css         ✅ EXISTS
  ```
- **Fix Needed**: Parse Unity `config` object from HTML to extract actual filenames, then download each asset

---

### Game: Slipways Classic ✅ ANALYZED
- **Author**: Jakub Wasilewski
- **Source URL**: https://krajzeg.itch.io/slipways
- **Game Engine**: PICO-8 (Emscripten)
- **Iframe URL**: `https://html-classic.itch.zone/html/3076366/index.html?v=1732313795`
- **Problem**: Script completely fails - this is NOT a Unity WebGL game, it's PICO-8
- **Required Assets**:
  ```
  zepto.min.js     ✅ EXISTS
  slipways.js      ✅ EXISTS
  (no Build/ directory needed)
  ```
- **Fix Needed**: Detect PICO-8 games (look for `Module.canvas` and `.js` asset), download JS file and dependencies

---

### Game: Shogun Showdown - Alpha ✅ ANALYZED
- **Author**: Roboatino
- **Source URL**: https://roboatino.itch.io/shogunshowdown
- **Game Engine**: Unity WebGL
- **Iframe URL**: `https://html-classic.itch.zone/html/6187898/ShogunShowdown_WebGL/index.html?v=1732313700`
- **Problem**: Script downloads HTML but finds "0 assets" because it looks for generic patterns instead of parsing Unity config
- **Required Assets**:
  ```
  Build/ShogunShowdown_WebGL.loader.js      ✅ EXISTS
  Build/ShogunShowdown_WebGL.data.gz        ✅ EXISTS
  Build/ShogunShowdown_WebGL.framework.js.gz ✅ EXISTS  
  Build/ShogunShowdown_WebGL.wasm.gz        ✅ EXISTS
  TemplateData/favicon.ico                  ✅ EXISTS
  TemplateData/style.css                    ✅ EXISTS
  ```
- **Fix Needed**: Parse Unity `config` object from HTML to extract actual filenames, then download each asset (note: .gz compression)

---

### Game: Average Routine ⚠️ PREDICTED ISSUE
- **Author**: ColorlessWing_Studio
- **Source URL**: https://colorlesswing-studio.itch.io/average-routine
- **Game Engine**: Likely Unity WebGL
- **Predicted Problem**: Script will find HTML but download "0 assets" due to generic pattern matching instead of parsing Unity config
- **Expected Assets**:
  ```
  Build/[GameName].loader.js    
  Build/[GameName].data         
  Build/[GameName].framework.js 
  Build/[GameName].wasm         
  TemplateData/favicon.ico      
  TemplateData/style.css        
  ```
- **Fix Needed**: Parse Unity `config` object from HTML to extract actual filenames

---

### Game: Frasier Fantasy: The Director's Cut ⚠️ PREDICTED ISSUE
- **Author**: Edward La Barbera
- **Source URL**: https://edward-la-barbera.itch.io/frasier-fantasy
- **Game Engine**: Likely Unity WebGL or other engine
- **Predicted Problem**: Script will fail due to engine-specific requirements not being met
- **Fix Needed**: Detect game engine and handle accordingly

---

### Game: Into Ruins ⚠️ PREDICTED ISSUE
- **Author**: SPARSE//GameDev
- **Source URL**: https://sparsegamedev.itch.io/into-ruins
- **Game Engine**: Likely Unity WebGL or other engine
- **Predicted Problem**: Script will fail due to engine-specific requirements not being met
- **Fix Needed**: Detect game engine and handle accordingly

---

### Game: Persona 4 GB [DEMO] ⚠️ PREDICTED ISSUE
- **Author**: SeanSS
- **Source URL**: https://seanss.itch.io/persona-4-gb-demo
- **Game Engine**: Likely Game Boy/retro engine (not Unity)
- **Predicted Problem**: Script will completely fail - non-Unity game engine
- **Fix Needed**: Detect game engine type and implement appropriate downloader

---

### Game: Backpack Hero ⚠️ PREDICTED ISSUE
- **Author**: Thejaspel
- **Source URL**: https://thejaspel.itch.io/backpack-hero
- **Game Engine**: Likely Unity WebGL or other engine
- **Predicted Problem**: Script will fail due to engine-specific requirements not being met
- **Fix Needed**: Detect game engine and handle accordingly

---

### Game: Solitomb ✅ ANALYZED
- **Author**: Jakub Wasilewski
- **Source URL**: https://krajzeg.itch.io/solitomb
- **Game Engine**: PICO-8 (Emscripten)
- **Iframe URL**: `https://html-classic.itch.zone/html/12290587/index.html`
- **Problem**: Script completely fails - this is NOT a Unity WebGL game, it's PICO-8
- **Required Assets**:
  ```
  solitomb.js     ✅ EXISTS (main game executable)
  (embedded game data, no separate assets)
  ```
- **Fix Needed**: Detect PICO-8 games (look for `Module.canvas` and `.js` asset), download JS file

---

### Game: Porklike ⚠️ PREDICTED ISSUE
- **Author**: Krystman
- **Source URL**: https://krystman.itch.io/porklike
- **Game Engine**: Likely PICO-8 (similar to Slipways/Solitomb)
- **Predicted Problem**: Script will completely fail - this is likely PICO-8, not Unity
- **Fix Needed**: Detect PICO-8 games and download .js executable

---

### Game: Hungry Horrors (demo) ⚠️ PREDICTED ISSUE
- **Author**: Clumsy Bear Studio
- **Source URL**: https://clumsy-bear-studio.itch.io/hungry-horrors
- **Game Engine**: Likely Unity WebGL or other engine
- **Predicted Problem**: Script will fail due to engine-specific requirements not being met
- **Fix Needed**: Detect game engine and handle accordingly 