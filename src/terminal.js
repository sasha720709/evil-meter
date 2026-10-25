const tty = process.stderr.isTTY && !process.env.NO_COLOR;
const c = (code) => (s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : String(s));
export const red = c("31;1");
export const green = c("32;1");
export const yellow = c("33;1");
export const dim = c("2");
export const bold = c("1");

export const log = (...args) => console.error(...args);

const colorFor = (score, threshold) => (score > threshold ? red : score > threshold * 0.6 ? yellow : green);

export function meterBar(score, threshold, width = 40) {
  const filled = Math.round((score / 100) * width);
  const limitAt = Math.round((threshold / 100) * width);
  let bar = "";
  for (let i = 0; i < width; i++) {
    const ch = i === limitAt ? "|" : i < filled ? "█" : "░";
    bar += i === limitAt ? red(ch) : i < filled ? colorFor((i / width) * 100, threshold)(ch) : dim(ch);
  }
  return `[${bar}]`;
}

let spinner;
export function startSpinner(text) {
  if (!tty) return log(dim(text));
  const frames = ["▁", "▃", "▅", "▇", "▅", "▃"];
  let i = 0;
  spinner = setInterval(() => process.stderr.write(`\r  ${red(frames[i++ % frames.length])} ${dim(text)}   `), 120);
}
export function stopSpinner() {
  if (spinner) {
    clearInterval(spinner);
    spinner = null;
    process.stderr.write("\r\x1b[K");
  }
}

const meterLine = (score, threshold) =>
  `  ${bold("☠ EVIL METER")}  ${meterBar(score, threshold)}  ${colorFor(score, threshold)(`${String(score).padStart(3)}/100`)} ${dim(`(limit ${threshold})`)}`;

// Sweep the bar up to the score (with a little overshoot) like a needle settling.
async function animateMeter(score, threshold) {
  const steps = 24;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const eased = 1 - Math.pow(1 - t, 3) + Math.sin(t * Math.PI) * 0.08;
    const v = Math.max(0, Math.min(100, Math.round(score * eased)));
    process.stderr.write(`\r${meterLine(v, threshold)}\x1b[K`);
    await new Promise((r) => setTimeout(r, 30));
  }
  process.stderr.write(`\r${meterLine(score, threshold)}\x1b[K\n`);
}

export async function printResult(result, threshold, allowed) {
  const col = colorFor(result.score, threshold);
  log("");
  if (tty) await animateMeter(result.score, threshold);
  else log(meterLine(result.score, threshold));
  log(`  ${col(result.title)} ${dim("—")} ${result.roast}`);
  if (result.sins.length) {
    log("");
    for (const s of result.sins) log(`   ${red(`+${s.points}`.padStart(4))}  ${s.description} ${dim(s.where)}`);
  }
  log("");
  if (allowed) log(`  ${green("✔ Push allowed.")} ${dim("The darkness approves.")}`);
  else
    log(
      `  ${red("✖ Push blocked: too evil.")} ${dim("Repent and recommit, or bypass with")} git push --no-verify`,
    );
  log("");
}
