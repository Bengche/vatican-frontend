const API_URL = (
  process.env.NEXT_PUBLIC_BASE_API_URL || "http://localhost:8000"
).replace(/\/+$/, "");

/** Server-side fetch of public API data; returns null instead of throwing so pages degrade gracefully. */
export async function fetchPublic<T>(
  path: string,
  revalidateSeconds = 60,
): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}/api${path}`, {
      next: { revalidate: revalidateSeconds },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
