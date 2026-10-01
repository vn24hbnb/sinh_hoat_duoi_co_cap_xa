import { readFile } from 'node:fs/promises'
import ts from 'typescript'

// Executes actual production service code while replacing only its IO imports.
export async function loadService(relativePath, dependencies) {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
  const key = `qa_${crypto.randomUUID().replaceAll('-', '')}`
  globalThis[key] = dependencies
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace(/import\s*\*\s*as\s*(\w+)\s*from\s*['"]([^'"]+)['"];?/g,
    (_, name, path) => `const ${name} = globalThis[${JSON.stringify(key)}][${JSON.stringify(path)}];`).replace(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g,
    (_, names, path) => `const {${names}} = globalThis[${JSON.stringify(key)}][${JSON.stringify(path)}];`)
  try {
    return await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
  } finally {
    delete globalThis[key]
  }
}

export function queryMock(data, error = null) {
  const calls = []
  const query = { then: (resolve, reject) => Promise.resolve({ data, error }).then(resolve, reject) }
  for (const method of ['select', 'eq', 'order', 'in', 'limit', 'single', 'maybeSingle', 'insert', 'update', 'delete']) {
    query[method] = (...args) => { calls.push([method, ...args]); return query }
  }
  return { calls, query, client: { from(table) { calls.push(['from', table]); return query } } }
}
