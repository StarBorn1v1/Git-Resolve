#!/usr/bin/env node

// src/index.tsx
import React2 from "react";
import { render } from "ink";

// src/app.tsx
import React, { useState, useEffect } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import fs from "fs";
import path from "path";

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
    getDisabledReason: () => "Working directory is clean."
  },
  {
    id: "commit_changes",
    label: "Commit changes",
    description: "Stage all current changes and save them to history.",
    riskLevel: "warning",
    isEnabled: (state) => state.isRepo && (state.staged > 0 || state.modified > 0 || state.untracked > 0),
    getDisabledReason: () => "No changes to commit.",
    requiresInput: {
      prompt: "Enter a commit message:",
      placeholder: "Fix the flux capacitor..."
    }
  },
  {
    id: "view_history",
    label: "View history",
    description: "See recent commits.",
    riskLevel: "safe",
    isEnabled: (state) => state.isRepo
  },
  {
    id: "stash_changes",
    label: "Stash changes",
    description: "Set aside all uncommitted changes (including untracked files) temporarily.",
    riskLevel: "warning",
    isEnabled: (state) => state.isRepo && (!state.isClean || state.untracked > 0),
    getDisabledReason: () => "Working directory is clean."
  },
  {
    id: "undo_changes",
    label: "Undo changes",
    description: "Discard uncommitted changes. This cannot be easily reversed.",
    riskLevel: "destructive",
    isEnabled: (state) => state.isRepo && !state.isClean,
    getDisabledReason: () => "No changes to undo."
  },
  {
    id: "recover_work",
    label: "Recover lost work",
    description: "Look through recent history to find and recover lost commits or states.",
    riskLevel: "safe",
    isEnabled: (state) => state.isRepo
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
function sanitizeErrorMessage(msg) {
  return msg.replace(/https?:\/\/[^@\s]+@/g, "https://***@");
}
async function executeAction(actionId, cwd, payload) {
  const git = simpleGit2({ baseDir: cwd });
  try {
    switch (actionId) {
      case "view_status": {
        const status = await git.status();
        let msg = `Branch: ${status.current || "Detached HEAD / No Branch"}
`;
        if (status.isClean()) {
          msg += "Working directory is clean.";
        } else {
          if (status.staged.length > 0) {
            msg += `Staged files: ${status.staged.join(", ")}
`;
          }
          if (status.modified.length > 0) {
            msg += `Modified files: ${status.modified.join(", ")}
`;
          }
          if (status.not_added.length > 0) {
            msg += `Untracked files: ${status.not_added.join(", ")}`;
          }
        }
        return { success: true, message: msg };
      }
      case "view_changes": {
        let msg = "";
        const stagedDiff = await git.diff(["--cached"]);
        if (stagedDiff) {
          msg += "=== Staged Changes ===\n";
          msg += stagedDiff.substring(0, 2e3) + (stagedDiff.length > 2e3 ? "\n... (truncated)" : "");
          msg += "\n\n";
        }
        const diff = await git.diff();
        if (diff) {
          msg += "=== Unstaged Changes ===\n";
          msg += diff.substring(0, 2e3) + (diff.length > 2e3 ? "\n... (truncated)" : "");
        }
        const status = await git.status();
        if (status.not_added.length > 0) {
          msg += "\n\n=== Untracked Files ===\n";
          msg += status.not_added.join("\n");
        }
        return { success: true, message: msg || "No changes found." };
      }
      case "view_history": {
        try {
          const log = await git.log({ maxCount: 10 });
          const msg = log.all.map((l) => `* ${l.hash.substring(0, 7)} - ${l.message} (${l.author_name})`).join("\n");
          return { success: true, message: msg || "No commits yet." };
        } catch {
          return { success: true, message: "No commits yet. This is a brand new repository." };
        }
      }
      case "commit_changes": {
        if (!payload || !payload.trim()) {
          return { success: false, message: "Commit aborted: No commit message provided." };
        }
        await git.add(".");
        await git.commit(payload.trim());
        return { success: true, message: `Changes staged and committed successfully: "${payload.trim()}"` };
      }
      case "stash_changes": {
        await git.stash(["push", "--include-untracked"]);
        return { success: true, message: "Changes safely stashed (including untracked files)." };
      }
      case "undo_changes": {
        try {
          await git.stash(["push", "--include-untracked", "-m", "AUTO-SAVE: Before Undo"]);
        } catch {
        }
        await git.reset(["--hard"]);
        await git.clean("f", ["-d"]);
        return { success: true, message: "Changes discarded. A safety stash was automatically created just in case." };
      }
      case "recover_work": {
        try {
          const rawLog = await git.raw(["reflog", "--format=%H %gd %gs %cr", "-n", "10"]);
          if (!rawLog.trim()) {
            return { success: true, message: "No recoverable history found." };
          }
          const lines = rawLog.trim().split("\n").map((line) => {
            const parts = line.split(" ");
            const hash = parts[0].substring(0, 7);
            const match = line.match(/^[a-f0-9]+ [^ ]+ (.+), (\d+ \w+ ago)$/);
            if (match) {
              return `  ${match[2]} \u2014 ${match[1]} (${hash})`;
            }
            return `  ${line}`;
          });
          return { success: true, message: `Recoverable States:

${lines.join("\n")}` };
        } catch {
          return { success: true, message: "No recoverable history found." };
        }
      }
      default:
        return { success: false, message: `Action ${actionId} is not implemented yet.` };
    }
  } catch (e) {
    let msg = e instanceof Error ? e.message : String(e);
    msg = sanitizeErrorMessage(msg);
    if (msg.includes("conflict")) {
      msg = "Merge conflicts detected. Please resolve them in your editor before continuing.";
    }
    return { success: false, message: `Operation safely aborted: ${msg}` };
  }
}

// src/app.tsx
var HERO_ANSI = "";
try {
  HERO_ANSI = fs.readFileSync(path.join(process.cwd(), "assets", "hero.ans"), "utf8");
} catch (e) {
}
var THEMES = {
  classic: { border: "blue", text: "cyan", highlight: "yellow", success: "green", error: "red", textDim: "gray" },
  midnight: { border: "magenta", text: "magentaBright", highlight: "white", success: "magenta", error: "red", textDim: "gray" },
  amber: { border: "yellow", text: "yellowBright", highlight: "yellow", success: "yellowBright", error: "red", textDim: "yellow" },
  matrix: { border: "green", text: "greenBright", highlight: "green", success: "greenBright", error: "red", textDim: "green" },
  monochrome: { border: "white", text: "whiteBright", highlight: "white", success: "whiteBright", error: "gray", textDim: "gray" },
  synthwave: { border: "magenta", text: "cyanBright", highlight: "magentaBright", success: "cyan", error: "redBright", textDim: "magenta" },
  ocean: { border: "blue", text: "blueBright", highlight: "cyanBright", success: "cyan", error: "red", textDim: "blue" },
  dracula: { border: "magenta", text: "white", highlight: "magentaBright", success: "greenBright", error: "redBright", textDim: "gray" },
  sunset: { border: "red", text: "yellowBright", highlight: "redBright", success: "yellow", error: "red", textDim: "red" }
};
var ASCII_HEADER = `
  ____ _ _     ____                _           
 / ___(_) |_  |  _ \\ ___  ___  ___| |_   _____ 
| |  _| | __| | |_) / _ \\/ __|/ _ \\ \\ \\ / / _ \\
| |_| | | |_  |  _ <  __/\\__ \\ (_) | \\ V /  __/
 \\____|_|\\__| |_| \\_\\___||___/\\___/|_|\\_/ \\___|
`;
var App = () => {
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState({
    columns: stdout.columns || 80,
    rows: stdout.rows || 24
  });
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("main");
  const [selectedAction, setSelectedAction] = useState(null);
  const [resultMsg, setResultMsg] = useState("");
  const [resultSuccess, setResultSuccess] = useState(true);
  const [activityRail, setActivityRail] = useState([]);
  const [themeName, setThemeName] = useState("classic");
  const [inputText, setInputText] = useState("");
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
  useEffect(() => {
    let timeout;
    const onResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setDimensions({
          columns: stdout.columns || 80,
          rows: stdout.rows || 24
        });
      }, 50);
    };
    stdout.on("resize", onResize);
    return () => {
      clearTimeout(timeout);
      stdout.off("resize", onResize);
    };
  }, [stdout]);
  useInput((input, key) => {
    if (screen === "result" && (key.return || input === " ")) {
      setScreen("main");
    } else if (screen === "briefing") {
      if (input.toLowerCase() === "y") {
        if (selectedAction?.requiresInput) {
          setScreen("input");
          setInputText("");
        } else {
          executeSelected();
        }
      } else if (input.toLowerCase() === "n" || key.escape) {
        setScreen("main");
      }
    } else if (screen === "themes") {
      if (key.escape) {
        setScreen("main");
      }
    } else if (screen === "input") {
      if (key.escape) {
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
      if (!action.isEnabled(state)) {
        return;
      }
      setSelectedAction(action);
      if (action.riskLevel === "safe") {
        if (action.requiresInput) {
          setScreen("input");
          setInputText("");
        } else {
          executeSelectedAction(action);
        }
      } else {
        setScreen("briefing");
      }
    }
  };
  const handleThemeSelect = (item) => {
    setThemeName(item.value);
    setScreen("main");
  };
  const executeSelectedAction = async (action, payload) => {
    setScreen("executing");
    try {
      const res = await executeAction(action.id, process.cwd(), payload);
      setResultMsg(res.message);
      setResultSuccess(res.success);
      if (res.success) {
        setActivityRail((prev) => [...prev, `\u2713 ${action.label}`]);
      } else {
        setActivityRail((prev) => [...prev, `\u2717 ${action.label}`]);
      }
      await refreshState();
      setScreen("result");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setResultMsg(`Unexpected error: ${msg}`);
      setResultSuccess(false);
      setActivityRail((prev) => [...prev, `\u2717 ${action.label}`]);
      setScreen("result");
    }
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
    return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", padding: 1, borderStyle: "single", borderColor: theme.border, alignSelf: "flex-start" }, /* @__PURE__ */ React.createElement(Text, { bold: true, color: theme.text }, "SELECT THEME"), /* @__PURE__ */ React.createElement(Text, { color: theme.textDim }, "Press Esc to cancel"), /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(SelectInput, { items: themeItems, onSelect: handleThemeSelect })));
  }
  if (screen === "briefing" && selectedAction) {
    let briefingDetails = "";
    if (["commit_changes", "undo_changes", "stash_changes"].includes(selectedAction.id) && state) {
      briefingDetails = `Files affected: ${state.staged} staged, ${state.modified} modified, ${state.untracked} untracked`;
    }
    return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", padding: 1, borderStyle: "single", borderColor: theme.highlight, alignSelf: "flex-start" }, /* @__PURE__ */ React.createElement(Text, { bold: true, color: theme.highlight }, "BRIEFING: ", selectedAction.label.toUpperCase()), /* @__PURE__ */ React.createElement(Box, { marginTop: 1, marginBottom: 1, flexDirection: "column" }, /* @__PURE__ */ React.createElement(Text, { color: theme.text }, selectedAction.description), briefingDetails && /* @__PURE__ */ React.createElement(Text, { color: theme.textDim }, briefingDetails)), /* @__PURE__ */ React.createElement(Text, { color: theme.text }, "Continue? (y/N)"));
  }
  if (screen === "input" && selectedAction?.requiresInput) {
    return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", padding: 1, borderStyle: "single", borderColor: theme.highlight, alignSelf: "flex-start" }, /* @__PURE__ */ React.createElement(Text, { bold: true, color: theme.highlight }, selectedAction.requiresInput.prompt.toUpperCase()), /* @__PURE__ */ React.createElement(Box, { marginTop: 1, marginBottom: 1 }, /* @__PURE__ */ React.createElement(
      TextInput,
      {
        value: inputText,
        onChange: setInputText,
        onSubmit: (val) => executeSelectedAction(selectedAction, val),
        placeholder: selectedAction.requiresInput.placeholder
      }
    )), /* @__PURE__ */ React.createElement(Text, { color: theme.textDim }, "Press Enter to submit, Esc to cancel"));
  }
  if (screen === "executing") {
    return /* @__PURE__ */ React.createElement(Box, { padding: 1 }, /* @__PURE__ */ React.createElement(Text, { color: theme.text }, "Executing..."));
  }
  if (screen === "result") {
    const borderColor = resultSuccess ? theme.success : theme.error;
    const headerText = resultSuccess ? "RESULT" : "ACTION COULD NOT BE COMPLETED";
    return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", padding: 1, borderStyle: "round", borderColor, alignSelf: "flex-start" }, /* @__PURE__ */ React.createElement(Text, { bold: true, color: borderColor }, headerText), /* @__PURE__ */ React.createElement(Box, { marginTop: 1, marginBottom: 1 }, /* @__PURE__ */ React.createElement(Text, { color: theme.text }, resultMsg)), /* @__PURE__ */ React.createElement(Text, { color: theme.textDim }, "Press Enter to return to menu"));
  }
  const items = ALL_ACTIONS.map((a) => {
    const enabled = a.isEnabled(state);
    const label = enabled ? a.label : `${a.label} (Unavailable: ${a.getDisabledReason ? a.getDisabledReason(state) : "Not applicable"})`;
    return { label, value: a.id };
  });
  items.push({ label: "Exit", value: "exit" });
  const showHeroAndRail = dimensions.columns >= 130 && dimensions.rows >= 35;
  const showAsciiHeader = dimensions.columns >= 75 && dimensions.rows >= 20;
  return /* @__PURE__ */ React.createElement(Box, { padding: 1, flexDirection: "column", alignSelf: "flex-start" }, /* @__PURE__ */ React.createElement(Box, { flexDirection: "row", alignItems: "center", marginBottom: 1 }, showHeroAndRail && HERO_ANSI ? /* @__PURE__ */ React.createElement(Box, { marginRight: 2 }, /* @__PURE__ */ React.createElement(Text, { wrap: "none" }, HERO_ANSI)) : null, showAsciiHeader ? /* @__PURE__ */ React.createElement(Box, null, /* @__PURE__ */ React.createElement(Text, { bold: true, color: theme.highlight }, ASCII_HEADER)) : /* @__PURE__ */ React.createElement(Box, { marginBottom: 1 }, /* @__PURE__ */ React.createElement(Text, { bold: true, color: theme.highlight }, "=== GIT RESOLVE ==="))), /* @__PURE__ */ React.createElement(Box, { flexDirection: "row" }, /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", paddingRight: showHeroAndRail ? 2 : 0 }, /* @__PURE__ */ React.createElement(Box, { borderStyle: "single", borderColor: theme.border, padding: 1, marginBottom: 1, flexDirection: "column", alignSelf: "flex-start" }, /* @__PURE__ */ React.createElement(Text, null, "Project: ", state.repoRoot), /* @__PURE__ */ React.createElement(Text, null, "Branch:  ", state.branch), /* @__PURE__ */ React.createElement(Text, null, "Status:  ", state.isClean ? "Clean" : `${state.modified} modified, ${state.staged} staged, ${state.untracked} untracked`)), /* @__PURE__ */ React.createElement(Text, { bold: true, color: theme.text }, "SELECT ACTION"), /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(SelectInput, { items, onSelect: handleSelect }))), showHeroAndRail && /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", minWidth: 30, borderStyle: "single", borderColor: theme.border, paddingLeft: 1, alignSelf: "flex-start" }, /* @__PURE__ */ React.createElement(Text, { bold: true, underline: true, color: theme.text }, "ACTIVITY"), activityRail.length === 0 && /* @__PURE__ */ React.createElement(Text, { color: theme.textDim }, "No recent activity"), activityRail.map((act, i) => /* @__PURE__ */ React.createElement(Text, { key: i, color: act.startsWith("\u2713") ? theme.success : theme.error }, act)))));
};
var app_default = App;

// src/index.tsx
process.stdout.write("\x1B[?1049h");
var { unmount } = render(/* @__PURE__ */ React2.createElement(app_default, null));
process.on("exit", () => {
  process.stdout.write("\x1B[?1049l");
});
