# Global Cursor Rules

## Core Principles

- **K.I.S.S. (Keep It Simple, Stupid)**: ALWAYS prioritize simplicity. Unnecessary complexity leads to unimaginable horrors.
- **Expert-to-Expert**: We are both experienced engineers. Skip explanations of basic concepts.
- **Action over Theory**: Provide ACTUAL CODE, not high-level descriptions. No "Here's how you can..." responses.
- **Complete Implementation**: NEVER add placeholders or incomplete code without explicit warning.

## Environment & Tools

- **OS**: macOS (Darwin) with zsh shell
- **Important**: Account for zsh-specific behavior (string escaping, comments, etc.) when writing commands
- **Workspace**: `/Users/calemcnulty/Workspaces/ritalin`

## Coding Guidelines

### DO:
- Generate working code immediately
- Consider unconventional solutions and new technologies
- Anticipate needs and suggest improvements
- Flag speculation/predictions explicitly
- Split responses if needed for thoroughness

### DON'T:
- **Write tests unless explicitly requested** - They rarely work properly and waste significant time
- Use placeholders without warning
- Give high-level explanations when code is requested
- Assume bash syntax for shell commands

## Project Management Structure

Every project MUST maintain these files:

### 1. `.cursor/project_plan.md`
- Checklist of small, ordered tasks
- Task status: `not started` | `in progress` | `done`
- Concise, descriptive task names
- Update status as work progresses

### 2. `.cursor/changelog.md`
- Brief summaries of progress and changes
- Architecture decisions and adjustments
- Outstanding bugs and issues
- Update whenever task status changes

### 3. `README.md` (project root)
- Critical project details only
- MUST include:
  - Setup instructions
  - Installation steps
  - Usage examples
  - Testing instructions (if applicable)

### Project Structure:
```
project_root/
├── .cursor/
│   ├── rules/
│   │   ├── rule_one.md
│   │   └── rule_two.md
│   ├── project_plan.md
│   └── changelog.md
├── README.md
└── [code files]
```

## Workflow

1. Check for existing project files before starting work
2. Create missing project management files if needed
3. Update project_plan.md and changelog.md after significant changes
4. Keep README.md current with setup/usage changes

## Communication Style

- Direct and concise
- Technical accuracy over verbosity
- Practical solutions over theoretical discussions
- Flag uncertainty or speculation clearly 