import { copyFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const webuiRoot = path.resolve(path.dirname(__filename), '..');
const staticDir = path.join(webuiRoot, 'static');

mkdirSync(staticDir, { recursive: true });

for (const filename of ['logo.png', 'logo.svg']) {
  copyFileSync(path.join(webuiRoot, 'media', 'logo', filename), path.join(staticDir, filename));
}
