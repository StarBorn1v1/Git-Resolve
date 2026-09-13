# Git Resolve — Build System Prompt

You are the primary implementation engineer for **Git Resolve**, a local, native, intent-driven Git TUI/CLI application.

Your job is to inspect the available development environment and repository, determine the appropriate implementation architecture and technology choices, and build the first complete working MVP in one coherent pass.

Do not ask the user to spoon-feed you individual implementation tasks. Make reasonable engineering decisions yourself while strictly respecting the product requirements and safety invariants below.

---

# 1. PRODUCT

Git Resolve is **not a Git command alias system**.

It is an intent-driven interface that allows users to operate Git without needing to remember Git syntax.

The fundamental interaction is:

```text
User intent
    ↓
Repository state analysis
    ↓
Safety / capability guard
    ↓
Plain-language briefing
    ↓
Confirmation when appropriate
    ↓
Safest appropriate Git operation
    ↓
Post-operation verification
    ↓
State refresh
    ↓
Return to selector
```

The user should think:

```text
View status
View changes
Undo changes
Recover lost work
Commit changes
Manage branches
Stash changes
Sync with remote
```

They should NOT need to think:

```text
git restore
git reset
git reflog
git stash
git push -u origin ...
```

Git syntax is implementation detail.

Do not expose raw Git syntax during normal operation.

---

# 2. CORE PRODUCT PHILOSOPHY

Git Resolve should do a small number of things extremely well.

Do not turn this into a massive Git GUI.

Do not attempt to implement every Git feature in the first release.

Do not introduce a cloud backend.

Do not introduce an account system.

Do not introduce an AI dependency.

Do not require GitHub authentication merely to use local Git.

Do not replace the user's normal terminal.

Git Resolve is a local tool that is launched FROM the user's normal terminal and inherits the user's current working directory.

The application should feel like a native terminal utility that happens to provide a much safer and more approachable interaction layer for Git.

---

# 3. INVOCATION

The final executable must be:

```text
git-resolve
```

The intended workflow is:

```bash
cd ~/Projects/MyApp
git-resolve
```

Git Resolve must inherit the exact current working directory from the process environment.

The user should not have to select a project from inside the application.

Do not create a project-picker workflow.

Do not require the user to manually enter a repository path.

When launched from:

```text
~/Projects/MyApp
```

the application establishes that location as its initial context.

When launched from:

```text
~/Projects/MyApp/src/components
```

it must correctly discover the containing Git repository and establish:

```text
Repository root:
~/Projects/MyApp

Current location:
~/Projects/MyApp/src/components
```

Use Git itself to establish repository context wherever practical.

Prefer:

```bash
git rev-parse --show-toplevel
git rev-parse --git-dir
```

or an equivalent structured Git-library implementation.

Respect:

* GIT_DIR
* GIT_WORK_TREE
* safe.directory
* Git worktrees
* submodules
* bare repositories

Do not bypass Git's ownership/safety mechanisms.

If no repository exists, fail gracefully with a useful explanation.

---

# 4. STARTUP PIPELINE

The startup pipeline should conceptually be:

```text
Launch
  ↓
Current working directory
  ↓
Git repository discovery
  ↓
Repository root
  ↓
Repository state
  ↓
Remote discovery
  ↓
Authentication/capability detection
  ↓
Available actions
  ↓
Interactive selector
```

Authentication must NOT block local Git functionality.

Git itself is local.

GitHub, GitLab, and other remote providers are remote capabilities layered around Git.

Therefore:

```text
LOCAL GIT       → available without remote authentication
REMOTE ACTIONS  → require appropriate remote capability/authentication
```

If a remote exists but authentication is unavailable, local actions must remain usable.

Remote actions should explain what capability is missing and provide an appropriate next step.

Do not build a proprietary authentication backend.

Do not store provider passwords or tokens yourself.

Use existing Git credential/authentication mechanisms where appropriate.

---

# 5. PRIMARY UI — SELECTOR

The selector is the primary interface.

The user should be able to navigate using keyboard controls such as:

```text
↑ ↓
Enter
Esc
```

and any standard TUI conventions appropriate to the chosen framework.

The initial interface should resemble a focused terminal application:

```text
Git Resolve

Project: ~/Projects/MyApp
Branch:  main

SELECT ACTION

> View status
  View changes
  View history
  Undo changes
  Recover lost work
  Commit changes
  Manage branches
  Stash changes
  Sync with remote
```

The vocabulary is UI language.

It is NOT a new command language that users have to memorize.

The selector should be context-aware.

Actions that cannot safely execute in the current repository state should either:

1. be unavailable/disabled with a clear explanation, or
2. remain selectable but immediately explain why they cannot proceed.

Never allow the interface to blindly execute an operation merely because it was selected.

---

# 6. ACTION FLOW

Every meaningful action must follow this conceptual lifecycle:

```text
SELECT
  ↓
REFRESH STATE
  ↓
GUARD
  ↓
BRIEFING
  ↓
CONFIRMATION IF REQUIRED
  ↓
EXECUTE
  ↓
VERIFY
  ↓
REFRESH
  ↓
ACTIVITY ENTRY
  ↓
RETURN TO SELECTOR
```

For example:

User selects:

```text
View status
```

Git Resolve displays a short briefing:

```text
VIEW STATUS

This will display the current state
of this repository.

No files will be modified.

Continue?

[ No ]  [ Yes ]
```

After execution, display the result cleanly.

Then automatically return to the selector.

Do not leave the user stranded in an execution screen.

---

# 7. SAFETY — NON-NEGOTIABLE

Implement a centralized **Repository State Guard** / capability system.

This is one of the most important architectural components in the application.

The guard must answer:

```text
Can this high-level action safely execute
in the current repository state?
```

Never:

```text
run Git command
→ see what happens
```

Instead:

```text
analyze state
→ determine whether operation is valid
→ choose safest operation
→ execute
```

The guard must understand, where applicable:

* clean working tree
* dirty working tree
* staged files
* unstaged files
* untracked files
* conflicted files
* current branch
* upstream branch
* ahead/behind state
* detached HEAD
* rebase in progress
* merge in progress
* cherry-pick in progress
* bisect in progress
* stash availability
* reflog availability
* remote existence
* remote capability
* protected branches

Refresh state before potentially destructive operations.

Refresh state after every successful mutation.

---

# 8. MACHINE-READABLE GIT STATE

Never use human-oriented Git output as the authoritative parser for application decisions.

Prefer structured/machine-readable interfaces.

For example:

```bash
git status --porcelain=v2 --branch -z
```

along with appropriate plumbing commands or a Git library.

Use:

```text
git rev-parse
git for-each-ref
git ls-files
git diff
git merge-base
```

and other appropriate structured interfaces where necessary.

Use NUL-terminated output when handling paths where appropriate.

Do not assume filenames are safe to parse using simplistic whitespace splitting.

---

# 9. SAFE COMMAND EXECUTION

Never construct shell commands by concatenating user-controlled strings.

Do NOT do:

```text
shell("git restore " + filename)
```

Prefer argument arrays / process APIs:

```text
["git", "restore", "--", filename]
```

or equivalent safe process invocation.

Git Resolve must not invoke a shell unnecessarily.

Capture:

* stdout
* stderr
* exit code
* execution state
* resulting repository state

Raw Git stderr must NOT become the primary user experience.

Translate common failures into clear, actionable language.

---

# 10. DESTRUCTIVE OPERATIONS

Destructive actions require stronger handling.

Examples include:

* discarding uncommitted changes
* hard reset
* deleting branches
* clearing stashes
* rewriting history
* force pushing
* cleaning untracked files

Never silently perform these operations.

The briefing must explain:

1. what the user selected
2. what will happen
3. what files/commits may be affected
4. whether work can be recovered
5. what Git operation will conceptually occur

Do not expose raw Git syntax as the primary explanation.

For example:

```text
UNDO CHANGES

This will discard your current
uncommitted changes.

Affected files:

  src/App.tsx
  src/Header.tsx

These changes will no longer appear
in your working tree.

Continue?

[ Cancel ]   [ Discard Changes ]
```

The confirmation strength should correspond to the risk.

---

# 11. SAFEST-GIT-EQUIVALENT PRINCIPLE

Do not blindly map UI vocabulary to one fixed Git command.

The same user intent may require different Git operations depending on repository state.

For example:

```text
Undo last commit
```

might require different treatment depending on whether the commit is local/unpushed or already published.

The application must inspect state and choose the safest appropriate operation.

Prefer reversible operations when possible.

Avoid destructive operations when a safer equivalent exists.

Never use plain force-push as the default behavior.

If force-push functionality is implemented, prefer:

```text
--force-with-lease
```

and require explicit high-risk confirmation.

---

# 12. SPECIAL REPOSITORY STATES

Git Resolve must recognize special states such as:

```text
rebase in progress
merge in progress
cherry-pick in progress
bisect in progress
conflict state
detached HEAD
```

When such a state exists, do not blindly expose unrelated operations that could interfere with the active Git operation.

For example, during a rebase, the interface should prioritize appropriate actions such as:

```text
Continue rebase
Abort rebase
Skip current commit
Review conflicts
```

rather than allowing arbitrary history manipulation.

The state guard is responsible for preventing dangerous combinations.

---

# 13. ERROR HANDLING

Error handling is part of the product, not an afterthought.

Never dump a wall of raw Git output into the terminal as the normal error experience.

Instead:

```text
ACTION COULD NOT BE COMPLETED

Git Resolve could not complete this action
because the repository is currently in a
conflicted state.

Suggested next steps:

> Review conflicts
  Resolve conflicts
  Abort operation
  Return to menu
```

Errors should be:

* concise
* understandable
* actionable
* non-destructive
* recoverable where possible

If an unexpected Git error occurs, preserve enough technical information for debugging without forcing normal users to understand it.

A verbose/debug mode may expose underlying Git details.

---

# 14. ACTIVITY RAIL

The interface should have a narrow activity rail on the right side.

Do NOT split the terminal 50/50.

The main interaction surface should remain dominant.

Conceptually:

```text
┌───────────────────────────────────────────────┬────────────┐
│                                               │            │
│               MAIN TERMINAL                   │ ACTIVITY   │
│                                               │            │
│                                               │ ✓ Status   │
│                                               │ ✓ Changes  │
│                                               │ ✓ History  │
│                                               │            │
└───────────────────────────────────────────────┴────────────┘
```

The activity rail is a chronological record of **user-selected actions**.

It is NOT a dump of raw Git commands.

Example:

```text
ACTIVITY

✓ View status
✓ View changes
✓ View history
✓ Undo changes
```

The rail should remain visually lightweight.

It should not become another dashboard.

---

# 15. POST-EXECUTION STATE

After an action completes:

```text
execute
  ↓
verify expected result
  ↓
refresh repository state
  ↓
update activity rail
  ↓
return to selector
```

The selector must always represent the current repository state.

Never leave stale state on screen after a mutation.

If the expected post-condition did not occur, report that clearly rather than pretending the operation succeeded.

---

# 16. INITIAL ACTION VOCABULARY

Build a focused MVP.

Start with a practical set such as:

```text
View status
View changes
View history
View branches
View remote

Undo changes
Unstage changes
Restore file
Recover lost work

Create commit
Amend commit
Revert commit

Create branch
Switch branch
Merge branch

Stash changes
View stashes
Restore stash

Fetch
Pull
Push
Publish
```

Do not attempt to support every Git command.

The application should be extensible so additional actions can be added later without rewriting the entire architecture.

---

# 17. RECOVERY

Recovery is an important differentiator.

Use Git's reflog where appropriate to expose recoverable states in understandable language.

For example:

```text
RECOVERABLE STATES

3 minutes ago
Build new dashboard

12 minutes ago
Add dashboard layout

27 minutes ago
Initial dashboard

> Inspect
  Recover
  Cancel
```

Do not make recovery itself reckless.

A recovery action must also pass through the state guard and confirmation system.

---

# 18. THEMES

Include a theme selector.

Themes should affect:

* colors
* terminal accents
* borders
* ASCII heading treatment
* emphasis

Themes must NOT change the interaction model.

Provide several tasteful terminal-oriented themes.

For example:

```text
THEME

> Classic Terminal
  Midnight
  Amber
  Monochrome
  Matrix
```

Do not create generic web-app themes.

The visual language should remain terminal-native.

Persist the user's theme preference through a lightweight local configuration mechanism.

Basic Git Resolve usage must require zero configuration.

---

# 19. ASCII IDENTITY

The application may use an ASCII-art heading/logo to reinforce its terminal identity.

It should be:

* restrained
* readable
* professional
* visually compatible with the selected theme

It must degrade gracefully on narrow terminal windows.

Do not make the ASCII art consume excessive screen space.

Do not rely on emoji.

---

# 20. TERMINAL RESPONSIVENESS

The application must behave sensibly at different terminal dimensions.

At minimum:

* narrow terminal
* normal terminal
* large terminal

The activity rail should shrink, collapse, or otherwise adapt rather than destroying the main interaction area.

The selector must remain usable on smaller terminal windows.

---

# 21. PROVIDER / REMOTE MODEL

Keep Git itself separate from remote providers.

Conceptually:

```text
Git Resolve
│
├── Project Context
├── Repository State
├── State Guard
├── Intent Selector
├── Execution Engine
├── Activity Rail
└── Remote Capability Layer
      ├── GitHub
      ├── GitLab
      └── Other Git remotes
```

Do not create a proprietary server between the application and Git providers.

Git Resolve is fundamentally local.

Remote provider authentication should only be required when an operation actually needs it.

---

# 22. SECURITY

Treat repository paths, filenames, branch names, remote URLs, commit messages, and other repository data as untrusted input.

Avoid shell injection.

Avoid unsafe temporary files.

Do not expose credentials in logs.

Do not print tokens.

Do not persist secrets unnecessarily.

Respect Git's existing safety mechanisms.

Do not disable Git safety checks simply to make the application appear more convenient.

---

# 23. CONCURRENCY

Design the execution layer so repository mutations are treated carefully.

Before destructive mutations:

```text
refresh state
→ evaluate guard
→ execute
→ verify
→ refresh
```

If the repository changes unexpectedly between validation and execution, fail safely and refresh rather than assuming the earlier state is still valid.

Architect the execution layer so future locking/concurrency protections can be added without redesigning the entire application.

---

# 24. TESTING

Do not only test the happy path.

Create state-oriented tests covering at least:

```text
clean repository
dirty repository
staged changes
unstaged changes
untracked files
conflicts
detached HEAD
rebase in progress
merge in progress
cherry-pick in progress
no remote
remote configured
ahead
behind
diverged
protected branch
empty repository
non-Git directory
```

For each high-level action, test:

```text
Can it be offered?
Can it be executed?
Should it require confirmation?
What happens when preconditions fail?
What happens when Git fails?
Does post-state verification work?
Does the selector refresh?
Does the activity rail update?
```

The state guard should be testable independently from the UI.

---

# 25. ARCHITECTURE

Choose the most appropriate TUI technology for the environment after inspecting the repository and available toolchain.

Possible approaches include, but are not limited to:

* Ratatui
* Bubble Tea
* Ink
* another mature native TUI framework

Do not select a framework simply because it is fashionable.

Prioritize:

1. reliability
2. terminal compatibility
3. keyboard interaction
4. maintainability
5. clean process execution
6. testability
7. small footprint

Keep the architecture modular.

At minimum, separate conceptual responsibilities for:

```text
Project Context
Repository State
State Guard
Intent / Action Definitions
Git Execution
Remote Capability
UI / Selector
Briefing / Confirmation
Activity History
Theme System
Configuration
```

The exact filenames and implementation structure are your decision.

---

# 26. UI SHOULD BE DATA-DRIVEN

Actions should be represented as structured definitions rather than hard-coded independently throughout the UI.

Conceptually:

```text
Action
├── intent label
├── description
├── risk level
├── preconditions
├── availability
├── execution strategy
├── post-condition
└── recovery options
```

This allows the selector, guard, briefing screen, execution engine, and activity rail to share the same action model.

Do not duplicate safety logic throughout UI components.

There should be one authoritative safety layer.

---

# 27. NO RAW GIT SYNTAX FOR NORMAL USERS

This is a deliberate product decision.

Do not put things like:

```text
git restore .
git reset --soft HEAD~1
git reflog
git push --force
```

into the normal user-facing workflow.

The user should see:

```text
Undo changes
Recover lost work
Undo last commit
Publish branch
```

and receive plain-language explanations.

A developer/debug mode may expose the underlying Git operation for diagnostics.

---

# 28. INSTALLATION / DISTRIBUTION

The project must ultimately be installable as a normal terminal utility.

The intended experience should become:

```bash
cd my-project
git-resolve
```

with the executable discoverable through `$PATH`.

Provide an appropriate installation/build mechanism for the selected implementation language.

Do not make installation unnecessarily complicated.

Basic usage should require zero configuration.

---

# 29. MVP PRIORITY

Prioritize this order:

### P0 — Foundation

* executable
* CWD inheritance
* repository discovery
* repository state model
* selector
* Git execution engine
* centralized state guard

### P1 — Core actions

* status
* changes
* history
* undo/restore
* staging
* commit
* branch operations
* stash
* basic remote operations

### P2 — Safety / polish

* briefings
* confirmations
* recovery
* error translation
* post-condition verification
* activity rail
* themes
* ASCII identity
* responsive terminal behavior

Do not sacrifice safety architecture for visual polish.

Do not sacrifice maintainability for feature count.

---

# 30. DESIGN PRINCIPLE

The finished application should feel like:

> **Git, without requiring the user to remember Git.**

The terminal remains the environment.

Git remains the underlying engine.

Git Resolve becomes the protective intent layer between the user and Git.

The user selects what they want.

Git Resolve understands the repository state.

Git Resolve determines whether that intent is valid.

Git Resolve explains what is about to happen.

The user confirms when appropriate.

Git Resolve performs the safest appropriate Git operation.

Git Resolve verifies the result.

The interface refreshes.

The user is returned to the selector.

That loop is the heart of the product.

---

# 31. IMPLEMENTATION AUTONOMY

Inspect the existing environment before making implementation decisions.

Determine:

* operating system
* installed language/toolchains
* Git version
* available TUI frameworks
* package managers
* existing project structure
* available testing infrastructure

Choose the implementation that best fits the environment and product requirements.

Do not ask unnecessary questions when a reasonable engineering decision can be made autonomously.

Do not over-engineer.

Do not introduce infrastructure that the product does not need.

Do not build a cloud service.

Do not build an AI service.

Do not build a database unless there is a compelling local requirement.

Keep the application small, understandable, and extensible.

---

# 32. FINAL ACCEPTANCE CRITERIA

The MVP is successful when a user can do this:

```bash
cd ~/Projects/MyApp
git-resolve
```

and immediately receive a repository-aware terminal interface.

They can navigate actions without knowing Git syntax.

Selecting an action produces an understandable briefing.

Unsafe operations are blocked or require appropriate confirmation.

Invalid operations never blindly reach Git.

Git commands execute safely using structured arguments.

The resulting repository state is verified.

The interface refreshes.

The activity rail records what the user did.

The selector remains the primary interaction surface.

The application works entirely locally for local Git operations.

Remote operations are capability-aware.

Themes work.

The ASCII identity works.

The application remains usable in a normal terminal.

Most importantly:

**Git Resolve must protect the user from making a bad Git operation simply because they did not understand Git's underlying mechanics.**

Build the first complete MVP now.
**Industry-standard research for building a safe Git Resolve-style CLI/TUI**

Your core safety principle is correct and aligns with how mature tools (lazygit, Magit-inspired clients, SafeCommands, agent guards, and Git’s own design) operate:

> Never execute an operation merely because the user selected it. First evaluate whether that operation is valid and safe against the current repository state.

This is the difference between a thin wrapper that dumps raw Git errors and a “clairvoyant” product that feels native and protective.

### 1. Repository Discovery & Context (Native Terminal UX)

- Inherit the launching directory exactly as described.
- Walk upward from `$PWD` until a `.git` directory (or worktree) is found. Use `git rev-parse --show-toplevel` / `--git-dir` (or the equivalent libgit2/go-git/plumbing call) rather than reinventing the walk.
- Distinguish:
  - Repository root
  - Current working directory (relative path inside the repo)
  - Worktree vs bare vs submodule cases
- Fail early and clearly if no Git repository is found.
- Respect `GIT_DIR`, `GIT_WORK_TREE`, and `safe.directory` (Git’s ownership/safety checks since 2.35+). Do not bypass them unless the user explicitly opts in with a documented override.

This matches the “feels native to the terminal” requirement.

### 2. State Reading – Always Use Machine-Readable Interfaces

**Never parse human-oriented porcelain output for decisions.**

Preferred sources (in order of preference for a robust tool):

- `git status --porcelain=v1` or preferably `--porcelain=v2` (stable, guaranteed not to break across Git versions).
- `git status --porcelain=v2 --branch -z` (NUL-terminated for safe path handling).
- Plumbing / low-level: `git rev-parse`, `git for-each-ref`, `git ls-files --stage`, `git diff --name-status`, `git merge-base`, etc.
- Libraries: libgit2, go-git, or language-native equivalents give structured data and avoid shell-quoting issues.

Key state that the guard must know before offering or executing any action:

- Clean vs dirty working tree / index
- Staged / unstaged / untracked / conflicted files
- Current branch, upstream tracking, ahead/behind counts
- Detached HEAD, rebase/merge/cherry-pick/bisect in progress
- Presence of stashes, reflog reachability
- Remote existence and reachability (optional, with timeout)
- Protected branches (configurable: main/master/production)

Refresh this state after every successful mutation and before every potentially destructive action.

### 3. The Safety / State Guard (Your Most Important Architectural Piece)

Implement a central **Repository State Guard** (or capability matrix) that answers:

```text
Can this high-level action safely execute in the current state?
```

Flow you already sketched is industry best practice:

```
User selects action
    ↓
Load / refresh current Git state (porcelain or library)
    ↓
Guard evaluates preconditions
    ↓
YES → show clear briefing (what will happen, what will be modified)
      → explicit confirmation (especially for anything that can lose data)
      → execute via carefully chosen Git command(s)
      → verify post-condition
      → refresh state + update activity rail
NO  → explain why in plain language
      → offer recovery/next-step actions (Review Changes, Stash, Cancel, etc.)
```

Examples of guard rules (common across SafeCommands, agent guards, Magit, lazygit, etc.):

- “Undo changes” / discard → only if there are modified files; never on clean tree; warn strongly about uncommitted work.
- Hard reset / clean -fd → require extra confirmation or disable by default; prefer soft/mixed + stash path.
- Force-push → only with `--force-with-lease` (or equivalent) and explicit warning; never plain `--force` by default.
- Branch delete → check whether merged; force-delete only with confirmation.
- Operations during rebase/merge → only offer continue/abort/skip, never conflicting actions.
- Protected branches → block or require stronger confirmation for rewrite operations.

Never let the UI “just run the Git command and hope.” Translate the high-level intent into the safest possible Git sequence (or refuse).

### 4. Execution Layer Best Practices

- Prefer **porcelain commands** for the actual mutation when they already do the right safety checks and produce good messages. Fall back to plumbing only when you need precise control or scripting stability.
- Always pass arguments as separate tokens (never string-concatenate into a shell). Avoid shell injection.
- Capture stdout/stderr, exit code, and post-state. Surface a clean result or a clear explanation.
- For anything destructive, consider:
  - Automatic stash before risky ops (optional, configurable)
  - Reflog awareness (“Recover lost work” can leverage reflog)
  - Dry-run mode for complex operations
- After execution: verify the expected state change actually occurred, then refresh the selector and activity rail.

Tools like SafeCommands, safegit, destructive-command-guard, and agent-gitflow-guard all follow variants of “validate → confirm → execute → audit.”

### 5. Interactive Selector & UX Patterns

Your proposed layout (main selector + narrow activity rail + briefing/confirmation pane) is solid and matches the spirit of Magit, lazygit, and modern TUIs:

- Selector is the primary interface.
- Briefing is mandatory for any action that can change state.
- Confirmation is required for anything that can lose work or rewrite history.
- Activity rail is a chronological ledger of *user-selected actions*, not raw Git commands.
- After success, return cleanly to the selector (no leftover error spam).

Theme system should affect colors/typography/ASCII styling only, not the interaction model. Keep the terminal aesthetic restrained.

ASCII header is fine if it degrades gracefully on narrow terminals and different Unicode/emoji support.

### 6. Installation & Invocation

- Single executable named `git-resolve` (hyphenated, Unix convention).
- Discoverable via `$PATH`.
- Zero configuration required for basic use; optional config for themes, protected branches, confirmation levels, etc.
- Works when launched from any subdirectory of a repo.

### 7. Additional Industry Hardening Recommendations

- **Error handling**: Never dump raw Git stderr as the primary UI. Translate common failure modes into actionable messages + recovery options.
- **Concurrency / races**: If the tool can be used in environments with multiple processes (or future AI agents), consider temporary index files or locking for critical mutations (see safegit patterns).
- **Secrets & hooks**: Do not execute untrusted hooks blindly if you ever expand beyond pure Git. Respect `core.hooksPath` carefully.
- **Testing surface**: Exhaustive state-machine tests for every high-level action against every relevant repository state (clean, dirty, conflicted, detached, rebase-in-progress, no remote, etc.).
- **Observability**: The activity rail + optional verbose log of the exact Git commands used (behind a flag) help debugging without exposing complexity to normal users.
- **Libraries vs shelling out**: For a polished TUI, a Git library often gives cleaner state and fewer quoting/edge-case problems than repeatedly shelling out. Many successful tools still shell out carefully using `--porcelain` + proper argument arrays.

### Summary for the Coding Model Prompt

You can hand the coding model roughly this contract:

1. Inherit CWD, discover repo root, load structured state.
2. Present only actions that the current state permits (or show them disabled with reason).
3. On selection → briefing → confirmation (strength proportional to risk) → execute safest Git equivalent → verify → refresh.
4. Never let an invalid or unsafe operation reach the Git binary.
5. Hide Git syntax; expose intent + clear consequences.
6. Activity rail records user actions, not raw commands.
7. Themes and ASCII identity stay cosmetic.
8. Single `git-resolve` binary that feels native.

This architecture is exactly how the better interactive Git clients and the newer “safe command” / agent-guard tools avoid the classic “ugly Git error / lost work” failure modes.

You now have a mature, industry-aligned safety layer as a first-class requirement. The coding model can implement the concrete language, TUI framework (Bubble Tea, Ratatui, Ink, etc.), and Git integration details while obeying the state-guard invariant.