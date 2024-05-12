import { defineConfig } from 'tsup';

export default defineConfig(options => ({
    entry: ['src/index.ts'],
    format: ['cjs', 'esm', 'iife'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    treeshake: true,
    minify: !options.watch,
}));
