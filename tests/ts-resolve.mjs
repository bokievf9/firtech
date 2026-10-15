// Lets node --test import the app's .ts modules: extensionless relative imports resolve to .ts.
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, next) {
    if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]s$/.test(specifier)) {
      try {
        return next(`${specifier}.ts`, context)
      } catch {}
    }
    return next(specifier, context)
  },
})
