export type ParamValue = string | number | boolean | readonly string[] | readonly number[];

/**
 * Query parameters, keyed by Qloo's own dotted names. Param shapes are `type` aliases, not
 * interfaces, so they are assignable to this index signature.
 */
export type QlooParams = Record<string, ParamValue | undefined>;

function serializeValue(value: ParamValue): string | undefined {
  if (typeof value === 'string') return value === '' ? undefined : value;
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value.toString();
  // Empty lists are dropped so `signal.interests.tags=` never reaches Qloo.
  return value.length === 0 ? undefined : value.join(',');
}

/**
 * The query string as sorted key/value pairs. This is what a receipt records as `input`, and
 * what the in-run cache keys on.
 */
export function serializeParams(params: QlooParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (value === undefined) continue;
    const serialized = serializeValue(value);
    if (serialized !== undefined) out[key] = serialized;
  }
  return out;
}

/** True when `key` is set to something Qloo would receive. */
export function hasParam(params: QlooParams, key: string): boolean {
  const value = params[key];
  return value !== undefined && serializeValue(value) !== undefined;
}
