import type { Tables } from "@/integrations/supabase/types";

type ProfileRow = Tables<"profiles">;
type MoodEntry = Tables<"mood_entries">;
type DepressionTest = Tables<"depression_tests">;

export type HeaderCache = {
  dateKey: string;
  name: string;
  isAdmin: boolean;
  profile: ProfileRow | null;
  todayMood: MoodEntry | null;
  latestTest: DepressionTest | null;
  testCount: number;
};

export type HeaderCacheUpdate = {
  userId: string;
  cache: HeaderCache;
};

type ReadHeaderCacheOptions = {
  dateKey?: string;
  removeExpired?: boolean;
};

export const HEADER_CACHE_UPDATED_EVENT = "mindsense-header-cache-updated";

export const todayKey = () => new Date().toISOString().slice(0, 10);

export const headerCacheKey = (userId: string) => `mindsense-header-cache-${userId}`;

const canUseLocalStorage = () => typeof window !== "undefined" && Boolean(window.localStorage);

export const readHeaderCache = (userId?: string | null, options: ReadHeaderCacheOptions = {}) => {
  if (!userId || !canUseLocalStorage()) return null;

  const expectedDateKey = options.dateKey || todayKey();
  const key = headerCacheKey(userId);

  try {
    const cached = localStorage.getItem(key);
    const parsed = cached ? (JSON.parse(cached) as HeaderCache) : null;
    if (parsed?.dateKey === expectedDateKey) return parsed;

    if (cached && options.removeExpired) {
      localStorage.removeItem(key);
    }
  } catch {
    if (options.removeExpired) {
      localStorage.removeItem(key);
    }
  }

  return null;
};

export const writeHeaderCache = (userId: string, cache: HeaderCache) => {
  if (!canUseLocalStorage()) return;

  try {
    localStorage.setItem(headerCacheKey(userId), JSON.stringify(cache));
  } catch {
    // Header cache is only used to prevent UI flicker between routes.
  }
};

export const updateHeaderProfileCache = (userId: string, profile: ProfileRow, name: string) => {
  const current = readHeaderCache(userId);
  const cache: HeaderCache = {
    dateKey: todayKey(),
    name,
    isAdmin: current?.isAdmin ?? false,
    profile,
    todayMood: current?.todayMood ?? null,
    latestTest: current?.latestTest ?? null,
    testCount: current?.testCount ?? 0,
  };

  writeHeaderCache(userId, cache);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<HeaderCacheUpdate>(HEADER_CACHE_UPDATED_EVENT, {
        detail: { userId, cache },
      }),
    );
  }
};

export const updateHeaderMoodCache = (userId: string, todayMood: MoodEntry | null) => {
  const current = readHeaderCache(userId);
  if (!current) return;

  const cache: HeaderCache = {
    ...current,
    dateKey: todayKey(),
    todayMood,
  };

  writeHeaderCache(userId, cache);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<HeaderCacheUpdate>(HEADER_CACHE_UPDATED_EVENT, {
        detail: { userId, cache },
      }),
    );
  }
};
