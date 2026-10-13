import { defineConfig } from 'tsup';

// Watch mode must not empty dist: dependents compile while the d.ts files are being rewritten
// and would see the package as untyped.
export default defineConfig((options) => ({
  entry: ['src/index.ts', 'src/stdio.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: !options.watch,
}));
