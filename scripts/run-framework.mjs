import { existsSync, symlinkSync } from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readExecutionProfile } from "./execution-profile.mjs";

const [command, ...args] = process.argv.slice(2);
if (!["dev", "build"].includes(command)) throw new Error("Expected dev or build.");
const managedLinux = readExecutionProfile() === "managed-linux";

// Rolldown's Windows native binding crashes when the project path contains
// characters outside the active code page (this repository lives under a
// Chinese folder). Build through an ASCII junction so the same files and
// output remain in the real checkout while Vite/Rolldown only sees ASCII
// paths. The junction is disposable and never enters the repository.
if (process.platform === "win32" && /[^\x00-\x7f]/.test(process.cwd())) {
  const sourceRoot = process.cwd();
  const suffix = crypto.createHash("sha1").update(sourceRoot).digest("hex").slice(0, 12);
  const junction = path.join(os.tmpdir(), `zcq-sites-build-${suffix}`);
  if (!existsSync(junction)) symlinkSync(sourceRoot, junction, "junction");
  process.chdir(junction);
}

if (managedLinux && command === "build") {
  const result = spawnSync("bash", [
    fileURLToPath(new URL("./build-verified.sh", import.meta.url)), ...args,
  ], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

// Import in this process so the preview owner retains its PID and signals.
const cli = new URL(managedLinux
  ? "../node_modules/vite/bin/vite.js"
  : "../node_modules/vinext/dist/cli.js", import.meta.url);
process.argv = [process.execPath, fileURLToPath(cli), command,
  ...(!managedLinux && command === "dev" ? ["--port", "5173"] : []), ...args];
await import(cli.href);
