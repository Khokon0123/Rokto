// next/cache needs a Next.js request scope; in tests caching is a pass-through.
export function unstable_cache<T extends (...args: never[]) => unknown>(fn: T): T {
  return fn;
}
export function revalidateTag(): void {}
export function revalidatePath(): void {}
