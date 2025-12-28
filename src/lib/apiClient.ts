// src/lib/apiClient.ts

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
  authToken?: string,
  workspaceId?: string
): Promise<ApiResponse<T>> {
  const requestId = crypto.randomUUID(); // Generate UUID for request ID

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "X-Request-ID": requestId, // Attach X-Request-ID header
    ...options.headers,
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  } else {
    console.warn(`[${requestId}] apiFetch called without an authentication token.`);
  }

  if (workspaceId) {
    headers["X-Workspace-ID"] = workspaceId;
  } else {
    console.warn(`[${requestId}] apiFetch called without a workspace ID.`);
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      // Handle non-200 responses safely
      const errorText = await response.text();
      const errorMessage = `API Error: ${response.status} - ${errorText}`;
      console.warn(`[${requestId}] ${errorMessage}`); // Log with request_id
      return { error: errorMessage };
    }

    // Attempt to parse JSON, but handle cases where response might be empty or not JSON
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      try {
        const data: T = await response.json();
        return { data };
      } catch (jsonError: any) {
        const errorMessage = `JSON parsing error: ${jsonError.message}`;
        console.warn(`[${requestId}] ${errorMessage}`); // Log with request_id
        return { error: errorMessage };
      }
    } else {
      // If not JSON, return successful response but no data
      console.warn(`[${requestId}] API response not JSON. Content-Type: ${contentType}`);
      return { data: undefined };
    }

  } catch (e: any) {
    // Handle network errors or other exceptions
    const errorMessage = `Network or other error: ${e.message}`;
    console.warn(`[${requestId}] ${errorMessage}`); // Log with request_id
    return { error: errorMessage };
  }
}