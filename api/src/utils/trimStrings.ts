/**
 * Recursively trim trailing whitespace from every string value in an object.
 * Works on nested objects and arrays. MSSQL 2008 CHAR/NCHAR fields are
 * right-padded, so this cleans API responses before sending to the client.
 *
 * @param input  Any value (primitive, object, array, null, undefined).
 * @returns      The same value with all strings trimmed of trailing whitespace.
 */
export function trimStrings<T>(input: T): T {
  if (typeof input === "string") {
    return input.trimEnd() as unknown as T;
  }

  if (Array.isArray(input)) {
    return input.map(trimStrings) as unknown as T;
  }

  if (input !== null && typeof input === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      cleaned[key] = trimStrings(value);
    }
    return cleaned as T;
  }

  return input;
}
