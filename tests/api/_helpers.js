// Shared test helpers for API route tests.

/**
 * Build a minimal mock Request with a JSON body.
 */
export function makeReq(body) {
  return {
    json: () => Promise.resolve(body),
  };
}

/**
 * Build a minimal mock Request that throws on .json() — simulates malformed body.
 */
export function makeInvalidJsonReq() {
  return {
    json: () => { throw new SyntaxError('bad json'); },
  };
}

/**
 * Extract the JSON body and status from a NextResponse mock return value.
 * Our NextResponse mock stores these on the object directly.
 */
export function unwrap(res) {
  return { status: res._status, body: res._body };
}
