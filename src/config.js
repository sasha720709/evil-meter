import fs from "node:fs";
import path from "node:path";

export const CONFIG_FILE = ".evilmeter.json";

export const DEFAULTS = {
  // Pushes scoring above this (0-100) are blocked.
  threshold: 70,
  // "auto" | "api" | "claude-code"
  //   api         -> uses ANTHROPIC_API_KEY (you pay per push, fractions of a cent to a few cents)
  //   claude-code -> uses your logged-in Claude Code CLI (`claude`), billed to your Claude plan
  //   auto        -> api if a key is set, otherwise claude-code if installed
  provider: "auto",
  // Model for the "api" provider. "claude-haiku-5-5" is ~40x cheaper if you want pennies.
  model: "claude-opus-5-5",
  // Model for the "claude-code" provider; null = whatever your Claude Code uses by default.
  claudeCodeModel: null,
  // "app" (chromeless browser window) | "browser" (normal tab) | "off" (terminal only)
  popup: "app",
  // What to do if Claude can't be reached: "allow" or "block"
  onError: "allow",
  // Diffs larger than this are cut off (and Claude is told so).
  maxDiffChars: 80000,
  // Paths never sent to Claude (git pathspec globs).
  exclude: [
    "**/package-lock.json",
    "**/yarn.lock",
    "**/pnpm-lock.yaml",
    "**/Cargo.lock",
    "**/poetry.lock",
    "**/composer.lock",
    "**/Gemfile.lock",
    "**/go.sum",
    "**/*.min.js",
    "**/*.map",
  ],
};

export function loadConfig(repoRoot) {
  let fileConfig = {};
  const file = repoRoot && path.join(repoRoot, CONFIG_FILE);
  if (file && fs.existsSync(file)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (err) {
      throw new Error(`Could not parse ${CONFIG_FILE}: ${err.message}`);
    }
  }
  const cfg = { ...DEFAULTS, ...fileConfig };

  const env = process.env;
  if (env.EVIL_METER_THRESHOLD) cfg.threshold = Number(env.EVIL_METER_THRESHOLD);
  if (env.EVIL_METER_PROVIDER) cfg.provider = env.EVIL_METER_PROVIDER;
  if (env.EVIL_METER_MODEL) cfg.model = env.EVIL_METER_MODEL;
  if (env.EVIL_METER_POPUP) cfg.popup = env.EVIL_METER_POPUP;
  if (env.CI) cfg.popup = "off";

  if (!Number.isFinite(cfg.threshold)) cfg.threshold = DEFAULTS.threshold;
  return cfg;
}
