import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Award,
  BatteryLow,
  Brain,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Download,
  Edit3,
  FileText,
  Leaf,
  Lightbulb,
  LineChart,
  Moon,
  Plus,
  Search,
  Smile,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  TrendingUp,
  Users,
  Waves,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { updateHeaderMoodCache } from "@/lib/headerCache";
import { readMindSensePreferences } from "@/lib/preferences";

type MoodEntry = {
  id: string;
  user_id: string;
  mood: number;
  note: string | null;
  tags: string[] | null;
  energy: number | null;
  sleep_quality: number | null;
  entry_date: string;
  created_at: string;
};

type MoodChartPoint = {
  date: string;
  mood: number;
  energy: number | null;
  sleep: number | null;
};

type MoodOption = {
  value: number;
  marker: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  hex: string;
  glow: string;
};

const MOODS: MoodOption[] = [
  {
    value: 1,
    marker: "1",
    label: "Drained",
    description: "Heavy, tired, low capacity",
    icon: BatteryLow,
    color: "from-rose-400 to-red-500",
    hex: "#f43f5e",
    glow: "rgba(244,63,94,0.34)",
  },
  {
    value: 2,
    marker: "2",
    label: "Low",
    description: "Uneasy, flat, or overwhelmed",
    icon: CloudRain,
    color: "from-orange-400 to-amber-500",
    hex: "#f97316",
    glow: "rgba(249,115,22,0.32)",
  },
  {
    value: 3,
    marker: "3",
    label: "Neutral",
    description: "Steady, quiet, in-between",
    icon: Waves,
    color: "from-yellow-400 to-amber-400",
    hex: "#eab308",
    glow: "rgba(234,179,8,0.28)",
  },
  {
    value: 4,
    marker: "4",
    label: "Good",
    description: "Clear, supported, balanced",
    icon: Sun,
    color: "from-emerald-400 to-green-500",
    hex: "#10b981",
    glow: "rgba(16,185,129,0.32)",
  },
  {
    value: 5,
    marker: "5",
    label: "Amazing",
    description: "Energized, hopeful, bright",
    icon: Sparkles,
    color: "from-sky-400 to-teal-500",
    hex: "#06b6d4",
    glow: "rgba(6,182,212,0.34)",
  },
];

const ALL_TAGS = ["Stress", "Anxiety", "Motivation", "Sleep", "Productivity", "Social", "Relaxed", "Overthinking"];

const TAG_META: Record<string, { icon: LucideIcon }> = {
  Stress: { icon: CloudRain },
  Anxiety: { icon: Brain },
  Motivation: { icon: Sparkles },
  Sleep: { icon: Moon },
  Productivity: { icon: BriefcaseBusiness },
  Social: { icon: Users },
  Relaxed: { icon: Leaf },
  Overthinking: { icon: Waves },
};

const TIPS = [
  "Small progress is still progress.",
  "Take breaks and breathe deeply.",
  "Drink water and rest properly.",
  "Reach out to someone you trust today.",
  "A short walk can lift your mood.",
  "Be kind to yourself - you are doing your best.",
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DRAFT_KEY = "mood-draft";

const todayKey = () => new Date().toISOString().slice(0, 10);

const dateFromKey = (dateKey: string) => new Date(`${dateKey}T00:00:00`);

const dayDistanceFromToday = (dateKey: string) => {
  const today = dateFromKey(todayKey());
  const date = dateFromKey(dateKey);
  return Math.floor((today.getTime() - date.getTime()) / MS_PER_DAY);
};

const average = (values: number[]) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const moodMeta = (value: number) => MOODS.find((mood) => mood.value === value) || MOODS[2];

const formatDate = (value?: string | null) => {
  if (!value) return "No data";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatShortDate = (value?: string | null) => {
  if (!value) return "No data";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const formatTime = (value?: string | null) => {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const sortEntries = (entries: MoodEntry[]) =>
  [...entries].sort(
    (a, b) =>
      new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime() ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

const dedupeEntriesByDate = (entries: MoodEntry[]) => {
  const latestByDate = new Map<string, MoodEntry>();
  sortEntries(entries).forEach((entry) => {
    if (!latestByDate.has(entry.entry_date)) {
      latestByDate.set(entry.entry_date, entry);
    }
  });
  return sortEntries(Array.from(latestByDate.values()));
};

const entriesInRange = (entries: MoodEntry[], minDistance: number, maxDistance: number) =>
  entries.filter((entry) => {
    const distance = dayDistanceFromToday(entry.entry_date);
    return distance >= minDistance && distance <= maxDistance;
  });

const downloadCsv = (rows: string[][], filename: string) => {
  const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const Mood = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [open, setOpen] = useState(false);
  const [detailEntry, setDetailEntry] = useState<MoodEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<MoodEntry | null>(null);
  const [filter, setFilter] = useState<"week" | "month" | "year">("month");
  const [search, setSearch] = useState("");
  const [moodFilter, setMoodFilter] = useState<number | null>(null);
  const [calMonth, setCalMonth] = useState(new Date());
  const [tipIndex, setTipIndex] = useState(0);
  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [energy, setEnergy] = useState(5);
  const [sleep, setSleep] = useState(5);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [rememberMoodDrafts, setRememberMoodDrafts] = useState(() => readMindSensePreferences().moodDrafts);

  const today = todayKey();
  const todayEntry = useMemo(() => entries.find((entry) => entry.entry_date === today) || null, [entries, today]);

  const resetForm = () => {
    setMood(null);
    setNote("");
    setTags([]);
    setEnergy(5);
    setSleep(5);
  };

  const populateForm = (entry: MoodEntry) => {
    setMood(entry.mood);
    setNote(entry.note || "");
    setTags(entry.tags || []);
    setEnergy(entry.energy ?? 5);
    setSleep(entry.sleep_quality ?? 5);
  };

  const loadDraftIntoForm = () => {
    if (!rememberMoodDrafts) {
      resetForm();
      return;
    }

    const draft = localStorage.getItem(DRAFT_KEY);
    if (!draft) {
      resetForm();
      return;
    }

    try {
      const data = JSON.parse(draft) as {
        mood?: number | null;
        note?: string;
        tags?: string[];
        energy?: number;
        sleep?: number;
      };
      setMood(data.mood ?? null);
      setNote(data.note || "");
      setTags(data.tags || []);
      setEnergy(data.energy ?? 5);
      setSleep(data.sleep ?? 5);
    } catch {
      localStorage.removeItem(DRAFT_KEY);
      resetForm();
    }
  };

  const openMoodForm = (entry?: MoodEntry | null) => {
    const targetEntry = entry || todayEntry;
    setDetailEntry(null);
    setEditingEntry(targetEntry || null);
    setSaveSuccess(false);

    if (targetEntry) {
      populateForm(targetEntry);
    } else {
      loadDraftIntoForm();
    }

    setOpen(true);
  };

  const loadEntries = useCallback(
    async (uid: string) => {
      setLoading(true);
      setLoadError("");

      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        const expMs = (sessionData.session.expires_at ?? 0) * 1000;
        if (expMs && expMs < Date.now() + 30_000) {
          await supabase.auth.refreshSession();
        }
      }

      const { data, error } = await supabase
        .from("mood_entries")
        .select("*")
        .eq("user_id", uid)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        setLoadError(error.message);
        toast({ title: "Could not load moods", description: error.message, variant: "destructive" });
      } else {
        setEntries(dedupeEntriesByDate((data as MoodEntry[] | null) || []));
      }

      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    if (!user) return;
    loadEntries(user.id);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" && user) loadEntries(user.id);
    });
    return () => subscription.unsubscribe();
  }, [loadEntries, user]);

  useEffect(() => {
    const syncPreferences = () => setRememberMoodDrafts(readMindSensePreferences().moodDrafts);
    window.addEventListener("storage", syncPreferences);
    return () => window.removeEventListener("storage", syncPreferences);
  }, []);

  useEffect(() => {
    if (!open || editingEntry || todayEntry) return;
    if (!rememberMoodDrafts) {
      localStorage.removeItem(DRAFT_KEY);
      return;
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ mood, note, tags, energy, sleep }));
  }, [editingEntry, energy, mood, note, open, rememberMoodDrafts, sleep, tags, todayEntry]);

  useEffect(() => {
    if (!user || loading) return;
    updateHeaderMoodCache(user.id, todayEntry);
  }, [loading, todayEntry, user]);

  const toggleTag = (tag: string) => setTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));

  const saveMood = async () => {
    if (!user) return;
    if (!mood) {
      toast({ title: "Choose a mood", description: "Select one mood level before saving.", variant: "destructive" });
      return;
    }

    setSaving(true);

    let targetEntry = editingEntry;
    if (!targetEntry && todayEntry) targetEntry = todayEntry;

    if (!targetEntry) {
      const { data: existing, error: lookupError } = await supabase
        .from("mood_entries")
        .select("*")
        .eq("user_id", user.id)
        .eq("entry_date", today)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lookupError) {
        setSaving(false);
        toast({ title: "Save failed", description: lookupError.message, variant: "destructive" });
        return;
      }

      targetEntry = (existing as MoodEntry | null) || null;
    }

    const entryDate = targetEntry?.entry_date || today;
    const payload = {
      mood,
      note: note.trim() || null,
      tags,
      energy,
      sleep_quality: sleep,
      entry_date: entryDate,
    };

    const { data, error } = targetEntry
      ? await supabase
          .from("mood_entries")
          .update(payload)
          .eq("id", targetEntry.id)
          .eq("user_id", user.id)
          .select()
          .single()
      : await supabase
          .from("mood_entries")
          .insert({ ...payload, user_id: user.id })
          .select()
          .single();

    setSaving(false);

    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }

    const savedEntry = data as MoodEntry;
    setEntries((current) => dedupeEntriesByDate([savedEntry, ...current.filter((entry) => entry.id !== savedEntry.id)]));
    if (savedEntry.entry_date === today) updateHeaderMoodCache(user.id, savedEntry);

    toast({
      title: targetEntry ? "Mood updated" : "Mood recorded",
      description: targetEntry ? "Your mood entry was updated." : "Your mood has been saved successfully.",
    });

    setSaveSuccess(true);
    localStorage.removeItem(DRAFT_KEY);
    window.setTimeout(() => {
      setOpen(false);
      setSaveSuccess(false);
      setEditingEntry(null);
      resetForm();
    }, 420);
  };

  const deleteEntry = async (entry: MoodEntry) => {
    const { error } = await supabase.from("mood_entries").delete().eq("id", entry.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }

    setEntries((current) => current.filter((item) => item.id !== entry.id));
    if (user && entry.entry_date === today) updateHeaderMoodCache(user.id, null);
    if (detailEntry?.id === entry.id) setDetailEntry(null);
    toast({ title: "Entry removed" });
  };

  const currentWeekEntries = useMemo(() => entriesInRange(entries, 0, 6), [entries]);
  const previousWeekEntries = useMemo(() => entriesInRange(entries, 7, 13), [entries]);

  const stats = useMemo(() => {
    const avg = average(entries.map((entry) => entry.mood));
    const dates = new Set(entries.map((entry) => entry.entry_date));
    let streak = 0;
    const current = dateFromKey(today);
    while (dates.has(current.toISOString().slice(0, 10))) {
      streak += 1;
      current.setDate(current.getDate() - 1);
    }

    const currentAvg = average(currentWeekEntries.map((entry) => entry.mood));
    const previousAvg = average(previousWeekEntries.map((entry) => entry.mood));
    const improvement = previousAvg ? ((currentAvg - previousAvg) / previousAvg) * 100 : 0;
    const best = [...currentWeekEntries].sort((a, b) => b.mood - a.mood || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null;
    const lowest = [...currentWeekEntries].sort((a, b) => a.mood - b.mood || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null;

    return {
      avg,
      total: entries.length,
      streak,
      improvement,
      weeklyAverage: currentAvg,
      previousWeeklyAverage: previousAvg,
      best,
      lowest,
    };
  }, [currentWeekEntries, entries, previousWeekEntries, today]);

  const commonTags = useMemo(() => {
    const counts = new Map<string, number>();
    currentWeekEntries.forEach((entry) => {
      (entry.tags || []).forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [currentWeekEntries]);

  const chartData = useMemo<MoodChartPoint[]>(() => {
    const days = filter === "week" ? 7 : filter === "month" ? 30 : 365;
    return entries
      .filter((entry) => {
        const distance = dayDistanceFromToday(entry.entry_date);
        return distance >= 0 && distance < days;
      })
      .sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime())
      .map((entry) => ({
        date: formatShortDate(entry.entry_date),
        mood: entry.mood,
        energy: entry.energy ?? null,
        sleep: entry.sleep_quality ?? null,
      }));
  }, [entries, filter]);

  const filteredHistory = useMemo(
    () =>
      entries.filter((entry) => {
        const query = search.trim().toLowerCase();
        if (moodFilter && entry.mood !== moodFilter) return false;
        if (!query) return true;

        const haystack = [
          entry.note || "",
          moodMeta(entry.mood).label,
          entry.entry_date,
          ...(entry.tags || []),
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      }),
    [entries, moodFilter, search],
  );

  const insights = useMemo(() => {
    if (!entries.length) {
      return ["Add your first mood check-in to start building useful patterns."];
    }

    const output: string[] = [];
    if (!todayEntry) output.push("Today's check-in is not logged yet.");
    if (stats.previousWeeklyAverage) {
      if (stats.improvement > 5) output.push("Your latest 7-day average is improving compared with the previous week.");
      if (stats.improvement < -5) output.push("Your latest 7-day average is lower than the previous week. Consider opening support tools.");
    }
    if (stats.streak >= 3) output.push(`You have a ${stats.streak}-day tracking streak.`);

    const sleepMoodPairs = entries.filter((entry) => entry.sleep_quality !== null);
    const highSleepGoodMood = sleepMoodPairs.filter((entry) => (entry.sleep_quality || 0) >= 7 && entry.mood >= 4).length;
    if (highSleepGoodMood >= 2) output.push("Higher sleep quality appears connected with better mood in your logs.");

    if (!output.length) output.push("Keep tracking daily so stronger patterns can appear.");
    return output.slice(0, 3);
  }, [entries, stats.improvement, stats.previousWeeklyAverage, stats.streak, todayEntry]);

  const tagInsights = useMemo(() => {
    const map = new Map<string, { tag: string; moods: number[]; high: number; low: number }>();
    entries.forEach((entry) => {
      (entry.tags || []).forEach((tag) => {
        const current = map.get(tag) || { tag, moods: [], high: 0, low: 0 };
        current.moods.push(entry.mood);
        if (entry.mood >= 4) current.high += 1;
        if (entry.mood <= 2) current.low += 1;
        map.set(tag, current);
      });
    });

    return Array.from(map.values())
      .map((item) => ({ ...item, average: average(item.moods), count: item.moods.length }))
      .sort((a, b) => b.count - a.count || b.average - a.average)
      .slice(0, 5);
  }, [entries]);

  const calDays = useMemo(() => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const first = new Date(year, month, 1).getDay();
    const total = new Date(year, month + 1, 0).getDate();
    const map = new Map<string, MoodEntry>();
    entries.forEach((entry) => {
      const date = dateFromKey(entry.entry_date);
      if (date.getFullYear() === year && date.getMonth() === month) map.set(entry.entry_date, entry);
    });

    const cells: ({ date: string; entry?: MoodEntry; day: number } | null)[] = [];
    for (let index = 0; index < first; index += 1) cells.push(null);
    for (let day = 1; day <= total; day += 1) {
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({ date, day, entry: map.get(date) });
    }
    return cells;
  }, [calMonth, entries]);

  const exportCSV = () => {
    if (!entries.length) {
      toast({ title: "No mood data yet", description: "Add at least one mood entry before exporting." });
      return;
    }

    const rows = [
      ["date", "mood", "label", "note", "tags", "energy", "sleep"],
      ...entries.map((entry) => [
        entry.entry_date,
        String(entry.mood),
        moodMeta(entry.mood).label,
        entry.note || "",
        (entry.tags || []).join("|"),
        String(entry.energy ?? ""),
        String(entry.sleep_quality ?? ""),
      ]),
    ];

    downloadCsv(rows, `mindsense-mood-${today}.csv`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_20%_20%,hsl(var(--primary)/0.16),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(167,139,250,0.16),transparent_28%),rgba(255,255,255,0.055)] p-5 shadow-[var(--shadow-card)] md:p-7">
          <div className="premium-grid pointer-events-none absolute inset-0 opacity-25" />
          <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="rounded-[1.5rem] border border-white/10 bg-black/10 p-5 md:p-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
                <CalendarDays className="h-4 w-4" />
                One mood entry per day
              </div>
              <h1 className="mt-5 text-4xl font-extrabold leading-tight md:text-5xl">Mood Tracking</h1>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                Log one daily mood check-in, update today's entry when needed, and review patterns across mood, energy, sleep, and tags.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => openMoodForm()}
                  className="premium-button inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold"
                >
                  {todayEntry ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {todayEntry ? "Edit Today's Mood" : "Add Today's Mood"}
                </button>
                <button
                  type="button"
                  onClick={exportCSV}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold transition hover:bg-white/[0.08]"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
              </div>
            </div>

            <div className="premium-card relative overflow-hidden p-5">
              <div className="absolute -right-16 -top-16 h-36 w-36 rounded-full bg-primary/15 blur-3xl" />
              <div className="relative">
                <div className="text-sm font-medium text-muted-foreground">Today's mood</div>
                <div className="mt-2 text-3xl font-extrabold">{todayEntry ? moodMeta(todayEntry.mood).label : "Not logged"}</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {todayEntry
                    ? `Saved as ${todayEntry.mood}/5 at ${formatTime(todayEntry.created_at)}. You can update it today.`
                    : "Add today's check-in to keep your dashboard and notifications current."}
                </p>
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Energy</span>
                    <span className="font-semibold">{todayEntry?.energy ?? 0}/10</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-sky-400" style={{ width: `${((todayEntry?.energy ?? 0) / 10) * 100}%` }} />
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Sleep</span>
                    <span className="font-semibold">{todayEntry?.sleep_quality ?? 0}/10</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                    <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-primary" style={{ width: `${((todayEntry?.sleep_quality ?? 0) / 10) * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {loadError && <ErrorPanel message={loadError} onRetry={() => user && loadEntries(user.id)} loading={loading} />}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, index) => <MetricSkeleton key={index} />)
            : (
              <>
                <MetricCard icon={Smile} title="Average mood" value={stats.avg ? stats.avg.toFixed(1) : "0"} detail={stats.avg ? `${moodMeta(Math.round(stats.avg)).label} overall` : "No mood data yet"} />
                <MetricCard icon={CalendarDays} title="Total entries" value={String(stats.total)} detail={`${stats.streak}-day streak`} />
                <MetricCard icon={TrendingUp} title="7-day change" value={`${stats.improvement >= 0 ? "+" : ""}${stats.improvement.toFixed(0)}%`} detail={stats.previousWeeklyAverage ? "Compared with previous 7 days" : "Needs previous week data"} />
                <MetricCard icon={Award} title="Best day" value={stats.best ? formatShortDate(stats.best.entry_date) : "--"} detail={stats.best ? `${moodMeta(stats.best.mood).label} mood` : "No weekly data"} />
              </>
            )}
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
          <section className="premium-card relative overflow-hidden p-5 md:p-6">
            <div className="premium-grid pointer-events-none absolute inset-0 opacity-20" />
            <div className="relative mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold">
                  <LineChart className="h-5 w-5 text-primary" />
                  Mood Over Time
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">Real mood entries only. No sample data is shown.</p>
              </div>
              <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1">
                {(["week", "month", "year"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setFilter(item)}
                    className={`rounded-lg px-3 py-1.5 text-sm capitalize transition ${
                      filter === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative h-72">
              {loading ? (
                <ChartSkeleton />
              ) : chartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 16, right: 12, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="moodArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} />
                    <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "16px",
                        color: "hsl(var(--foreground))",
                        boxShadow: "var(--shadow-card)",
                      }}
                    />
                    <Area type="monotone" dataKey="mood" name="Mood" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#moodArea)" dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={LineChart} title="No mood trend yet" description="Add a mood entry to start building your chart." action="Add Mood" onAction={() => openMoodForm()} />
              )}
            </div>
          </section>

          <section className="premium-card p-5 md:p-6">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Activity className="h-5 w-5 text-primary" />
              Weekly Summary
            </h2>
            <div className="mt-5 space-y-4">
              <SummaryRow label="Weekly average" value={stats.weeklyAverage ? `${stats.weeklyAverage.toFixed(1)}/5` : "0/5"} />
              <SummaryRow label="Best day" value={stats.best ? `${formatShortDate(stats.best.entry_date)} - ${moodMeta(stats.best.mood).label}` : "No data"} />
              <SummaryRow label="Lowest day" value={stats.lowest ? `${formatShortDate(stats.lowest.entry_date)} - ${moodMeta(stats.lowest.mood).label}` : "No data"} />
              <SummaryRow label="Common tags" value={commonTags.length ? commonTags.map(([tag]) => tag).join(", ") : "No tags"} />
            </div>
          </section>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="premium-card p-5 md:p-6">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Zap className="h-5 w-5 text-primary" />
              Energy and Sleep
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">These values come from the same daily mood entries.</p>
            <div className="mt-5">
              {loading ? (
                <ChartSkeleton compact />
              ) : chartData.some((entry) => entry.energy || entry.sleep) ? (
                <EnergySleepGraphic data={chartData} />
              ) : (
                <EmptyState icon={Moon} title="No energy or sleep data yet" description="Add mood entries with energy and sleep values to see this chart." />
              )}
            </div>
          </section>

          <section className="premium-card p-5 md:p-6">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Tag className="h-5 w-5 text-primary" />
              Tag Insights
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">See which tags appear around high and low moods.</p>
            <div className="mt-5 space-y-3">
              {tagInsights.length ? (
                tagInsights.map((item) => (
                  <div key={item.tag} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold">{item.tag}</div>
                      <div className="text-sm text-muted-foreground">{item.count} entries</div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                      <div className="rounded-xl bg-white/[0.04] p-2">Avg {item.average.toFixed(1)}/5</div>
                      <div className="rounded-xl bg-emerald-400/10 p-2 text-emerald-200">High {item.high}</div>
                      <div className="rounded-xl bg-rose-400/10 p-2 text-rose-200">Low {item.low}</div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState icon={Tag} title="No tag insights yet" description="Add tags to mood entries to see relationships." />
              )}
            </div>
          </section>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
          <section className="premium-card p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <CalendarDays className="h-5 w-5 text-primary" />
                Mood Calendar
              </h2>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))} className="rounded-lg p-2 hover:bg-white/[0.06]">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="w-36 text-center text-sm font-medium">{calMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                <button type="button" onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))} className="rounded-lg p-2 hover:bg-white/[0.06]">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-muted-foreground">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                <div key={`${day}-${index}`} className="py-1">{day}</div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1.5">
              {loading
                ? Array.from({ length: 35 }).map((_, index) => <div key={index} className="aspect-square animate-pulse rounded-xl bg-white/[0.04]" />)
                : calDays.map((cell, index) => {
                    const meta = cell?.entry ? moodMeta(cell.entry.mood) : null;
                    const MoodIcon = meta?.icon;
                    return (
                      <button
                        key={cell?.date || `blank-${index}`}
                        type="button"
                        disabled={!cell?.entry}
                        onClick={() => cell?.entry && setDetailEntry(cell.entry)}
                        title={cell?.entry && meta ? `${formatDate(cell.date)} - ${meta.label}` : undefined}
                        className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border text-xs transition ${
                          cell
                            ? "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]"
                            : "border-transparent"
                        } ${cell?.entry ? "cursor-pointer" : "cursor-default"}`}
                        style={meta ? { borderColor: `${meta.hex}70`, background: `linear-gradient(135deg, ${meta.hex}24, rgba(255,255,255,0.025))` } : {}}
                      >
                        {cell && (
                          <>
                            <span className="absolute left-2 top-1.5 text-[10px] font-semibold text-muted-foreground">{cell.day}</span>
                            {cell.entry && MoodIcon && meta && (
                              <>
                                <motion.span
                                  initial={{ scale: 0.88, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  className="flex h-8 w-8 items-center justify-center rounded-full border text-white shadow-lg sm:h-9 sm:w-9"
                                  style={{
                                    borderColor: `${meta.hex}70`,
                                    background: `linear-gradient(135deg, ${meta.hex}, rgba(255,255,255,0.12))`,
                                    boxShadow: `0 0 26px ${meta.glow}`,
                                  }}
                                >
                                  <MoodIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                                </motion.span>
                                <span className="mt-1 hidden max-w-full truncate px-1 text-[10px] font-bold sm:block" style={{ color: meta.hex }}>
                                  {meta.label}
                                </span>
                              </>
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}
            </div>
          </section>

          <section className="premium-card p-5 md:p-6">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Sparkles className="h-5 w-5 text-primary" />
              Mood Insights
            </h2>
            <div className="mt-5 grid gap-3">
              {insights.map((insight, index) => (
                <motion.div
                  key={insight}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-muted-foreground"
                >
                  {insight}
                </motion.div>
              ))}
              <InsightMiniCard
                icon={todayEntry ? Check : CalendarDays}
                title={todayEntry ? "Today is logged" : "Today needs a check-in"}
                value={todayEntry ? moodMeta(todayEntry.mood).label : "Not logged"}
                detail={todayEntry ? `Energy ${todayEntry.energy ?? 0}/10 - Sleep ${todayEntry.sleep_quality ?? 0}/10` : "Add one mood entry to keep this week accurate."}
              />
              <InsightMiniCard
                icon={Tag}
                title="Top weekly context"
                value={commonTags.length ? commonTags[0][0] : "No tags yet"}
                detail={commonTags.length ? `${commonTags[0][1]} entries this week` : "Select tags when saving moods to unlock patterns."}
              />
            </div>
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center gap-2 font-semibold">
                <Lightbulb className="h-4 w-4 text-primary" />
                Daily Wellness Tip
              </div>
              <AnimatePresence mode="wait">
                <motion.p key={tipIndex} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-3 text-sm text-muted-foreground">
                  {TIPS[tipIndex]}
                </motion.p>
              </AnimatePresence>
              <button type="button" onClick={() => setTipIndex((index) => (index + 1) % TIPS.length)} className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium hover:bg-white/[0.08]">
                New Tip
              </button>
            </div>
          </section>
        </div>

        <section className="premium-card p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <FileText className="h-5 w-5 text-primary" />
              Mood History
            </h2>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search notes or tags"
                  className="w-full rounded-xl border border-white/10 bg-background px-9 py-2 text-sm sm:w-56"
                />
              </div>
              <select
                value={moodFilter ?? ""}
                onChange={(event) => setMoodFilter(event.target.value ? Number(event.target.value) : null)}
                className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm"
              >
                <option value="">All moods</option>
                {MOODS.map((item) => (
                  <option key={item.value} value={item.value}>{item.value} - {item.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => <HistorySkeleton key={index} />)
            ) : filteredHistory.length ? (
              filteredHistory.slice(0, 40).map((entry) => {
                const meta = moodMeta(entry.mood);
                return (
                  <div key={entry.id} className="group rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:border-primary/25 hover:bg-white/[0.055]">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <button type="button" onClick={() => setDetailEntry(entry)} className="flex min-w-0 flex-1 items-center gap-4 text-left">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${meta.color} text-lg font-extrabold text-white`}>
                          {entry.mood}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold">{meta.label}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{formatDate(entry.entry_date)} - {formatTime(entry.created_at)}</div>
                          {entry.note && <p className="mt-1 truncate text-sm text-muted-foreground">{entry.note}</p>}
                          {entry.tags && entry.tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {entry.tags.map((tag) => (
                                <span key={tag} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-muted-foreground">{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </button>
                      <div className="flex gap-2 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                        <button type="button" onClick={() => openMoodForm(entry)} className="rounded-lg p-2 text-primary hover:bg-primary/10" aria-label="Edit mood entry">
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => deleteEntry(entry)} className="rounded-lg p-2 text-rose-300 hover:bg-rose-400/10" aria-label="Delete mood entry">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState icon={FileText} title="No mood history found" description={entries.length ? "Try changing your search or filter." : "Add your first mood entry to build history."} action={!entries.length ? "Add Mood" : undefined} onAction={!entries.length ? () => openMoodForm() : undefined} />
            )}
          </div>
        </section>
      </div>

      <AnimatePresence>
        {open && (
          <MoodFormModal
            editingEntry={editingEntry}
            mood={mood}
            note={note}
            tags={tags}
            energy={energy}
            sleep={sleep}
            saving={saving}
            saveSuccess={saveSuccess}
            onClose={() => {
              setOpen(false);
              setEditingEntry(null);
              setSaveSuccess(false);
              if (!todayEntry) resetForm();
            }}
            onSave={saveMood}
            onMoodChange={setMood}
            onNoteChange={setNote}
            onToggleTag={toggleTag}
            onEnergyChange={setEnergy}
            onSleepChange={setSleep}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detailEntry && (
          <EntryDetailModal
            entry={detailEntry}
            onClose={() => setDetailEntry(null)}
            onEdit={() => openMoodForm(detailEntry)}
            onDelete={() => deleteEntry(detailEntry)}
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

type MetricCardProps = {
  icon: LucideIcon;
  title: string;
  value: string;
  detail: string;
};

const MetricCard = ({ icon: Icon, title, value, detail }: MetricCardProps) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }} className="premium-card p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-medium text-muted-foreground">{title}</div>
        <div className="mt-2 text-3xl font-extrabold">{value}</div>
      </div>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 text-primary">
        <Icon className="h-5 w-5" />
      </div>
    </div>
    <p className="mt-4 text-xs font-medium text-muted-foreground">{detail}</p>
  </motion.div>
);

const MetricSkeleton = () => (
  <div className="premium-card p-5">
    <div className="h-3 w-28 animate-pulse rounded-full bg-white/10" />
    <div className="mt-5 h-9 w-20 animate-pulse rounded-xl bg-white/10" />
    <div className="mt-5 h-3 w-32 animate-pulse rounded-full bg-white/10" />
  </div>
);

const HistorySkeleton = () => <div className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />;

const ChartSkeleton = ({ compact = false }: { compact?: boolean }) => (
  <div className={`flex ${compact ? "h-64" : "h-72"} items-end gap-3 rounded-2xl border border-white/10 bg-black/10 p-5`}>
    {[42, 68, 52, 78, 60, 88, 70].map((height, index) => (
      <div key={index} className="flex flex-1 items-end">
        <div className="w-full animate-pulse rounded-t-xl bg-white/10" style={{ height: `${height}%` }} />
      </div>
    ))}
  </div>
);

const numericValues = (values: (number | null)[]) => values.filter((value): value is number => typeof value === "number");

const EnergySleepGraphic = ({ data }: { data: MoodChartPoint[] }) => {
  const recent = data.filter((entry) => entry.energy !== null || entry.sleep !== null).slice(-7);
  const energyValues = numericValues(data.map((entry) => entry.energy));
  const sleepValues = numericValues(data.map((entry) => entry.sleep));
  const avgEnergy = energyValues.length ? average(energyValues) : null;
  const avgSleep = sleepValues.length ? average(sleepValues) : null;
  const latestEnergy = [...data].reverse().find((entry) => entry.energy !== null)?.energy ?? null;
  const latestSleep = [...data].reverse().find((entry) => entry.sleep !== null)?.sleep ?? null;

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_15%_0%,rgba(45,212,191,0.16),transparent_34%),radial-gradient(circle_at_90%_20%,rgba(167,139,250,0.16),transparent_32%),rgba(255,255,255,0.04)] p-4">
      <div className="premium-grid pointer-events-none absolute inset-0 opacity-20" />
      <div className="relative grid gap-3 sm:grid-cols-2">
        <EnergySleepGauge icon={Zap} label="Energy rhythm" value={avgEnergy} latest={latestEnergy} color="#2dd4bf" />
        <EnergySleepGauge icon={Moon} label="Sleep rhythm" value={avgSleep} latest={latestSleep} color="#a78bfa" />
      </div>

      <div className="relative mt-4 rounded-2xl border border-white/10 bg-black/15 p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold">Recent rhythm</div>
            <div className="text-xs text-muted-foreground">Energy and sleep from tracked days</div>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-muted-foreground">
            Last {recent.length} days
          </span>
        </div>
        <div className="space-y-3">
          {recent.map((entry, index) => (
            <motion.div
              key={`${entry.date}-${index}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.035] p-3 md:grid-cols-[4.5rem_minmax(0,1fr)] md:items-center"
            >
              <div className="text-xs font-semibold text-muted-foreground">{entry.date}</div>
              <div className="grid gap-2">
                <MiniSignalRow label="Energy" value={entry.energy} color="#2dd4bf" />
                <MiniSignalRow label="Sleep" value={entry.sleep} color="#a78bfa" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

const EnergySleepGauge = ({
  icon: Icon,
  label,
  value,
  latest,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: number | null;
  latest: number | null;
  color: string;
}) => {
  const percent = value === null ? 0 : Math.max(0, Math.min(100, value * 10));

  return (
    <motion.div whileHover={{ y: -2 }} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/20" style={{ color }}>
            <Icon className="h-4 w-4" />
          </span>
          {label}
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-muted-foreground">
          Latest {latest === null ? "--" : `${latest}/10`}
        </span>
      </div>
      <div className="mt-5 flex items-center gap-4">
        <div
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full p-2"
          style={{ background: `conic-gradient(${color} ${percent * 3.6}deg, rgba(255,255,255,0.1) 0deg)` }}
        >
          <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-white/10 bg-[#0b111d]">
            <div className="text-2xl font-extrabold">{value === null ? "--" : value.toFixed(1)}</div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Avg</div>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{value === null ? "Waiting for data" : value >= 7 ? "Strong signal" : value >= 4 ? "Moderate signal" : "Needs care"}</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {value === null ? "Log a mood with this value to see rhythm." : "A smoother pattern appears as daily entries build."}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

const MiniSignalRow = ({ label, value, color }: { label: string; value: number | null; color: string }) => {
  const percent = value === null ? 0 : Math.max(0, Math.min(100, value * 10));

  return (
    <div className="grid grid-cols-[4.25rem_minmax(0,1fr)_2.5rem] items-center gap-2 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, rgba(255,255,255,0.8))`, boxShadow: `0 0 18px ${color}55` }}
        />
      </div>
      <span className="text-right font-bold" style={{ color }}>
        {value === null ? "--" : value}
      </span>
    </div>
  );
};

const SummaryRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4 last:border-b-0 last:pb-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-right text-sm font-semibold">{value}</span>
  </div>
);

const InsightMiniCard = ({
  icon: Icon,
  title,
  value,
  detail,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  detail: string;
}) => (
  <motion.div whileHover={{ y: -2 }} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</div>
        <div className="mt-1 truncate text-base font-extrabold">{value}</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
      </div>
    </div>
  </motion.div>
);

const ErrorPanel = ({ message, onRetry, loading }: { message: string; onRetry: () => void; loading: boolean }) => (
  <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="font-semibold text-amber-100">Mood data could not be loaded</div>
        <p className="mt-1 text-sm text-amber-100/75">{message}</p>
      </div>
      <button type="button" onClick={onRetry} disabled={loading} className="rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-sm font-semibold">
        Retry
      </button>
    </div>
  </div>
);

const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) => (
  <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.035] p-6 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/12 text-primary">
      <Icon className="h-6 w-6" />
    </div>
    <h3 className="mt-4 text-lg font-semibold">{title}</h3>
    <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
    {action && onAction && (
      <button type="button" onClick={onAction} className="premium-button mt-5 px-5 py-2 text-sm font-semibold">
        {action}
      </button>
    )}
  </div>
);

type MoodFormModalProps = {
  editingEntry: MoodEntry | null;
  mood: number | null;
  note: string;
  tags: string[];
  energy: number;
  sleep: number;
  saving: boolean;
  saveSuccess: boolean;
  onClose: () => void;
  onSave: () => void;
  onMoodChange: (value: number) => void;
  onNoteChange: (value: string) => void;
  onToggleTag: (tag: string) => void;
  onEnergyChange: (value: number) => void;
  onSleepChange: (value: number) => void;
};

const MoodFormModal = ({
  editingEntry,
  mood,
  note,
  tags,
  energy,
  sleep,
  saving,
  saveSuccess,
  onClose,
  onSave,
  onMoodChange,
  onNoteChange,
  onToggleTag,
  onEnergyChange,
  onSleepChange,
}: MoodFormModalProps) => {
  const [showMoodError, setShowMoodError] = useState(false);
  const selectedMood = mood ? moodMeta(mood) : null;
  const selectedIcon = selectedMood?.icon || Smile;
  const SelectedIcon = selectedIcon;
  const ambientHex = selectedMood?.hex || "#2dd4bf";
  const ambientGlow = selectedMood?.glow || "rgba(45,212,191,0.28)";
  const successReflection = selectedMood
    ? `${selectedMood.label} has been saved for today. Your signal is now part of your weekly mood pattern.`
    : "Your daily check-in is recorded. Keep returning once per day and the patterns will become clearer.";

  const handleSave = () => {
    if (!mood) {
      setShowMoodError(true);
      return;
    }
    onSave();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#030712]/72 p-3 backdrop-blur-md sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 18 }}
        animate={{
          scale: 1,
          opacity: 1,
          y: 0,
          boxShadow: `0 0 0 1px ${ambientHex}30, 0 34px 120px -42px ${ambientGlow}`,
        }}
        exit={{ scale: 0.94, opacity: 0, y: 18 }}
        transition={{ type: "spring", stiffness: 180, damping: 22 }}
        onClick={(event) => event.stopPropagation()}
        className="relative max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0b111d]/95 shadow-2xl"
      >
        <motion.div
          className="pointer-events-none absolute inset-0"
          animate={{
            background: selectedMood
              ? `radial-gradient(circle at 18% 0%, ${selectedMood.glow}, transparent 34%), radial-gradient(circle at 86% 18%, ${selectedMood.hex}24, transparent 34%), rgba(255,255,255,0.035)`
              : "radial-gradient(circle at 18% 0%, rgba(45,212,191,0.16), transparent 34%), radial-gradient(circle at 86% 18%, rgba(167,139,250,0.16), transparent 34%), rgba(255,255,255,0.035)",
          }}
          transition={{ duration: 0.45 }}
        />
        <motion.div
          className="pointer-events-none absolute -left-20 top-16 h-52 w-52 rounded-full blur-3xl"
          animate={{ backgroundColor: ambientHex, opacity: selectedMood ? 0.18 : 0.1, scale: selectedMood ? [1, 1.08, 1] : 1 }}
          transition={{ duration: 4, repeat: selectedMood ? Infinity : 0, ease: "easeInOut" }}
        />
        <motion.div
          className="pointer-events-none absolute -right-16 bottom-8 h-60 w-60 rounded-full blur-3xl"
          animate={{ backgroundColor: ambientHex, opacity: selectedMood ? 0.12 : 0.08, scale: selectedMood ? [1.06, 1, 1.06] : 1 }}
          transition={{ duration: 4.5, repeat: selectedMood ? Infinity : 0, ease: "easeInOut" }}
        />
        <div className="premium-grid pointer-events-none absolute inset-0 opacity-20" />

        <div className="relative max-h-[92vh] overflow-y-auto p-4 sm:p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Daily Check-In
              </div>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight md:text-4xl">
                {editingEntry ? "Tune today's signal" : "How does today feel?"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {editingEntry
                  ? "Update the mood, context, energy, and sleep attached to this daily check-in."
                  : "Choose one emotional signal for today. You can edit this entry later if your day changes."}
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded-full border border-white/10 bg-white/[0.04] p-2 transition hover:bg-white/[0.08]" aria-label="Close mood form">
              <X className="h-4 w-4" />
            </button>
          </div>

          <AnimatePresence mode="wait">
            {saveSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -12 }}
                className="relative mt-8 flex min-h-[28rem] flex-col items-center justify-center overflow-hidden rounded-[1.5rem] border p-8 text-center"
                style={{
                  borderColor: `${ambientHex}55`,
                  background: `radial-gradient(circle at 50% 0%, ${ambientGlow}, transparent 52%), rgba(255,255,255,0.05)`,
                }}
              >
                <motion.div
                  className="absolute inset-x-10 top-10 h-28 rounded-full blur-3xl"
                  animate={{ backgroundColor: ambientHex, opacity: [0.12, 0.24, 0.12], scale: [0.9, 1.08, 0.9] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div
                  initial={{ scale: 0.6, rotate: -12 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 220, damping: 14 }}
                  className="relative flex h-20 w-20 items-center justify-center rounded-full text-white"
                  style={{ background: `linear-gradient(135deg, ${ambientHex}, rgba(255,255,255,0.18))`, boxShadow: `0 0 48px ${ambientGlow}` }}
                >
                  <Check className="h-9 w-9" />
                </motion.div>
                <h3 className="relative mt-6 text-3xl font-extrabold">Mood saved</h3>
                <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                  {successReflection}
                </p>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <section className="mt-6">
                  <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold">Choose your emotional state</h3>
                      <p className="mt-1 text-sm text-muted-foreground">1 is drained. 5 is amazing.</p>
                    </div>
                    {selectedMood && (
                      <motion.div
                        key={selectedMood.value}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm font-semibold"
                        style={{ color: selectedMood.hex }}
                      >
                        <SelectedIcon className="h-4 w-4" />
                        {selectedMood.label} selected
                      </motion.div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    {MOODS.map((item, index) => {
                      const selected = mood === item.value;
                      const Icon = item.icon;
                      return (
                        <motion.button
                          key={item.value}
                          type="button"
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.04, type: "spring", stiffness: 160, damping: 18 }}
                          whileHover={{ y: -6, scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => {
                            setShowMoodError(false);
                            onMoodChange(item.value);
                          }}
                          aria-pressed={selected}
                          className={`group relative min-h-[10.5rem] overflow-hidden rounded-[1.35rem] border p-3.5 text-left transition sm:p-4 ${
                            selected ? "border-transparent text-white" : "border-white/10 bg-white/[0.04] hover:border-white/20"
                          }`}
                          style={{
                            background: selected
                              ? `linear-gradient(135deg, ${item.hex}cc, rgba(255,255,255,0.08))`
                              : `linear-gradient(145deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02)), radial-gradient(circle at 20% 0%, ${item.glow}, transparent 56%)`,
                            boxShadow: selected ? `0 20px 70px -26px ${item.glow}` : undefined,
                          }}
                        >
                          <div className="absolute inset-0 opacity-0 transition group-hover:opacity-100" style={{ background: `radial-gradient(circle at 40% 0%, ${item.glow}, transparent 58%)` }} />
                          <div className="relative">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
                                <Icon className="h-5 w-5" />
                              </div>
                              <span className="text-xs font-bold opacity-75">{item.marker}/5</span>
                            </div>
                            <div className="mt-5 text-lg font-extrabold">{item.label}</div>
                            <p className="mt-2 text-xs leading-5 opacity-80">{item.description}</p>
                          </div>
                          {selected && (
                            <motion.div
                              layoutId="selectedMoodRing"
                              className="absolute inset-0 rounded-[1.35rem] ring-2 ring-white/35"
                              transition={{ type: "spring", stiffness: 180, damping: 18 }}
                            />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                  {showMoodError && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 text-sm text-rose-300">
                      Please choose a mood level before saving.
                    </motion.p>
                  )}
                </section>

                <motion.section
                  className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 transition focus-within:border-primary/45"
                  whileHover={{ y: -2 }}
                  style={{ boxShadow: selectedMood ? `0 18px 60px -42px ${ambientGlow}` : undefined }}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 font-semibold" htmlFor="mood-note">
                      <Sparkles className="h-4 w-4" style={{ color: ambientHex }} />
                      Reflection
                    </label>
                  </div>
                  <textarea
                    id="mood-note"
                    value={note}
                    onChange={(event) => onNoteChange(event.target.value)}
                    rows={4}
                    placeholder="What is shaping your mood today? Add a short reflection..."
                    className="mt-3 w-full resize-none rounded-2xl border border-white/10 p-4 text-sm leading-6 text-slate-50 transition placeholder:text-slate-400 focus:outline-none"
                    style={{
                      backgroundColor: "rgba(3, 7, 18, 0.86)",
                      caretColor: ambientHex,
                      boxShadow: note ? `inset 0 0 0 1px ${ambientHex}30` : "inset 0 0 0 1px rgba(255,255,255,0.05)",
                    }}
                  />
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    A short note helps MindSense connect emotional patterns with sleep, energy, and context over time.
                  </p>
                </motion.section>

                <section className="mt-6">
                  <h3 className="text-lg font-bold">Context tags</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ALL_TAGS.map((tag, index) => {
                      const selected = tags.includes(tag);
                      const meta = TAG_META[tag] || { icon: Tag };
                      const TagIcon = meta.icon;
                      return (
                        <motion.button
                          key={tag}
                          type="button"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0, scale: selected ? [1, 1.025, 1] : 1 }}
                          transition={selected ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : { delay: index * 0.025 }}
                          whileHover={{ y: -2, scale: 1.03 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => onToggleTag(tag)}
                          aria-pressed={selected}
                          className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                            selected
                              ? "text-white"
                              : "border-white/10 bg-white/[0.05] text-muted-foreground hover:text-foreground"
                          }`}
                          style={
                            selected
                              ? {
                                  borderColor: `${ambientHex}55`,
                                  background: `linear-gradient(135deg, ${ambientHex}28, rgba(255,255,255,0.06))`,
                                  boxShadow: `0 0 28px ${ambientGlow}`,
                                }
                              : undefined
                          }
                        >
                          {selected ? <Check className="h-3.5 w-3.5" /> : <TagIcon className="h-3.5 w-3.5" />}
                          {tag}
                        </motion.button>
                      );
                    })}
                  </div>
                </section>

                <section className="mt-6 grid gap-4 md:grid-cols-2">
                  <RangeField icon={Zap} label="Energy Level" lowLabel="Low energy" highLabel="High energy" value={energy} color={ambientHex} onChange={onEnergyChange} />
                  <RangeField icon={Moon} label="Sleep Quality" lowLabel="Restless" highLabel="Restful" value={sleep} color="#a78bfa" onChange={onSleepChange} />
                </section>

                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={onClose} className="rounded-full px-5 py-2.5 text-sm font-semibold hover:bg-white/[0.06]">
                    Cancel
                  </motion.button>
                  <motion.button
                    type="button"
                    disabled={saving}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={handleSave}
                    className="premium-button inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold disabled:opacity-50"
                    style={{
                      background: `linear-gradient(135deg, ${ambientHex}, #8b5cf6)`,
                      boxShadow: `0 18px 48px -26px ${ambientGlow}`,
                    }}
                  >
                    {saving ? (
                      <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="h-4 w-4 rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    {saving ? "Saving..." : editingEntry ? "Update Mood" : "Save Mood"}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};

const RangeField = ({
  icon: Icon,
  label,
  value,
  onChange,
  lowLabel,
  highLabel,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  onChange: (value: number) => void;
  lowLabel: string;
  highLabel: string;
  color: string;
}) => {
  const percent = ((value - 1) / 9) * 100;

  return (
    <motion.div whileHover={{ y: -2 }} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-4 flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]" style={{ color }}>
            <Icon className="h-4 w-4" />
          </span>
          {label}
        </span>
        <motion.span
          key={value}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-extrabold"
          style={{ color }}
        >
          {value}/10
        </motion.span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full outline-none [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-white"
        style={{
          background: `linear-gradient(90deg, ${color} ${percent}%, rgba(255,255,255,0.12) ${percent}%)`,
          accentColor: color,
          boxShadow: `0 0 24px ${color}22`,
        }}
      />
      <div className="mt-3 flex justify-between text-[11px] font-medium text-muted-foreground">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </motion.div>
  );
};

const EntryDetailModal = ({
  entry,
  onClose,
  onEdit,
  onDelete,
}: {
  entry: MoodEntry;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const meta = moodMeta(entry.mood);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/45 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 16 }}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-xl rounded-3xl border border-white/10 bg-card p-5 shadow-2xl md:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-muted-foreground">{formatDate(entry.entry_date)} - {formatTime(entry.created_at)}</div>
            <h2 className="mt-2 text-2xl font-bold">{meta.label} mood</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-white/[0.06]" aria-label="Close mood detail">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <DetailMetric label="Mood" value={`${entry.mood}/5`} icon={Smile} />
          <DetailMetric label="Energy" value={`${entry.energy ?? 0}/10`} icon={Zap} />
          <DetailMetric label="Sleep" value={`${entry.sleep_quality ?? 0}/10`} icon={Moon} />
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="text-sm font-medium text-muted-foreground">Reflection</div>
          <p className="mt-2 text-sm leading-6">{entry.note || "No note added."}</p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {(entry.tags || []).length ? (
            (entry.tags || []).map((tag) => <span key={tag} className="rounded-full bg-primary/12 px-3 py-1 text-xs font-medium text-primary">{tag}</span>)
          ) : (
            <span className="text-sm text-muted-foreground">No tags added.</span>
          )}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onDelete} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300/20 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-400/15">
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
          <button type="button" onClick={onEdit} className="premium-button inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-semibold">
            <Edit3 className="h-4 w-4" />
            Edit Entry
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const DetailMetric = ({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
    <Icon className="h-4 w-4 text-primary" />
    <div className="mt-3 text-xs text-muted-foreground">{label}</div>
    <div className="mt-1 font-bold">{value}</div>
  </div>
);

export default Mood;
