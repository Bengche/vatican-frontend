import axios, { AxiosError } from "axios";
import { clearSession, getToken } from "./auth";

export const API_URL = (
  process.env.NEXT_PUBLIC_BASE_API_URL || "http://localhost:8000"
).replace(/\/+$/, "");

export const api = axios.create({ baseURL: `${API_URL}/api`, timeout: 30_000 });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const isAuthAttempt = error.config?.url?.includes("/login");
    if (
      error.response?.status === 401 &&
      !isAuthAttempt &&
      typeof window !== "undefined" &&
      getToken()
    ) {
      clearSession();
      const redirect = encodeURIComponent(
        window.location.pathname + window.location.search,
      );
      // Full reload on purpose: it also discards any state tied to the expired session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `${window.location.origin}/login?redirect=${redirect}`;
    }
    return Promise.reject(error);
  },
);

/** Turns any thrown value into a message that is safe to show to a passenger. */
export function errorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.data && typeof error.response.data.message === "string")
      return error.response.data.message;
    if (!error.response)
      return "Unable to reach the server. Please check your internet connection.";
  }
  return fallback;
}
