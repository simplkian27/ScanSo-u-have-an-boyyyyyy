import { QueryClient, QueryFunction } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Auth storage key - must match AuthContext
const AUTH_STORAGE_KEY = "@containerflow_auth_user";

// API URL Configuration
// EXPO_PUBLIC_DOMAIN is set by Replit at startup to "$REPLIT_DEV_DOMAIN:5000"
// This ensures all API requests go to the Express backend on port 5000
// The Expo app NEVER connects directly to Supabase - all DB access goes through the backend
export function getApiUrl(): string {
  let host = process.env.EXPO_PUBLIC_DOMAIN;

  if (!host) {
    throw new Error("EXPO_PUBLIC_DOMAIN is not set");
  }

  // Build HTTPS URL pointing to Express backend
  let url = new URL(`https://${host}`);

  return url.href;
}

// Get current user ID from AsyncStorage for auth headers
async function getStoredUserId(): Promise<string | null> {
  try {
    const storedUser = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (storedUser) {
      const user = JSON.parse(storedUser);
      return user.id || null;
    }
  } catch {
    // Ignore errors - no user stored
  }
  return null;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  // Build headers with authentication
  const headers: Record<string, string> = {};
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  // Include user ID for authentication on protected routes
  const userId = await getStoredUserId();
  if (userId) {
    headers["x-user-id"] = userId;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey[0] as string, baseUrl);

    if (queryKey.length > 1 && queryKey[1]) {
      const params = queryKey[1] as Record<string, string>;
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined) {
          url.searchParams.append(key, params[key]);
        }
      });
    }

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
    mutations: {
      retry: false,
    },
  },
});
