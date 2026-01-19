import {
  ACTIVE_STYLE,
  HIDE_POPUP_STYLE,
  INACTIVE_STYLE,
  LOADING_STYLE,
  SHOW_POPUP_STYLE,
} from "./constants";
import { status, inProgress, execGitCommand, isRepoClean } from "./git";

export const checkStatus = async () => {
  console.log("Checking status...");
  const statusRes = await status(false);
  if (statusRes?.stdout === "") {
    console.log("No changes", statusRes);
    setPluginStyle(INACTIVE_STYLE);
  } else {
    console.log("Need save", statusRes);
    setPluginStyle(ACTIVE_STYLE);
  }
  return statusRes;
};

let pluginStyle = "";
export const setPluginStyle = (style: string) => {
  pluginStyle = style;
  logseq.provideStyle({ key: "git", style });
};
export const getPluginStyle = () => pluginStyle;

export const showPopup = () => {
  const _style = getPluginStyle();
  logseq.UI.queryElementRect("#logseq-git--git").then((triggerIconRect) => {
    console.log("[faiz:] === triggerIconRect", triggerIconRect);
    if (!triggerIconRect) return;
    const popupWidth = 120 + 10 * 2;
    const left =
      triggerIconRect.left + triggerIconRect.width / 2 - popupWidth / 2;
    const top = triggerIconRect.top + triggerIconRect.height;
    const _style = getPluginStyle();
    setPluginStyle(
      `${_style}\n.plugin-git-popup{left:${left}px;top:${top}px;}`
    );
  });
  setPluginStyle(`${_style}\n${SHOW_POPUP_STYLE}`);
};
export const hidePopup = () => {
  const _style = getPluginStyle();
  setPluginStyle(`${_style}\n${HIDE_POPUP_STYLE}`);
};

export const debounce = (fn, wait: number = 100, environment?: any) => {
  let timer = null;
  return function () {
    // @ts-ignore
    const context = environment || this;
    const args = arguments;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    // @ts-ignore
    timer = setTimeout(function () {
      fn.apply(context, args);
    }, wait);
  };
};

export const checkStatusWithDebounce = debounce(() => {
  checkStatus();
}, 2000);

export const isRepoUpTodate = async () => {
  await execGitCommand(["fetch", "-q"]);
  const local = await execGitCommand(["rev-parse", "HEAD"]);
  const remote = await execGitCommand(["rev-parse", "@{u}"]);
  return local.stdout === remote.stdout;
};

export const checkIsSynced = async () => {
  if (inProgress()) {
    console.log("[faiz:] === checkIsSynced Git in progress, skip check");
    return
  }

  const isSynced = await isRepoUpTodate();
  if (!isSynced)
    logseq.UI.showMsg(
      `The current repository is not synchronized with the remote repository, please check.`,
      "warning",
      { timeout: 0 }
    );
};

const parseAheadBehind = (
  stdout: string
): { ahead: number; behind: number } | null => {
  const parts = stdout.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const ahead = Number(parts[0]);
  const behind = Number(parts[1]);
  if (!Number.isFinite(ahead) || !Number.isFinite(behind)) return null;
  return { ahead, behind };
};

let lastAutoPullSkipToastAt = 0;
const AUTO_PULL_SKIP_TOAST_THROTTLE_MS = 5 * 60 * 1000;
let lastRemoteAheadToastAt = 0;
const REMOTE_AHEAD_TOAST_THROTTLE_MS = 5 * 60 * 1000;

export const fetchAndMaybeAutoPull = async () => {
  if (inProgress()) {
    console.log("[faiz:] === fetchAndMaybeAutoPull Git in progress, skip");
    return;
  }

  const fetchRes = await execGitCommand(["fetch", "-q"]);
  if (fetchRes.exitCode !== 0) {
    console.log("[faiz:] === auto fetch failed", fetchRes);
    return;
  }

  const divergedRes = await execGitCommand([
    "rev-list",
    "--left-right",
    "--count",
    "HEAD...@{u}",
  ]);
  if (divergedRes.exitCode !== 0) {
    console.log("[faiz:] === rev-list failed", divergedRes);
    return;
  }

  const counts = parseAheadBehind(divergedRes.stdout);
  if (!counts) return;

  if (counts.behind <= 0) return;

  if (!logseq.settings?.autoPullWhenRemoteChanged) {
    if (logseq.settings?.autoCheckSynced) {
      const now = Date.now();
      if (now - lastRemoteAheadToastAt > REMOTE_AHEAD_TOAST_THROTTLE_MS) {
        lastRemoteAheadToastAt = now;
        logseq.UI.showMsg(
          `Remote has ${counts.behind} new commit(s).`,
          "warning",
          { timeout: 0 }
        );
      }
    }
    return;
  }

  const clean = await isRepoClean();
  if (!clean) {
    const now = Date.now();
    if (now - lastAutoPullSkipToastAt > AUTO_PULL_SKIP_TOAST_THROTTLE_MS) {
      lastAutoPullSkipToastAt = now;
      logseq.UI.showMsg(
        `Remote has updates but your repo has local changes. Auto pull skipped.`,
        "warning",
        { timeout: 10 }
      );
    }
    return;
  }

  setPluginStyle(LOADING_STYLE);
  const strategy = (logseq.settings?.autoPullStrategy as string | undefined) || "Pull Rebase";
  const pullArgs = strategy === "Pull" ? ["pull"] : ["pull", "--rebase"];
  const pullRes = await execGitCommand(pullArgs);

  if (pullRes.exitCode === 0) {
    logseq.UI.showMsg(
      `Auto pulled ${counts.behind} commit(s) from remote.`,
      "success",
      { timeout: 5 }
    );
  } else {
    logseq.UI.showMsg(
      `Auto pull failed\n${pullRes.stderr || pullRes.stdout}`,
      "error",
      { timeout: 0 }
    );
  }

  await checkStatus();
};
