import { EnvError, EnvMissingError } from './errors'
import { CleanedEnvAccessors, CleanOptions, Spec, ValidatorSpec } from './types'
import defaultReporter from './reporter'
import { defaultMiddlewares } from './middleware'

const testOnlySymbol = Symbol('envalid - test only')

/**
 * Validate a single env var, given a spec object
 *
 * @throws EnvError - If validation is unsuccessful
 * @return - The cleaned value
 */
function validateVar<T>({
  spec,
  name,
  rawValue,
}: {
  name: string
  rawValue: string | T
  spec: Spec<T> & { _parse: (input: string) => T }
}) {
  if (typeof spec._parse !== 'function') {
    throw new EnvError(`Invalid spec for "${name}"`)
  }
  const value = spec._parse(rawValue as string)

  if (spec.choices) {
    if (!Array.isArray(spec.choices)) {
      throw new TypeError(`"choices" must be an array (in spec for "${name}")`)
    } else if (!spec.choices.includes(value)) {
      throw new EnvError(`Value "${value}" not in choices [${spec.choices}]`)
    }
  }
  if (value == null) throw new EnvError(`Invalid value for env var "${name}"`)
  return value
}

// Format a string error message for when a required env var is missing
function formatSpecDescription<T>(spec: Spec<T>) {
  const egText = spec.example ? ` (eg. "${spec.example}")` : ''
  const docsText = spec.docs ? `. See ${spec.docs}` : ''
  return `${spec.desc}${egText}${docsText}`
}

const readRawEnvValue = <T>(env: unknown, k: keyof T | 'NODE_ENV'): string | T[keyof T] => {
  return (env as any)[k]
}

const isTestOnlySymbol = (value: any): value is symbol => value === testOnlySymbol

/**
 * Returns a sanitized, immutable environment object. _Only_ the env vars
 * specified in the `validators` parameter will be accessible on the returned
 * object.
 * @param environment An object containing your env vars (eg. process.env).
 * @param specs An object that specifies the format of required vars.
 * @param options An object that specifies options for cleanEnv.
 */
function cleanEnv<T>(
  environment: unknown,
  specs: { [K in keyof T]: ValidatorSpec<T[K]> },
  options: CleanOptions<T> = { middleware: defaultMiddlewares },
): Readonly<T & CleanedEnvAccessors> {
  let output = {} as T
  const errors: Partial<Record<keyof T, Error>> = {}
  const varKeys = Object.keys(specs) as Array<keyof T>
  const rawNodeEnv = readRawEnvValue(environment, 'NODE_ENV')

  for (const k of varKeys) {
    const spec = specs[k]
    const usingDevDefault = rawNodeEnv !== 'production' && spec.hasOwnProperty('devDefault')
    const devDefault = usingDevDefault ? spec.devDefault : undefined
    const rawValue =
      readRawEnvValue(environment, k) ?? (devDefault === undefined ? spec.default : devDefault)

    // Default values can be anything falsy (including an explicitly set undefined), without
    // triggering validation errors:
    const usingFalsyDefault =
      (spec.hasOwnProperty('default') && spec.default === rawValue) ||
      (usingDevDefault && devDefault === rawValue)

    try {
      if (isTestOnlySymbol(rawValue)) {
        throw new EnvMissingError(formatSpecDescription(spec))
      }

      if (rawValue === undefined) {
        if (!usingFalsyDefault) {
          throw new EnvMissingError(formatSpecDescription(spec))
        }
      } else {
        output[k] = validateVar({ name: k as string, spec, rawValue })
      }
    } catch (err) {
      if (options.reporter === null) throw err
      errors[k] = err
    }
  }

  const reporter = options.reporter || defaultReporter
  reporter({ errors, env: output })

  // Apply middlewares to transform the validated env object
  if (options.middleware?.length) {
    output = options.middleware.reduce((acc, mw) => mw(acc, environment as any), output)
  }

  return Object.freeze(output as T & CleanedEnvAccessors)
}

/**
 * Utility function for providing default values only when NODE_ENV=test
 *
 * For more context, see https://github.com/af/envalid/issues/32
 */
const testOnly = <T>(defaultValueForTests: T) => {
  return process.env.NODE_ENV === 'test' ? defaultValueForTests : ((testOnlySymbol as unknown) as T) // T is not strictly correct, but prevents type errors during usage
}

export { cleanEnv, testOnly }