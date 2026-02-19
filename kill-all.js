#!/usr/bin/env node

/**
 * Kill running UI and API development server processes.
 * Respects port overrides from .env file.
 */

const { execSync } = require("child_process");
const path = require("path");

// Load .env file if it exists
const dotenvPath = path.resolve(process.cwd(), ".env");
try {
  require("dotenv").config({ path: dotenvPath });
} catch {
  // dotenv might not be available, that's okay
}

const UI_PORT = parseInt(process.env.UI_PORT ?? "5173", 10);
const API_PORT = parseInt(process.env.API_PORT ?? "4319", 10);

function findPidsOnPort(port) {
  try {
    const platform = process.platform;
    let output;

    if (platform === "darwin" || platform === "linux") {
      // lsof -ti:port outputs just PIDs, one per line
      output = execSync(`lsof -ti:${port}`, { encoding: "utf-8" });
    } else if (platform === "win32") {
      // Windows: netstat -ano | findstr :PORT
      output = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf-8" });
      // Parse Windows output to extract PIDs (last column)
      return output
        .split("\n")
        .filter((line) => line.includes("LISTENING"))
        .map((line) => line.trim().split(/\s+/).pop())
        .filter((pid, idx, arr) => pid && arr.indexOf(pid) === idx);
    } else {
      console.error(`Unsupported platform: ${platform}`);
      return [];
    }

    return output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch {
    // No process found on this port
    return [];
  }
}

function killPids(pids) {
  const platform = process.platform;

  for (const pid of pids) {
    try {
      if (platform === "win32") {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      } else {
        process.kill(parseInt(pid, 10), "SIGTERM");
      }
      console.log(`Killed process ${pid}`);
    } catch (error) {
      console.error(`Failed to kill process ${pid}: ${error.message}`);
    }
  }
}

function main() {
  console.log(`Checking for processes on ports: UI=${UI_PORT}, API=${API_PORT}`);

  const uiPids = findPidsOnPort(UI_PORT);
  const apiPids = findPidsOnPort(API_PORT);

  if (uiPids.length === 0 && apiPids.length === 0) {
    console.log("No processes found on UI or API ports.");
    return;
  }

  if (uiPids.length > 0) {
    console.log(`Found UI processes on port ${UI_PORT}: ${uiPids.join(", ")}`);
    killPids(uiPids);
  }

  if (apiPids.length > 0) {
    console.log(`Found API processes on port ${API_PORT}: ${apiPids.join(", ")}`);
    killPids(apiPids);
  }

  console.log("Done.");
}

main();
