// Lets the task scripts import the app's .ts modules from plain Node, as the tests do: extensionless
// relative imports resolve to .ts and 'server-only' becomes an empty module.
import { registerHooks } from 'node:module'

// Node warns that the .ts files have no package type; harmless here.
process.removeAllListeners('warning')

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only')
      return { url: 'data:text/javascript,export{}', shortCircuit: true }
    if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]s(on)?$/.test(specifier)) {
      try {
        return next(`${specifier}.ts`, context)
      } catch {}
    }
    return next(specifier, context)
  },
})
