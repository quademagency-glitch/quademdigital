import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Execute the real server modules with explicitly injected external services.
// A missing mock cannot accidentally submit to production: fetch fails closed.
export function loadTs(file, { mocks = {}, env = {}, globals = {}, append = '' } = {}) {
  const filename = new URL(file, new URL('../../', import.meta.url));
  const source = readFileSync(filename, 'utf8').replaceAll('import.meta.env', 'TEST_ENV');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const realRequire = createRequire(filename);
  const context = {
    exports: {}, TEST_ENV: env, process: { env: {} },
    require: id => Object.hasOwn(mocks, id) ? mocks[id] : realRequire(id),
    Request, Response, Headers, URL, URLSearchParams, FormData, Blob, Buffer, AbortSignal,
    structuredClone, setTimeout, clearTimeout,
    console: { log() {}, warn() {}, error() {} },
    fetch: async () => { throw new Error('Unmocked network request'); }, ...globals,
  };
  vm.runInNewContext(code + '\n' + append, context, { filename: filename.pathname });
  return context.exports;
}
