const authNetworkErrorMessage =
  "Cannot reach the Supabase project. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env, then restart the dev server.";

const networkErrorIndicators = [
  "failed to fetch",
  "fetch failed",
  "load failed",
  "networkerror",
  "network request failed",
];

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return typeof error === "string" ? error : "";
};

export const getAuthErrorMessage = (error: unknown) => {
  const message = getErrorMessage(error);
  const normalized = message.toLowerCase();

  if (networkErrorIndicators.some((indicator) => normalized.includes(indicator))) {
    return authNetworkErrorMessage;
  }

  return message || "Something went wrong. Please try again.";
};
