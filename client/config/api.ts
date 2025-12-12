/**
 * API Configuration - Single source of truth for API base URL
 * 
 * Configure API_BASE_URL via environment variable:
 * - EXPO_PUBLIC_API_URL: Full URL to your backend (overrides default)
 * 
 * Default production URL: https://containerflow-api.onrender.com/api
 */

declare const __DEV__: boolean;

// Production API URL - your Render.com deployment
const PRODUCTION_API_URL = "https://containerflow-api.onrender.com/api";

function buildApiBaseUrl(): string {
  // Check for explicit API URL environment variable (allows override)
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  
  if (apiUrl) {
    // Ensure the value has a protocol
    const base = apiUrl.startsWith("http://") || apiUrl.startsWith("https://")
      ? apiUrl
      : `https://${apiUrl}`;
    
    // Remove trailing slash, ensure it ends with /api
    const cleanBase = base.replace(/\/+$/, "");
    return cleanBase.endsWith("/api") ? cleanBase : `${cleanBase}/api`;
  }
  
  // In development, use localhost
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return "http://localhost:5000/api";
  }
  
  // Production: Use hardcoded Render URL
  return PRODUCTION_API_URL;
}

export const API_BASE_URL = buildApiBaseUrl();

// Log API URL at startup (development only)
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  console.log("API_BASE_URL =", API_BASE_URL);
}
