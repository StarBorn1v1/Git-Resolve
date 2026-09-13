#!/usr/bin/env node

// src/index.tsx
import React2 from "react";
import { render } from "ink";

// src/app.tsx
import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";

// src/git.ts
import { simpleGit } from "simple-git";
async function getRepoState(cwd) {
  const git = simpleGit({ baseDir: cwd });
  try {
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return {
        isRepo: false,
        repoRoot: null,
        branch: null,
        isClean: true,
        ahead: 0,
        behind: 0,
        conflicted: false,
        untracked: 0,
        modified: 0,
        staged: 0
      };
    }
    const repoRoot = await git.revparse(["--show-toplevel"]);
    const status = await git.status();
    return {
      isRepo: true,
      repoRoot,
      branch: status.current,
      isClean: status.isClean(),
      ahead: status.ahead,
      behind: status.behind,
      conflicted: status.conflicted.length > 0,
      untracked: status.not_added.length,
      modified: status.modified.length,
      staged: status.staged.length
    };
  } catch (error) {
    return {
      isRepo: false,
      repoRoot: null,
      branch: null,
      isClean: true,
      ahead: 0,
      behind: 0,
      conflicted: false,
      untracked: 0,
      modified: 0,
      staged: 0
    };
  }
}

// src/actions.ts
var ALL_ACTIONS = [
  {
    id: "view_status",
    label: "View status",
    description: "Check the current state of your repository.",
    riskLevel: "safe",
    isEnabled: (state) => state.isRepo
  },
  {
    id: "view_changes",
    label: "View changes",
    description: "See the exact changes made in modified files.",
    riskLevel: "safe",
    isEnabled: (state) => state.isRepo && (!state.isClean || state.untracked > 0),
    getDisabledReason: (state) => "Working directory is clean."
  },
  {
    id: "view_history",
    label: "View history",
    description: "See recent commits.",
    riskLevel: "safe",
    isEnabled: (state) => state.isRepo
  },
  {
    id: "commit_changes",
    label: "Commit changes",
    description: "Save your changes to history.",
    riskLevel: "safe",
    isEnabled: (state) => state.isRepo && (state.staged > 0 || state.modified > 0 || state.untracked > 0),
    getDisabledReason: (state) => "No changes to commit."
  },
  {
    id: "stash_changes",
    label: "Stash changes",
    description: "Set aside uncommitted changes temporarily.",
    riskLevel: "safe",
    isEnabled: (state) => state.isRepo && (!state.isClean || state.untracked > 0),
    getDisabledReason: (state) => "Working directory is clean."
  },
  {
    id: "undo_changes",
    label: "Undo changes",
    description: "Discard uncommitted changes. This cannot be easily reversed.",
    riskLevel: "destructive",
    isEnabled: (state) => state.isRepo && !state.isClean,
    getDisabledReason: (state) => "No changes to undo."
  },
  {
    id: "recover_work",
    label: "Recover lost work",
    description: "Look through Git reflog to find and recover lost commits or states.",
    riskLevel: "safe",
    isEnabled: (state) => state.isRepo
  },
  {
    id: "sync_remote",
    label: "Sync with remote (Pull/Push)",
    description: "Pull new changes and push your local commits.",
    riskLevel: "warning",
    isEnabled: (state) => state.isRepo && !!state.branch
  },
  {
    id: "change_theme",
    label: "Change Theme",
    description: "Switch application color theme.",
    riskLevel: "safe",
    isEnabled: () => true
  }
];

// src/executor.ts
import { simpleGit as simpleGit2 } from "simple-git";
async function executeAction(actionId, cwd) {
  const git = simpleGit2({ baseDir: cwd });
  try {
    switch (actionId) {
      case "view_status": {
        const status = await git.status();
        let msg = `Branch: ${status.current}
`;
        if (status.isClean()) {
          msg += "Working directory is clean.";
        } else {
          msg += `Modified files: ${status.modified.join(", ")}
`;
          msg += `Untracked files: ${status.not_added.join(", ")}`;
        }
        return { success: true, message: msg };
      }
      case "view_changes": {
        const diff = await git.diff();
        return { success: true, message: diff.substring(0, 1e3) + (diff.length > 1e3 ? "\n... (truncated)" : "") || "No unstaged changes." };
      }
      case "view_history": {
        const log = await git.log({ maxCount: 5 });
        const msg = log.all.map((l) => `* ${l.hash.substring(0, 7)} - ${l.message} (${l.author_name})`).join("\n");
        return { success: true, message: msg || "No commits yet." };
      }
      case "commit_changes": {
        await git.add(".");
        await git.commit("Quick commit from Git Resolve");
        return { success: true, message: "Changes staged and committed successfully." };
      }
      case "stash_changes": {
        await git.stash();
        return { success: true, message: "Changes safely stashed." };
      }
      case "undo_changes": {
        await git.reset(["--hard"]);
        await git.clean("f", ["-d"]);
        return { success: true, message: "All uncommitted changes have been safely discarded." };
      }
      case "recover_work": {
        const rawLog = await git.raw(["reflog", "-n", "5"]);
        if (!rawLog.trim()) {
          return { success: true, message: "No recoverable history found." };
        }
        return { success: true, message: `Recoverable States:

${rawLog}` };
      }
      case "sync_remote": {
        await git.pull().catch(() => {
        });
        await git.push();
        return { success: true, message: "Successfully synced with remote." };
      }
      default:
        return { success: false, message: `Action ${actionId} is not implemented yet.` };
    }
  } catch (e) {
    let msg = e.message;
    if (msg.includes("conflict")) {
      msg = "Merge conflicts detected. Please resolve them in your editor before continuing.";
    } else if (msg.includes("Could not read from remote repository")) {
      msg = "Cannot connect to remote repository. Check your network or credentials.";
    }
    return { success: false, message: `Operation safely aborted: ${msg}` };
  }
}

// src/app.tsx
var THEMES = {
  classic: { border: "blue", text: "cyan", highlight: "yellow", success: "green", textDim: "gray" },
  midnight: { border: "magenta", text: "magentaBright", highlight: "white", success: "magenta", textDim: "gray" },
  amber: { border: "yellow", text: "yellowBright", highlight: "yellow", success: "yellowBright", textDim: "yellow" },
  matrix: { border: "green", text: "greenBright", highlight: "green", success: "greenBright", textDim: "green" }
};
var ASCII_HEADER = `
  ____ _ _     ____                _           
 / ___(_) |_  |  _ \\ ___  ___  ___| |_   _____ 
| |  _| | __| | |_) / _ \\/ __|/ _ \\ \\ \\ / / _ \\
| |_| | | |_  |  _ <  __/\\__ \\ (_) | \\ V /  __/
 \\____|_|\\__| |_| \\_\\___||___/\\___/|_|\\_/ \\___|
`;
var App = () => {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("main");
  const [selectedAction, setSelectedAction] = useState(null);
  const [resultMsg, setResultMsg] = useState("");
  const [activityRail, setActivityRail] = useState([]);
  const [themeName, setThemeName] = useState("classic");
  const theme = THEMES[themeName];
  const refreshState = async () => {
    setLoading(true);
    const s = await getRepoState(process.cwd());
    setState(s);
    setLoading(false);
  };
  useEffect(() => {
    refreshState();
  }, []);
  useInput((input, key) => {
    if (screen === "result" && (key.return || input === " ")) {
      setScreen("main");
    } else if (screen === "briefing") {
      if (input.toLowerCase() === "y") {
        executeSelected();
      } else if (input.toLowerCase() === "n" || key.escape) {
        setScreen("main");
      }
    }
  });
  const handleSelect = (item) => {
    if (item.value === "exit") {
      process.exit(0);
    }
    if (item.value === "change_theme") {
      setScreen("themes");
      return;
    }
    const action = ALL_ACTIONS.find((a) => a.id === item.value);
    if (action) {
      setSelectedAction(action);
      if (action.riskLevel === "safe") {
        executeSelectedAction(action);
      } else {
        setScreen("briefing");
      }
    }
  };
  const handleThemeSelect = (item) => {
    setThemeName(item.value);
    setScreen("main");
  };
  const executeSelectedAction = async (action) => {
    setScreen("executing");
    const res = await executeAction(action.id, process.cwd());
    setResultMsg(res.message);
    setActivityRail((prev) => [...prev, `\u2713 ${action.label}`]);
    await refreshState();
    setScreen("result");
  };
  const executeSelected = () => {
    if (selectedAction) {
      executeSelectedAction(selectedAction);
    }
  };
  if (loading && screen === "main") {
    return /* @__PURE__ */ React.createElement(Text, { color: theme.text }, "Loading repository state...");
  }
  if (!state || !state.isRepo) {
    return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", padding: 1 }, /* @__PURE__ */ React.createElement(Text, { color: "red" }, "Error: Not a git repository."), /* @__PURE__ */ React.createElement(Text, { color: theme.text }, "Please run git-resolve from within a Git project."));
  }
  if (screen === "themes") {
    const themeItems = Object.keys(THEMES).map((t) => ({ label: t.charAt(0).toUpperCase() + t.slice(1), value: t }));
    return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", padding: 1 }, /* @__PURE__ */ React.createElement(Text, { bold: true, color: theme.text }, "SELECT THEME"), /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(SelectInput, { items: themeItems, onSelect: handleThemeSelect })));
  }
  if (screen === "briefing" && selectedAction) {
    return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", padding: 1, borderStyle: "single", borderColor: theme.highlight }, /* @__PURE__ */ React.createElement(Text, { bold: true, color: theme.highlight }, "BRIEFING: ", selectedAction.label.toUpperCase()), /* @__PURE__ */ React.createElement(Box, { marginTop: 1, marginBottom: 1 }, /* @__PURE__ */ React.createElement(Text, { color: theme.text }, selectedAction.description)), /* @__PURE__ */ React.createElement(Text, { color: theme.text }, "Continue? (y/N)"));
  }
  if (screen === "executing") {
    return /* @__PURE__ */ React.createElement(Box, { padding: 1 }, /* @__PURE__ */ React.createElement(Text, { color: theme.text }, "Executing..."));
  }
  if (screen === "result") {
    return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", padding: 1, borderStyle: "round", borderColor: theme.success }, /* @__PURE__ */ React.createElement(Text, { bold: true, color: theme.success }, "RESULT"), /* @__PURE__ */ React.createElement(Box, { marginTop: 1, marginBottom: 1 }, /* @__PURE__ */ React.createElement(Text, { color: theme.text }, resultMsg)), /* @__PURE__ */ React.createElement(Text, { color: theme.textDim }, "Press Enter to return to menu"));
  }
  const items = ALL_ACTIONS.map((a) => {
    const enabled = a.isEnabled(state);
    const label = enabled ? a.label : `${a.label} (Disabled: ${a.getDisabledReason ? a.getDisabledReason(state) : "Not available"})`;
    return { label, value: a.id };
  });
  items.push({ label: "Exit", value: "exit" });
  return /* @__PURE__ */ React.createElement(Box, { padding: 1 }, /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", flexGrow: 1, paddingRight: 2 }, /* @__PURE__ */ React.createElement(Text, { color: theme.text }, ASCII_HEADER), /* @__PURE__ */ React.createElement(Box, { borderStyle: "single", borderColor: theme.border, padding: 1, marginBottom: 1, flexDirection: "column" }, /* @__PURE__ */ React.createElement(Text, null, "Project: ", state.repoRoot), /* @__PURE__ */ React.createElement(Text, null, "Branch:  ", state.branch), /* @__PURE__ */ React.createElement(Text, null, "Status:  ", state.isClean ? "Clean" : `${state.modified} modified, ${state.staged} staged, ${state.untracked} untracked`)), /* @__PURE__ */ React.createElement(Text, { bold: true, color: theme.text }, "SELECT ACTION"), /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(SelectInput, { items, onSelect: handleSelect }))), /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", width: 30, borderStyle: "single", borderColor: theme.border, paddingLeft: 1 }, /* @__PURE__ */ React.createElement(Text, { bold: true, underline: true, color: theme.text }, "ACTIVITY"), activityRail.length === 0 && /* @__PURE__ */ React.createElement(Text, { color: theme.textDim }, "No recent activity"), activityRail.map((act, i) => /* @__PURE__ */ React.createElement(Text, { key: i, color: theme.success }, act))));
};
var app_default = App;

// src/index.tsx
render(/* @__PURE__ */ React2.createElement(app_default, null));
