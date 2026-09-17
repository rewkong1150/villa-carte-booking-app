// Copies the Vite production build (dist/) into pocketbase/pb_public/ so a
// single PocketBase instance can serve both the React app and its own API
// from the same origin (no separate web server, no CORS setup needed).
// Run via `npm run build:pb` (builds + copies in one step).
//
// NOTE: this uses a manual recursive copy (readdirSync/copyFileSync) instead
// of fs.cpSync — on this project's path (which contains Thai characters),
// Node's native recursive fs.cpSync crashes the process outright (no error
// output, just a hard crash). mkdirSync/copyFileSync do not have this problem.
import { existsSync, rmSync, mkdirSync, readdirSync, copyFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(rootDir, 'dist');
const targetDir = path.join(rootDir, 'pocketbase', 'pb_public');

if (!existsSync(distDir)) {
  console.error('dist/ not found — run `vite build` first (this script runs automatically via `npm run build:pb`).');
  process.exit(1);
}

const copyRecursive = (src, dest) => {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
};

rmSync(targetDir, { recursive: true, force: true });
copyRecursive(distDir, targetDir);

console.log(`Copied ${distDir} -> ${targetDir}`);
console.log('Next: sync the pocketbase/ folder to your Synology NAS shared folder, then restart the container (or it will pick up new pb_public files on next request).');
