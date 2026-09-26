import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'tmp/portable-app.js'), 'utf8');
const banks = {
  './data/questions.json': fs.readFileSync(path.join(root, 'data/questions.json'), 'utf8'),
  './data/education.json': fs.readFileSync(path.join(root, 'data/education.json'), 'utf8'),
  './data/education-papers.json': fs.readFileSync(path.join(root, 'data/education-papers.json'), 'utf8'),
};
const bankSource = JSON.stringify(banks);
const shim = `<script>const __embeddedBanks=${bankSource};const __nativeFetch=window.fetch.bind(window);window.fetch=async function(input,init){const u=String(input);const key=Object.keys(__embeddedBanks).find(k=>u.includes(k.slice(2)));if(key)return new Response(__embeddedBanks[key],{status:200,headers:{'Content-Type':'application/json'}});return __nativeFetch(input,init)};</script>`;
const portableJs = js
  .replace('await fetch(`./data/questions.json?v=${DATA_VERSION}`, { cache: "no-store" })', 'await __portableJsonResponse(__embeddedBanks["./data/questions.json"])')
  .replace('await fetch(`./data/education.json?v=${DATA_VERSION}`, { cache: "no-store" })', 'await __portableJsonResponse(__embeddedBanks["./data/education.json"])')
  .replace('await fetch(`./data/education-papers.json?v=${DATA_VERSION}`, { cache: "no-store" })', 'await __portableJsonResponse(__embeddedBanks["./data/education-papers.json"])');
const portableShim = `<script>window.addEventListener('error',e=>{const n=document.querySelector('#sessionText');if(n)n.textContent='本地版加载错误：'+(e.error?.message||e.message)});window.addEventListener('unhandledrejection',e=>{const n=document.querySelector('#sessionText');if(n)n.textContent='本地版加载错误：'+(e.reason?.message||e.reason)});const __embeddedBanks=${bankSource};const __portableJsonResponse=async text=>new Response(text,{status:200,headers:{'Content-Type':'application/json'}});const __nativeFetch=window.fetch.bind(window);window.fetch=async function(input,init){const u=String(input);const key=Object.keys(__embeddedBanks).find(k=>u.includes(k.slice(2)));if(key)return __portableJsonResponse(__embeddedBanks[key]);return __nativeFetch(input,init)};</script>`;
const inline = `${portableShim}<script>${portableJs}</script>`;
let out = index.replace(/<link rel="stylesheet" href="\.\/styles\.css\?[^>]+\/>/, `<style>${css}</style>`);
out = out.replace(/<script type="module" src="\.\/app\.js\?[^>]+><\/script>/, inline);
// The portable file runs inline code under file://; the online CSP would block it.
out = out.split('\n').filter(line => !line.includes('Content-Security-Policy')).join('\n');
out = out.replace('<title>高校资格证刷题zcq版</title>', '<title>高校资格证刷题zcq版 · 教室版</title>');
fs.writeFileSync(path.join(root, '课堂版.html'), out, 'utf8');
console.log('课堂版.html generated');
