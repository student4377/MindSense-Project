import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Award,
  Calendar,
  ClipboardList,
  Download,
  FileText,
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
type TextAnswer = {
  question: string;
  answer: string;
  score: number;
};

const moodMeta = (value: number) => {
  if (value >= 5) return { label: "Excellent", emoji: "😁", color: "text-sky-600" };
  if (value >= 4) return { label: "Good", emoji: "😊", color: "text-emerald-600" };
  if (value >= 3) return { label: "Okay", emoji: "😐", color: "text-amber-600" };
  if (value >= 2) return { label: "Low", emoji: "😟", color: "text-orange-600" };
  return { label: "Very Low", emoji: "😢", color: "text-rose-600" };
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

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
  const average = answers.reduce((sum, answer) => sum + answer.score, 0) / answers.length;
  return Math.round(((5 - average) / 4) * 100);
};

const wellnessLabel = (score: number | null) => {
  if (score === null) return "Awaiting data";
  if (score >= 75) return "Balanced";
  if (score >= 50) return "Mostly steady";
  if (score >= 30) return "Needs care";
  return "Reach out";
};

const average = (values: number[]) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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
  const { user } = useAuth();
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [tests, setTests] = useState<DepressionTest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadReports = async () => {
      setLoading(true);
      const [moodResult, testResult] = await Promise.all([
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
      ]);

      if (cancelled) return;

      if (moodResult.error) {
        toast({ title: "Could not load mood history", description: moodResult.error.message, variant: "destructive" });
      }
      if (testResult.error) {
        toast({ title: "Could not load test history", description: testResult.error.message, variant: "destructive" });
      }

      setMoods((moodResult.data as MoodEntry[] | null) || []);
      setTests((testResult.data as DepressionTest[] | null) || []);
      setLoading(false);
    };

    loadReports();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const latestTest = tests[0] ?? null;
  const latestScore = getTestScore(latestTest);
  const latestAnswers = latestTest ? getTextAnswers(latestTest.text_answers) : [];
  const sortedMoods = useMemo(
    () => [...moods].sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()),
    [moods],
  );

  const stats = useMemo(() => {
    const uniqueDays = new Set(moods.map((entry) => entry.entry_date));
    const avgMood = average(moods.map((entry) => entry.mood));
    const recent = sortedMoods.slice(-7);
    const previous = sortedMoods.slice(-14, -7);
    const recentAvg = average(recent.map((entry) => entry.mood));
    const previousAvg = average(previous.map((entry) => entry.mood));
    const improvement = previousAvg ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0;

    return {
      totalTests: tests.length,
      avgMood,
      trackedDays: uniqueDays.size,
      improvement,
    };
  }, [moods, sortedMoods, tests.length]);

  const moodTrend = useMemo(() => {
    const grouped = new Map<string, number[]>();
    sortedMoods.forEach((entry) => {
      const current = grouped.get(entry.entry_date) || [];
      current.push(entry.mood);
      grouped.set(entry.entry_date, current);
    });

    return Array.from(grouped.entries())
      .slice(-30)
      .map(([date, values]) => ({
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        mood: Number(average(values).toFixed(2)),
      }));
  }, [sortedMoods]);

  const weeklyStats = useMemo(() => {
    const recent = sortedMoods.slice(-28);
    return [0, 1, 2, 3].map((weekIndex) => {
      const week = recent.slice(weekIndex * 7, weekIndex * 7 + 7);
      return {
        week: `Week ${weekIndex + 1}`,
        mood: Number(average(week.map((entry) => entry.mood)).toFixed(2)),
      };
    });
  }, [sortedMoods]);

  const scoreAnalysis = useMemo(() => {
    const avgMoodPercent = Math.round(stats.avgMood * 20);
    const avgSleep = Math.round(average(moods.map((entry) => entry.sleep_quality ?? 0).filter(Boolean)) * 10);
    const avgEnergy = Math.round(average(moods.map((entry) => entry.energy ?? 0).filter(Boolean)) * 10);

    return [
      { label: "Mood", value: avgMoodPercent, color: "bg-emerald-500" },
      { label: "Sleep", value: avgSleep, color: "bg-violet-500" },
      { label: "Energy", value: avgEnergy, color: "bg-sky-500" },
      { label: "Latest test", value: latestScore ?? 0, color: "bg-amber-500" },
    ];
  }, [latestScore, moods, stats.avgMood]);

  const recentMoods = moods.slice(0, 8);

  const exportReport = () => {
    if (!moods.length && !tests.length) {
      toast({ title: "No report data yet", description: "Add mood entries or complete a test before exporting." });
      return;
    }

    const rows = [
      ["section", "date", "title", "value", "details"],
      ...moods.map((entry) => [
        "mood",
        entry.entry_date,
        moodMeta(entry.mood).label,
        String(entry.mood),
        `note=${entry.note || ""}; tags=${(entry.tags || []).join("|")}; energy=${entry.energy ?? ""}; sleep=${entry.sleep_quality ?? ""}`,
      ]),
      ...tests.map((test) => {
        const score = getTestScore(test);
        return [
          "test",
          test.created_at,
          wellnessLabel(score),
          score === null ? "" : String(score),
          `status=${test.status}; text_answers=${getTextAnswers(test.text_answers).length}; voice=${test.voice_path ? "yes" : "no"}; video=${test.video_path ? "yes" : "no"}`,
        ];
      }),
    ];

    downloadCsv(rows, `mindsense-report-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">History & Reports</h1>
          <p className="mt-1 text-muted-foreground">
            Real analytics from your mood logs and depression test submissions.
          </p>
        </div>
        <Button variant="outline" onClick={exportReport} className="gap-2">
          <Download className="h-4 w-4" /> Export Report
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ClipboardList} title={String(stats.totalTests)} subtitle="Completed tests" bg="bg-emerald-50" color="text-emerald-600" />
        <StatCard icon={TrendingUp} title={stats.avgMood ? stats.avgMood.toFixed(1) : "-"} subtitle="Average mood" bg="bg-violet-50" color="text-violet-600" />
        <StatCard icon={Calendar} title={String(stats.trackedDays)} subtitle="Days tracked" bg="bg-sky-50" color="text-sky-600" />
        <StatCard icon={Award} title={`${stats.improvement >= 0 ? "+" : ""}${stats.improvement.toFixed(0)}%`} subtitle="Recent change" bg="bg-amber-50" color="text-amber-600" />
      </div>

      {loading ? (
        <div className="mt-6 grid gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <h2 className="font-bold text-lg">Latest Test Report</h2>
              {latestTest ? (
                <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
                  <div className="relative h-40 w-40 shrink-0">
                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                      <circle cx="50" cy="50" r="42" stroke="hsl(var(--muted))" strokeWidth="10" fill="none" />
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        stroke="hsl(var(--primary))"
                        strokeWidth="10"
                        fill="none"
                        strokeDasharray={`${((latestScore ?? 0) / 100) * 264} 264`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-3xl font-bold">{latestScore ?? "-"}</div>
                      <div className="text-xs text-muted-foreground">Wellness score</div>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{wellnessLabel(latestScore)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(latestTest.created_at)}</div>
                    <div className="mt-3 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                      Based on {latestAnswers.length} text answers. Voice/video are saved as capture data and can be analyzed when your model is added later.
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      <Badge label={`Status: ${latestTest.status}`} />
                      <Badge label={latestTest.voice_path ? "Voice captured" : "No voice"} />
                      <Badge label={latestTest.video_path ? "Video captured" : "No video"} />
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No test reports yet"
                  description="Complete a depression test to see your latest wellness score here."
                  to="/test"
                  action="Start test"
                />
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <h2 className="font-bold text-lg">Score Analysis</h2>
              <div className="mt-4 space-y-4">
                {scoreAnalysis.map((item) => (
                  <div key={item.label}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium">{item.label}</span>
                      <span className="text-muted-foreground">{item.value || 0}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full ${item.color} transition-all duration-500`} style={{ width: `${item.value || 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg">Mood Trend</h2>
                <Link to="/mood" className="text-sm font-medium text-primary">View mood page</Link>
              </div>
              <div className="mt-4 h-64">
                {moodTrend.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={moodTrend}>
                      <defs>
                        <linearGradient id="moodTrend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis domain={[1, 5]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip />
                      <Area type="monotone" dataKey="mood" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#moodTrend)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart message="Add mood entries to see your trend." />
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <h2 className="font-bold text-lg">Weekly Mood Averages</h2>
              <div className="mt-4 h-64">
                {moods.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                      <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis domain={[1, 5]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="mood" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart message="Weekly averages appear after mood tracking starts." />
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <h2 className="font-bold text-lg">Recent Mood History</h2>
              <div className="mt-4 divide-y divide-border">
                {recentMoods.length ? (
                  recentMoods.map((entry) => {
                    const meta = moodMeta(entry.mood);
                    return (
                      <div key={entry.id} className="flex items-center justify-between py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="text-2xl">{meta.emoji}</div>
                          <div className="min-w-0">
                            <div className={`font-medium text-sm ${meta.color}`}>{meta.label}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {formatDate(entry.entry_date)}{entry.note ? ` • ${entry.note}` : ""}
                            </div>
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-primary">{entry.mood}/5</div>
                      </div>
                    );
                  })
                ) : (
                  <EmptyState
                    title="No mood history yet"
                    description="Use Mood Tracking to start building a useful report."
                    to="/mood"
                    action="Track mood"
                  />
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <h2 className="font-bold text-lg">Test Submission History</h2>
              <div className="mt-4 divide-y divide-border">
                {tests.length ? (
                  tests.slice(0, 8).map((test) => {
                    const score = getTestScore(test);
                    return (
                      <div key={test.id} className="flex items-center justify-between gap-4 py-3">
                        <div className="min-w-0">
                          <div className="font-medium text-sm">{wellnessLabel(score)}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateTime(test.created_at)} • {getTextAnswers(test.text_answers).length} answers
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-primary">{score ?? "-"}%</div>
                      </div>
                    );
                  })
                ) : (
                  <EmptyState
                    title="No test submissions yet"
                    description="Test reports will appear after you complete the assessment."
                    to="/test"
                    action="Start test"
                  />
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
};

type StatCardProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  bg: string;
  color: string;
};

const StatCard = ({ icon: Icon, title, subtitle, bg, color }: StatCardProps) => (
  <div className={`rounded-2xl border border-border ${bg} p-5 hover:shadow-[var(--shadow-soft)] hover:-translate-y-0.5 transition`}>
    <div className="flex items-start gap-3">
      <div className={`h-12 w-12 rounded-xl bg-white flex items-center justify-center ${color}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <div className="text-2xl font-bold">{title}</div>
        <div className="text-sm font-medium">{subtitle}</div>
      </div>
    </div>
  </div>
);

const Badge = ({ label }: { label: string }) => (
  <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">{label}</span>
);

const EmptyChart = ({ message }: { message: string }) => (
  <div className="flex h-full items-center justify-center rounded-xl bg-muted/50 text-center text-sm text-muted-foreground">
    {message}
  </div>
);

const EmptyState = ({
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
  <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
    <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
    <h3 className="mt-3 font-semibold">{title}</h3>
    <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    <Button asChild size="sm" className="mt-4">
      <Link to={to}>{action}</Link>
    </Button>
  </div>
);

export default History;
