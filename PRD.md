# Product Requirements Document: Ritalin for Cursor

## Executive Summary

**Product Name:** Ritalin for Cursor  
**Product Type:** VS Code Extension  
**Version:** 1.0.0  
**Date:** December 2024  
**Author:** Team Ritalin  

### Vision Statement
Create a VS Code extension that transforms idle waiting time during AI code generation into productive micro-gaming sessions, maintaining developer focus and preventing context switching while Cursor AI processes requests.

### Problem Statement
Developers using AI coding assistants face 15-60 second wait times during code generation. This "micro-downtime" often leads to:
- Context switching to browsers/social media
- Loss of flow state
- Difficulty re-engaging with the problem
- Reduced overall productivity

### Solution
An extension that automatically displays engaging, pauseable mini-games during AI generation periods, keeping developers mentally engaged within the IDE environment.

---

## User Personas

### Primary: "The Distracted Developer"
- **Age:** 25-40
- **Behavior:** Frequently switches to Reddit/Twitter during AI generation
- **Pain Point:** Loses 5-10 minutes per context switch
- **Goal:** Stay focused on coding tasks

### Secondary: "The Flow State Seeker"
- **Age:** 20-50
- **Behavior:** Values deep work and uninterrupted coding sessions
- **Pain Point:** AI wait times break concentration
- **Goal:** Maintain mental engagement without leaving IDE

---

## Functional Requirements

### Core Features (MVP)

#### 1. AI Generation Detection
- **Requirement:** Detect when Cursor AI begins generating code
- **Acceptance Criteria:**
  - Detects generation start within 100ms
  - Detects generation completion within 100ms
  - Works with all Cursor AI features (chat, inline, commands)

#### 2. Game Display System
- **Requirement:** Display mini-game in non-intrusive window
- **Acceptance Criteria:**
  - Game appears within 500ms of generation start
  - Game window is draggable and resizable
  - Game pauses when window loses focus
  - Game state persists between sessions

#### 3. Game Integration
- **Requirement:** Embed "Die in the Dungeon" web game
- **Acceptance Criteria:**
  - Game loads successfully from itch.io
  - Game is playable with mouse only
  - No audio by default (configurable)
  - Handles network failures gracefully

#### 4. Auto-Hide Mechanism
- **Requirement:** Hide game when AI completes or needs input
- **Acceptance Criteria:**
  - Game hides within 200ms of generation completion
  - Smooth fade transition
  - Returns focus to editor
  - Preserves game state for next session

### Enhanced Features (v1.1+)

#### 5. Statistics Dashboard
- Track total "productive waiting time"
- Show games played vs. context switches avoided
- Daily/weekly/monthly views

#### 6. Multiple Games
- Game rotation system
- User-selectable game library
- Quick game switching

#### 7. Customization Options
- Delay before game appears (0-5 seconds)
- Window position presets
- Opacity controls
- Size preferences

#### 8. Achievements System
- "Focus Streaks" - consecutive sessions without switching apps
- "Patient Coder" - accumulated waiting time milestones
- "Game Master" - game-specific achievements

---

## Technical Requirements

### Architecture

```
ritalin-for-cursor/
├── src/
│   ├── extension.ts          # Main extension entry
│   ├── detectors/
│   │   ├── aiDetector.ts     # AI generation detection
│   │   └── cursorApi.ts      # Cursor-specific hooks
│   ├── views/
│   │   ├── gamePanel.ts      # WebView panel management
│   │   └── gameLoader.ts     # Game iframe handling
│   ├── state/
│   │   ├── gameState.ts      # Game state persistence
│   │   └── statistics.ts     # Usage tracking
│   └── config/
│       └── settings.ts       # User preferences
├── resources/
│   ├── games/               # Local game fallbacks
│   └── styles/              # UI styling
└── tests/
```

### Technical Specifications

#### Platform Requirements
- VS Code 1.74.0+
- Cursor (latest version)
- Internet connection (for game loading)

#### Performance Constraints
- Extension activation: < 2 seconds
- Game load time: < 3 seconds
- Memory usage: < 100MB
- CPU usage: < 5% when idle

#### Security Considerations
- Sandboxed WebView execution
- No external data collection
- Local storage only
- Content Security Policy enforcement

---

## User Interface

### Game Window States

1. **Hidden State**
   - No visual presence
   - Zero performance impact

2. **Loading State**
   - Subtle loading indicator
   - Semi-transparent overlay

3. **Active State**
   - Configurable size (default: 400x600px)
   - Draggable title bar
   - Minimize/close buttons
   - Opacity slider (50-100%)

4. **Minimized State**
   - Small icon in status bar
   - Click to restore

### Configuration UI
- Settings accessible via Command Palette
- Visual preview of window positions
- Game selection gallery

---

## Success Metrics

### Quantitative
- **Adoption Rate:** 10% of Cursor users within 3 months
- **Retention:** 60% weekly active users after 1 month
- **Engagement:** Average 5+ game sessions per day per user
- **Performance:** < 1% CPU usage increase

### Qualitative
- User feedback: "Helps me stay focused"
- Reduced self-reported context switching
- Positive reviews on VS Code marketplace

---

## Implementation Phases

### Phase 1: MVP (Week 1-2)
- Basic AI detection
- Single game integration
- Simple show/hide mechanics

### Phase 2: Polish (Week 3)
- Smooth transitions
- State persistence
- Error handling

### Phase 3: Enhancement (Week 4+)
- Statistics tracking
- Multiple games
- Achievements

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| CORS blocking game loading | High | Proxy server or local game copies |
| Cursor API changes | High | Version detection and fallbacks |
| Performance degradation | Medium | Lazy loading and resource limits |
| Game addiction concerns | Low | Time limits and productivity metrics |

---

## Open Questions

1. Should we support custom game URLs?
2. How to handle multiple Cursor windows?
3. Integration with Cursor's native UI vs. floating window?
4. Monetization strategy (free vs. premium games)?

---

## Appendix

### Competitive Analysis
- No direct competitors identified
- Similar concepts: VS Code Pets, Power Mode
- Differentiation: Productivity-focused gaming

### Technical Resources
- VS Code Extension API
- WebView API Documentation
- itch.io embed guidelines

### Legal Considerations
- Game licensing and embedding rights
- User data privacy
- Extension marketplace requirements 