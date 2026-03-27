import * as esbuild from 'esbuild';
import stylexPlugin from '@stylexjs/esbuild-plugin';

const isWatch = process.argv.includes('--watch');

const webview = {
  entryPoints: ['src/kiwiSearch/webview/index.tsx'],
  bundle: true,
  outfile: 'out/webview.js',
  plugins: [
    stylexPlugin({
      useCSSLayers: true,
      generatedCSSFileName: 'out/webview.css',
      stylexImports: ['@stylexjs/stylex']
    })
  ],
  define: {
    'process.env.NODE_ENV': '"production"'
  }
};

console.log('Build start');
if (isWatch) {
  await Promise.all([esbuild.context(webview).then(c => c.watch())]);
} else {
  await Promise.all([esbuild.build(webview)]);
}
console.log('Build success');
