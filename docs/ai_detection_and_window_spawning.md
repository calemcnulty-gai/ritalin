# AI Detection and Window Spawning Analysis

This document outlines the findings from a review of the code responsible for AI activity detection and the subsequent spawning of the game window. The investigation focused on two primary user-reported issues:
1.  Significant delay between AI detection and the game window appearing.
2.  Spawning of multiple game windows.

## 1. Window Loading Delay

The investigation identified a primary and several secondary causes for the delay.

### Primary Cause: Hardcoded Delay in `GameWindowManager`

The most significant source of the delay is a hardcoded 2-second timeout at the end of the `start()` method in `src/GameWindowManager.ts`:

```typescript
// src/GameWindowManager.ts - in start() method
// ...
// Wait a bit for the process to be ready
await new Promise(resolve => setTimeout(resolve, 2000));
```

This line introduces an unconditional 2-second wait every time the Electron process is started, which directly corresponds to the user-observed lag. It was likely added to wait for the Electron process to initialize, but a more robust event-driven approach should be used instead.

### Secondary Causes

- **Polling Fallback in `CursorDetector`**: `src/cursorDetector.ts` uses a `FileSystemWatcher` but also has a 2-second polling `setInterval` as a backup. If the file watcher event is missed for any reason, it could take up to 2 seconds for the polling to detect the change in `.cursor/is_working`.
- **Minor Delays**: Small, cumulative delays are present from file I/O operations (checking for Electron installation, reading config) and a 50ms `setTimeout` in `handleIsWorkingFileChange` in `cursorDetector.ts`.

## 2. Multiple Window Spawning

The spawning of multiple windows is caused by a classic race condition in how the `onAiGenerationStart` event is handled.

### Primary Cause: Race Condition in `show()` and `loadGame()`

In `src/extension.ts`, the event listener for `onAiGenerationStart` calls both `gameWindowManager.loadGame()` and `gameWindowManager.show()`.

```typescript
// src/extension.ts
cursorDetector.onAiGenerationStart(() => {
    // ...
    if (selectedGame) {
        gameWindowManager.loadGame(selectedGame);
    }
    gameWindowManager.show();
});
```

Both `loadGame()` and `show()` in `src/GameWindowManager.ts` contain similar logic:

```typescript
// src/GameWindowManager.ts - Simplified logic in both show() and loadGame()
if (!this.electronProcess) {
    this.start().then(() => {
        // ... send command
    });
}
```

**The Race Condition:**

1.  The `onAiGenerationStart` event fires.
2.  `loadGame()` is called. It checks `this.electronProcess`, sees it's `null`, and calls `this.start()` asynchronously.
3.  Immediately after, `show()` is called. Since `this.start()` has not yet completed and assigned a process to `this.electronProcess`, the property is *still `null`*.
4.  `show()` also calls `this.start()` asynchronously.
5.  The result is two separate Electron processes being spawned.

This issue is exacerbated if the `onAiGenerationStart` event itself fires multiple times in quick succession, which can happen with the complex confidence logic in `CursorDetector`.

## Recommendations for Remediation

### Fixing the Delay

1.  **Remove Hardcoded Delay**: Remove the `await new Promise(resolve => setTimeout(resolve, 2000));` line from `GameWindowManager.start()`.
2.  **Event-Driven Readiness**: The window manager already waits for a `'ready'` message from the Electron process to set `this.isReady = true`. This is the correct mechanism. Logic that depends on the window being ready should rely on this flag and the message queue, not arbitrary timers.

### Fixing Multiple Windows

1.  **Introduce a State Flag**: Add a state flag to `GameWindowManager`, such as `isStarting`, to prevent multiple calls to `start()`.

    ```typescript
    // In GameWindowManager
    private isStarting: boolean = false;

    public async start(): Promise<void> {
        if (this.electronProcess || this.isStarting) {
            return; 
        }
        this.isStarting = true;

        try {
            // ... current start() logic ...
        } finally {
            this.isStarting = false;
        }
    }
    ```

2.  **Consolidate Start Logic**: Refactor the event handler in `src/extension.ts` to have a single point of entry for showing the window. The `loadGame` method should not be responsible for also showing the window.

    A better flow would be:
    - `onAiGenerationStart` fires.
    - It calls a single method, e.g., `showGame(game)`.
    - `showGame` is responsible for starting the process (if needed), loading the game content, and showing the window, all while using state flags (`isStarting`, `electronProcess`) to prevent race conditions. 