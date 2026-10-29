const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const file of ['index.html', 'app.js', 'portfolio.js', 'companies.js', 'styles.css', 'logo.svg', 'favicon.svg', 'manifest.webmanifest', 'sw.js']) {
  fs.copyFileSync(path.join(root, file), path.join(output, file));
}
const outputIcons = path.join(output, 'icons');
fs.mkdirSync(outputIcons, { recursive: true });
for (const file of ['app-icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png']) {
  fs.copyFileSync(path.join(root, 'icons', file), path.join(outputIcons, file));
}
console.log(`Copied static PWA to ${path.relative(root, output)}`);
