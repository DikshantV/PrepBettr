/* utils/selfPolyfill.js */
if (typeof self === 'undefined') {
  global.self = globalThis;
}
export default globalThis.self;