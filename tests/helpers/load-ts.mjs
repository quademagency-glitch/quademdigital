import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Execute the real server modules with explicitly injected external services.
// A missing mock cannot accidentally submit to production: fetch fails closed.
export function loadTs(file, { mocks = {}, env = {}, globals = {}, append = '' } = {}, loaded = new Map()) {
  const filename = new URL(file, new URL('../../', import.meta.url));
  const source = readFileSync(filename, 'utf8').replaceAll('import.meta.env', 'TEST_ENV');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const realRequire = createRequire(filename);
  // One of our own TypeScript files, imported without its extension, is run
  // the same way with the same mocks; Node alone cannot load it.
  const ownTs = id => {
    if (!id.startsWith('.')) return null;
    const found = [`${id}.ts`, `${id}/index.ts`].map(candidate => new URL(candidate, filename)).find(url => existsSync(url));
    if (!found) return null;
    if (!loaded.has(found.href)) loaded.set(found.href, loadTs(found.href, { mocks, env, globals }, loaded));
    return loaded.get(found.href);
  };
  const context = {
    exports: {}, TEST_ENV: env, process: { env: {} },
    require: id => Object.hasOwn(mocks, id) ? mocks[id] : ownTs(id) ?? realRequire(id),
    Request, Response, Headers, URL, URLSearchParams, FormData, Blob, Buffer, AbortSignal,
    structuredClone, setTimeout, clearTimeout,
    console: { log() {}, warn() {}, error() {} },
    fetch: async () => { throw new Error('Unmocked network request'); }, ...globals,
  };
  vm.runInNewContext(code + '\n' + append, context, { filename: filename.pathname });
  return context.exports;
}
