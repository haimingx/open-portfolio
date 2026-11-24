import { unstable_cache } from 'next/cache';

// The data cache outlives deployments while the cached shapes change with the code, so keys include the deployment id and a new deployment never reads data written by older code.
// Locally there is no deployment id; clear .next/cache after a shape change.
const DEPLOYMENT = process.env.VERCEL_DEPLOYMENT_ID ?? 'local';

// unstable_cache keys include the callback's source. Pages, route handlers and Server Actions are separate bundle layers whose minified sources differ,
// so the same data would be stored several times, invisible to each other, and read once each. A bound function's source is always "function () { [native code] }",
// so the key depends only on keyParts and the deployment id, and keyParts must be unique.
// A caller whose values do not depend on the site's code, such as a Chaintable function's results, passes its own version instead, so they survive deployments.
export function sharedCache<A extends unknown[], R>(fn: (...args: A) => Promise<R>, keyParts: string[], options: { revalidate: number; version?: string }) {
  return unstable_cache(fn.bind(null), [...keyParts, options.version ?? DEPLOYMENT], { revalidate: options.revalidate });
}
