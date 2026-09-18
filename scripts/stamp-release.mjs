import { readFileSync, writeFileSync } from 'node:fs';

const pad = value => String(value).padStart(2, '0');
const now = new Date();
const display = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
const cache = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;

const update = (file, transform) => writeFileSync(file, transform(readFileSync(file, 'utf8')), 'utf8');
update('app.js', text => text
  .replace(/const DATA_VERSION = '\d+';/, `const DATA_VERSION = '${cache}';`)
  .replace(/version\.textContent = ' · 版本 [^']+';/, `version.textContent = ' · 版本 ${display}';`));
update('index.html', text => text
  .replace(/styles\.css\?v=\d+/, `styles.css?v=${cache}`)
  .replace(/app\.js\?v=\d+/, `app.js?v=${cache}`));
console.log(`Release version stamped: ${display}`);
