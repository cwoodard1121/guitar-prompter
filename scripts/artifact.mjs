// Turns the single-file Vite build into a claude.ai artifact page: the artifact
// host supplies <!doctype>/<html>/<head>/<body>, so we emit only the content
// (title, font link, styles, contract comment, root, inline module script).
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist-single/index.html', 'utf8');
const pick = (re) => [...html.matchAll(re)].map((m) => m[0]);
const title = pick(/<title>[\s\S]*?<\/title>/g)[0] ?? '<title>Guitar Prompter</title>';
const links = pick(/<link rel="stylesheet"[^>]*>/g);
const styles = pick(/<style[\s\S]*?<\/style>/g);
const scripts = pick(/<script[\s\S]*?<\/script>/g);
const body = html.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? '';
const bodyNoScripts = body.replace(/<script[\s\S]*?<\/script>/g, '');

const out = [title, ...links, ...styles, bodyNoScripts.trim(), ...scripts].join('\n');
writeFileSync('dist-single/guitar-prompter.html', out);
console.log(`artifact page: ${(out.length / 1024).toFixed(0)} KB`);
