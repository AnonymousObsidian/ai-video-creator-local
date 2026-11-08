import { spawn } from "node:child_process";
import { isIP } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const command = process.argv[2];
if (!["dev", "start"].includes(command)) {
  console.error("Usage: node scripts/run-next.mjs <dev|start>");
  process.exit(2);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvConfig(root, command === "dev");
const host = process.env.AVC_HOST?.trim() || "127.0.0.1";
const portText = process.env.AVC_PORT?.trim() || "3000";
const port = Number(portText);
if (!(host === "localhost" || host === "0.0.0.0" || host === "::" || isIP(host) || /^[a-z0-9.-]+$/i.test(host))) {
  console.error("AVC_HOST must be an IP address or hostname.");
  process.exit(2);
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("AVC_PORT must be a number from 1 to 65535.");
  process.exit(2);
}

const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextCli, command, "--hostname", host, "--port", String(port)], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});
child.once("error", (error) => {
  console.error(`Could not start Next.js: ${error.message}`);
  process.exitCode = 1;
});
child.once("close", (code) => {
  process.exitCode = code ?? 1;
});
