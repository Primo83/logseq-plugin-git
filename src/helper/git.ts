// https://logseq.github.io/plugins/interfaces/IAppProxy.html#execGitCommand
import type { IGitResult } from "@logseq/libs/dist/LSPlugin.user"

let _inProgress: Promise<IGitResult> | undefined = undefined
let _directGitRunner:
  | ((args: string[]) => Promise<IGitResult | undefined>)
  | undefined
  | null = undefined

const normalizePath = (inputPath: string) =>
  inputPath.replace(/\\/g, "/").replace(/\/+$/, "");

const getRepoRootPathSetting = () =>
  (logseq.settings?.repoRootPath as string | undefined)?.trim();

const getGraphPath = async () => (await logseq.App.getCurrentGraph())?.path;

const getNodeRequire = () => {
  const globalObject = globalThis as any;
  const candidates = [
    () => globalObject.require,
    () => globalObject.window?.require,
    () => globalObject.top?.require,
    () => globalObject.parent?.require,
    () => globalObject.process?.mainModule?.require,
    () => globalObject.logseq?.Experiments?.ensureHostScope?.()?.require,
    () =>
      globalObject.logseq
        ?.Experiments
        ?.ensureHostScope
        ?.()
        ?.process
        ?.mainModule
        ?.require,
  ];

  for (const getCandidate of candidates) {
    try {
      const candidate = getCandidate();
      if (typeof candidate === "function") return candidate;
    } catch (error) {
      // Cross-origin access can throw in some Logseq plugin contexts.
    }
  }

  return undefined;
};

const getDirectGitRunner = () => {
  if (_directGitRunner !== undefined) return _directGitRunner;

  const nodeRequire = getNodeRequire();
  if (!nodeRequire) {
    _directGitRunner = null;
    return _directGitRunner;
  }

  try {
    const childProcess = nodeRequire("child_process");
    const execFile = childProcess?.execFile;
    if (typeof execFile !== "function") {
      _directGitRunner = null;
      return _directGitRunner;
    }

    _directGitRunner = (args: string[]) =>
      new Promise((resolve) => {
        execFile(
          "git",
          args,
          { windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
          (error: any, stdout: string | Buffer, stderr: string | Buffer) => {
            if (error?.code === "ENOENT") {
              resolve(undefined);
              return;
            }

            resolve({
              exitCode:
                typeof error?.code === "number" ? error.code : error ? 1 : 0,
              stdout: stdout?.toString() ?? "",
              stderr: stderr?.toString() || error?.message || "",
            });
          }
        );
      });
  } catch (error) {
    _directGitRunner = null;
  }

  return _directGitRunner;
};

const wrapExecGitCommand = async (args: string[]): Promise<IGitResult> => {
  const directGitRunner = getDirectGitRunner();
  const directRes = directGitRunner ? await directGitRunner(args) : undefined;
  if (directRes) return directRes;

  return logseq.App
    .execGitCommand(args)
    .then((stdout) => ({
      exitCode: stdout === undefined ? 1 : 0,
      stdout: stdout ?? "",
      stderr: "",
    }))
    .catch((error) => ({
      exitCode: 1,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
    }));
};

const dirname = (inputPath: string): string | undefined => {
  const path = normalizePath(inputPath);
  const driveRootMatch = path.match(/^[A-Za-z]:\/?$/);
  if (driveRootMatch) return undefined;

  const slashIndex = path.lastIndexOf("/");
  if (slashIndex <= 0) return undefined;
  if (slashIndex === 2 && path[1] === ":") return path.slice(0, slashIndex + 1);
  return path.slice(0, slashIndex);
};

const isPathInside = (childPath: string, parentPath: string) => {
  const child = normalizePath(childPath).toLowerCase();
  const parent = normalizePath(parentPath).toLowerCase();
  if (child === parent) return true;
  const parentPrefix = parent.endsWith("/") ? parent : `${parent}/`;
  return child.startsWith(parentPrefix);
};

const getGitTopLevel = async (basePath: string): Promise<string | undefined> => {
  const res = await wrapExecGitCommand([
    "-C",
    basePath,
    "rev-parse",
    "--show-toplevel",
  ]);

  if (res.exitCode !== 0) return undefined;
  const topLevel = res.stdout.trim();
  return topLevel ? normalizePath(topLevel) : undefined;
};

const getEffectiveRepoRootPath = async (): Promise<string | undefined> => {
  const configuredRepoRootPath = getRepoRootPathSetting();
  if (configuredRepoRootPath) return configuredRepoRootPath;

  const graphPath = await getGraphPath();
  if (!graphPath) return undefined;

  const normalizedGraphPath = normalizePath(graphPath);
  const parentPath = dirname(normalizedGraphPath);
  if (parentPath) {
    const parentRepoRoot = await getGitTopLevel(parentPath);
    if (parentRepoRoot && isPathInside(normalizedGraphPath, parentRepoRoot)) {
      return parentRepoRoot;
    }
  }

  return (await getGitTopLevel(normalizedGraphPath)) ?? normalizedGraphPath;
};

const getScopePathspec = async (): Promise<string> => {
  const repoRootPath = await getEffectiveRepoRootPath();
  const graphPath = await getGraphPath();

  if (!repoRootPath || !graphPath) return ".";

  const repo = normalizePath(repoRootPath);
  const graph = normalizePath(graphPath);

  const repoLower = repo.toLowerCase();
  const graphLower = graph.toLowerCase();

  if (graphLower === repoLower) return ".";

  const repoPrefix = repo.endsWith("/") ? repo : `${repo}/`;
  if (!graphLower.startsWith(repoPrefix.toLowerCase())) {
    // Misconfiguration (graph is outside repo root). Fail safe by returning a
    // non-existing pathspec so we don't accidentally operate on the whole repo.
    return "__INVALID_SCOPE__";
  }

  const rel = graph.slice(repoPrefix.length);
  return rel || ".";
};

export const execGitCommand = async (args: string[]) : Promise<IGitResult> => {
  if (_inProgress) await _inProgress

  let res: IGitResult
  try {
    const graphPath = await getGraphPath();
    const gitBasePath = (await getEffectiveRepoRootPath()) ?? graphPath;
    const runArgs = gitBasePath ? ['-C', gitBasePath, ...args] : args
    _inProgress = wrapExecGitCommand(runArgs)
    res = await _inProgress
  } finally {
    _inProgress = undefined
  }
  return res
}

export const inProgress = () => _inProgress

export const isRepoClean = async (): Promise<boolean> => {
  const res = await execGitCommand(["status", "--porcelain"]);
  if (res.exitCode !== 0) return false;
  return res.stdout.trim() === "";
};

export const getUpstreamRef = async (): Promise<string | null> => {
  const res = await execGitCommand([
    "rev-parse",
    "--abbrev-ref",
    "--symbolic-full-name",
    "@{u}",
  ]);
  if (res.exitCode !== 0) return null;
  const upstream = res.stdout.trim();
  return upstream ? upstream : null;
};

export const syncBeforePush = async (showRes = true): Promise<boolean> => {
  if (inProgress()) {
    console.log("[faiz:] === syncBeforePush Git in progress, skip");
    return false;
  }

  const fetchRes = await execGitCommand(["fetch", "-q"]);
  if (fetchRes.exitCode !== 0) {
    if (showRes) {
      logseq.UI.showMsg(
        `Pre-push fetch failed\n${fetchRes.stderr || fetchRes.stdout}`,
        "error",
        { timeout: 0 }
      );
    }
    return false;
  }

  const upstream = await getUpstreamRef();
  if (!upstream) {
    if (showRes) {
      logseq.UI.showMsg(
        `Pre-push rebase skipped (no upstream configured).`,
        "warning",
        { timeout: 10 }
      );
    }
    return true;
  }

  const clean = await isRepoClean();
  const rebaseArgs = clean
    ? ["rebase", upstream]
    : ["rebase", "--autostash", upstream];

  const rebaseRes = await execGitCommand(rebaseArgs);
  if (rebaseRes.exitCode !== 0) {
    if (showRes) {
      logseq.UI.showMsg(
        `Pre-push rebase failed\n${rebaseRes.stderr || rebaseRes.stdout}`,
        "error",
        { timeout: 0 }
      );
    }
    return false;
  }

  return true;
};

export const status = async (showRes = true): Promise<IGitResult> => {
  // git status --porcelain | awk '{print $2}'
  // git status --porcelain | wc -l
  const scope = await getScopePathspec();
  const res =  await execGitCommand(['status', '--porcelain', '--', scope])
  console.log('[faiz:] === git status', res)
  if (showRes) {
    if (res.exitCode === 0) {
      logseq.UI.showMsg('Git status success')
    } else {
      logseq.UI.showMsg(`Git status failed\n${res.stderr}`, 'error')
    }
  }
  /**
   * res
   * modify
   * {
   *  exitCode: 0,
   *  stderr: '',
   *  stdout: 'M foo.md\n?? bar.md\n',
   * }
   * ahead & uptodate & behind
   * {
   * exitCode: 0,
   * stderr: '',
   * stdout: '',
   * }
   */
  // changed files    staged files
  return res
}

// log with git log --pretty=format:"%h %ad | %s%d [%an]" --date=short
export const log = async (showRes = true): Promise<IGitResult> => {
  // git log --pretty=format:"%h %s" -n 1
  // git log --pretty=format:"%h %ad | %s%d [%an]" --date=short
  // return await logseq.App.execGitCommand(['log', '--pretty=format:"%h %s"'])
  const scope = await getScopePathspec();
  const res = await execGitCommand(['log', '--pretty=format:"%h %ad | %s [%an]"', '--date=format:"%Y-%m-%d %H:%M:%S"', '--name-status', '--', scope])
  console.log('[faiz:] === git log', res)
  if (showRes) {
    if (res.exitCode === 0) {
      logseq.UI.showMsg('Git log success')
    } else {
      logseq.UI.showMsg(`Git log failed\n${res.stderr}`, 'error')
    }
  }
  return res
}

// git pull
export const pull = async (showRes = true): Promise<IGitResult> => {
  const fetchRes = await execGitCommand(["fetch", "-q"]);
  if (fetchRes.exitCode !== 0) {
    if (showRes) {
      logseq.UI.showMsg(
        `Git pull failed\n${fetchRes.stderr || fetchRes.stdout}`,
        "error",
        { timeout: 0 }
      );
    }
    return fetchRes;
  }

  const upstream = await getUpstreamRef();
  if (!upstream) {
    const res: IGitResult = {
      exitCode: 1,
      stdout: "",
      stderr: "No upstream configured (cannot pull).",
    };
    if (showRes) {
      logseq.UI.showMsg(`Git pull failed\n${res.stderr}`, "error", { timeout: 0 });
    }
    return res;
  }

  const res = await execGitCommand(["merge", upstream]);
  console.log("[faiz:] === git pull (fetch+merge)", res);
  if (showRes) {
    if (res.exitCode === 0) {
      logseq.UI.showMsg("Git pull success");
    } else {
      logseq.UI.showMsg(`Git pull failed\n${res.stderr || res.stdout}`, "error", {
        timeout: 0,
      });
    }
  }
  return res;
}

// git pull --rebase
export const pullRebase = async (showRes = true): Promise<IGitResult> => {
  const fetchRes = await execGitCommand(["fetch", "-q"]);
  if (fetchRes.exitCode !== 0) {
    if (showRes) {
      logseq.UI.showMsg(
        `Git pull --rebase failed\n${fetchRes.stderr || fetchRes.stdout}`,
        "error",
        { timeout: 0 }
      );
    }
    return fetchRes;
  }

  const upstream = await getUpstreamRef();
  if (!upstream) {
    const res: IGitResult = {
      exitCode: 1,
      stdout: "",
      stderr: "No upstream configured (cannot pull --rebase).",
    };
    if (showRes) {
      logseq.UI.showMsg(`Git pull --rebase failed\n${res.stderr}`, "error", {
        timeout: 0,
      });
    }
    return res;
  }

  const clean = await isRepoClean();
  const rebaseArgs = clean
    ? ["rebase", upstream]
    : ["rebase", "--autostash", upstream];

  const res = await execGitCommand(rebaseArgs);
  console.log("[faiz:] === git pull --rebase (fetch+rebase)", res);
  if (showRes) {
    if (res.exitCode === 0) {
      logseq.UI.showMsg("Git pull --rebase success");
    } else {
      logseq.UI.showMsg(`Git pull --rebase failed\n${res.stderr || res.stdout}`, "error", {
        timeout: 0,
      });
    }
  }
  return res;
}

// git checkout .
export const checkout = async (showRes = true): Promise<IGitResult> => {
  const scope = await getScopePathspec();
  const res = await execGitCommand(['checkout', '--', scope])
  console.log('[faiz:] === git checkout .', res)
  if (showRes) {
    if (res.exitCode === 0) {
      logseq.UI.showMsg('Git checkout success')
    } else {
      logseq.UI.showMsg(`Git checkout failed\n${res.stderr}`, 'error')
    }
  }
  return res
}

// git commit
export const commit = async (showRes = true, message: string): Promise<IGitResult> => {
  const scope = await getScopePathspec();
  await execGitCommand(['add', '-A', '--', scope])
  // git commit -m "message" -- <scope>
  const res = await execGitCommand(['commit', '-m', message, '--', scope])
  console.log('[faiz:] === git commit', res)
  if (showRes) {
    if (res.exitCode === 0) {
      logseq.UI.showMsg('Git commit success')
    } else {
      logseq.UI.showMsg(`Git commit failed\n${res.stdout || res.stderr}`, 'error')
    }
  }
  return res
}

// push
export const push = async (showRes = true): Promise<IGitResult> => {
  const synced = await syncBeforePush(showRes);
  if (!synced) {
    return { exitCode: 1, stdout: "", stderr: "Pre-push sync failed" };
  }

  const res = await execGitCommand(['push'])
  console.log('[faiz:] === git push', res)
  if (showRes) {
    if (res.exitCode === 0) {
      logseq.UI.showMsg('Git push success')
    } else {
      logseq.UI.showMsg(`Git push failed\n${res.stderr}`, 'error')
    }
  }
  return res
}


/**
 * Returns the commit message based on the selected commit message type in the logseq settings.
 * @returns The commit message.
 */
export const commitMessage = () : string => {
  
  let defaultMessage = "[logseq-plugin-git:commit]";

  switch (logseq.settings?.typeCommitMessage as string) {
    case "Default Message":
      return defaultMessage;
    case "Default Message With Date":
      return defaultMessage + " " + new Date().toISOString();
    case "Custom Message":
      let customMessage = logseq.settings?.customCommitMessage as string;
      if (customMessage.trim() === "") {
        return defaultMessage;
      } else {
        return customMessage;
      }
    case "Custom Message With Date":
      let customMessageWithDate = logseq.settings?.customCommitMessage as string;
      if (customMessageWithDate.trim() === "") {
        return defaultMessage + " " + new Date().toISOString();
      } else {
        return customMessageWithDate + " " + new Date().toISOString();
      }
    default:
      return defaultMessage;
  }
}
