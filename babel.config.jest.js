/**
 * Babel Configuration for PrepBettr
 * 
 * Supports JSX/TSX transformation for Jest coverage collection and test environments.
 */

module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: { node: 'current' }
    }],
    '@babel/preset-react',
    '@babel/preset-typescript'
  ],
  plugins: [
    '@babel/plugin-syntax-jsx',
    '@babel/plugin-syntax-import-attributes',
    '@babel/plugin-transform-modules-commonjs'
  ],
  env: {
    test: {
      presets: [
        ['@babel/preset-env', {
          targets: { node: 'current' }
        }],
        ['@babel/preset-react', {
          runtime: 'automatic'
        }],
        '@babel/preset-typescript'
      ],
      plugins: [
        '@babel/plugin-syntax-jsx'
      ]
    }
  }
};
