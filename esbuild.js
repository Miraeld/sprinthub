const esbuild = require('esbuild');

const isProd = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

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

const cssConfig = {
  entryPoints: ['webview-ui/styles.css'],
  bundle: true,
  outfile: 'out/styles.css',
  minify: isProd,
};

async function main() {
  if (isWatch) {
    const [extCtx, webCtx, cssCtx] = await Promise.all([
      esbuild.context(extensionConfig),
      esbuild.context(webviewConfig),
      esbuild.context(cssConfig),
    ]);
    await Promise.all([extCtx.watch(), webCtx.watch(), cssCtx.watch()]);
    console.log('Watching for changes...');
  } else {
    await Promise.all([
      esbuild.build(extensionConfig),
      esbuild.build(webviewConfig),
      esbuild.build(cssConfig),
    ]);
    console.log('Build complete.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
