import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Brain,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  History,
  KeyRound,
  LineChart,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { normalizeName, validateName } from "@/lib/authValidation";
import { updateHeaderProfileCache } from "@/lib/headerCache";

type ProfileRow = Tables<"profiles">;
type MoodEntry = Tables<"mood_entries">;
type DepressionTest = Tables<"depression_tests">;
type SupportActivity = Tables<"support_activity_history">;
type MeditationStreak = Tables<"meditation_streaks">;

type ProfileSummary = {
  moodCount: number;
  testCount: number;
  supportCount: number;
  latestMood: MoodEntry | null;
  latestTest: DepressionTest | null;
  latestSupport: SupportActivity | null;
  meditationStreak: MeditationStreak | null;
};

type ActivityItem = {
  label: string;
  detail: string;
  date: string;
  icon: LucideIcon;
};

const emptySummary: ProfileSummary = {
  moodCount: 0,
  testCount: 0,
  supportCount: 0,
  latestMood: null,
  latestTest: null,
  latestSupport: null,
  meditationStreak: null,
};

const isMissingSupportTableError = (message?: string) =>
  Boolean(message?.includes("schema cache") || message?.includes("does not exist"));

const formatDate = (value?: string | null) => {
  if (!value) return "Not available";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "Not available";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getTextAnswers = (value: DepressionTest["text_answers"]) => (Array.isArray(value) ? value : []);

const getTestScore = (test?: DepressionTest | null) => {
  if (!test) return null;
  const answers = getTextAnswers(test.text_answers)
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const score = Number((item as Record<string, unknown>).score);
      return Number.isFinite(score) ? score : null;
    })
    .filter((score): score is number => typeof score === "number");

  if (!answers.length) return null;
  const average = answers.reduce((sum, score) => sum + score, 0) / answers.length;
  return Math.max(0, Math.min(100, Math.round(((5 - average) / 4) * 100)));
};

const moodLabel = (value?: number | null) => {
  if (!value) return "No mood yet";
  if (value >= 5) return "Amazing";
  if (value >= 4) return "Good";
  if (value >= 3) return "Neutral";
  if (value >= 2) return "Low";
  return "Drained";
};

const testLabel = (score: number | null) => {
  if (score === null) return "No score yet";
  if (score >= 75) return "Balanced";
  if (score >= 55) return "Mostly steady";
  if (score >= 35) return "Needs care";
  return "Needs support";
};

const Profile = () => {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [summary, setSummary] = useState<ProfileSummary>(emptySummary);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const [profileResult, moodCountResult, testCountResult, latestMoodResult, latestTestResult, supportCountResult, latestSupportResult, streakResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("mood_entries").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("depression_tests").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "completed"),
      supabase
        .from("mood_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("depression_tests")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("support_activity_history").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase
        .from("support_activity_history")
        .select("*")
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("meditation_streaks").select("*").eq("user_id", user.id).maybeSingle(),
    ]);

    if (profileResult.error) {
      toast({ title: "Could not load profile", description: profileResult.error.message, variant: "destructive" });
    }
    if (moodCountResult.error) {
      toast({ title: "Could not load mood count", description: moodCountResult.error.message, variant: "destructive" });
    }
    if (testCountResult.error) {
      toast({ title: "Could not load test count", description: testCountResult.error.message, variant: "destructive" });
    }
    if (supportCountResult.error && !isMissingSupportTableError(supportCountResult.error.message)) {
      toast({ title: "Could not load support count", description: supportCountResult.error.message, variant: "destructive" });
    }
    if (latestSupportResult.error && !isMissingSupportTableError(latestSupportResult.error.message)) {
      toast({ title: "Could not load support activity", description: latestSupportResult.error.message, variant: "destructive" });
    }
    if (streakResult.error && !isMissingSupportTableError(streakResult.error.message)) {
      toast({ title: "Could not load meditation streak", description: streakResult.error.message, variant: "destructive" });
    }

    const profileData = (profileResult.data as ProfileRow | null) ?? null;
    const metadataName = typeof user.user_metadata?.name === "string" ? user.user_metadata.name : "";

    setProfile(profileData);
    setName(profileData?.name || metadataName);
    setNameError("");
    setSummary({
      moodCount: moodCountResult.count ?? 0,
      testCount: testCountResult.count ?? 0,
      supportCount: supportCountResult.error ? 0 : supportCountResult.count ?? 0,
      latestMood: (latestMoodResult.data as MoodEntry | null) ?? null,
      latestTest: (latestTestResult.data as DepressionTest | null) ?? null,
      latestSupport: latestSupportResult.error ? null : (latestSupportResult.data as SupportActivity | null) ?? null,
      meditationStreak: streakResult.error ? null : (streakResult.data as MeditationStreak | null) ?? null,
    });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading) void loadProfile();
  }, [authLoading, loadProfile]);

  const savedProfileName = normalizeName(profile?.name || "");
  const displayName = savedProfileName || user?.email?.split("@")[0] || "MindSense user";
  const initials = useMemo(() => {
    const source = displayName.trim() || user?.email || "U";
    return (
      source
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "U"
    );
  }, [displayName, user?.email]);

  const latestScore = getTestScore(summary.latestTest);
  const lastActivity = useMemo(() => {
    const items: ActivityItem[] = [];
    if (summary.latestMood) {
      items.push({
        label: `${moodLabel(summary.latestMood.mood)} mood`,
        detail: `Mood signal ${summary.latestMood.mood}/5`,
        date: summary.latestMood.created_at || `${summary.latestMood.entry_date}T12:00:00`,
        icon: LineChart,
      });
    }
    if (summary.latestTest) {
      items.push({
        label: `${testLabel(latestScore)} assessment`,
        detail: latestScore === null ? "Text score unavailable" : `${latestScore}% text-based score`,
        date: summary.latestTest.created_at,
        icon: ClipboardList,
      });
    }
    if (summary.latestSupport) {
      items.push({
        label: summary.latestSupport.title,
        detail: `${summary.latestSupport.activity_type} support activity`,
        date: summary.latestSupport.completed_at,
        icon: HeartPulse,
      });
    }
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);
  }, [latestScore, summary.latestMood, summary.latestSupport, summary.latestTest]);

  const completionScore = useMemo(() => {
    const checks = [
      Boolean(savedProfileName),
      Boolean(user?.email),
      summary.moodCount > 0,
      summary.testCount > 0,
      summary.supportCount > 0 || Boolean(summary.meditationStreak?.completed_sessions),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [savedProfileName, summary.meditationStreak?.completed_sessions, summary.moodCount, summary.supportCount, summary.testCount, user?.email]);

  const readiness = [
    { label: "Profile name", value: savedProfileName ? "Added" : "Missing", ready: Boolean(savedProfileName), icon: UserRound },
    { label: "Email", value: user?.email ? "Connected" : "Missing", ready: Boolean(user?.email), icon: Mail },
    { label: "Mood data", value: summary.moodCount ? `${summary.moodCount} entries` : "Not started", ready: summary.moodCount > 0, icon: TrendingUp },
    { label: "Assessment", value: summary.testCount ? `${summary.testCount} complete` : "No test yet", ready: summary.testCount > 0, icon: ClipboardList },
    { label: "Support", value: summary.supportCount ? `${summary.supportCount} sessions` : "No sessions", ready: summary.supportCount > 0, icon: HeartPulse },
  ];

  const saveProfile = async () => {
    if (!user) return;
    const nextName = normalizeName(name);
    const validation = validateName(nextName);
    setNameError(validation);
    if (validation) {
      toast({ title: "Check your name", description: validation, variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload: TablesInsert<"profiles"> = {
      id: user.id,
      email: user.email || null,
      name: nextName,
    };

    const { data, error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" }).select("*").single();
    setSaving(false);

    if (error) {
      toast({ title: "Profile update failed", description: error.message, variant: "destructive" });
      return;
    }

    const savedProfile = data as ProfileRow;
    const savedName = savedProfile.name || user.email?.split("@")[0] || "User";

    setProfile(savedProfile);
    setName(savedProfile.name || "");
    setNameError("");
    updateHeaderProfileCache(user.id, savedProfile, savedName);
    toast({ title: "Profile updated", description: "Your account details were saved." });
  };

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-5">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_18%_16%,hsl(var(--primary)/0.18),transparent_32%),radial-gradient(circle_at_88%_8%,rgba(167,139,250,0.18),transparent_28%),rgba(255,255,255,0.055)] p-5 shadow-[var(--shadow-card)] backdrop-blur-2xl md:p-7">
          <div className="premium-grid pointer-events-none absolute inset-0 opacity-25" />
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                <ShieldCheck className="h-4 w-4" />
                Private account
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-[0.95] tracking-normal md:text-6xl">
                Your MindSense profile, centered around you.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
                Manage your identity, check account readiness, and jump back into your mood, reports, and support tools from one premium workspace.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button className="premium-button" onClick={saveProfile} disabled={saving || loading}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4" />}
                  {saving ? "Saving..." : "Save profile"}
                </Button>
                <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={() => void loadProfile()} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh
                </Button>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-black/15 p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-primary via-sky-400 to-violet-400 text-2xl font-extrabold text-slate-950 shadow-[var(--shadow-glow)]">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-2xl font-extrabold">{displayName}</div>
                  <div className="mt-1 flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="truncate">{user?.email || "No email connected"}</span>
                  </div>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <ProfileMiniStat icon={CalendarDays} label="Member since" value={formatDate(profile?.created_at || user?.created_at)} />
                <ProfileMiniStat icon={ShieldCheck} label="Email status" value={user?.email_confirmed_at ? "Verified" : "Active"} />
                <ProfileMiniStat icon={KeyRound} label="Last sign in" value={formatDate(user?.last_sign_in_at)} />
                <ProfileMiniStat icon={Sparkles} label="Profile ready" value={`${completionScore}%`} />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Sparkles} label="Profile readiness" value={`${completionScore}%`} detail="Based on identity and real wellness activity." />
          <MetricCard icon={LineChart} label="Mood entries" value={loading ? "..." : String(summary.moodCount)} detail={summary.latestMood ? `Latest: ${moodLabel(summary.latestMood.mood)}` : "No mood data yet."} />
          <MetricCard icon={ClipboardList} label="Assessments" value={loading ? "..." : String(summary.testCount)} detail={summary.latestTest ? `${testLabel(latestScore)} report` : "No completed test yet."} />
          <MetricCard icon={HeartPulse} label="Support sessions" value={loading ? "..." : String(summary.supportCount)} detail={summary.meditationStreak ? `${summary.meditationStreak.streak_count} day meditation streak` : "No support activity yet."} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
          <div className="premium-card p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold">
                  <UserRound className="h-5 w-5 text-primary" />
                  Profile Details
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Keep your visible account name clean and recognizable across MindSense.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Full name</Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (nameError) setNameError(validateName(event.target.value));
                  }}
                  onBlur={() => setNameError(validateName(name))}
                  placeholder="Enter your name"
                  aria-invalid={Boolean(nameError)}
                  aria-describedby={nameError ? "profile-name-error" : undefined}
                  className={`h-12 rounded-2xl border-white/10 bg-background/80 ${nameError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                {nameError ? <p id="profile-name-error" className="text-xs text-destructive">{nameError}</p> : <p className="text-xs text-muted-foreground">Use letters and spaces only.</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-email">Email address</Label>
                <Input id="profile-email" value={user?.email || ""} disabled className="h-12 rounded-2xl border-white/10 bg-background/50" />
                <p className="text-xs text-muted-foreground">Email changes are handled from account security settings.</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button className="premium-button" onClick={saveProfile} disabled={saving || loading}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {saving ? "Saving..." : "Save changes"}
              </Button>
              <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" asChild>
                <Link to="/settings">
                  <Settings className="h-4 w-4" />
                  Open settings
                </Link>
              </Button>
            </div>
          </div>

          <div className="premium-card p-5 md:p-6">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Lock className="h-5 w-5 text-primary" />
              Account Access
            </h2>
            <div className="mt-5 space-y-3">
              <AccessRow icon={Mail} title="Signed-in email" description={user?.email || "No email available"} />
              <AccessRow icon={ShieldCheck} title="Data ownership" description="Mood, reports, and support records are scoped to your account." />
              <AccessRow icon={KeyRound} title="Password reset" description="Managed securely from Settings." />
            </div>
            <Button asChild className="premium-button mt-5 w-full">
              <Link to="/settings">
                Manage account security
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {readiness.map((item) => (
            <ReadinessCard key={item.label} {...item} />
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="premium-card p-5 md:p-6">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Activity className="h-5 w-5 text-primary" />
              Recent Account Activity
            </h2>
            <div className="mt-5 space-y-3">
              {lastActivity.length ? (
                lastActivity.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={`${item.label}-${item.date}`} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold">{item.label}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{item.detail}</div>
                        <div className="mt-1 text-xs text-primary">{formatDateTime(item.date)}</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyPanel
                  icon={Activity}
                  title="No profile activity yet"
                  description="Mood entries, completed assessments, and support sessions will appear here."
                  to="/mood"
                  action="Start with mood"
                />
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ActionPanel to="/mood" icon={LineChart} title="Mood tracking" description={summary.latestMood ? `Last mood: ${moodLabel(summary.latestMood.mood)}` : "Create your first mood entry."} />
            <ActionPanel to="/test" icon={ClipboardList} title="Depression test" description={summary.latestTest ? `Latest score: ${latestScore ?? "--"}%` : "Complete the questionnaire report."} />
            <ActionPanel to="/history" icon={History} title="History & reports" description="Review trends, timelines, and exports." />
            <ActionPanel to="/therapy" icon={HeartPulse} title="Therapy support" description={summary.latestSupport ? `Latest: ${summary.latestSupport.activity_type}` : "Open calming support tools."} />
          </div>
        </section>
      </motion.div>
    </DashboardLayout>
  );
};

function ProfileMiniStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-bold">{value}</div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
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

function AccessRow({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="font-bold">{title}</div>
        <div className="mt-1 break-words text-sm leading-5 text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}

function ReadinessCard({ label, value, ready, icon: Icon }: { label: string; value: string; ready: boolean; icon: LucideIcon }) {
  return (
    <motion.div whileHover={{ y: -3 }} className="premium-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-primary">
          <Icon className="h-4 w-4" />
        </div>
        {ready ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <Activity className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-extrabold">{value}</div>
    </motion.div>
  );
}

function ActionPanel({ to, icon: Icon, title, description }: { to: string; icon: LucideIcon; title: string; description: string }) {
  return (
    <Link to={to} className="group premium-card min-h-40 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
      </div>
      <h2 className="mt-5 text-lg font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </Link>
  );
}

function EmptyPanel({ icon: Icon, title, description, to, action }: { icon: LucideIcon; title: string; description: string; to: string; action: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.035] p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-bold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      <Button asChild size="sm" className="premium-button mt-5">
        <Link to={to}>{action}</Link>
      </Button>
    </div>
  );
}

export default Profile;
