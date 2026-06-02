import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Award,
  BarChart3,
  Brain,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  HeartPulse,
  History as HistoryIcon,
  Loader2,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type MoodEntry = Tables<"mood_entries">;
type DepressionTest = Tables<"depression_tests">;
type SupportActivity = Tables<"support_activity_history">;

type TextAnswer = {
  question: string;
  answer: string;
  score: number;
};

type TimelineItem = {
  id: string;
  type: "mood" | "test" | "support";
  title: string;
  detail: string;
  date: string;
  meta?: string;
  icon: LucideIcon;
};

const chartTooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "16px",
  color: "hsl(var(--foreground))",
  boxShadow: "var(--shadow-card)",
};

const isMissingSupportTableError = (message?: string) =>
  Boolean(message?.includes("schema cache") || message?.includes("does not exist"));

const dateFromKey = (dateKey: string) => new Date(`${dateKey}T00:00:00`);

const localDateKey = (date = new Date()) => {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
};

const dayDistanceFromToday = (dateKey: string) => {
  const today = dateFromKey(localDateKey());
  const date = dateFromKey(dateKey);
  return Math.floor((today.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
};

const formatDate = (value: string) =>
  dateFromKey(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const formatShortDate = (value: string) =>
  dateFromKey(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatDuration = (seconds: number) => {
  if (!seconds) return "Quick action";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (!mins) return `${secs}s`;
  return secs ? `${mins}m ${secs}s` : `${mins}m`;
};

const average = (values: number[]) => {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const sortMoodsDesc = (entries: MoodEntry[]) =>
  [...entries].sort(
    (a, b) =>
      new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime() ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

const dedupeEntriesByDate = (entries: MoodEntry[]) => {
  const latestByDate = new Map<string, MoodEntry>();
  sortMoodsDesc(entries).forEach((entry) => {
    if (!latestByDate.has(entry.entry_date)) {
      latestByDate.set(entry.entry_date, entry);
    }
  });
  return sortMoodsDesc(Array.from(latestByDate.values()));
};

const entriesInRange = (entries: MoodEntry[], minDistance: number, maxDistance: number) =>
  entries.filter((entry) => {
    const distance = dayDistanceFromToday(entry.entry_date);
    return distance >= minDistance && distance <= maxDistance;
  });

const moodMeta = (value: number) => {
  if (value >= 5) return { label: "Amazing", tone: "text-sky-300", bg: "bg-sky-400/12", icon: Sparkles };
  if (value >= 4) return { label: "Good", tone: "text-emerald-300", bg: "bg-emerald-400/12", icon: HeartPulse };
  if (value >= 3) return { label: "Neutral", tone: "text-amber-200", bg: "bg-amber-300/12", icon: Activity };
  if (value >= 2) return { label: "Low", tone: "text-orange-300", bg: "bg-orange-400/12", icon: Moon };
  return { label: "Drained", tone: "text-rose-300", bg: "bg-rose-400/12", icon: AlertCircle };
};

const getTextAnswers = (value: DepressionTest["text_answers"]): TextAnswer[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const score = typeof record.score === "number" ? record.score : Number(record.score);
      if (!Number.isFinite(score)) return null;
      return {
        question: typeof record.question === "string" ? record.question : "",
        answer: typeof record.answer === "string" ? record.answer : "",
        score,
      };
    })
    .filter((item): item is TextAnswer => Boolean(item));
};

const getTestScore = (test?: DepressionTest | null) => {
  if (!test) return null;
  const answers = getTextAnswers(test.text_answers);
  if (!answers.length) return null;
  const avg = answers.reduce((sum, answer) => sum + answer.score, 0) / answers.length;
  return Math.max(0, Math.min(100, Math.round(((5 - avg) / 4) * 100)));
};

const wellnessLabel = (score: number | null) => {
  if (score === null) return "Awaiting data";
  if (score >= 75) return "Balanced";
  if (score >= 55) return "Mostly steady";
  if (score >= 35) return "Needs care";
  return "Needs support";
};

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

const History = () => {
  const { user, loading: authLoading } = useAuth();
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [tests, setTests] = useState<DepressionTest[]>([]);
  const [activities, setActivities] = useState<SupportActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReports = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const [moodResult, testResult, activityResult] = await Promise.all([
      supabase
        .from("mood_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("depression_tests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("support_activity_history")
        .select("*")
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false })
        .limit(50),
    ]);

    if (moodResult.error) {
      toast({ title: "Could not load mood history", description: moodResult.error.message, variant: "destructive" });
    }
    if (testResult.error) {
      toast({ title: "Could not load test history", description: testResult.error.message, variant: "destructive" });
    }
    if (activityResult.error && !isMissingSupportTableError(activityResult.error.message)) {
      toast({ title: "Could not load support history", description: activityResult.error.message, variant: "destructive" });
    }

    setMoods((moodResult.data as MoodEntry[] | null) ?? []);
    setTests((testResult.data as DepressionTest[] | null) ?? []);
    setActivities(activityResult.error ? [] : ((activityResult.data as SupportActivity[] | null) ?? []));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading) void loadReports();
  }, [authLoading, loadReports]);

  const completedTests = useMemo(() => tests.filter((test) => test.status === "completed"), [tests]);
  const latestTest = completedTests[0] ?? tests[0] ?? null;
  const latestScore = getTestScore(latestTest);
  const latestAnswers = latestTest ? getTextAnswers(latestTest.text_answers) : [];
  const latestMoodEntries = useMemo(() => dedupeEntriesByDate(moods), [moods]);
  const sortedMoodAsc = useMemo(() => [...latestMoodEntries].reverse(), [latestMoodEntries]);
  const latestMood = latestMoodEntries[0] ?? null;

  const reportStats = useMemo(() => {
    const recent = latestMoodEntries.slice(0, 7);
    const previous = latestMoodEntries.slice(7, 14);
    const avgMood = average(latestMoodEntries.map((entry) => entry.mood));
    const recentAvg = average(recent.map((entry) => entry.mood));
    const previousAvg = average(previous.map((entry) => entry.mood));
    const avgSleep = average(latestMoodEntries.map((entry) => entry.sleep_quality).filter((value): value is number => typeof value === "number"));
    const avgEnergy = average(latestMoodEntries.map((entry) => entry.energy).filter((value): value is number => typeof value === "number"));

    return {
      avgMood,
      avgSleep,
      avgEnergy,
      trackedDays: latestMoodEntries.length,
      supportSessions: activities.length,
      moodChange: recentAvg !== null && previousAvg !== null ? Number((recentAvg - previousAvg).toFixed(1)) : null,
    };
  }, [activities.length, latestMoodEntries]);

  const moodTrend = useMemo(
    () =>
      sortedMoodAsc.slice(-30).map((entry) => ({
        date: formatShortDate(entry.entry_date),
        mood: entry.mood,
        sleep: typeof entry.sleep_quality === "number" ? Number((entry.sleep_quality / 2).toFixed(1)) : null,
        energy: typeof entry.energy === "number" ? Number((entry.energy / 2).toFixed(1)) : null,
      })),
    [sortedMoodAsc],
  );

  const weeklyStats = useMemo(() => {
    const ranges = [
      { label: "4 wks ago", min: 21, max: 27 },
      { label: "3 wks ago", min: 14, max: 20 },
      { label: "Last week", min: 7, max: 13 },
      { label: "This week", min: 0, max: 6 },
    ];
    return ranges.map((range) => {
      const entries = entriesInRange(latestMoodEntries, range.min, range.max);
      const value = average(entries.map((entry) => entry.mood));
      return {
        week: range.label,
        mood: value === null ? null : Number(value.toFixed(2)),
      };
    });
  }, [latestMoodEntries]);

  const testTrend = useMemo(
    () =>
      [...completedTests]
        .reverse()
        .slice(-8)
        .map((test, index) => ({
          label: `Test ${index + 1}`,
          score: getTestScore(test),
        }))
        .filter((item) => item.score !== null),
    [completedTests],
  );

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const moodItems = latestMoodEntries.slice(0, 8).map((entry) => {
      const meta = moodMeta(entry.mood);
      return {
        id: `mood-${entry.id}`,
        type: "mood" as const,
        title: `${meta.label} mood`,
        detail: `Mood signal ${entry.mood}/5${entry.note ? ` - ${entry.note}` : ""}`,
        date: `${entry.entry_date}T12:00:00`,
        meta: entry.tags?.length ? entry.tags.join(", ") : undefined,
        icon: meta.icon,
      };
    });

    const testItems = completedTests.slice(0, 6).map((test) => {
      const score = getTestScore(test);
      return {
        id: `test-${test.id}`,
        type: "test" as const,
        title: `${wellnessLabel(score)} assessment`,
        detail: `${getTextAnswers(test.text_answers).length} text answers. ${test.voice_path ? "Voice captured" : "No voice"}. ${test.video_path ? "Video captured" : "No video"}.`,
        date: test.created_at,
        meta: score === null ? "Score unavailable" : `${score}% text-based score`,
        icon: ClipboardList,
      };
    });

    const supportItems = activities.slice(0, 8).map((activity) => ({
      id: `support-${activity.id}`,
      type: "support" as const,
      title: activity.title,
      detail: `${activity.activity_type} support activity`,
      date: activity.completed_at,
      meta: formatDuration(activity.duration_seconds),
      icon: HeartPulse,
    }));

    return [...moodItems, ...testItems, ...supportItems]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 14);
  }, [activities, completedTests, latestMoodEntries]);

  const readiness = [
    {
      label: "Mood data",
      value: reportStats.trackedDays ? `${reportStats.trackedDays} days` : "Not logged",
      ready: reportStats.trackedDays > 0,
      icon: TrendingUp,
    },
    {
      label: "Questionnaire",
      value: completedTests.length ? `${completedTests.length} complete` : "No test yet",
      ready: completedTests.length > 0,
      icon: ClipboardList,
    },
    {
      label: "Voice signal",
      value: completedTests.some((test) => test.voice_path) ? "Captured" : "Pending",
      ready: completedTests.some((test) => test.voice_path),
      icon: Activity,
    },
    {
      label: "Video signal",
      value: completedTests.some((test) => test.video_path) ? "Captured" : "Pending",
      ready: completedTests.some((test) => test.video_path),
      icon: Brain,
    },
    {
      label: "Support activity",
      value: activities.length ? `${activities.length} sessions` : "No sessions",
      ready: activities.length > 0,
      icon: HeartPulse,
    },
  ];

  const exportReport = () => {
    if (!moods.length && !tests.length && !activities.length) {
      toast({ title: "No report data yet", description: "Add mood entries, complete a test, or use support tools before exporting." });
      return;
    }

    const rows = [
      ["section", "date", "title", "value", "details"],
      ...latestMoodEntries.map((entry) => [
        "mood",
        entry.entry_date,
        moodMeta(entry.mood).label,
        `${entry.mood}/5`,
        `note=${entry.note || ""}; tags=${(entry.tags || []).join("|")}; energy=${entry.energy ?? ""}; sleep=${entry.sleep_quality ?? ""}`,
      ]),
      ...tests.map((test) => {
        const score = getTestScore(test);
        return [
          "test",
          test.created_at,
          wellnessLabel(score),
          score === null ? "" : `${score}%`,
          `status=${test.status}; text_answers=${getTextAnswers(test.text_answers).length}; voice=${test.voice_path ? "yes" : "no"}; video=${test.video_path ? "yes" : "no"}`,
        ];
      }),
      ...activities.map((activity) => [
        "support",
        activity.completed_at,
        activity.title,
        activity.activity_type,
        `duration=${activity.duration_seconds}; metadata=${JSON.stringify(activity.metadata ?? {})}`,
      ]),
    ];

    downloadCsv(rows, `mindsense-report-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const displayName = typeof user?.user_metadata?.name === "string" ? user.user_metadata.name.split(" ")[0] : user?.email?.split("@")[0] ?? "there";
  const hasReportData = Boolean(latestMoodEntries.length || completedTests.length || activities.length);

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-5">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_20%_18%,hsl(var(--primary)/0.18),transparent_32%),radial-gradient(circle_at_86%_10%,rgba(167,139,250,0.18),transparent_28%),rgba(255,255,255,0.055)] p-5 shadow-[var(--shadow-card)] backdrop-blur-2xl md:p-7">
          <div className="premium-grid pointer-events-none absolute inset-0 opacity-25" />
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                <HistoryIcon className="h-4 w-4" />
                Wellness record
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-[0.95] tracking-normal md:text-6xl">
                {displayName}, your progress report is organized here.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
                Review mood patterns, questionnaire history, multimodal readiness, support sessions, and exports from one calm report workspace.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button className="premium-button" onClick={exportReport}>
                  <Download className="h-4 w-4" />
                  Export report
                </Button>
                <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={() => void loadReports()} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh
                </Button>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-black/15 p-5">
              <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] p-3">
                <div
                  className="flex h-full w-full items-center justify-center rounded-full p-3"
                  style={{
                    background: latestScore === null ? "rgba(255,255,255,0.06)" : `conic-gradient(hsl(var(--primary)) ${latestScore * 3.6}deg, rgba(255,255,255,0.1) 0deg)`,
                  }}
                >
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-white/10 bg-[#0b111d] text-center">
                    <div className="text-4xl font-extrabold gradient-text">{latestScore ?? "--"}</div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Latest score</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 text-center">
                <div className="text-lg font-bold">{wellnessLabel(latestScore)}</div>
                <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
                  {latestTest ? "Current score is based on questionnaire answers. Voice and video models can be added later." : "Complete an assessment to generate your first report score."}
                </p>
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <ReportSkeleton />
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {readiness.map((item) => (
                <ReadinessCard key={item.label} {...item} />
              ))}
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={ClipboardList} label="Completed tests" value={String(completedTests.length)} detail={latestTest ? `Latest: ${formatDateTime(latestTest.created_at)}` : "No assessment yet"} />
              <MetricCard icon={TrendingUp} label="Average mood" value={reportStats.avgMood === null ? "--" : `${reportStats.avgMood.toFixed(1)}/5`} detail={latestMood ? `Latest: ${moodMeta(latestMood.mood).label}` : "No mood data yet"} />
              <MetricCard icon={Calendar} label="Days tracked" value={String(reportStats.trackedDays)} detail={reportStats.moodChange === null ? "Need previous week data" : `7-day change ${reportStats.moodChange >= 0 ? "+" : ""}${reportStats.moodChange}`} />
              <MetricCard icon={HeartPulse} label="Support sessions" value={String(reportStats.supportSessions)} detail={activities[0] ? `Latest: ${formatDateTime(activities[0].completed_at)}` : "No support activity yet"} />
            </section>

            {!hasReportData && (
              <section className="premium-card p-5 md:p-6">
                <EmptyState
                  icon={FileText}
                  title="Your report is ready to be built"
                  description="Start with one mood entry or complete the depression test. MindSense will keep the report empty until real account data exists."
                  actions={[
                    { to: "/mood", label: "Track mood" },
                    { to: "/test", label: "Start test" },
                  ]}
                />
              </section>
            )}

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <ChartCard title="Mood, Sleep, and Energy Trend" subtitle="Mood uses 1-5. Sleep and energy are scaled to 1-5 for comparison." icon={BarChart3}>
                {moodTrend.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={moodTrend} margin={{ top: 16, right: 18, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="historyMoodArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.42} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                      <XAxis dataKey="date" stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} fontSize={12} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Area type="monotone" dataKey="mood" name="Mood" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#historyMoodArea)" dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }} />
                      <Line type="monotone" dataKey="sleep" name="Sleep signal" stroke="#a78bfa" strokeWidth={2} dot={false} connectNulls />
                      <Line type="monotone" dataKey="energy" name="Energy signal" stroke="#38bdf8" strokeWidth={2} dot={false} connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart icon={TrendingUp} message="Add mood entries to build mood, sleep, and energy trends." to="/mood" action="Track mood" />
                )}
              </ChartCard>

              <ChartCard title="Weekly Mood Averages" subtitle="Recent calendar-week comparison from mood tracking." icon={Award}>
                {latestMoodEntries.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyStats} margin={{ top: 16, right: 12, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                      <XAxis dataKey="week" stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} fontSize={12} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Bar dataKey="mood" name="Mood average" radius={[12, 12, 0, 0]} fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart icon={Calendar} message="Weekly averages appear after mood tracking starts." to="/mood" action="Add mood" />
                )}
              </ChartCard>
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <LatestAssessment test={latestTest} score={latestScore} answers={latestAnswers} />
              <ChartCard title="Assessment Score Trend" subtitle="Text-based wellness score across completed assessments." icon={ClipboardList}>
                {testTrend.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={testTrend} margin={{ top: 16, right: 18, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                      <XAxis dataKey="label" stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} fontSize={12} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Line type="monotone" dataKey="score" name="Wellness score" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 5, fill: "hsl(var(--primary))", strokeWidth: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart icon={ClipboardList} message="Complete at least one assessment to see score history." to="/test" action="Start test" />
                )}
              </ChartCard>
            </section>

            <UnifiedTimeline items={timelineItems} />

            <section className="grid gap-5 xl:grid-cols-2">
              <MoodHistory entries={latestMoodEntries.slice(0, 8)} />
              <TestHistory tests={completedTests.slice(0, 8)} />
            </section>

            <section className="premium-card flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold">Report ownership</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Exports include only your saved mood entries, test submissions, and support activity. MindSense reports are supportive wellness records, not medical diagnosis.
                  </p>
                </div>
              </div>
              <Button className="premium-button w-full md:w-auto" onClick={exportReport}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </section>
          </>
        )}
      </motion.div>
    </DashboardLayout>
  );
};

function ReadinessCard({
  label,
  value,
  ready,
  icon: Icon,
}: {
  label: string;
  value: string;
  ready: boolean;
  icon: LucideIcon;
}) {
  return (
    <motion.div whileHover={{ y: -3 }} className="premium-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-primary">
          <Icon className="h-4 w-4" />
        </div>
        {ready ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <AlertCircle className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-extrabold">{value}</div>
    </motion.div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <motion.div whileHover={{ y: -3 }} className="premium-card min-h-36 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <Sparkles className="h-4 w-4 text-primary/70" />
      </div>
      <div className="mt-5 text-3xl font-extrabold">{value}</div>
      <div className="mt-1 text-sm font-semibold">{label}</div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
    </motion.div>
  );
}

function ChartCard({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="premium-card p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Icon className="h-5 w-5 text-primary" />
            {title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="h-72">{children}</div>
    </section>
  );
}

function LatestAssessment({
  test,
  score,
  answers,
}: {
  test: DepressionTest | null;
  score: number | null;
  answers: TextAnswer[];
}) {
  return (
    <section className="premium-card p-5 md:p-6">
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <Brain className="h-5 w-5 text-primary" />
        Latest Assessment Report
      </h2>
      {test ? (
        <div className="mt-5 grid gap-5 md:grid-cols-[11rem_minmax(0,1fr)] md:items-center">
          <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] p-3">
            <div
              className="flex h-full w-full items-center justify-center rounded-full p-3"
              style={{
                background: score === null ? "rgba(255,255,255,0.06)" : `conic-gradient(hsl(var(--primary)) ${score * 3.6}deg, rgba(255,255,255,0.1) 0deg)`,
              }}
            >
              <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-white/10 bg-[#0b111d] text-center">
                <div className="text-4xl font-extrabold gradient-text">{score ?? "--"}</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Score</div>
              </div>
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold">{wellnessLabel(score)}</div>
            <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(test.created_at)}</div>
            <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-muted-foreground">
              This report is currently based on {answers.length} questionnaire answers. Voice and video files are shown as capture readiness until the models are connected.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <StatusPill label={`Status: ${test.status}`} ready={test.status === "completed"} />
              <StatusPill label={test.voice_path ? "Voice captured" : "No voice"} ready={Boolean(test.voice_path)} />
              <StatusPill label={test.video_path ? "Video captured" : "No video"} ready={Boolean(test.video_path)} />
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={ClipboardList}
          title="No assessment report yet"
          description="Complete the depression test to create your first structured wellness report."
          actions={[{ to: "/test", label: "Start test" }]}
        />
      )}
    </section>
  );
}

function UnifiedTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <section className="premium-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <HistoryIcon className="h-5 w-5 text-primary" />
            Unified Wellness Timeline
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Mood logs, assessments, and therapy support activity appear together in one account timeline.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {items.length ? (
          items.map((item) => {
            const Icon = item.icon;
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold">{item.title}</div>
                    <div className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.detail}</div>
                    {item.meta && <div className="mt-1 text-xs font-semibold text-primary">{item.meta}</div>}
                  </div>
                </div>
                <div className="shrink-0 text-xs text-muted-foreground">{item.type === "mood" ? formatDate(item.date.slice(0, 10)) : formatDateTime(item.date)}</div>
              </motion.div>
            );
          })
        ) : (
          <EmptyState
            icon={HistoryIcon}
            title="No timeline activity yet"
            description="Your mood entries, test submissions, and support sessions will appear here after you start using MindSense."
            actions={[
              { to: "/mood", label: "Track mood" },
              { to: "/test", label: "Start test" },
            ]}
          />
        )}
      </div>
    </section>
  );
}

function MoodHistory({ entries }: { entries: MoodEntry[] }) {
  return (
    <section className="premium-card p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <TrendingUp className="h-5 w-5 text-primary" />
          Mood History
        </h2>
        <Link to="/mood" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
          Mood page <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mt-5 space-y-3">
        {entries.length ? (
          entries.map((entry) => {
            const meta = moodMeta(entry.mood);
            const Icon = meta.icon;
            return (
              <div key={entry.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 ${meta.bg} ${meta.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold">{meta.label}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {formatDate(entry.entry_date)}
                      {entry.note ? ` - ${entry.note}` : ""}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{entry.mood}/5</div>
              </div>
            );
          })
        ) : (
          <EmptyState icon={TrendingUp} title="No mood history yet" description="Use Mood Tracking to build a meaningful report." actions={[{ to: "/mood", label: "Track mood" }]} />
        )}
      </div>
    </section>
  );
}

function TestHistory({ tests }: { tests: DepressionTest[] }) {
  return (
    <section className="premium-card p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <ClipboardList className="h-5 w-5 text-primary" />
          Test History
        </h2>
        <Link to="/test" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
          Test page <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mt-5 space-y-3">
        {tests.length ? (
          tests.map((test) => {
            const score = getTestScore(test);
            return (
              <div key={test.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="min-w-0">
                  <div className="font-bold">{wellnessLabel(score)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(test.created_at)} - {getTextAnswers(test.text_answers).length} answers
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusPill label={test.voice_path ? "Voice" : "No voice"} ready={Boolean(test.voice_path)} />
                    <StatusPill label={test.video_path ? "Video" : "No video"} ready={Boolean(test.video_path)} />
                  </div>
                </div>
                <div className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{score ?? "--"}%</div>
              </div>
            );
          })
        ) : (
          <EmptyState icon={ClipboardList} title="No test submissions yet" description="Assessment reports will appear here after you complete the test." actions={[{ to: "/test", label: "Start test" }]} />
        )}
      </div>
    </section>
  );
}

function StatusPill({ label, ready }: { label: string; ready: boolean }) {
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${ready ? "border-primary/25 bg-primary/10 text-primary" : "border-white/10 bg-white/[0.04] text-muted-foreground"}`}>
      {label}
    </span>
  );
}

function EmptyChart({
  icon: Icon,
  message,
  to,
  action,
}: {
  icon: LucideIcon;
  message: string;
  to: string;
  action: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-center">
      <Icon className="h-8 w-8 text-primary" />
      <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">{message}</p>
      <Button asChild size="sm" className="premium-button mt-4">
        <Link to={to}>{action}</Link>
      </Button>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actions: { to: string; label: string }[];
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.035] p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-bold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {actions.map((action, index) => (
          <Button key={action.to} asChild size="sm" className={index === 0 ? "premium-button" : "rounded-full border-white/10 bg-white/[0.04]"} variant={index === 0 ? "default" : "outline"}>
            <Link to={action.to}>{action.label}</Link>
          </Button>
        ))}
      </div>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-72 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
        ))}
      </div>
    </div>
  );
}

export default History;
