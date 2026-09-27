#!/usr/bin/env node
// Start the backend services first and only launch the web app once the API
// answers /health. A plain `turbo dev` starts every package in parallel, so
// Vite comes up long before the API and its /api proxy logs ECONNREFUSED until
// the API finishes booting (or fails, e.g. when Postgres isn't running).
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

let turboBin;
try {
  turboBin = require.resolve("turbo");
} catch {
  console.error("[dev] turbo is not installed. Run `pnpm install` first.");
  process.exit(1);
}

const BACKENDS = ["@rakazo/api", "@rakazo/worker", "@rakazo/sandbox-supervisor"];
const WEB = ["@rakazo/web"];
const READY_TIMEOUT_MS = Number(process.env.DEV_API_READY_TIMEOUT_MS ?? 120_000);
const START_POSTGRES =
  "docker compose --env-file .env -f infra/compose/docker-compose.yml -f infra/compose/docker-compose.postgres-host.yml up postgres -d";

const rootEnv = readRootEnv();
const apiHost = connectableHost(process.env.API_HOST ?? rootEnv.API_HOST ?? "127.0.0.1");
const apiPort = portOf(process.env.API_PORT ?? rootEnv.API_PORT ?? 3100);
const healthUrl = `http://${apiHost}:${apiPort}/health`;
const database = databaseAddress();

const children = new Set();
let stopping = false;

function readRootEnv() {
  try {
    const text = readFileSync(fileURLToPath(new URL("../.env", import.meta.url)), "utf8");
    const values = {};
    for (const line of text.split(/\r?\n/)) {
      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
      if (match) values[match[1]] = match[2].trim().replace(/^"(.*)"$/, "$1");
    }
    return values;
  } catch {
    return {};
  }
}

function connectableHost(host) {
  return host === "0.0.0.0" || host === "::" || host === "[::]" ? "127.0.0.1" : host;
}

function portOf(value) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 ? port : 3100;
}

function databaseAddress() {
  const url = process.env.DATABASE_URL ?? rootEnv.DATABASE_URL;
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return { host: parsed.hostname, port: portOf(parsed.port || 5432) };
  } catch {
    return undefined;
  }
}

function isListening(host, port, timeoutMs = 2_000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (up) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(up);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.setTimeout(timeoutMs, () => done(false));
  });
}

function killTree(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  child.kill("SIGTERM");
}

function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) killTree(child);
}

function startTurborepo(label, filters) {
  const args = [turboBin, "dev", ...filters.map((filter) => `--filter=${filter}`)];
  const child = spawn(process.execPath, args, { stdio: "inherit" });
  children.add(child);
  child.once("error", (error) => {
    children.delete(child);
    console.error(`[dev] could not start ${label}: ${error.message}`);
    process.exitCode = 1;
    stop();
  });
  child.once("exit", (code, signal) => {
    children.delete(child);
    if (stopping) return;
    process.exitCode = signal ? 1 : (code ?? 1);
    console.error(`[dev] ${label} exited; stopping the rest of the dev stack.`);
    stop();
  });
  return child;
}

async function waitForApi() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (!stopping && Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return true;
    } catch {
      // API not listening yet; keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function reportNotReady() {
  const seconds = Math.round(READY_TIMEOUT_MS / 1_000);
  console.error(`[dev] API did not answer ${healthUrl} within ${seconds}s.`);
  if (database && !(await isListening(database.host, database.port))) {
    console.error(`[dev] Postgres is not reachable at ${database.host}:${database.port}.`);
    console.error(`[dev] Start it with: ${START_POSTGRES}`);
    console.error("[dev] Then apply the schema with: pnpm db:migrate");
    return;
  }
  console.error("[dev] Check the api output above for the startup error.");
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

console.log("[dev] starting api, worker and sandbox-supervisor");
startTurborepo("backends", BACKENDS);

if (database && !(await isListening(database.host, database.port))) {
  console.log(`[dev] waiting for Postgres at ${database.host}:${database.port}.`);
  console.log(`[dev] start it with: ${START_POSTGRES}`);
}

const ready = await waitForApi();
if (ready) {
  console.log(`[dev] api ready on ${healthUrl}; starting web`);
  startTurborepo("web", WEB);
} else if (!stopping) {
  process.exitCode = 1;
  await reportNotReady();
  stop();
}
