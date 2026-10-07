import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
console.log(
  'Synthetic demo only. All visitors know the demo password. Do not enter confidential information.',
);
const child = spawn(process.execPath, [process.env.npm_execpath, 'run', 'dev'], {
  cwd: root,
  stdio: 'inherit',
  windowsHide: true,
  env: { ...process.env, DEMO_MODE: 'true', STORAGE_MODE: 'demo' },
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
