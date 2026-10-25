import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hooksDir } from "./git.js";

const MARKER = "# evil-meter-hook";
const BACKUP = "pre-push.pre-evil-meter";
const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "bin", "evil-meter.js");

const sh = (p) => `'${p.replace(/\\/g, "/").replace(/'/g, `'\\''`)}'`;

function hookScript() {
  return `#!/bin/sh
${MARKER} (installed by \`evil-meter install\`; remove with \`evil-meter uninstall\`)
[ "$EVIL_METER_SKIP" = "1" ] && exit 0
input=$(cat)
HOOK_DIR=$(dirname "$0")
if [ -x "$HOOK_DIR/${BACKUP}" ]; then
  printf '%s\\n' "$input" | "$HOOK_DIR/${BACKUP}" "$@" || exit $?
fi
NODE=${sh(process.execPath)}
CLI=${sh(CLI)}
if [ -f "$CLI" ] && [ -f "$NODE" ]; then
  printf '%s\\n' "$input" | "$NODE" "$CLI" hook "$@"
elif command -v evil-meter >/dev/null 2>&1; then
  printf '%s\\n' "$input" | evil-meter hook "$@"
else
  printf '%s\\n' "$input" | npx --yes evil-meter hook "$@"
fi
`;
}

export function install() {
  const dir = hooksDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "pre-push");
  if (fs.existsSync(file)) {
    const current = fs.readFileSync(file, "utf8");
    if (!current.includes(MARKER)) {
      fs.renameSync(file, path.join(dir, BACKUP));
      console.error(`Existing pre-push hook kept as ${BACKUP} (it still runs first).`);
    }
  }
  fs.writeFileSync(file, hookScript(), { mode: 0o755 });
  fs.chmodSync(file, 0o755);
  return file;
}

export function uninstall() {
  const dir = hooksDir();
  const file = path.join(dir, "pre-push");
  if (!fs.existsSync(file) || !fs.readFileSync(file, "utf8").includes(MARKER)) return false;
  fs.rmSync(file);
  const backup = path.join(dir, BACKUP);
  if (fs.existsSync(backup)) fs.renameSync(backup, file);
  return true;
}
