const fs = require('fs');
const code = fs.readFileSync('src/components/MenuSystem.jsx', 'utf8');
let depth = 0;
let line = 1;
let inTemplate = false;
let lastDepthChanges = [];

for (let i = 0; i < code.length; i++) {
  const c = code[i];
  const prev = i > 0 ? code[i - 1] : '';
  if (c === '`' && prev !== '\\') { inTemplate = !inTemplate; continue; }
  if (inTemplate) continue;
  if (c === '\n') { line++; continue; }
  if (c === '{') {
    depth++;
    if (depth === 1) lastDepthChanges.push({ type: 'open', line, depth });
  }
  if (c === '}') {
    depth--;
    if (depth === 0) lastDepthChanges.push({ type: 'close', line, depth });
    if (depth < 0) { console.log('Extra } at line', line); process.exit(1); }
  }
}
console.log('Final depth:', depth, 'at line', line);
console.log('Depth 0 events:', JSON.stringify(lastDepthChanges));