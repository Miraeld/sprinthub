const esbuild = require('esbuild');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const isProd = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

const TW_CLI = process.platform === 'win32'
  ? path.join(__dirname, 'node_modules/.bin/tailwindcss.cmd')
  : path.join(__dirname, 'node_modules/.bin/tailwindcss');
const TW_ARGS = ['-i', 'webview-ui/styles.css', '-o', 'out/styles.css'];

const extensionConfig = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: !isProd,
  minify: isProd,
};

const webviewConfig = {
  entryPoints: ['webview-ui/index.tsx'],
  bundle: true,
  outfile: 'out/webview.js',
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  sourcemap: !isProd,
  minify: isProd,
  define: {
    'process.env.NODE_ENV': isProd ? '"production"' : '"development"',
  },
};

async function main() {
  fs.mkdirSync('out', { recursive: true });

  if (isWatch) {
    // Tailwind in watch mode runs as a parallel process
    const twProc = spawn(TW_CLI, [...TW_ARGS, '--watch'], { stdio: 'inherit' });
    twProc.on('error', (err) => console.error('Tailwind watch error:', err));

    const [extCtx, webCtx] = await Promise.all([
      esbuild.context(extensionConfig),
      esbuild.context(webviewConfig),
    ]);
    await Promise.all([extCtx.watch(), webCtx.watch()]);
    console.log('Watching for changes...');
  } else {
    await Promise.all([
      esbuild.build(extensionConfig),
      esbuild.build(webviewConfig),
    ]);
    // Tailwind processes the CSS after JS is built
    const twResult = spawnSync(TW_CLI, [...TW_ARGS, ...(isProd ? ['--minify'] : [])], { stdio: 'inherit' });
    if (twResult.status !== 0) {
      throw new Error(`Tailwind exited with code ${twResult.status}`);
    }
    console.log('Build complete.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
