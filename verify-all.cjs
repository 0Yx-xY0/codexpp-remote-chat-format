const { spawnSync } = require('node:child_process');
const { resolve, join } = require('node:path');
const { statSync } = require('node:fs');

const target = process.argv[2];
if (!target || !statSync(target, { throwIfNoEntry: false })?.isFile()) {
  console.error('Usage: npm test -- <path to the patched index.html>');
  process.exit(2);
}

for (const script of ['verify-line-chat.cjs', 'verify-width.cjs', 'verify-math.cjs']) {
  const result = spawnSync(process.execPath, [join(__dirname, script), resolve(target)], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
