#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { loadConfig, DEFAULTS, CONFIG_FILE } from "../src/config.js";
import { repoRoot, changesFromPushInput, changesFromLastCommit } from "../src/git.js";
import { judge } from "../src/judge.js";
import { startPopup } from "../src/popup.js";
import { install, uninstall } from "../src/hook.js";
import { log, printResult, startSpinner, stopSpinner, red, yellow, dim, bold } from "../src/terminal.js";

const HELP = `${bold("evil-meter")} — Claude measures how evil your push is.

  evil-meter install      add the pre-push hook to this repo
  evil-meter uninstall    remove it
  evil-meter init         write a ${CONFIG_FILE} with the defaults
  evil-meter check [rev]  judge one commit (default HEAD) without pushing
  evil-meter demo [score] show the meter with a fake verdict (no Claude call)

Bypass once:  git push --no-verify   or   EVIL_METER_SKIP=1 git push`;

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve("");
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (d) => (data += d));
    process.stdin.on("end", () => resolve(data));
  });
}

// Shared by `hook` and `check`: judge, show the meter, return whether the push may go ahead.
async function run(changes, cfg) {
  const popup = cfg.popup === "off" ? null : await startPopup({ threshold: cfg.threshold, commits: changes.commits, mode: cfg.popup }).catch(() => null);
  const n = changes.commits.length;
  startSpinner(`Measuring the evil of ${n} commit${n === 1 ? "" : "s"}…`);
  let result;
  try {
    result = await judge(changes, cfg);
  } catch (err) {
    stopSpinner();
    const allowed = cfg.onError !== "block";
    log(`\n  ${yellow("⚠ Evil meter could not get a reading:")} ${err.message}`);
    log(`  ${allowed ? dim("Letting the push through (onError: allow).") : red("Blocking the push (onError: block).")}\n`);
    await popup?.finish({ phase: "error", error: err.message, allowed });
    return allowed;
  }
  stopSpinner();
  const allowed = result.score <= cfg.threshold;
  printResult(result, cfg.threshold, allowed);
  await popup?.finish({ phase: "done", result, allowed });
  return allowed;
}

async function main() {
  const [cmd = "help", ...args] = process.argv.slice(2);
  const root = repoRoot();

  if (cmd === "help" || cmd === "--help" || cmd === "-h") return log(HELP), 0;

  if (cmd === "demo") {
    const score = args[0] !== undefined ? Number(args[0]) : 83;
    const cfg = loadConfig(root);
    const popup = await startPopup({
      threshold: cfg.threshold,
      mode: cfg.popup,
      commits: [{ sha: "d3m0666", subject: "quick fix, don't look", author: "you" }],
    });
    if (cfg.popup === "off") log(dim(`Meter page: ${popup.url}`));
    startSpinner("Measuring evil (demo)…");
    await new Promise((r) => setTimeout(r, Number(process.env.EVIL_METER_DEMO_MS) || 3500));
    stopSpinner();
    const result = {
      score,
      title: score > cfg.threshold ? "Diabolical" : "Mostly Harmless",
      roast: "This is a demo verdict. Your real code will be judged far more personally.",
      sins: [
        { where: "src/db.js:12", description: "SQL built by string concatenation", points: 30 },
        { where: "config.js:3", description: "Hardcoded API key", points: 25 },
        { where: "test/app.test.js", description: "Tests deleted instead of fixed", points: 20 },
      ],
    };
    const allowed = score <= cfg.threshold;
    printResult(result, cfg.threshold, allowed);
    await popup.finish({ phase: "done", result, allowed });
    return 0;
  }

  if (!root) {
    log(red("Not inside a git repository."));
    return 1;
  }

  if (cmd === "install") {
    const file = install();
    log(`☠ Evil meter armed: ${dim(file)}`);
    log(dim(`Every \`git push\` from this repo will now be judged. Tune it with \`evil-meter init\`.`));
    return 0;
  }
  if (cmd === "uninstall") {
    log(uninstall() ? "Evil meter disarmed." : "No evil-meter hook found.");
    return 0;
  }
  if (cmd === "init") {
    const file = path.join(root, CONFIG_FILE);
    if (fs.existsSync(file)) return log(`${CONFIG_FILE} already exists.`), 0;
    fs.writeFileSync(file, JSON.stringify(DEFAULTS, null, 2) + "\n");
    log(`Wrote ${file}`);
    return 0;
  }

  const cfg = loadConfig(root);

  if (cmd === "check") {
    return (await run(changesFromLastCommit(cfg, args[0] || "HEAD"), cfg)) ? 0 : 1;
  }

  if (cmd === "hook") {
    if (process.env.EVIL_METER_SKIP === "1") return 0;
    const changes = changesFromPushInput(await readStdin(), cfg);
    if (!changes) return 0; // nothing new (e.g. deleting a branch)
    if (!changes.diff.trim()) {
      log(dim("☠ Evil meter: nothing to judge (no file changes)."));
      return 0;
    }
    return (await run(changes, cfg)) ? 0 : 1;
  }

  log(HELP);
  return 1;
}

main().then(
  (code) => process.exit(code ?? 0),
  (err) => {
    stopSpinner();
    log(red(`evil-meter: ${err.message}`));
    // A broken meter should not hold pushes hostage unless configured to.
    const isHook = process.argv[2] === "hook";
    let onError = DEFAULTS.onError;
    try {
      onError = loadConfig(repoRoot()).onError;
    } catch {}
    process.exit(isHook && onError !== "block" ? 0 : 1);
  },
);
