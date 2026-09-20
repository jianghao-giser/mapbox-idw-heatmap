import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.ts',
  external: ['mapbox-gl', 'earcut'],
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true
    }
  ],
  plugins: [
    typescript({
      tsconfig: './tsconfig.json'
    })
  ]
};
