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

export function printResult(result, threshold, allowed) {
  const col = colorFor(result.score, threshold);
  log("");
  log(`  ${bold("☠ EVIL METER")}  ${meterBar(result.score, threshold)}  ${col(`${result.score}/100`)} ${dim(`(limit ${threshold})`)}`);
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
