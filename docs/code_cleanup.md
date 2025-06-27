# Code Cleanup and Refactoring Opportunities

This document outlines areas of the codebase that are redundant, obsolete, or unnecessarily complex. The goal is to simplify the code, remove unused logic, and improve maintainability.

---

## 1. Drastically Simplify `cursorDetector.ts`

**Summary:** The `cursorDetector.ts` file is massively over-engineered. It contains several complex, heuristic-based detection methods that are now obsolete. The only method currently required is `selfReport`, which watches the `.cursor/is_working` file for changes.

**Location:** `src/cursorDetector.ts`

**Identified Issues:**
- **Obsolete Detection Methods:** The `document`, `selection`, and `chat` detection methods are no longer needed. The extension's architecture relies on the AI agent explicitly writing its status to `.cursor/is_working`, making these heuristics redundant and prone to error.
- **Unnecessary Complexity:** The entire system of "confidence scores", "detection events", "tiers", and aggregation logic (`calculateAggregateConfidence`) is made irrelevant by the authoritative `selfReport` mechanism.
- **Code Size:** The file is almost 900 lines long but its effective logic can be implemented in less than 100.

**Recommended Action:**
- **Refactor `CursorDetector`:** Rewrite the class to *only* contain the file-watching logic for `.cursor/is_working`.
- Remove all other detection methods (`document`, `selection`, `chat`).
- Remove the confidence scoring and event aggregation logic.
- The class's only responsibility should be to watch the file and emit `onAiGenerationStart` and `onAiGenerationEnd` events based on the file's content (`true` or `false`).

---

## 2. Simplify Electron IPC and Process Spawning

**Summary:** The communication between the VS Code extension (`GameWindowManager.ts`) and the Electron game window (`electron-game-window/main.js`) is overly complex, involving an intermediate wrapper script and a file-based messaging system.

**Location:** `src/GameWindowManager.ts`, `electron-game-window/run-electron.js`, `electron-game-window/main.js`

**Identified Issues:**
- **Redundant IPC Handler:** `electron-game-window/main.js` contains code to listen to `process.stdin`. This code is unreachable because the process's `stdin` is not piped. The actual communication happens via a file (`.ipc-messages`).
- **Convoluted Process Spawning:** The current chain is: `GameWindowManager.ts` -> `spawns node` -> `run-electron.js` -> `spawns electron` -> `main.js`. The `run-electron.js` script acts as a middleman that complicates the flow and introduces a file-based IPC layer where a direct `stdio` pipe should be sufficient.

**Recommended Action:**
- **Remove `stdin` handler in `main.js`:** Delete the `process.stdin.on('data', ...)` block as it is dead code.
- **(Optional but Recommended) Refactor process spawning:** Eliminate the `run-electron.js` wrapper. Modify `GameWindowManager.ts` to spawn the Electron executable directly. This would require solving the original problem that led to the wrapper's creation, but would significantly simplify the architecture. If direct spawning is problematic, the current system works but should be documented.

---

## 3. Consolidate Game Lists

**Summary:** There are two sources for the "popular" or "curated" games list: a hardcoded list within a Python script and a separate JSON file. This is redundant.

**Location:** `scripts/search_games.py`, `scripts/curated_games.json`

**Identified Issues:**
- **Duplicate Data:** The `get_hardcoded_popular_games()` function in `search_games.py` contains a static list of games that is also present in `curated_games.json`.
- **Maintainability:** Having two lists makes updates difficult and error-prone. The JSON file is the more appropriate location for this data.

**Recommended Action:**
- **Modify `search_games.py`:** Remove the `get_hardcoded_popular_games()` function. When the script is called without a search query, it should read from `scripts/curated_games.json` and return its contents.

---

## 4. Remove Unused Files

**Summary:** A simple test file appears to be left over from development.

**Location:** `electron-game-window/test-simple.js`

**Identified Issues:**
- **Obsolete Test File:** `test-simple.js` is a small script for testing the Electron window. It is not used in the extension's normal operation.

**Recommended Action:**
- **Delete `electron-game-window/test-simple.js`**. 