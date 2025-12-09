// lib/api-client.ts
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "http://localhost:5000";

interface ApiRequestOptions {
  method?: string;
  token?: string | null;
  body?: unknown;
}

export async function apiRequest<TResponse>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<TResponse> {
  const { method = "GET", token, body } = options;

  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // فقط برای دیباگ؛ بعداً می‌تونی برداریش
  console.log("apiRequest:", { url, status: res.status });

  if (!res.ok) {
    let errorBody: unknown = null;
    try {
      errorBody = await res.json();
    } catch {
      // ignore
    }
    console.error("API error:", {
      url,
      status: res.status,
      body: errorBody,
    });
    throw new Error(`API request failed with status ${res.status}`);
  }

  if (res.status === 204) {
    // No Content
    return undefined as TResponse;
  }

  return (await res.json()) as TResponse;
}
