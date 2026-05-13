import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Brain,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  HeartHandshake,
  History as HistoryIcon,
  Info,
  LineChart,
  RefreshCw,
  Target,
  TrendingUp,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import { PremiumTiltCard, Reveal, Stagger } from "@/components/PremiumMotion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type ProfileRow = Tables<"profiles">;
type MoodEntry = Tables<"mood_entries">;
type DepressionTest = Tables<"depression_tests">;
type TextAnswer = {
  score: number;
};

const average = (values: number[]) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const formatDate = (value?: string | null) => {
  if (!value) return "No data yet";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "No data yet";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const getTextAnswers = (value: DepressionTest["text_answers"]): TextAnswer[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const score = typeof record.score === "number" ? record.score : Number(record.score);
      if (!Number.isFinite(score)) return null;
      return { score };
    })
    .filter((item): item is TextAnswer => Boolean(item));
};

const testScore = (test?: DepressionTest | null) => {
  if (!test) return null;
  const answers = getTextAnswers(test.text_answers);
  if (!answers.length) return null;
  const raw = average(answers.map((answer) => answer.score));
  return Math.max(0, Math.min(100, Math.round(((5 - raw) / 4) * 100)));
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const moodLabel = (value?: number | null) => {
  if (!value) return "No mood yet";
  if (value >= 4.5) return "Excellent";
  if (value >= 3.5) return "Good";
  if (value >= 2.5) return "Okay";
  if (value >= 1.5) return "Low";
  return "Very low";
};

const sortMoodEntries = (entries: MoodEntry[]) =>
  [...entries].sort(
    (a, b) =>
      new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime() ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

const dedupeMoodEntriesByDate = (entries: MoodEntry[]) => {
  const latestByDate = new Map<string, MoodEntry>();
  sortMoodEntries(entries).forEach((entry) => {
    if (!latestByDate.has(entry.entry_date)) {
      latestByDate.set(entry.entry_date, entry);
    }
  });
  return sortMoodEntries(Array.from(latestByDate.values()));
};

const Dashboard = () => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [tests, setTests] = useState<DepressionTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadDashboard = useCallback(
    async (cancelled?: () => boolean, options?: { background?: boolean }) => {
      if (!user) return;

      const background = Boolean(options?.background);
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setLoadError("");
      const [profileResult, moodResult, testResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase
          .from("mood_entries")
          .select("*")
          .eq("user_id", user.id)
          .order("entry_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(60),
        supabase
          .from("depression_tests")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (cancelled?.()) return;

      const errors = [profileResult.error, moodResult.error, testResult.error]
        .map((error) => error?.message)
        .filter(Boolean);

      const profile = (profileResult.data as ProfileRow | null) || null;
      setName(profile?.name || user.email?.split("@")[0] || "");
      setMoods(dedupeMoodEntriesByDate((moodResult.data as MoodEntry[] | null) || []));
      setTests((testResult.data as DepressionTest[] | null) || []);
      setLoadError(errors.length ? "Some dashboard data could not be loaded. Refresh the dashboard or try again shortly." : "");
      setLoading(false);
      setRefreshing(false);
    },
    [user],
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    loadDashboard(() => cancelled);

    return () => {
      cancelled = true;
    };
  }, [loadDashboard, user]);

  const latestMood = moods[0] || null;
  const latestTest = tests[0] || null;
  const latestTestScore = testScore(latestTest);
  const avgMood = average(moods.map((entry) => entry.mood));
  const hasMoodData = moods.length > 0;
  const hasTestData = tests.length > 0;
  const wellnessScore = hasMoodData ? Math.round(avgMood * 20) : 0;
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const currentDateKey = todayKey();
  const todayMood = moods.find((entry) => entry.entry_date === currentDateKey) || null;

  const chartData = useMemo(() => {
    const sorted = [...moods].sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
    const grouped = new Map<string, number[]>();
    sorted.forEach((entry) => {
      const current = grouped.get(entry.entry_date) || [];
      current.push(entry.mood);
      grouped.set(entry.entry_date, current);
    });

    const data = Array.from(grouped.entries()).slice(-7).map(([date, values]) => ({
      date: formatDate(date),
      mood: Number(average(values).toFixed(2)),
    }));

    return data;
  }, [moods]);

  const weekAverage = average(chartData.map((entry) => entry.mood));
  const trendDelta = chartData.length > 1 ? chartData[chartData.length - 1].mood - chartData[0].mood : 0;
  const trendLabel = !chartData.length
    ? "Waiting for data"
    : trendDelta > 0.25
      ? "Improving"
      : trendDelta < -0.25
        ? "Needs attention"
        : "Stable";
  const careRecommendation = !hasMoodData
    ? {
        title: "Track your first mood",
        description: "Your dashboard starts becoming useful after the first mood entry.",
        to: "/mood",
        action: "Track Mood",
        icon: LineChart,
      }
    : !hasTestData
      ? {
          title: "Create an assessment baseline",
          description: "Complete the questionnaire so reports can compare mood and assessment history.",
          to: "/test",
          action: "Start Test",
          icon: ClipboardList,
        }
      : latestMood && latestMood.mood <= 2
        ? {
            title: "Use a support tool",
            description: "Your latest mood is low. A short breathing or grounding exercise may help right now.",
            to: "/therapy",
            action: "Open Support",
            icon: HeartHandshake,
          }
        : {
            title: "Review your progress",
            description: "Your dashboard has enough activity to review patterns and reports.",
            to: "/history",
            action: "View Reports",
            icon: HistoryIcon,
          };
  const statusItems = [
    {
      label: "Today mood",
      value: todayMood ? moodLabel(todayMood.mood) : "Not tracked",
      icon: LineChart,
      to: "/mood",
    },
    {
      label: "Assessment",
      value: latestTest ? "Completed" : "Not started",
      icon: ClipboardList,
      to: "/test",
    },
    {
      label: "Weekly trend",
      value: trendLabel,
      icon: TrendingUp,
      to: "/history",
    },
  ];

  const todayStatus = [
    {
      label: "Mood tracked today",
      value: todayMood ? "Yes" : "No",
      detail: todayMood ? `${moodLabel(todayMood.mood)} mood logged` : "Add today's mood from Mood Tracking",
      to: "/mood",
      complete: Boolean(todayMood),
    },
    {
      label: "Assessment baseline",
      value: latestTest ? "Ready" : "Missing",
      detail: latestTest ? `Last assessment: ${formatDate(latestTest.created_at)}` : "Complete your first depression test",
      to: "/test",
      complete: Boolean(latestTest),
    },
    {
      label: "Recommended next step",
      value: careRecommendation.action,
      detail: careRecommendation.title,
      to: careRecommendation.to,
      complete: false,
    },
  ];

  const recentActivity = [
    latestMood
      ? {
          title: "Latest mood entry",
          value: `${moodLabel(latestMood.mood)} (${latestMood.mood}/5)`,
          detail: formatDateTime(latestMood.created_at),
          to: "/mood",
          icon: LineChart,
        }
      : {
          title: "Latest mood entry",
          value: "No mood entries yet",
          detail: "Start from Mood Tracking",
          to: "/mood",
          icon: LineChart,
        },
    latestTest
      ? {
          title: "Latest assessment",
          value: latestTestScore !== null ? `${latestTestScore}% score` : "Assessment saved",
          detail: formatDateTime(latestTest.created_at),
          to: "/history",
          icon: ClipboardList,
        }
      : {
          title: "Latest assessment",
          value: "No test assessments yet",
          detail: "Start the depression test",
          to: "/test",
          icon: ClipboardList,
        },
    {
      title: "Weekly mood trend",
      value: trendLabel,
      detail: chartData.length ? `${chartData.length} tracked day${chartData.length === 1 ? "" : "s"} this week` : "Waiting for mood data",
      to: "/history",
      icon: TrendingUp,
    },
  ];

  const stats = [
    {
      label: "Mood wellness score",
      value: loading ? "..." : `${wellnessScore}%`,
      icon: Brain,
      detail: hasMoodData ? "Calculated from mood tracking" : "Needs mood data",
      meter: wellnessScore,
      accent: "from-primary to-sky-400",
      tooltip: "This score is calculated only from mood tracking data, not voice/video or questionnaire analysis.",
    },
    {
      label: "Mood entries",
      value: loading ? "..." : String(moods.length),
      icon: LineChart,
      detail: latestMood ? `Last: ${formatDate(latestMood.entry_date)}` : "No mood entries yet",
      meter: clampPercent(moods.length * 10),
      accent: "from-sky-400 to-violet-400",
      tooltip: "Total mood entries saved from the Mood Tracking page.",
    },
    {
      label: "Assessments",
      value: loading ? "..." : String(tests.length),
      icon: ClipboardList,
      detail: latestTest
        ? latestTestScore !== null
          ? `Latest score: ${latestTestScore}%`
          : `Last: ${formatDate(latestTest.created_at)}`
        : "No test assessments yet",
      meter: clampPercent(tests.length * 25),
      accent: "from-violet-400 to-primary",
      tooltip: "Saved depression test submissions from the assessment flow.",
    },
    {
      label: "Average mood",
      value: loading ? "..." : hasMoodData ? avgMood.toFixed(1) : "0",
      icon: Activity,
      detail: hasMoodData ? "Out of 5" : "No mood data yet",
      meter: clampPercent(avgMood * 20),
      accent: "from-primary to-emerald-300",
      tooltip: "Average of your saved mood values on the 1 to 5 scale.",
    },
  ];

  const actionCards = [
    {
      to: "/test",
      icon: ClipboardList,
      title: "Start Depression Test",
      desc: "Begin the guided multimodal assessment flow.",
    },
    {
      to: "/mood",
      icon: LineChart,
      title: "Mood Tracking",
      desc: "Review and manage your mood logs.",
    },
    {
      to: "/therapy",
      icon: HeartHandshake,
      title: "Therapy & Support",
      desc: "Open breathing tools and support resources.",
    },
    {
      to: "/history",
      icon: HistoryIcon,
      title: "Reports",
      desc: "See charts, history, and exports.",
    },
    {
      to: "/resources",
      icon: BookOpen,
      title: "Resources",
      desc: "Browse articles, videos, and audio guides.",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <Reveal>
          <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_20%_20%,hsl(var(--primary)/0.18),transparent_32%),radial-gradient(circle_at_88%_12%,rgba(167,139,250,0.18),transparent_28%),rgba(255,255,255,0.055)] p-5 shadow-[var(--shadow-card)] backdrop-blur-2xl md:p-7">
            <div className="premium-grid absolute inset-0 opacity-30" />
            <div className="ambient-beams absolute inset-0 opacity-45" />
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
            <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-stretch">
              <div className="flex min-h-[18rem] flex-col justify-between rounded-[1.5rem] border border-white/10 bg-black/10 p-5 md:p-6">
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
                  <Calendar className="h-4 w-4" />
                  {today}
                </div>
                <h1 className="max-w-4xl text-4xl font-extrabold leading-[1.02] md:text-5xl xl:text-6xl">
                  Hi {name || "Friend"},
                  <span className="block gradient-text">your wellness overview.</span>
                </h1>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Button asChild className="premium-button">
                    <Link to="/test">
                      Start Assessment
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-full border-white/10 bg-white/[0.04]">
                    <Link to="/history">View Reports</Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => loadDashboard(undefined, { background: true })}
                    disabled={loading || refreshing}
                    className="rounded-full border-white/10 bg-white/[0.04]"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading || refreshing ? "animate-spin" : ""}`} />
                    {refreshing ? "Refreshing" : "Refresh"}
                  </Button>
                </div>
              </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {statusItems.map((item) => (
                    <Link
                      key={item.label}
                      to={item.to}
                      className="group rounded-2xl border border-white/10 bg-white/[0.045] p-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white/[0.075]"
                    >
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        <item.icon className="h-3.5 w-3.5 text-primary" />
                        {item.label}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-base font-semibold text-foreground">{item.value}</span>
                        <ArrowRight className="h-4 w-4 text-primary opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[1.5rem] border border-primary/20 bg-[#0b1320]/80 p-5 shadow-[var(--shadow-glow)]">
                <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
                <div className="absolute -bottom-16 left-8 h-36 w-36 rounded-full bg-violet-400/20 blur-3xl" />
                <div className="relative flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Mood wellness index</div>
                    <div className="mt-1 text-2xl font-bold">{hasMoodData ? moodLabel(avgMood) : "No baseline"}</div>
                  </div>
                  <div className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {hasMoodData ? "Live" : "Waiting"}
                  </div>
                </div>
                <div className="relative mx-auto mt-5 flex h-48 w-48 items-center justify-center rounded-full border border-white/10 bg-white/[0.035]">
                  <div className="absolute inset-3 rounded-full border border-primary/10" />
                <div
                    className="relative flex h-40 w-40 items-center justify-center rounded-full shadow-[0_0_80px_rgba(45,212,191,0.18)]"
                  style={{
                    background: `conic-gradient(hsl(var(--primary)) ${wellnessScore * 3.6}deg, hsl(var(--muted)) 0deg)`,
                  }}
                >
                    <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full border border-white/10 bg-background text-center">
                      <div className="text-4xl font-extrabold">{loading ? "..." : `${wellnessScore}%`}</div>
                      <div className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Mood wellness</div>
                    </div>
                  </div>
                </div>
                <div className="relative mt-5 grid gap-3">
                  <SignalRow label="Mood average" value={hasMoodData ? `${avgMood.toFixed(1)}/5` : "0/5"} meter={avgMood * 20} />
                  <SignalRow label="Assessments" value={String(tests.length)} meter={clampPercent(tests.length * 25)} />
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        {loadError && <DashboardError message={loadError} onRetry={() => loadDashboard(undefined, { background: true })} loading={loading || refreshing} />}

        <Reveal>
          <section className="premium-card relative overflow-hidden p-5 md:p-6">
            <div className="premium-grid pointer-events-none absolute inset-0 opacity-20" />
            <div className="pointer-events-none absolute right-0 top-0 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Mood Signal Trend
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">Latest week of mood tracking, measured from 1 to 5.</p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-muted-foreground">
                Last 7 tracked days
              </div>
            </div>
            <div className="relative">
              {loading && !chartData.length ? (
                <ChartSkeleton />
              ) : chartData.length ? (
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_17rem]">
                  <div className="h-72 rounded-2xl border border-white/10 bg-black/10 p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 16, right: 12, left: -16, bottom: 0 }}>
                        <defs>
                          <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                        <XAxis dataKey="date" stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} />
                        <YAxis
                          stroke="rgba(255,255,255,0.45)"
                          tickLine={false}
                          axisLine={false}
                          domain={[1, 5]}
                          ticks={[1, 2, 3, 4, 5]}
                        />
                        <Tooltip
                          cursor={{ stroke: "hsl(var(--primary) / 0.35)", strokeWidth: 1 }}
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "16px",
                            color: "hsl(var(--foreground))",
                            boxShadow: "var(--shadow-card)",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="mood"
                          name="Mood"
                          stroke="hsl(var(--primary))"
                          fill="url(#moodGradient)"
                          strokeWidth={3}
                          dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                          activeDot={{ r: 6, fill: "hsl(var(--primary-glow))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                    <div className="text-sm font-medium text-muted-foreground">Week snapshot</div>
                    <div className="mt-5 space-y-5">
                      <SnapshotRow label="Tracked days" value={String(chartData.length)} />
                      <SnapshotRow label="Week average" value={weekAverage ? `${weekAverage.toFixed(1)}/5` : "0/5"} />
                      <SnapshotRow label="Trend status" value={trendLabel} />
                      <SnapshotRow label="Latest mood" value={latestMood ? moodLabel(latestMood.mood) : "No mood yet"} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-72">
                  <EmptyDashboardState
                    title="No mood trend yet"
                    description="Add mood entries from the Mood Tracking page to build your signal trend."
                    to="/mood"
                    action="Open Mood Tracking"
                  />
                </div>
              )}
            </div>
          </section>
        </Reveal>

        <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {loading && !moods.length && !tests.length
            ? Array.from({ length: 4 }).map((_, index) => <MetricSkeleton key={index} />)
            : stats.map((stat) => (
            <PremiumTiltCard key={stat.label} className="group relative min-h-40 overflow-hidden p-5">
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${stat.accent}`} />
              <div className="absolute -right-12 -top-12 h-28 w-28 rounded-full bg-primary/10 blur-2xl transition group-hover:bg-primary/20" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" aria-label={stat.tooltip} title={stat.tooltip} />
                  </div>
                  <div className="mt-2 text-4xl font-extrabold tracking-tight">{stat.value}</div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/12 text-primary shadow-[var(--shadow-soft)]">
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div className={`h-full rounded-full bg-gradient-to-r ${stat.accent}`} style={{ width: `${stat.meter}%` }} />
              </div>
              <p className="mt-4 text-xs font-medium text-muted-foreground">{stat.detail}</p>
            </PremiumTiltCard>
          ))}
        </Stagger>

        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <TodayStatusPanel items={todayStatus} loading={loading && !moods.length && !tests.length} />
          <CareRecommendationPanel recommendation={careRecommendation} loading={loading && !moods.length && !tests.length} />
        </div>

        <RecentActivityPanel items={recentActivity} loading={loading && !moods.length && !tests.length} />

        <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {actionCards.map((card) => (
            <ActionCard key={card.to} {...card} />
          ))}
        </Stagger>
      </div>
    </DashboardLayout>
  );
};

type ActionCardProps = {
  to: string;
  icon: LucideIcon;
  title: string;
  desc: string;
};

type TodayStatusItem = {
  label: string;
  value: string;
  detail: string;
  to: string;
  complete: boolean;
};

type Recommendation = {
  title: string;
  description: string;
  to: string;
  action: string;
  icon: LucideIcon;
};

type ActivityItem = {
  title: string;
  value: string;
  detail: string;
  to: string;
  icon: LucideIcon;
};

const DashboardError = ({ message, onRetry, loading }: { message: string; onRetry: () => void; loading: boolean }) => (
  <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-300/15 text-amber-300">
          <TriangleAlert className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold text-amber-100">Dashboard data needs a refresh</div>
          <p className="mt-1 text-sm text-amber-100/75">{message}</p>
        </div>
      </div>
      <Button type="button" variant="outline" onClick={onRetry} disabled={loading} className="rounded-full border-amber-300/25 bg-amber-300/10">
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        Retry
      </Button>
    </div>
  </div>
);

const MetricSkeleton = () => (
  <div className="premium-card min-h-40 overflow-hidden p-5">
    <div className="h-3 w-28 animate-pulse rounded-full bg-white/10" />
    <div className="mt-5 h-10 w-20 animate-pulse rounded-xl bg-white/10" />
    <div className="mt-6 h-1.5 animate-pulse rounded-full bg-white/10" />
    <div className="mt-4 h-3 w-36 animate-pulse rounded-full bg-white/10" />
  </div>
);

const ChartSkeleton = () => (
  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
    <div className="h-72 rounded-2xl border border-white/10 bg-black/10 p-5">
      <div className="flex h-full items-end gap-3">
        {[42, 68, 52, 78, 60, 88, 70].map((height, index) => (
          <div key={index} className="flex flex-1 items-end">
            <div className="w-full animate-pulse rounded-t-xl bg-white/10" style={{ height: `${height}%` }} />
          </div>
        ))}
      </div>
    </div>
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="h-4 w-28 animate-pulse rounded-full bg-white/10" />
      <div className="mt-6 space-y-5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-4 animate-pulse rounded-full bg-white/10" />
        ))}
      </div>
    </div>
  </div>
);

const TodayStatusPanel = ({ items, loading }: { items: TodayStatusItem[]; loading: boolean }) => (
  <section className="premium-card p-5 md:p-6">
    <div className="mb-5 flex items-center gap-2">
      <CalendarCheck className="h-5 w-5 text-primary" />
      <h2 className="text-xl font-bold">Today's Status</h2>
    </div>
    <div className="grid gap-3 md:grid-cols-3">
      {loading
        ? Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
          ))
        : items.map((item) => (
            <Link key={item.label} to={item.to} className="group rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white/[0.075]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${item.complete ? "bg-emerald-400/15 text-emerald-300" : "bg-white/[0.06] text-primary"}`}>
                  {item.complete ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                </div>
              </div>
              <div className="mt-3 text-lg font-bold">{item.value}</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
            </Link>
          ))}
    </div>
  </section>
);

const CareRecommendationPanel = ({ recommendation, loading }: { recommendation: Recommendation; loading: boolean }) => {
  const Icon = recommendation.icon;

  return (
    <section className="premium-card relative overflow-hidden p-5 md:p-6">
      <div className="absolute -right-14 -top-14 h-36 w-36 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative flex h-full flex-col justify-between gap-5">
        <div>
          <div className="mb-5 flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Care Recommendation</h2>
          </div>
          {loading ? (
            <div className="space-y-4">
              <div className="h-6 w-52 animate-pulse rounded-full bg-white/10" />
              <div className="h-4 w-full animate-pulse rounded-full bg-white/10" />
              <div className="h-4 w-2/3 animate-pulse rounded-full bg-white/10" />
            </div>
          ) : (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/12 text-primary">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-2xl font-bold">{recommendation.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{recommendation.description}</p>
            </>
          )}
        </div>
        <Button asChild className="premium-button w-fit">
          <Link to={recommendation.to}>
            {recommendation.action}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
};

const RecentActivityPanel = ({ items, loading }: { items: ActivityItem[]; loading: boolean }) => (
  <section className="premium-card p-5 md:p-6">
    <div className="mb-5 flex items-center gap-2">
      <FileText className="h-5 w-5 text-primary" />
      <h2 className="text-xl font-bold">Recent Activity</h2>
    </div>
    <div className="grid gap-3 md:grid-cols-3">
      {loading
        ? Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
          ))
        : items.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.title} to={item.to} className="group rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white/[0.075]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-primary opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" />
                </div>
                <div className="mt-4 text-sm font-medium text-muted-foreground">{item.title}</div>
                <div className="mt-1 font-semibold">{item.value}</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
              </Link>
            );
          })}
    </div>
  </section>
);

const SignalRow = ({ label, value, meter }: { label: string; value: string; meter: number }) => (
  <div>
    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
      <div className="h-full rounded-full bg-gradient-to-r from-primary to-sky-400" style={{ width: `${clampPercent(meter)}%` }} />
    </div>
  </div>
);

const SnapshotRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4 last:border-b-0 last:pb-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-semibold text-foreground">{value}</span>
  </div>
);

const EmptyDashboardState = ({
  title,
  description,
  to,
  action,
}: {
  title: string;
  description: string;
  to: string;
  action: string;
}) => (
  <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.035] p-6 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/12 text-primary">
      <LineChart className="h-6 w-6" />
    </div>
    <h3 className="mt-4 text-lg font-semibold">{title}</h3>
    <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
    <Button asChild className="mt-5 rounded-full">
      <Link to={to}>{action}</Link>
    </Button>
  </div>
);

const ActionCard = ({ to, icon: Icon, title, desc }: ActionCardProps) => (
  <PremiumTiltCard className="group relative flex min-h-[15.5rem] overflow-hidden p-0">
    <Link to={to} className="flex h-full min-h-[15.5rem] w-full flex-col p-5">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary transition group-hover:scale-110">
        <Icon className="h-6 w-6" />
      </div>
      <div className="mt-7 flex min-h-12 items-end text-xl font-semibold leading-tight">{title}</div>
      <p className="mt-3 min-h-16 text-sm leading-6 text-muted-foreground">{desc}</p>
      <div className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-primary">
        Open <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
      </div>
    </Link>
  </PremiumTiltCard>
);

export default Dashboard;
