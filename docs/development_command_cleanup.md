# Command Cleanup Plan

This document outlines the plan for removing obsolete and debug-related commands from the Ritalin extension. The goal is to streamline the command palette and remove unused code, focusing on the core user experience.

The two commands that will **remain** are:
*   `ritalin.showConfig` (Ritalin: Show Configuration Page)
*   `ritalin.manageGames` (Ritalin: Manage Downloaded Games)

## Commands to be Removed

The following commands have been identified as redundant, for debugging, or their functionality is now handled automatically or through the configuration UI.

| Command ID                      | Title in Palette                  | Reason for Removal                                                                                              | Related Code                                                                                                                                                                 |
| ------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ritalin.showGame`              | Ritalin: Show Game                | **Redundant**. The game window is now shown automatically when AI generation starts. This is a manual override.   | `GameWindowManager.show()`. The method itself is essential and used by `cursorDetector`, but the command is not.                                                           |
| `ritalin.hideGame`              | Ritalin: Hide Game                | **Redundant**. The game window is hidden automatically when AI generation ends. This is a manual override.      | `GameWindowManager.hide()`. The method is essential and used by `cursorDetector`, but the command is not.                                                                  |
| `ritalin.searchGames`           | Ritalin: Search itch.io Games     | **Redundant**. Game searching is integrated into the "Manage Downloaded Games" dialog and the main config page. | `showGameSearchDialog()`. The function is still required by `showGameManagementDialog()`, but the direct command is unnecessary.                                           |
| `ritalin.openSettings`          | Ritalin: Open Settings            | **Redundant**. The main configuration page (`showConfig`) is the primary interface for settings.                  | `vscode.commands.executeCommand('workbench.action.openSettings')`. Basic VS Code functionality, but the command is unneeded.                                               |
| `ritalin.testExternalWindow`    | Ritalin: Test External Window     | **Redundant**. Alias for `ritalin.showGame`.                                                                    | `GameWindowManager.show()`. Same as `ritalin.showGame`.                                                                                                                      |
| `ritalin.configureExternalWindow` | Ritalin: Configure External Window | **Redundant**. External window settings should be part of the main configuration page.                           | `vscode.commands.executeCommand('workbench.action.openSettings')`.                                                                                                           |
| `ritalin.preloadGame`           | Ritalin: Preload Game (Debug)     | **Unimplemented**. The command exists in `package.json` but has no implementation in `extension.ts`.              | `GameWindowManager.preload()`. The method is called on activation, not by a command.                                                                                       |
| `ritalin.showDashboard`         | Ritalin: Show Detection Dashboard | **Unimplemented**. Exists in `package.json` but is not implemented.                                             | None.                                                                                                                                                                        |
| `ritalin.runSetup`              | Ritalin: Run First-Time Setup     | **Unimplemented**. Exists in `package.json` but is not implemented. Setup runs on activation.                   | `createCursorFiles()`. This function runs on activation.                                                                                                                   |
| `ritalin.debugShowGame`         | Ritalin: Debug - Show Game Window | **Debug**. For development use only.                                                                            | Calls `GameWindowManager.loadGame()` and `show()`.                                                                                                                           |
| `ritalin.debugHideGame`         | Ritalin: Debug - Hide Game Window | **Debug**. For development use only.                                                                            | Calls `GameWindowManager.hide()`.                                                                                                                                            |
| `ritalin.debugGameStatus`       | Ritalin: Debug - Show Game Status | **Debug**. For development use only.                                                                            | Calls various `GameManager` and `CursorDetector` status functions.                                                                                                         |

## Action Items

1.  **Modify `package.json`**: Remove the JSON objects corresponding to the commands listed above from the `contributes.commands` array.
2.  **Modify `src/extension.ts`**: Remove the `vscode.commands.registerCommand` calls for each of the identified commands from the `context.subscriptions` push array.

## Core Modules Status

The following modules and functions are still in use and **should not be removed**:

-   **`GameWindowManager`**: All methods, especially `show()`, `hide()`, and `loadGame()`, are critical for the automatic game window management driven by `CursorDetector`.
-   **`GameManager`**: All methods are used by the configuration page (`ConfigPanel`) and the game management dialog (`showGameManagementDialog`).
-   **`CursorDetector`**: The core of the automatic detection, this remains unchanged.
-   **`ConfigPanel`**: The main UI for users to configure the extension and manage games.
-   **`showGameManagementDialog()`**: The implementation for the `ritalin.manageGames` command.
-   **`showGameSearchDialog()`**: Used by `showGameManagementDialog()` and the `ConfigPanel` webview.
-   **`downloadAndSelectGame()`**: Helper function used by the search dialog.

This cleanup will simplify the user-facing command list and make the codebase easier to maintain. 