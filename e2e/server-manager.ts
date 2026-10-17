import http from "http";
import { spawn, execSync, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";

const PID_FILE = path.resolve(process.cwd(), "node_modules", ".playwright-dev-server.pid");

/**
 * Checks if the Next.js dev server is reachable on http://localhost:3000.
 */
export function checkServerHealth(url = "http://localhost:3000/"): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode !== undefined && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Polls the dev server until it responds or until the timeout expires.
 */
export async function waitForServer(url = "http://localhost:3000/", timeoutMs = 60000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const alive = await checkServerHealth(url);
    if (alive) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/**
 * Checks if `npm run dev` is already running on port 3000.
 * If not running, starts it and waits until it is fully ready.
 */
export async function ensureServerStarted(): Promise<{ wasAlreadyRunning: boolean }> {
  console.log("\n[E2E Setup] Checking if dev server is running on http://localhost:3000...");
  const isRunning = await checkServerHealth();

  if (isRunning) {
    console.log("[E2E Setup] ✓ Dev server is already running on http://localhost:3000.");
    return { wasAlreadyRunning: true };
  }

  console.log("[E2E Setup] → Dev server is NOT running. Starting npm run dev...");

  const isWin = process.platform === "win32";
  const cmd = isWin ? "npm.cmd" : "npm";

  const devProcess: ChildProcess = spawn(cmd, ["run", "dev"], {
    cwd: process.cwd(),
    shell: true,
    stdio: "inherit",
    detached: !isWin,
  });

  if (devProcess.pid) {
    try {
      fs.writeFileSync(PID_FILE, devProcess.pid.toString(), "utf-8");
    } catch (err) {
      console.warn("[E2E Setup] Could not write PID file:", err);
    }
  }

  const ready = await waitForServer("http://localhost:3000/", 60000);
  if (!ready) {
    throw new Error("Timed out waiting for Next.js dev server to start on http://localhost:3000.");
  }

  console.log("[E2E Setup] ✓ Dev server is now ready and listening on http://localhost:3000.\n");
  return { wasAlreadyRunning: false };
}

/**
 * Terminates the npm run dev process and frees port 3000.
 */
export async function stopDevServer(): Promise<void> {
  console.log("\n[E2E Teardown] Ending npm run dev process...");

  // 1. Terminate recorded PID tree if available
  if (fs.existsSync(PID_FILE)) {
    try {
      const pid = fs.readFileSync(PID_FILE, "utf-8").trim();
      if (pid) {
        if (process.platform === "win32") {
          try {
            execSync(`taskkill /F /T /PID ${pid} >nul 2>&1`);
          } catch {}
        } else {
          try {
            process.kill(-Number(pid), "SIGTERM");
          } catch {}
        }
      }
    } catch {}
    try {
      fs.unlinkSync(PID_FILE);
    } catch {}
  }

  // 2. Terminate any lingering processes listening on port 3000
  if (process.platform === "win32") {
    try {
      const netstatOutput = execSync("netstat -ano | findstr :3000", {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const lines = netstatOutput.split("\n").filter(Boolean);
      const pidsToKill = new Set<string>();

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== "0") {
          pidsToKill.add(pid);
        }
      }

      for (const pid of pidsToKill) {
        try {
          execSync(`taskkill /F /T /PID ${pid} >nul 2>&1`);
        } catch {}
      }
    } catch {}
  } else {
    try {
      execSync("npx kill-port 3000 >/dev/null 2>&1");
    } catch {}
  }

  // 3. Short wait to verify port release
  await new Promise((r) => setTimeout(r, 1500));
  const stillAlive = await checkServerHealth();
  if (stillAlive) {
    console.warn("[E2E Teardown] ⚠ Dev server process may still be active on port 3000.");
  } else {
    console.log("[E2E Teardown] ✓ npm run dev process successfully ended.\n");
  }
}
