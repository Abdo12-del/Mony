const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const file of ['index.html', 'app.js', 'styles.css', 'logo.svg', 'favicon.svg']) {
  fs.copyFileSync(path.join(root, file), path.join(output, file));
}
console.log(`Copied static site to ${path.relative(root, output)}`);
