import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  BookOpen,
  ExternalLink,
  Filter,
  Headphones,
  MessageCircle,
  Play,
  RefreshCw,
  Sparkles,
  Star,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import WellnessAssistant, { type WellnessAssistantResource } from "@/components/WellnessAssistant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  RESOURCE_CATEGORIES,
  RESOURCE_MOOD_CATEGORIES,
  getEmbedUrl,
  listProgress,
  listResources,
  upsertProgress,
  type Resource,
  type ResourceCategory,
  type ResourceMoodCategory,
} from "@/lib/resourceService";
import { buildResourceContext, recommendResources } from "@/lib/resourceRecommendations";

type ProgressRow = Tables<"resource_progress">;
type MoodEntry = Tables<"mood_entries">;
type DepressionTest = Tables<"depression_tests">;

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

const Resources = () => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [resources, setResources] = useState<Resource[]>([]);
  const [progress, setProgress] = useState<Record<string, { progress: number; last: string }>>({});
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [latestTest, setLatestTest] = useState<DepressionTest | null>(null);
  const [category, setCategory] = useState<"all" | ResourceCategory>("all");
  const [moodFilter, setMoodFilter] = useState<"all" | ResourceMoodCategory>("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [openResource, setOpenResource] = useState<Resource | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError("");

    const [{ data: profile }, moodResult, testResult] = await Promise.all([
      supabase.from("profiles").select("name").eq("id", user.id).maybeSingle(),
      supabase.from("mood_entries").select("*").eq("user_id", user.id).order("entry_date", { ascending: false }).limit(14),
      supabase.from("depression_tests").select("*").eq("user_id", user.id).eq("status", "completed").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const [resourceResult, progressResult] = await Promise.all([
      listResources(false),
      listProgress(user.id),
    ]);

    if (resourceResult.error) {
      setLoadError(resourceResult.error.message);
      setResources([]);
    } else {
      setResources(resourceResult.data);
    }

    if (progressResult.error) toast({ title: "Could not load reading progress", description: progressResult.error.message, variant: "destructive" });
    if (moodResult.error) toast({ title: "Could not load mood signal", description: moodResult.error.message, variant: "destructive" });
    if (testResult.error) toast({ title: "Could not load assessment signal", description: testResult.error.message, variant: "destructive" });

    setName(profile?.name || user.email?.split("@")[0] || "Friend");

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
  const recommended = useMemo(() => recommendResources(resources, recommendationContext), [recommendationContext, resources]);
  const featured = useMemo(() => resources.filter((resource) => resource.is_published && resource.featured).slice(0, 6), [resources]);
  const allTags = useMemo(() => Array.from(new Set(resources.flatMap((resource) => resource.tags || []))).sort(), [resources]);

  const filtered = useMemo(() => {
    return resources.filter((resource) => {
      if (!resource.is_published) return false;
      if (category !== "all" && resource.type !== category) return false;
      if (moodFilter !== "all" && resource.mood_category !== moodFilter) return false;
      if (tagFilter !== "all" && !resource.tags?.some((tag) => tag.toLowerCase() === tagFilter.toLowerCase())) return false;
      return true;
    });
  }, [category, moodFilter, resources, tagFilter]);

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
    const { data, error } = await listResources(false);
    if (error) toast({ title: "Refresh failed", description: error.message, variant: "destructive" });
    else {
      setResources(data);
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
          counts={counts}
        />

        {loadError && (
          <section className="rounded-[1.5rem] border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
            Resource database could not be loaded. No preview resources are shown until the database responds. {loadError}
          </section>
        )}

        <ResourceCollection
          title="Recommended For You"
          subtitle={
            recommendationContext.hasSignals
              ? `Based on ${recommendationContext.reasons.join(", ")}.`
              : "Personalized resources will appear after your first mood entry or completed depression test."
          }
          resources={recommended}
          progress={progress}
          onOpen={openAndTrack}
          variant="recommended"
          emptyDescription={
            !recommendationContext.hasSignals
              ? "MindSense needs a real wellness signal first. Add today's mood or complete the depression test, then this section will show matched articles, videos, and audio."
              : resources.length === 0
                ? "No resources have been published yet. Once an admin publishes resources, MindSense will match them with your mood and assessment data."
                : "No published resource currently matches this wellness signal. Try the full library or check again after more resources are published."
          }
          emptyActions={
            !recommendationContext.hasSignals ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild className="premium-button">
                  <Link to="/mood">Add Mood</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full border-white/10 bg-white/[0.04]">
                  <Link to="/test">Take Depression Test</Link>
                </Button>
              </div>
            ) : undefined
          }
        />

        {featured.length > 0 && (
          <ResourceCollection title="Featured Resources" subtitle="Admin-curated content highlighted for MindSense users." resources={featured} progress={progress} onOpen={openAndTrack} compact />
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
              <p className="mt-1 text-sm text-muted-foreground">Filter and open external wellness resources.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={refreshResources}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>

          {loading ? (
            <ResourceSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyResources hasPublishedResources={resources.some((resource) => resource.is_published)} />
          ) : (
            <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  progress={progress[resource.id]?.progress ?? 0}
                  onOpen={() => openAndTrack(resource)}
                />
              ))}
            </motion.div>
          )}
        </section>

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
  counts,
}: {
  name: string;
  context: ReturnType<typeof buildResourceContext>;
  loading: boolean;
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
        </div>
        <div className="rounded-[1.5rem] border border-white/10 bg-black/15 p-5">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
            {context.hasSignals ? "Current recommendation focus" : "Personalization status"}
          </div>
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
  emptyDescription,
  emptyActions,
  resources,
  progress,
  onOpen,
  compact,
  variant = "default",
}: {
  title: string;
  subtitle: string;
  emptyDescription?: string;
  emptyActions?: ReactNode;
  resources: Resource[];
  progress: Record<string, { progress: number; last: string }>;
  onOpen: (resource: Resource) => void;
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
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {emptyDescription || "Add or import published resources to populate this section."}
          </p>
          {emptyActions}
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
          <ResourceCard key={resource.id} resource={resource} progress={progress[resource.id]?.progress ?? 0} onOpen={() => onOpen(resource)} />
        ))}
      </div>
    </section>
  );
}

function ResourceCard({
  resource,
  progress,
  onOpen,
}: {
  resource: Resource;
  progress: number;
  onOpen: () => void;
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

function ResourceSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="premium-card h-80 animate-pulse bg-white/[0.035]" />
      ))}
    </div>
  );
}

function EmptyResources({ hasPublishedResources }: { hasPublishedResources: boolean }) {
  return (
    <div className="premium-card p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
        <BookOpen className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-xl font-bold">{hasPublishedResources ? "No matching resources" : "No resources published yet"}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {hasPublishedResources
          ? "Try a different filter."
          : "The library will appear after an admin adds and publishes real resources from the Admin Dashboard."}
      </p>
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
