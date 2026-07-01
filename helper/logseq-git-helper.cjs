const http = require("node:http");
const { execFile } = require("node:child_process");
const path = require("node:path");

const PORT = Number.parseInt(process.env.LOGSEQ_GIT_HELPER_PORT || "17838", 10);
const ALLOWED_ROOT = path.resolve(
  process.env.LOGSEQ_GIT_HELPER_ALLOWED_ROOT || "C:\\PGMPI-DATA-STRATEGY"
);
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_BUFFER_BYTES = 10 * 1024 * 1024;
const ALLOWED_COMMANDS = new Set([
  "add",
  "checkout",
  "commit",
  "fetch",
  "log",
  "merge",
  "push",
  "rebase",
  "rev-parse",
  "status",
]);

const normalizeForCompare = (inputPath) => {
  const resolved = path.resolve(inputPath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
};

const allowedRootForCompare = normalizeForCompare(ALLOWED_ROOT);

const isPathInsideAllowedRoot = (candidatePath) => {
  const candidate = normalizeForCompare(candidatePath);
  if (candidate === allowedRootForCompare) return true;

  const prefix = allowedRootForCompare.endsWith(path.sep)
    ? allowedRootForCompare
    : `${allowedRootForCompare}${path.sep}`;
  return candidate.startsWith(prefix);
};

const isLocalAddress = (address) =>
  address === "127.0.0.1" ||
  address === "::1" ||
  address === "::ffff:127.0.0.1";

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(JSON.stringify(payload));
};

const readJsonBody = (req) =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });

const validateArgs = (args) => {
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) {
    return "args must be an array of strings";
  }

  if (args.some((arg) => arg.includes("\0"))) {
    return "args cannot contain NUL bytes";
  }

  if (args.length < 3 || args[0] !== "-C") {
    return "args must start with: -C <repo-path> <git-command>";
  }

  const repoPath = args[1];
  if (!isPathInsideAllowedRoot(repoPath)) {
    return `repo path is outside allowed root: ${ALLOWED_ROOT}`;
  }

  const command = args[2];
  if (!ALLOWED_COMMANDS.has(command)) {
    return `git command is not allowed: ${command}`;
  }

  return undefined;
};

const runGit = (args) =>
  new Promise((resolve) => {
    execFile(
      "git",
      args,
      {
        windowsHide: true,
        maxBuffer: MAX_BUFFER_BYTES,
        cwd: ALLOWED_ROOT,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: "0",
        },
      },
      (error, stdout, stderr) => {
        resolve({
          exitCode: typeof error?.code === "number" ? error.code : error ? 1 : 0,
          stdout: stdout?.toString() || "",
          stderr: stderr?.toString() || error?.message || "",
        });
      }
    );
  });

const server = http.createServer(async (req, res) => {
  if (!isLocalAddress(req.socket.remoteAddress)) {
    sendJson(res, 403, { error: "Only local requests are allowed" });
    return;
  }

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, {
      ok: true,
      port: PORT,
      allowedRoot: ALLOWED_ROOT,
      pid: process.pid,
    });
    return;
  }

  if (req.method !== "POST" || req.url !== "/git") {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const args = payload?.args;
    const validationError = validateArgs(args);
    if (validationError) {
      sendJson(res, 400, { exitCode: 1, stdout: "", stderr: validationError });
      return;
    }

    const result = await runGit(args);
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 400, {
      exitCode: 1,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(
    `Logseq Git helper listening on http://127.0.0.1:${PORT}; allowed root: ${ALLOWED_ROOT}`
  );
});
