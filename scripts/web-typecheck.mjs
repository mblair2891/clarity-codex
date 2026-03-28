import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDir = path.join(repoRoot, 'apps', 'web');
const tsconfigPath = path.join(webDir, 'tsconfig.json');
const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf8'));

tsconfig.include = (tsconfig.include ?? []).filter((entry) => entry !== '.next/types/**/*.ts');

const tempTsconfigPath = path.join(webDir, 'tsconfig.typecheck.json');

writeFileSync(tempTsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);

try {
  execFileSync(
    path.join(repoRoot, 'node_modules', '.bin', 'tsc'),
    ['-p', tempTsconfigPath, '--noEmit'],
    {
      cwd: webDir,
      stdio: 'inherit'
    }
  );
} finally {
  rmSync(tempTsconfigPath, { force: true });
}
