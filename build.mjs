// Bundles the browser code into plugin/genqr/assets/build/ as ES modules (loaded with
// wp_enqueue_script_module). The PDF and Word libraries are split into chunks that load
// only when someone downloads those formats.
import { build, context } from 'esbuild';
import { rmSync } from 'node:fs';

const watch = process.argv.includes('--watch');
const outdir = 'plugin/genqr/assets/build';

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: { genqr: 'src/main.tsx', 'genqr-admin': 'src/admin.tsx' },
  outdir,
  bundle: true,
  format: 'esm',
  splitting: true,
  chunkNames: 'chunks/[name]-[hash]',
  platform: 'browser',
  target: ['es2020', 'chrome90', 'firefox90', 'safari15'],
  jsx: 'automatic',
  jsxImportSource: 'preact',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  legalComments: 'linked',
  logLevel: 'info',
};

rmSync(outdir, { recursive: true, force: true });
if (watch) {
  await (await context(options)).watch();
} else {
  await build(options);
}
