const live = Boolean(process.stderr.isTTY);
const tty = live && !process.env.NO_COLOR;
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

// Everything on the meter line except the bar takes ~36 columns ("☠" can be 2 wide).
// The bar shrinks so the whole line always fits: a wrapped line can't be redrawn in place.
function barWidth() {
  const columns = process.stderr.columns || 80;
  return Math.max(10, Math.min(40, columns - 38));
}

const meterLine = (score, threshold) =>
  `  ${bold("☠ EVIL METER")} ${meterBar(score, threshold, barWidth())} ${colorFor(score, threshold)(`${String(score).padStart(3)}/100`)} ${dim(`limit ${threshold}`)}`;

const draw = (value, threshold) => process.stderr.write(`\r\x1b[2K${meterLine(Math.round(value), threshold)}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The live needle: while Claude thinks it wanders like a speed test, then springs onto the score.
const needle = { timer: null, value: 0, velocity: 0, target: 50, threshold: 70 };

function step(k, damping) {
  needle.velocity = (needle.velocity + (needle.target - needle.value) * k) * damping;
  needle.value = Math.max(0, Math.min(100, needle.value + needle.velocity));
}

export function startMeter(text, threshold) {
  log(dim(`  ${text}`));
  if (!live) return;
  Object.assign(needle, { value: 0, velocity: 0, target: 40, threshold });
  let frame = 0;
  needle.timer = setInterval(() => {
    if (frame++ % 12 === 0) needle.target = 15 + Math.random() * 70;
    needle.target += (Math.random() - 0.5) * 6;
    step(0.08, 0.8);
    draw(needle.value, threshold);
  }, 40);
}

export function stopMeter() {
  if (!needle.timer) return;
  clearInterval(needle.timer);
  needle.timer = null;
  process.stderr.write("\r\x1b[2K");
}

async function settleMeter(score, threshold) {
  const wasRunning = Boolean(needle.timer);
  clearInterval(needle.timer);
  needle.timer = null;
  if (!wasRunning) Object.assign(needle, { value: 0, velocity: 0 });
  needle.target = score;
  for (let i = 0; i < 80; i++) {
    step(0.16, 0.74);
    draw(needle.value, threshold);
    if (Math.abs(needle.target - needle.value) < 0.4 && Math.abs(needle.velocity) < 0.4) break;
    await sleep(30);
  }
  draw(score, threshold);
  process.stderr.write("\n");
}

export async function printResult(result, threshold, allowed) {
  const col = colorFor(result.score, threshold);
  if (live) await settleMeter(result.score, threshold);
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
