import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(currentDirectory, "..");
const checks = [];

const webEnvPath = join(workspaceRoot, "apps", "web", ".env.local");
const workerEnvPath = join(workspaceRoot, "apps", "worker", ".env.local");
const webEnv = readEnvFile(webEnvPath);
const workerEnv = readEnvFile(workerEnvPath);

await main();

async function main() {
  section("Files");
  checkFile(webEnvPath, "apps/web/.env.local");
  checkFile(workerEnvPath, "apps/worker/.env.local");

  section("Web env");
  checkEnv(webEnv, "NEXT_PUBLIC_SUPABASE_URL", "apps/web/.env.local");
  checkAnyEnv(
    webEnv,
    ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    "apps/web/.env.local",
  );
  checkEnv(webEnv, "SUPABASE_SERVICE_ROLE_KEY", "apps/web/.env.local");
  checkEnv(webEnv, "REDIS_URL", "apps/web/.env.local");

  section("Worker env");
  checkEnv(workerEnv, "REDIS_URL", "apps/worker/.env.local");
  checkAnyEnv(
    workerEnv,
    ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"],
    "apps/worker/.env.local",
  );
  checkEnv(workerEnv, "SUPABASE_SERVICE_ROLE_KEY", "apps/worker/.env.local");
  checkEnv(workerEnv, "YTDLP_PATH", "apps/worker/.env.local", {
    allowMissing: true,
    defaultValue: "yt-dlp",
  });
  checkEnv(workerEnv, "OPENAI_BASE_URL", "apps/worker/.env.local");
  checkEnv(workerEnv, "OPENAI_API_KEY", "apps/worker/.env.local");
  checkEnv(workerEnv, "OPENAI_SUMMARY_MODEL", "apps/worker/.env.local");
  checkOptionalNumberEnv(
    workerEnv,
    "OPENAI_SUMMARY_MAX_TOKENS",
    "apps/worker/.env.local",
  );

  section("Services");
  await checkRedis(
    workerEnv.REDIS_URL ?? webEnv.REDIS_URL,
    "Redis for BullMQ",
  );
  await checkYtDlp(workerEnv.YTDLP_PATH ?? "yt-dlp");
  await checkOptionalProxy(workerEnv.LOCAL_PROXY_URL);

  printSummary();
}

function section(title) {
  console.log(`\n${title}`);
}

function checkFile(filePath, label) {
  addCheck({
    ok: existsSync(filePath),
    label,
    detail: existsSync(filePath) ? "found" : "missing",
    required: true,
  });
}

function checkEnv(env, key, label, options = {}) {
  const value = env[key] ?? options.defaultValue;
  const exists = typeof value === "string" && value.trim().length > 0;
  const placeholder = exists && isPlaceholder(value);
  const ok = exists && !placeholder;

  addCheck({
    ok,
    label: `${label} ${key}`,
    detail: ok
      ? "configured"
      : placeholder
        ? "placeholder value"
        : options.allowMissing && options.defaultValue
          ? `not set, using ${options.defaultValue}`
          : "missing",
    required: !options.allowMissing,
  });
}

function checkAnyEnv(env, keys, label) {
  const configuredKey = keys.find((key) => {
    const value = env[key];
    return value && !isPlaceholder(value);
  });

  addCheck({
    ok: Boolean(configuredKey),
    label: `${label} ${keys.join(" or ")}`,
    detail: configuredKey ? `using ${configuredKey}` : "missing",
    required: true,
  });
}

function checkOptionalNumberEnv(env, key, label) {
  const value = env[key];

  if (!value) {
    addCheck({
      ok: true,
      label: `${label} ${key}`,
      detail: "not set, using provider default",
      required: false,
    });
    return;
  }

  const parsed = Number(value);

  addCheck({
    ok: Number.isSafeInteger(parsed) && parsed > 0,
    label: `${label} ${key}`,
    detail:
      Number.isSafeInteger(parsed) && parsed > 0
        ? "configured"
        : "must be a positive integer",
    required: false,
  });
}

async function checkRedis(redisUrl, label) {
  if (!redisUrl || isPlaceholder(redisUrl)) {
    addCheck({
      ok: false,
      label,
      detail: "REDIS_URL missing",
      required: true,
    });
    return;
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(redisUrl);
  } catch {
    addCheck({
      ok: false,
      label,
      detail: "REDIS_URL is not a valid URL",
      required: true,
    });
    return;
  }

  const host = parsedUrl.hostname;
  const port = Number(parsedUrl.port || 6379);
  const reachable = await canConnect(host, port, 1_500);

  addCheck({
    ok: reachable,
    label,
    detail: reachable ? `${host}:${port} reachable` : `${host}:${port} unreachable`,
    required: true,
  });
}

async function checkYtDlp(ytDlpPath) {
  try {
    const { stdout } = await execFileAsync(ytDlpPath, ["--version"], {
      timeout: 5_000,
      windowsHide: true,
    });

    addCheck({
      ok: true,
      label: "yt-dlp",
      detail: `version ${stdout.trim()}`,
      required: true,
    });
  } catch (caught) {
    addCheck({
      ok: false,
      label: "yt-dlp",
      detail: toErrorMessage(caught),
      required: true,
    });
  }
}

async function checkOptionalProxy(proxyUrl) {
  if (!proxyUrl) {
    addCheck({
      ok: true,
      label: "LOCAL_PROXY_URL",
      detail: "not set",
      required: false,
    });
    return;
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(proxyUrl);
  } catch {
    addCheck({
      ok: false,
      label: "LOCAL_PROXY_URL",
      detail: "not a valid URL",
      required: false,
    });
    return;
  }

  const defaultPort = parsedUrl.protocol === "https:" ? 443 : 80;
  const host = parsedUrl.hostname;
  const port = Number(parsedUrl.port || defaultPort);
  const reachable = await canConnect(host, port, 1_500);

  addCheck({
    ok: reachable,
    label: "LOCAL_PROXY_URL",
    detail: reachable ? `${host}:${port} reachable` : `${host}:${port} unreachable`,
    required: false,
  });
}

function readEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const content = readFileSync(filePath, "utf8");
  const env = {};

  for (const line of content.split(/\r?\n/u)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim();
    env[key] = unquote(value);
  }

  return {
    ...env,
    ...process.env,
  };
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function isPlaceholder(value) {
  const normalizedValue = value.toLowerCase();

  return (
    normalizedValue.includes("xxx") ||
    normalizedValue.includes("your-project-ref") ||
    normalizedValue.includes("your_") ||
    normalizedValue === "sk_xxx" ||
    normalizedValue === "sb_secret_xxx" ||
    normalizedValue === "sb_publishable_xxx"
  );
}

function canConnect(host, port, timeoutMs) {
  return new Promise((resolveConnect) => {
    const socket = net.createConnection({ host, port });
    let resolved = false;

    const finish = (result) => {
      if (resolved) {
        return;
      }

      resolved = true;
      socket.destroy();
      resolveConnect(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });
}

function addCheck(check) {
  checks.push(check);

  const status = check.ok ? "OK" : check.required ? "FAIL" : "WARN";
  console.log(`[${status}] ${check.label} - ${check.detail}`);
}

function printSummary() {
  const failures = checks.filter((check) => !check.ok && check.required);
  const warnings = checks.filter((check) => !check.ok && !check.required);

  console.log("\nSummary");
  console.log(`${checks.length} checks, ${failures.length} failed, ${warnings.length} warnings`);

  if (failures.length > 0) {
    console.log("\nFix the failed checks before running the full web + worker flow.");
    process.exitCode = 1;
    return;
  }

  console.log("\nLocal web + worker prerequisites look ready.");
}

function toErrorMessage(caught) {
  return caught instanceof Error ? caught.message : String(caught);
}
