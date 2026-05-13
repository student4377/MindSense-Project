import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  ClipboardList,
  HeartPulse,
  LineChart,
  Mail,
  ShieldCheck,
  User,
  type LucideIcon,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { updateHeaderProfileCache } from "@/lib/headerCache";

type ProfileRow = Tables<"profiles">;
type MoodEntry = Tables<"mood_entries">;
type DepressionTest = Tables<"depression_tests">;

type ProfileSummary = {
  moodCount: number;
  testCount: number;
  latestMood: MoodEntry | null;
  latestTest: DepressionTest | null;
};

const emptySummary: ProfileSummary = {
  moodCount: 0,
  testCount: 0,
  latestMood: null,
  latestTest: null,
};

const formatDate = (value?: string | null) => {
  if (!value) return "Not available";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const moodLabel = (value?: number | null) => {
  if (!value) return "No entry yet";
  if (value >= 5) return "Excellent";
  if (value >= 4) return "Good";
  if (value >= 3) return "Okay";
  if (value >= 2) return "Low";
  return "Very low";
};

const Profile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [summary, setSummary] = useState<ProfileSummary>(emptySummary);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadProfile = async () => {
      setLoading(true);
      const [profileResult, moodCountResult, testCountResult, latestMoodResult, latestTestResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("mood_entries").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("depression_tests").select("id", { count: "exact", head: true }).eq("user_id", user.id),
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
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (profileResult.error) {
        toast({ title: "Could not load profile", description: profileResult.error.message, variant: "destructive" });
      }
      if (moodCountResult.error) {
        toast({ title: "Could not load mood count", description: moodCountResult.error.message, variant: "destructive" });
      }
      if (testCountResult.error) {
        toast({ title: "Could not load test count", description: testCountResult.error.message, variant: "destructive" });
      }

      const profileData = (profileResult.data as ProfileRow | null) || null;
      setProfile(profileData);
      setName(profileData?.name || user.user_metadata?.name || user.email?.split("@")[0] || "");
      setSummary({
        moodCount: moodCountResult.count || 0,
        testCount: testCountResult.count || 0,
        latestMood: (latestMoodResult.data as MoodEntry | null) || null,
        latestTest: (latestTestResult.data as DepressionTest | null) || null,
      });
      setLoading(false);
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const displayName = profile?.name || name || user?.email?.split("@")[0] || "MindSense user";
  const initials = useMemo(() => {
    const source = displayName.trim() || user?.email || "U";
    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [displayName, user?.email]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);

    const payload: TablesInsert<"profiles"> = {
      id: user.id,
      email: user.email || null,
      name: name.trim() || null,
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
    updateHeaderProfileCache(user.id, savedProfile, savedName);
    toast({ title: "Profile updated", description: "Your account details were saved." });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-white to-sky-50 p-6 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground">
                {initials || "U"}
              </div>
              <div>
                <Badge variant="secondary" className="mb-2 gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Private account
                </Badge>
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{displayName}</h1>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  {user?.email || "No email connected"}
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-white/70 bg-white/80 px-4 py-3 text-sm text-muted-foreground shadow-sm">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <CalendarDays className="h-4 w-4 text-primary" />
                Member since
              </div>
              <div className="mt-1">{formatDate(profile?.created_at || user?.created_at)}</div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <User className="h-5 w-5 text-primary" />
                Profile Details
              </CardTitle>
              <CardDescription>Keep your basic account information clear and recognizable.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Full name</Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email">Email address</Label>
                <Input id="profile-email" value={user?.email || ""} disabled />
                <p className="text-xs text-muted-foreground">Email changes should be handled from account security settings.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={saveProfile} disabled={saving || loading}>
                  {saving ? "Saving..." : "Save Profile"}
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/settings">Open Settings</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <SummaryCard icon={LineChart} label="Mood entries" value={loading ? "..." : String(summary.moodCount)} />
            <SummaryCard icon={ClipboardList} label="Tests completed" value={loading ? "..." : String(summary.testCount)} />
            <SummaryCard icon={HeartPulse} label="Latest mood" value={loading ? "..." : moodLabel(summary.latestMood?.mood)} />
            <SummaryCard icon={Activity} label="Latest test" value={loading ? "..." : summary.latestTest ? summary.latestTest.status : "No test yet"} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <ActionPanel
            to="/mood"
            icon={LineChart}
            title="Mood tracking"
            description={`Last entry: ${formatDate(summary.latestMood?.entry_date)}`}
          />
          <ActionPanel
            to="/history"
            icon={Activity}
            title="History and reports"
            description="Review trends, exports, and assessment history."
          />
          <ActionPanel
            to="/test"
            icon={ClipboardList}
            title="Start assessment"
            description={`Last test: ${formatDate(summary.latestTest?.created_at)}`}
          />
        </div>
      </div>
    </DashboardLayout>
  );
};

type SummaryCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
};

const SummaryCard = ({ icon: Icon, label, value }: SummaryCardProps) => (
  <Card>
    <CardContent className="p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold capitalize">{value}</div>
    </CardContent>
  </Card>
);

type ActionPanelProps = {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
};

const ActionPanel = ({ to, icon: Icon, title, description }: ActionPanelProps) => (
  <Link to={to} className="group rounded-lg border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-md">
    <div className="flex items-start justify-between gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
    </div>
    <h2 className="mt-4 font-semibold">{title}</h2>
    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
  </Link>
);

export default Profile;
