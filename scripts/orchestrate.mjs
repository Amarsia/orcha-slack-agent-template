import { spawn } from "node:child_process";

const mode = process.argv[2] === "production" ? "production" : "dev";
const commands =
  mode === "production"
    ? [
        ["web", process.execPath, ["server.js"]],
        ["slack", process.execPath, ["dist/slack-worker.mjs"]],
      ]
    : [
        ["web", "npx", ["next", "dev"]],
        ["slack", "npx", ["tsx", "watch", "slack/worker.ts"]],
      ];

const children = new Map();
let shuttingDown = false;

function stop(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children.values()) {
    if (!child.killed) child.kill(signal);
  }
  setTimeout(() => {
    for (const child of children.values()) {
      if (!child.killed) child.kill("SIGKILL");
    }
  }, 8_000).unref();
}

for (const [name, command, args] of commands) {
  const child = spawn(command, args, {
    env: { ...process.env, NODE_ENV: mode === "production" ? "production" : "development" },
    stdio: "inherit",
  });
  children.set(name, child);
  child.on("error", (error) => {
    console.error(`${name} process failed to start:`, error.message);
    process.exitCode = 1;
    stop();
  });
  child.on("exit", (code, signal) => {
    children.delete(name);
    if (!shuttingDown) {
      console.error(`${name} process exited (${signal ?? code ?? "unknown"}).`);
      process.exitCode = code && code > 0 ? code : 1;
      stop();
    }
    if (children.size === 0) process.exit();
  });
}

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));
