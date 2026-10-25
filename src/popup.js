import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(here, "..", "ui", "meter.html");

const APP_BROWSERS = {
  win32: [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ],
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ],
  linux: ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/microsoft-edge"],
};

function detached(cmd, args) {
  const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
  child.on("error", () => {});
  child.unref();
}

function openWindow(url, mode) {
  if (mode === "app") {
    const browser = (APP_BROWSERS[process.platform] || []).find((p) => fs.existsSync(p));
    if (browser) {
      detached(browser, [`--app=${url}`, "--window-size=560,820", "--new-window"]);
      return;
    }
  }
  if (process.platform === "win32") detached("cmd", ["/c", "start", "", url]);
  else if (process.platform === "darwin") detached("open", [url]);
  else detached("xdg-open", [url]);
}

// Serves the meter page and lets it poll for the verdict.
export async function startPopup({ threshold, commits, mode }) {
  const state = { phase: "measuring", threshold, commits };
  let acked;
  const ackPromise = new Promise((resolve) => (acked = resolve));

  const server = http.createServer((req, res) => {
    if (req.url === "/" || req.url.startsWith("/?")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(fs.readFileSync(PAGE));
    } else if (req.url === "/state") {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(state));
    } else if (req.url === "/ack" && req.method === "POST") {
      res.writeHead(204).end();
      acked();
    } else {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  if (mode !== "off") openWindow(url, mode);

  return {
    url,
    // Publish the final state, then wait (briefly) for the page to pick it up.
    async finish(update, maxWaitMs = 8000) {
      Object.assign(state, update);
      await Promise.race([ackPromise, new Promise((r) => setTimeout(r, maxWaitMs))]);
      server.close();
      server.closeAllConnections?.();
    },
  };
}
