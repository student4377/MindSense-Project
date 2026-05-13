import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type ResourceCategory = "article" | "video" | "audio";
export type ResourceMoodCategory =
  | "stressed"
  | "anxious"
  | "low_motivation"
  | "overwhelmed"
  | "calm"
  | "focused"
  | "mindfulness"
  | "sleep_support";
export type ResourceSourcePlatform = "youtube" | "spotify" | "soundcloud" | "article" | "external";

export type Resource = Tables<"resources"> & {
  type: ResourceCategory;
  mood_category: ResourceMoodCategory | null;
  source_platform: ResourceSourcePlatform | null;
};

export type ResourceBookmark = Tables<"resource_bookmarks">;
export type ResourceProgress = Tables<"resource_progress">;
export type ResourcePayload = TablesInsert<"resources">;
export type ResourceUpdatePayload = TablesUpdate<"resources">;

export type ResourceMeta = {
  title?: string;
  description?: string;
  thumbnail_url?: string;
  source_platform: ResourceSourcePlatform;
};

type ResourceRow = Partial<Tables<"resources">> & {
  id: string;
  title: string;
};

type ResourceQueryResult = {
  data: Resource[];
  error: { message: string } | null;
  compatibilityMode: boolean;
};

export const RESOURCE_CATEGORIES: Array<"all" | ResourceCategory> = ["all", "article", "video", "audio"];
export const RESOURCE_MOOD_CATEGORIES: Array<"all" | ResourceMoodCategory> = [
  "all",
  "stressed",
  "anxious",
  "low_motivation",
  "overwhelmed",
  "calm",
  "focused",
  "mindfulness",
  "sleep_support",
];

const RESOURCE_MOOD_SET = new Set<ResourceMoodCategory>(RESOURCE_MOOD_CATEGORIES.filter((item) => item !== "all"));

const LEGACY_RESOURCE_COLUMNS =
  "id,title,description,type,category,topic,thumbnail_url,content_url,content_body,duration,featured,created_by,created_at";

const PREMIUM_SCHEMA_COLUMNS = [
  "mood_category",
  "external_url",
  "tags",
  "estimated_duration",
  "source_platform",
  "is_published",
  "updated_at",
];

const isMissingPremiumSchemaError = (error?: { message?: string } | null) =>
  Boolean(error?.message && PREMIUM_SCHEMA_COLUMNS.some((column) => error.message.includes(column)));

export const normalizeMoodCategory = (value?: string | null): ResourceMoodCategory | null => {
  if (!value) return null;
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z_]/g, "");

  if (RESOURCE_MOOD_SET.has(normalized as ResourceMoodCategory)) return normalized as ResourceMoodCategory;
  if (normalized.includes("sleep") || normalized.includes("rest")) return "sleep_support";
  if (normalized.includes("anx") || normalized.includes("panic") || normalized.includes("worry") || normalized.includes("overthinking")) return "anxious";
  if (normalized.includes("stress") || normalized.includes("pressure") || normalized.includes("burnout")) return "stressed";
  if (normalized.includes("overwhelm") || normalized.includes("low_mood") || normalized.includes("sad")) return "overwhelmed";
  if (normalized.includes("motivat") || normalized.includes("tired") || normalized.includes("fatigue")) return "low_motivation";
  if (normalized.includes("focus") || normalized.includes("productiv")) return "focused";
  if (normalized.includes("calm") || normalized.includes("relax")) return "calm";
  if (normalized.includes("mindful") || normalized.includes("meditat")) return "mindfulness";
  return "mindfulness";
};

export const normalizeResource = (resource: ResourceRow): Resource => {
  const contentUrl = resource.external_url || resource.content_url || null;
  const duration = resource.estimated_duration || resource.duration || null;
  const createdAt = resource.created_at || new Date(0).toISOString();
  const moodCategory = normalizeMoodCategory(resource.mood_category || resource.topic);

  return {
    id: resource.id,
    title: resource.title,
    description: resource.description ?? null,
    type: (resource.type || resource.category || "article") as ResourceCategory,
    category: resource.category || resource.type || "article",
    topic: resource.topic || moodCategory,
    mood_category: moodCategory,
    thumbnail_url: resource.thumbnail_url ?? null,
    content_url: resource.content_url || resource.external_url || null,
    external_url: contentUrl,
    content_body: resource.content_body ?? null,
    duration,
    estimated_duration: duration,
    source_platform: (resource.source_platform || detectSourcePlatform(contentUrl || "")) as ResourceSourcePlatform,
    tags: resource.tags || [],
    featured: resource.featured ?? false,
    is_published: resource.is_published ?? true,
    created_by: resource.created_by ?? null,
    created_at: createdAt,
    updated_at: resource.updated_at || createdAt,
  };
};

export const detectSourcePlatform = (url: string): ResourceSourcePlatform => {
  const lower = url.toLowerCase();
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "youtube";
  if (lower.includes("spotify.com")) return "spotify";
  if (lower.includes("soundcloud.com")) return "soundcloud";
  if (lower.startsWith("http")) return "article";
  return "external";
};

export const getYoutubeId = (url: string) => {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  return match?.[1] ?? null;
};

export const getEmbedUrl = (resource: Resource) => {
  const url = resource.external_url || resource.content_url || "";
  if (!url) return "";
  const youtubeId = getYoutubeId(url);
  if (youtubeId) return `https://www.youtube.com/embed/${youtubeId}`;
  if (url.includes("open.spotify.com")) return url.replace("open.spotify.com/", "open.spotify.com/embed/");
  if (url.includes("soundcloud.com")) {
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=true`;
  }
  return url;
};

export const fetchResourceMetadata = async (url: string): Promise<ResourceMeta> => {
  const source = detectSourcePlatform(url);
  const youtubeId = getYoutubeId(url);

  if (youtubeId) {
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (response.ok) {
        const data = (await response.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
        return {
          title: data.title,
          description: data.author_name ? `YouTube resource by ${data.author_name}` : "Curated YouTube wellness resource.",
          thumbnail_url: data.thumbnail_url || `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
          source_platform: "youtube",
        };
      }
    } catch {
      // CORS/network failures fall back to deterministic URL metadata.
    }

    return {
      thumbnail_url: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
      source_platform: "youtube",
    };
  }

  return { source_platform: source };
};

export const listResources = async (includeUnpublished: boolean): Promise<ResourceQueryResult> => {
  let query = supabase.from("resources").select("*").order("featured", { ascending: false }).order("created_at", { ascending: false });
  if (!includeUnpublished) query = query.eq("is_published", true);
  const { data, error } = await query;

  if (!error) {
    return { data: ((data || []) as ResourceRow[]).map(normalizeResource), error: null, compatibilityMode: false };
  }

  if (!isMissingPremiumSchemaError(error)) {
    return { data: [], error, compatibilityMode: false };
  }

  const legacyResult = await supabase
    .from("resources")
    .select(LEGACY_RESOURCE_COLUMNS)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (legacyResult.error) {
    return { data: [], error: legacyResult.error, compatibilityMode: false };
  }

  return {
    data: ((legacyResult.data || []) as ResourceRow[]).map(normalizeResource),
    error: null,
    compatibilityMode: true,
  };
};

export const listBookmarks = async (userId: string) =>
  supabase.from("resource_bookmarks").select("*").eq("user_id", userId);

export const listProgress = async (userId: string) =>
  supabase.from("resource_progress").select("*").eq("user_id", userId);

export const saveResource = async (payload: ResourcePayload, id?: string) => {
  const normalized = {
    ...payload,
    content_url: payload.content_url || payload.external_url || null,
    duration: payload.duration || payload.estimated_duration || null,
    topic: payload.topic || payload.mood_category || null,
    updated_at: new Date().toISOString(),
  };

  const result = id
    ? await supabase.from("resources").update(normalized).eq("id", id)
    : await supabase.from("resources").insert(normalized);

  if (!isMissingPremiumSchemaError(result.error)) return result;

  const legacyPayload = {
    title: payload.title,
    description: payload.description ?? null,
    type: payload.type,
    category: payload.category || payload.type,
    topic: payload.topic || payload.mood_category || null,
    thumbnail_url: payload.thumbnail_url ?? null,
    content_url: payload.content_url || payload.external_url || null,
    content_body: payload.content_body ?? null,
    duration: payload.duration || payload.estimated_duration || null,
    featured: payload.featured ?? false,
    created_by: payload.created_by ?? null,
  };

  return id
    ? supabase.from("resources").update(legacyPayload).eq("id", id)
    : supabase.from("resources").insert(legacyPayload);
};

export const deleteResource = async (id: string) => supabase.from("resources").delete().eq("id", id);

export const upsertProgress = async (userId: string, resourceId: string, nextProgress: number) =>
  supabase.from("resource_progress").upsert(
    {
      user_id: userId,
      resource_id: resourceId,
      progress: Math.max(0, Math.min(100, nextProgress)),
      last_viewed: new Date().toISOString(),
    },
    { onConflict: "user_id,resource_id" },
  );
