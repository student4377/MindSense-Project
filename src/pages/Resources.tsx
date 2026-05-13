import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Filter,
  Headphones,
  Loader2,
  MessageCircle,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import WellnessAssistant, { type WellnessAssistantResource } from "@/components/WellnessAssistant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { CURATED_RESOURCE_CANDIDATES, type CuratedResourceCandidate } from "@/data/curatedResourceDiscovery";
import {
  RESOURCE_CATEGORIES,
  RESOURCE_MOOD_CATEGORIES,
  deleteResource,
  detectSourcePlatform,
  fetchResourceMetadata,
  getEmbedUrl,
  listBookmarks,
  listProgress,
  listResources,
  normalizeResource,
  saveResource,
  upsertProgress,
  type Resource,
  type ResourceCategory,
  type ResourceMoodCategory,
} from "@/lib/resourceService";
import { buildResourceContext, recommendResources } from "@/lib/resourceRecommendations";

type BookmarkRow = Tables<"resource_bookmarks">;
type ProgressRow = Tables<"resource_progress">;
type MoodEntry = Tables<"mood_entries">;
type DepressionTest = Tables<"depression_tests">;

type ResourceFormState = {
  title: string;
  description: string;
  type: ResourceCategory;
  mood_category: ResourceMoodCategory;
  external_url: string;
  thumbnail_url: string;
  tags: string;
  estimated_duration: string;
  source_platform: string;
  featured: boolean;
  is_published: boolean;
};

const categoryIcon: Record<ResourceCategory, LucideIcon> = {
  article: BookOpen,
  video: Video,
  audio: Headphones,
};

const categoryLabel: Record<"all" | ResourceCategory, string> = {
  all: "All",
  article: "Articles",
  video: "Videos",
  audio: "Audio",
};

const moodLabel = (value: string) =>
  value === "all" ? "All moods" : value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatTags = (tags: string[] | null) => (tags || []).filter(Boolean).slice(0, 3);

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const isExternalUrl = (url?: string | null) => Boolean(url && /^https?:\/\//i.test(url));

const fallbackResources: Resource[] = CURATED_RESOURCE_CANDIDATES.map((candidate, index) =>
  normalizeResource({
    id: `fallback-${index}`,
    title: candidate.title,
    description: candidate.description,
    type: candidate.category,
    category: candidate.category,
    topic: candidate.mood_category,
    mood_category: candidate.mood_category,
    thumbnail_url: candidate.thumbnail_url,
    content_url: candidate.external_url,
    external_url: candidate.external_url,
    content_body: null,
    duration: candidate.estimated_duration,
    estimated_duration: candidate.estimated_duration,
    source_platform: candidate.source_platform,
    tags: candidate.tags,
    featured: candidate.featured ?? false,
    is_published: true,
    created_by: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  }),
);

const Resources = () => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [resources, setResources] = useState<Resource[]>([]);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<Record<string, { progress: number; last: string }>>({});
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [latestTest, setLatestTest] = useState<DepressionTest | null>(null);
  const [category, setCategory] = useState<"all" | ResourceCategory>("all");
  const [moodFilter, setMoodFilter] = useState<"all" | ResourceMoodCategory>("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [resourceSchemaReady, setResourceSchemaReady] = useState(true);
  const [openResource, setOpenResource] = useState<Resource | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError("");

    const [{ data: profile }, { data: admin }, moodResult, testResult] = await Promise.all([
      supabase.from("profiles").select("name").eq("id", user.id).maybeSingle(),
      supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle(),
      supabase.from("mood_entries").select("*").eq("user_id", user.id).order("entry_date", { ascending: false }).limit(14),
      supabase.from("depression_tests").select("*").eq("user_id", user.id).eq("status", "completed").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const adminMode = Boolean(admin);
    const [resourceResult, bookmarkResult, progressResult] = await Promise.all([
      listResources(adminMode),
      listBookmarks(user.id),
      listProgress(user.id),
    ]);

    if (resourceResult.error) {
      setLoadError(resourceResult.error.message);
      setResources(fallbackResources);
    } else {
      setResources(resourceResult.data.length ? resourceResult.data : fallbackResources);
    }
    setResourceSchemaReady(!resourceResult.error && !resourceResult.compatibilityMode);

    if (bookmarkResult.error) toast({ title: "Could not load bookmarks", description: bookmarkResult.error.message, variant: "destructive" });
    if (progressResult.error) toast({ title: "Could not load reading progress", description: progressResult.error.message, variant: "destructive" });
    if (moodResult.error) toast({ title: "Could not load mood signal", description: moodResult.error.message, variant: "destructive" });
    if (testResult.error) toast({ title: "Could not load assessment signal", description: testResult.error.message, variant: "destructive" });

    setName(profile?.name || user.email?.split("@")[0] || "Friend");
    setIsAdmin(adminMode);
    setBookmarks(new Set(((bookmarkResult.data as BookmarkRow[] | null) || []).map((bookmark) => bookmark.resource_id)));

    const pmap: Record<string, { progress: number; last: string }> = {};
    ((progressResult.data as ProgressRow[] | null) || []).forEach((item) => {
      pmap[item.resource_id] = { progress: item.progress, last: item.last_viewed };
    });
    setProgress(pmap);
    setMoods((moodResult.data as MoodEntry[] | null) || []);
    setLatestTest((testResult.data as DepressionTest | null) || null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const recommendationContext = useMemo(() => buildResourceContext(moods, latestTest), [latestTest, moods]);
  const recommended = useMemo(() => recommendResources(resources, recommendationContext, bookmarks), [bookmarks, recommendationContext, resources]);
  const featured = useMemo(() => resources.filter((resource) => resource.is_published && resource.featured).slice(0, 6), [resources]);
  const allTags = useMemo(() => Array.from(new Set(resources.flatMap((resource) => resource.tags || []))).sort(), [resources]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return resources.filter((resource) => {
      if (!isAdmin && !resource.is_published) return false;
      if (category !== "all" && resource.type !== category) return false;
      if (moodFilter !== "all" && resource.mood_category !== moodFilter) return false;
      if (tagFilter !== "all" && !resource.tags?.some((tag) => tag.toLowerCase() === tagFilter.toLowerCase())) return false;
      if (!query) return true;
      return `${resource.title} ${resource.description ?? ""} ${resource.mood_category ?? ""} ${(resource.tags || []).join(" ")}`
        .toLowerCase()
        .includes(query);
    });
  }, [category, isAdmin, moodFilter, resources, search, tagFilter]);

  const counts = useMemo(
    () => ({
      article: resources.filter((resource) => resource.type === "article").length,
      video: resources.filter((resource) => resource.type === "video").length,
      audio: resources.filter((resource) => resource.type === "audio").length,
    }),
    [resources],
  );

  const continueLearning = Object.entries(progress)
    .sort((a, b) => new Date(b[1].last).getTime() - new Date(a[1].last).getTime())
    .slice(0, 4)
    .map(([id, item]) => ({ resource: resources.find((resource) => resource.id === id), item }))
    .filter((entry): entry is { resource: Resource; item: { progress: number; last: string } } => Boolean(entry.resource));

  const refreshResources = async () => {
    const { data, error, compatibilityMode } = await listResources(isAdmin);
    if (error) toast({ title: "Refresh failed", description: error.message, variant: "destructive" });
    else {
      setResources(data.length ? data : fallbackResources);
      setResourceSchemaReady(!compatibilityMode);
    }
  };

  const toggleBookmark = async (id: string) => {
    if (!user) return;
    if (id.startsWith("fallback-")) {
      toast({ title: "Curated preview", description: "Save this resource after an admin imports it." });
      return;
    }

    const hadBookmark = bookmarks.has(id);
    const next = new Set(bookmarks);
    if (hadBookmark) next.delete(id);
    else next.add(id);
    setBookmarks(next);

    const { error } = hadBookmark
      ? await supabase.from("resource_bookmarks").delete().eq("user_id", user.id).eq("resource_id", id)
      : await supabase.from("resource_bookmarks").insert({ user_id: user.id, resource_id: id });

    if (error) {
      const rollback = new Set(bookmarks);
      setBookmarks(rollback);
      toast({ title: "Bookmark failed", description: error.message, variant: "destructive" });
    }
  };

  const openAndTrack = async (resource: Resource) => {
    setOpenResource(resource);
    if (!user || resource.id.startsWith("fallback-")) return;
    const current = progress[resource.id]?.progress ?? 0;
    const increment = resource.type === "article" ? 25 : 15;
    const nextProgress = Math.min(100, Math.max(current, current + increment));
    const { error } = await upsertProgress(user.id, resource.id, nextProgress);
    if (error) {
      toast({ title: "Progress not saved", description: error.message, variant: "destructive" });
      return;
    }
    setProgress((currentMap) => ({ ...currentMap, [resource.id]: { progress: nextProgress, last: new Date().toISOString() } }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <ResourceHero
          name={name}
          context={recommendationContext}
          loading={loading}
          search={search}
          onSearch={setSearch}
          counts={counts}
        />

        {loadError && (
          <section className="rounded-[1.5rem] border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
            Resource database could not be loaded, so MindSense is showing curated preview content. {loadError}
          </section>
        )}

        {isAdmin && !resourceSchemaReady && (
          <section className="rounded-[1.5rem] border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm text-cyan-50">
            Resources are running in compatibility mode. Apply the premium resources migration to enable drafts,
            publish controls, tags, mood categories, and admin discovery imports.
          </section>
        )}

        <ResourceCollection
          title="Recommended For You"
          subtitle={`Based on ${recommendationContext.reasons.join(", ")}.`}
          resources={recommended}
          bookmarks={bookmarks}
          progress={progress}
          onOpen={openAndTrack}
          onBookmark={toggleBookmark}
          variant="recommended"
        />

        {featured.length > 0 && (
          <ResourceCollection title="Featured Resources" subtitle="Admin-curated content highlighted for MindSense users." resources={featured} bookmarks={bookmarks} progress={progress} onOpen={openAndTrack} onBookmark={toggleBookmark} compact />
        )}

        <ResourceFilters
          category={category}
          moodFilter={moodFilter}
          tagFilter={tagFilter}
          tags={allTags}
          onCategory={setCategory}
          onMood={setMoodFilter}
          onTag={setTagFilter}
        />

        {continueLearning.length > 0 && <ContinueLearning entries={continueLearning} onOpen={openAndTrack} />}

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-extrabold">Resource Library</h2>
              <p className="mt-1 text-sm text-muted-foreground">Search, filter, save, and open external wellness resources.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={refreshResources}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              {isAdmin && resourceSchemaReady && (
                <Button className="premium-button" onClick={() => { setEditing(null); setAdminOpen(true); }}>
                  <Plus className="h-4 w-4" />
                  Add Resource
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <ResourceSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyResources isAdmin={isAdmin && resourceSchemaReady} onAdd={() => { setEditing(null); setAdminOpen(true); }} />
          ) : (
            <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  bookmarked={bookmarks.has(resource.id)}
                  progress={progress[resource.id]?.progress ?? 0}
                  onOpen={() => openAndTrack(resource)}
                  onBookmark={() => toggleBookmark(resource.id)}
                  admin={isAdmin && resourceSchemaReady && !resource.id.startsWith("fallback-")}
                  onEdit={() => { setEditing(resource); setAdminOpen(true); }}
                  onDelete={async () => {
                    if (!confirm("Delete this resource?")) return;
                    const { error } = await deleteResource(resource.id);
                    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
                    else {
                      toast({ title: "Resource deleted" });
                      refreshResources();
                    }
                  }}
                />
              ))}
            </motion.div>
          )}
        </section>

        {isAdmin && resourceSchemaReady && (
          <AdminDiscoveryPanel
            onImport={async (candidate) => {
              if (!user) return;
              const { error } = await saveResource({
                title: candidate.title,
                description: candidate.description,
                type: candidate.category,
                category: candidate.category,
                mood_category: candidate.mood_category,
                topic: candidate.mood_category,
                external_url: candidate.external_url,
                content_url: candidate.external_url,
                thumbnail_url: candidate.thumbnail_url,
                tags: candidate.tags,
                estimated_duration: candidate.estimated_duration,
                duration: candidate.estimated_duration,
                source_platform: candidate.source_platform,
                featured: candidate.featured ?? false,
                is_published: false,
                created_by: user.id,
              });
              if (error) toast({ title: "Import failed", description: error.message, variant: "destructive" });
              else {
                toast({ title: "Imported as draft", description: "Review and publish it from the admin manager." });
                refreshResources();
              }
            }}
          />
        )}

        <CrisisPanel />
      </div>

      <button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-sky-400 text-primary-foreground shadow-[var(--shadow-glow)] transition hover:scale-105"
        aria-label="Open Wellness Assistant"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      <AnimatePresence>
        {openResource && <ResourceModal resource={openResource} onClose={() => setOpenResource(null)} />}
        {adminOpen && resourceSchemaReady && (
          <AdminModal
            editing={editing}
            userId={user?.id}
            onClose={() => setAdminOpen(false)}
            onSaved={() => {
              setAdminOpen(false);
              refreshResources();
            }}
          />
        )}
        <WellnessAssistant
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          resources={resources}
          onOpenResource={(resource: WellnessAssistantResource) => {
            const matched = resources.find((item) => item.id === resource.id);
            if (matched) void openAndTrack(matched);
          }}
        />
      </AnimatePresence>
    </DashboardLayout>
  );
};

function ResourceHero({
  name,
  context,
  loading,
  search,
  onSearch,
  counts,
}: {
  name: string;
  context: ReturnType<typeof buildResourceContext>;
  loading: boolean;
  search: string;
  onSearch: (value: string) => void;
  counts: { article: number; video: number; audio: number };
}) {
  return (
    <section className="premium-card relative overflow-hidden p-5 md:p-7">
      <div className="premium-grid pointer-events-none absolute inset-0 opacity-25" />
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
            <Sparkles className="h-4 w-4" />
            {greeting()}, {name || "Friend"}
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-[1.04] md:text-5xl">
            Wellness resources,
            <span className="block gradient-text">curated around your mood.</span>
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
            Explore articles, videos, and audio from trusted external platforms. MindSense filters them with lightweight rules
            based on your mood, sleep, energy, and assessment signals.
          </p>
          <div className="relative mt-6 max-w-2xl">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search resources, tags, mood states..." className="h-12 rounded-full border-white/10 bg-white/[0.06] pl-11" />
          </div>
        </div>
        <div className="rounded-[1.5rem] border border-white/10 bg-black/15 p-5">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Current recommendation focus</div>
          <div className="mt-3 text-2xl font-extrabold capitalize">{context.moodLabel}</div>
          <div className="mt-3 space-y-2">
            {context.reasons.map((reason) => (
              <div key={reason} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-muted-foreground">
                {reason}
              </div>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <HeroStat label="Articles" value={counts.article} loading={loading} />
            <HeroStat label="Videos" value={counts.video} loading={loading} />
            <HeroStat label="Audio" value={counts.audio} loading={loading} />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroStat({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="text-2xl font-extrabold">{loading ? "-" : value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function CrisisPanel() {
  return (
    <section className="relative overflow-hidden rounded-[1.5rem] border border-amber-300/20 bg-gradient-to-br from-amber-300/12 via-white/[0.035] to-rose-400/10 p-5 md:p-6">
      <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-amber-300/15 blur-3xl" />
      <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-300/15 text-amber-100">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-amber-100/80">Safety notice</div>
            <h2 className="mt-2 text-xl font-extrabold text-amber-50">Emergency Support</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-100/75">
              MindSense resources are educational, not emergency care. If there is immediate danger in Pakistan, call Police 15,
              Rescue 1122 where available, or go to the nearest hospital emergency department.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" className="shrink-0 rounded-full border-amber-300/25 bg-amber-300/10 text-amber-50 hover:bg-amber-300/15">
          <a href="/contact">Contact MindSense</a>
        </Button>
      </div>
    </section>
  );
}

function ResourceFilters({
  category,
  moodFilter,
  tagFilter,
  tags,
  onCategory,
  onMood,
  onTag,
}: {
  category: "all" | ResourceCategory;
  moodFilter: "all" | ResourceMoodCategory;
  tagFilter: string;
  tags: string[];
  onCategory: (value: "all" | ResourceCategory) => void;
  onMood: (value: "all" | ResourceMoodCategory) => void;
  onTag: (value: string) => void;
}) {
  const activeFilters = [
    category !== "all" ? categoryLabel[category] : null,
    moodFilter !== "all" ? moodLabel(moodFilter) : null,
    tagFilter !== "all" ? `#${tagFilter}` : null,
  ].filter(Boolean);

  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-white/[0.07] via-white/[0.035] to-primary/[0.06] p-4 shadow-[var(--shadow-card)] md:p-5">
      <div className="pointer-events-none absolute -left-20 -top-24 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-primary">
            <Filter className="h-4 w-4" />
            Smart filters
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Shape the library by format, mood, and tags.</p>
        </div>
        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          {activeFilters.length ? activeFilters.join(" / ") : "All resources"}
        </div>
      </div>

      <div className="relative grid gap-3 xl:grid-cols-[1fr_1.35fr_1fr]">
        <FilterGroup label="Format">
          <ChipRow items={RESOURCE_CATEGORIES} active={category} label={categoryLabel} onSelect={onCategory} />
        </FilterGroup>
        <FilterGroup label="Mood state">
          <ChipRow items={RESOURCE_MOOD_CATEGORIES} active={moodFilter} label={moodLabel} onSelect={onMood} />
        </FilterGroup>
        <FilterGroup label="Tags">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {["all", ...tags].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTag(tag)}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  tagFilter === tag ? "border-primary/35 bg-primary/15 text-primary shadow-[0_0_18px_rgba(34,211,238,0.12)]" : "border-white/10 bg-white/[0.04] text-muted-foreground hover:border-white/20 hover:text-foreground"
                }`}
              >
                {tag === "all" ? "All tags" : tag}
              </button>
            ))}
          </div>
        </FilterGroup>
      </div>
    </section>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function ChipRow<T extends string>({ items, active, label, onSelect }: { items: T[]; active: T; label: Record<T, string> | ((value: T) => string); onSelect: (value: T) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onSelect(item)}
          className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
            active === item ? "border-primary/35 bg-primary/15 text-primary shadow-[0_0_18px_rgba(34,211,238,0.12)]" : "border-white/10 bg-white/[0.04] text-muted-foreground hover:border-white/20 hover:text-foreground"
          }`}
        >
          {typeof label === "function" ? label(item) : label[item]}
        </button>
      ))}
    </div>
  );
}

function ResourceCollection({
  title,
  subtitle,
  resources,
  bookmarks,
  progress,
  onOpen,
  onBookmark,
  compact,
  variant = "default",
}: {
  title: string;
  subtitle: string;
  resources: Resource[];
  bookmarks: Set<string>;
  progress: Record<string, { progress: number; last: string }>;
  onOpen: (resource: Resource) => void;
  onBookmark: (id: string) => void;
  compact?: boolean;
  variant?: "default" | "recommended";
}) {
  const isRecommended = variant === "recommended";

  if (resources.length === 0) {
    return (
      <section className={`${isRecommended ? "relative overflow-hidden rounded-[1.75rem] border border-primary/20 bg-gradient-to-br from-primary/10 via-white/[0.04] to-violet-400/10" : "premium-card"} p-5`}>
        {isRecommended && <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />}
        <div className="relative">
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">Add or import published resources to populate this section.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={`${isRecommended ? "relative overflow-hidden rounded-[1.85rem] border border-primary/20 bg-gradient-to-br from-primary/12 via-white/[0.045] to-violet-400/12 shadow-[var(--shadow-card)]" : "premium-card"} p-5 md:p-6`}>
      {isRecommended && (
        <>
          <div className="premium-grid pointer-events-none absolute inset-0 opacity-20" />
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-violet-400/10 blur-3xl" />
        </>
      )}
      <div className="relative mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          {isRecommended && (
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Personalized picks
            </div>
          )}
          <h2 className={`${isRecommended ? "text-2xl" : "text-xl"} font-extrabold`}>{title}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
        </div>
        {isRecommended && (
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
            <div className="text-2xl font-extrabold text-primary">{resources.length}</div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">matched</div>
          </div>
        )}
      </div>
      <div className={`relative grid gap-4 ${compact || isRecommended ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2"}`}>
        {resources.map((resource) => (
          <ResourceCard key={resource.id} resource={resource} bookmarked={bookmarks.has(resource.id)} progress={progress[resource.id]?.progress ?? 0} onOpen={() => onOpen(resource)} onBookmark={() => onBookmark(resource.id)} />
        ))}
      </div>
    </section>
  );
}

function ResourceCard({
  resource,
  bookmarked,
  progress,
  onOpen,
  onBookmark,
  admin,
  onEdit,
  onDelete,
}: {
  resource: Resource;
  bookmarked: boolean;
  progress: number;
  onOpen: () => void;
  onBookmark: () => void;
  admin?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const Icon = categoryIcon[resource.type] || BookOpen;

  return (
    <motion.article variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }} whileHover={{ y: -4 }} className="group flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.045] shadow-[var(--shadow-card)] transition">
      <div className="relative aspect-video overflow-hidden bg-black/20 text-left">
        <button type="button" onClick={onOpen} className="absolute inset-0 z-10" aria-label={`Open ${resource.title}`} />
        {resource.thumbnail_url ? (
          <img src={resource.thumbnail_url} alt={resource.title} loading="lazy" className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-105 group-hover:opacity-100" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-violet-400/10">
            <Icon className="h-10 w-10 text-primary" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#030712]/90 via-transparent to-transparent" />
        <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-wrap gap-2">
          {resource.featured && <Badge className="bg-amber-400 text-slate-950 hover:bg-amber-400"><Star className="mr-1 h-3 w-3" />Featured</Badge>}
          {!resource.is_published && <Badge variant="outline" className="border-amber-300/40 bg-amber-300/10 text-amber-100">Draft</Badge>}
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onBookmark();
          }}
          className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#07111f]/80 backdrop-blur transition hover:bg-[#07111f]"
          aria-label="Bookmark resource"
        >
          {bookmarked ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
        </button>
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between gap-2 text-xs">
          <span className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1 capitalize text-white">{resource.type}</span>
          {resource.estimated_duration && <span className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-white">{resource.estimated_duration}</span>}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap gap-2">
          {resource.mood_category && <Badge variant="secondary" className="capitalize">{moodLabel(resource.mood_category)}</Badge>}
          {resource.source_platform && <Badge variant="outline" className="border-white/10 capitalize text-muted-foreground">{resource.source_platform}</Badge>}
        </div>
        <h3 className="mt-3 line-clamp-2 text-lg font-extrabold leading-snug">{resource.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{resource.description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {formatTags(resource.tags).map((tag) => (
            <span key={tag} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
        {progress > 0 && (
          <div className="mt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-sky-400" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">{progress}% viewed</div>
          </div>
        )}
        <div className="mt-auto flex items-center gap-2 pt-4">
          <Button size="sm" onClick={onOpen} className="premium-button flex-1">
            <Play className="h-3.5 w-3.5" />
            Open
          </Button>
          {admin && (
            <>
              <Button size="icon" variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={onEdit} aria-label="Edit resource"><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={onDelete} aria-label="Delete resource"><Trash2 className="h-4 w-4" /></Button>
            </>
          )}
        </div>
      </div>
    </motion.article>
  );
}

function ContinueLearning({ entries, onOpen }: { entries: { resource: Resource; item: { progress: number; last: string } }[]; onOpen: (resource: Resource) => void }) {
  return (
    <section className="premium-card p-5 md:p-6">
      <h2 className="text-xl font-bold">Continue Learning</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {entries.map(({ resource, item }) => (
          <button key={resource.id} type="button" onClick={() => onOpen(resource)} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:bg-white/[0.07]">
            <div className="h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-black/20">
              {resource.thumbnail_url ? <img src={resource.thumbnail_url} alt={resource.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Play className="h-5 w-5 text-primary" /></div>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{resource.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{item.progress}% viewed - {resource.estimated_duration || "Flexible"}</div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-sky-400" style={{ width: `${item.progress}%` }} />
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function ResourceModal({ resource, onClose }: { resource: Resource; onClose: () => void }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const embedUrl = getEmbedUrl(resource);
  const externalUrl = resource.external_url || resource.content_url || "";
  const hasYoutubeEmbed = Boolean(embedUrl && (resource.type === "video" || (resource.type === "audio" && resource.source_platform === "youtube")));
  const hasAudioEmbed = Boolean(
    embedUrl &&
      resource.type === "audio" &&
      (resource.source_platform === "spotify" || resource.source_platform === "soundcloud"),
  );
  const showExternalFallback = resource.type !== "article" && isExternalUrl(externalUrl) && !hasYoutubeEmbed && !hasAudioEmbed;

  return (
    <ModalShell onClose={onClose} wide>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge variant="secondary" className="capitalize">{resource.type}</Badge>
          <h2 className="mt-3 text-2xl font-extrabold">{resource.title}</h2>
          {resource.description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{resource.description}</p>}
        </div>
        <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"><X className="h-5 w-5" /></button>
      </div>

      <div className="mt-5">
        {hasYoutubeEmbed && (
          <div className="aspect-video overflow-hidden rounded-2xl bg-black">
            <iframe title={resource.title} src={embedUrl} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          </div>
        )}
        {hasAudioEmbed && (
          <iframe title={resource.title} src={embedUrl} className="h-36 w-full rounded-2xl border border-white/10 bg-black/20" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" />
        )}
        {resource.type === "article" && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm leading-6 text-muted-foreground">{resource.description || "Open the full article from the original source."}</p>
            {isExternalUrl(externalUrl) && (
              <Button asChild className="premium-button mt-5">
                <a href={externalUrl} target="_blank" rel="noreferrer">
                  Read Full Article
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        )}
        {showExternalFallback && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm leading-6 text-muted-foreground">
              This resource opens on the original platform because it does not provide a safe inline embed.
            </p>
            <Button asChild className="premium-button mt-5">
              <a href={externalUrl} target="_blank" rel="noreferrer">
                Open Resource
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

function AdminDiscoveryPanel({ onImport }: { onImport: (candidate: CuratedResourceCandidate) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CURATED_RESOURCE_CANDIDATES;
    return CURATED_RESOURCE_CANDIDATES.filter((candidate) =>
      `${candidate.title} ${candidate.description} ${candidate.category} ${candidate.mood_category} ${candidate.tags.join(" ")}`
        .toLowerCase()
        .includes(q),
    );
  }, [query]);

  return (
    <section className="premium-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Admin Discovery</h2>
          <p className="mt-1 text-sm text-muted-foreground">Search curated external content, import as draft, then review and publish.</p>
        </div>
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try anxiety, sleep, focus..." className="rounded-full border-white/10 bg-white/[0.06] pl-9" />
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {results.map((candidate) => (
          <div key={candidate.external_url} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="aspect-video overflow-hidden rounded-xl bg-black/20">
              <img src={candidate.thumbnail_url} alt={candidate.title} className="h-full w-full object-cover" />
            </div>
            <div className="mt-3 font-bold leading-snug">{candidate.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">{candidate.estimated_duration} - {moodLabel(candidate.mood_category)}</div>
            <Button size="sm" className="premium-button mt-3 w-full" onClick={() => void onImport(candidate)}>
              Import Draft
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function AdminModal({ editing, userId, onClose, onSaved }: { editing: Resource | null; userId?: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<ResourceFormState>({
    title: editing?.title || "",
    description: editing?.description || "",
    type: editing?.type || "article",
    mood_category: editing?.mood_category || "mindfulness",
    external_url: editing?.external_url || editing?.content_url || "",
    thumbnail_url: editing?.thumbnail_url || "",
    tags: (editing?.tags || []).join(", "),
    estimated_duration: editing?.estimated_duration || editing?.duration || "",
    source_platform: editing?.source_platform || "",
    featured: editing?.featured || false,
    is_published: editing?.is_published ?? false,
  });
  const [extracting, setExtracting] = useState(false);

  const extractMetadata = async () => {
    if (!form.external_url.trim()) {
      toast({ title: "URL required", description: "Paste a resource URL first.", variant: "destructive" });
      return;
    }
    setExtracting(true);
    const meta = await fetchResourceMetadata(form.external_url.trim());
    setForm((current) => ({
      ...current,
      title: current.title || meta.title || "",
      description: current.description || meta.description || "",
      thumbnail_url: current.thumbnail_url || meta.thumbnail_url || "",
      source_platform: meta.source_platform,
    }));
    setExtracting(false);
  };

  const submit = async () => {
    if (!userId) return;
    if (!form.title.trim() || !form.external_url.trim()) {
      toast({ title: "Resource needs title and URL", variant: "destructive" });
      return;
    }

    const source = form.source_platform || detectSourcePlatform(form.external_url);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      type: form.type,
      category: form.type,
      mood_category: form.mood_category,
      topic: form.mood_category,
      external_url: form.external_url.trim(),
      content_url: form.external_url.trim(),
      thumbnail_url: form.thumbnail_url.trim() || null,
      tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      estimated_duration: form.estimated_duration.trim() || null,
      duration: form.estimated_duration.trim() || null,
      source_platform: source,
      featured: form.featured,
      is_published: form.is_published,
      created_by: userId,
    };

    const { error } = await saveResource(payload, editing?.id);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: editing ? "Resource updated" : "Resource created" });
      onSaved();
    }
  };

  return (
    <ModalShell onClose={onClose} wide>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold">{editing ? "Edit Resource" : "New Resource"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Store external metadata only. Do not upload large media files.</p>
        </div>
        <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]"><X className="h-5 w-5" /></button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="space-y-2 md:col-span-2">
          <Label>External URL</Label>
          <div className="flex gap-2">
            <Input value={form.external_url} onChange={(event) => setForm({ ...form, external_url: event.target.value })} placeholder="YouTube, Spotify, SoundCloud, article URL..." className="border-white/10 bg-background" />
            <Button variant="outline" className="shrink-0 rounded-full border-white/10 bg-white/[0.04]" onClick={extractMetadata} disabled={extracting}>
              {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Extract
            </Button>
          </div>
        </label>
        <label className="space-y-2 md:col-span-2">
          <Label>Title</Label>
          <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="border-white/10 bg-background" />
        </label>
        <label className="space-y-2 md:col-span-2">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} className="border-white/10 bg-background" />
        </label>
        <label className="space-y-2">
          <Label>Category</Label>
          <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as ResourceCategory })} className="h-10 w-full rounded-md border border-white/10 bg-background px-3 text-sm">
            <option value="article">Article</option>
            <option value="video">Video</option>
            <option value="audio">Audio</option>
          </select>
        </label>
        <label className="space-y-2">
          <Label>Mood category</Label>
          <select value={form.mood_category} onChange={(event) => setForm({ ...form, mood_category: event.target.value as ResourceMoodCategory })} className="h-10 w-full rounded-md border border-white/10 bg-background px-3 text-sm">
            {RESOURCE_MOOD_CATEGORIES.filter((item) => item !== "all").map((item) => (
              <option key={item} value={item}>{moodLabel(item)}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <Label>Duration</Label>
          <Input value={form.estimated_duration} onChange={(event) => setForm({ ...form, estimated_duration: event.target.value })} placeholder="5 min, 8 min read, Live" className="border-white/10 bg-background" />
        </label>
        <label className="space-y-2">
          <Label>Source platform</Label>
          <Input value={form.source_platform} onChange={(event) => setForm({ ...form, source_platform: event.target.value })} placeholder="youtube, spotify, article..." className="border-white/10 bg-background" />
        </label>
        <label className="space-y-2 md:col-span-2">
          <Label>Thumbnail URL</Label>
          <Input value={form.thumbnail_url} onChange={(event) => setForm({ ...form, thumbnail_url: event.target.value })} className="border-white/10 bg-background" />
        </label>
        <label className="space-y-2 md:col-span-2">
          <Label>Tags</Label>
          <Input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="stress, sleep, productivity" className="border-white/10 bg-background" />
        </label>
        <div className="flex items-center gap-6 md:col-span-2">
          <label className="flex items-center gap-3">
            <Switch checked={form.featured} onCheckedChange={(value) => setForm({ ...form, featured: value })} />
            <span className="text-sm font-semibold">Featured</span>
          </label>
          <label className="flex items-center gap-3">
            <Switch checked={form.is_published} onCheckedChange={(value) => setForm({ ...form, is_published: value })} />
            <span className="text-sm font-semibold">Published</span>
          </label>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={onClose}>Cancel</Button>
        <Button className="premium-button" onClick={submit}>{editing ? "Save changes" : "Create resource"}</Button>
      </div>
    </ModalShell>
  );
}

function ResourceSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="premium-card h-80 animate-pulse bg-white/[0.035]" />
      ))}
    </div>
  );
}

function EmptyResources({ isAdmin, onAdd }: { isAdmin: boolean; onAdd: () => void }) {
  return (
    <div className="premium-card p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
        <BookOpen className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-xl font-bold">No matching resources</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Try a different filter or search term.</p>
      {isAdmin && <Button className="premium-button mt-5" onClick={onAdd}>Add Resource</Button>}
    </div>
  );
}

function ModalShell({ children, onClose, wide }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#030712]/72 p-4 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 18 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 18 }}
        transition={{ type: "spring", damping: 22, stiffness: 220 }}
        onClick={(event) => event.stopPropagation()}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-[2rem] border border-white/10 bg-[#0b111d]/96 p-6 shadow-2xl ${wide ? "max-w-4xl" : "max-w-2xl"}`}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export default Resources;
