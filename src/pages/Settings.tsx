import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Database,
  Download,
  Eraser,
  FileText,
  KeyRound,
  LifeBuoy,
  Lock,
  LogOut,
  Moon,
  Settings as SettingsIcon,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  applyMindSensePreferences,
  readMindSensePreferences,
  saveMindSensePreferences,
  type MindSensePreferences,
} from "@/lib/preferences";

type ProfileRow = Tables<"profiles">;
type MoodEntry = Tables<"mood_entries">;
type DepressionTest = Tables<"depression_tests">;

const ASSISTANT_STORAGE_KEY = "mindsense-wellness-assistant-v1";

const downloadJson = (payload: unknown, filename: string) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const Settings = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState<MindSensePreferences>(() => readMindSensePreferences());
  const [exporting, setExporting] = useState(false);
  const [resetSending, setResetSending] = useState(false);

  useEffect(() => {
    applyMindSensePreferences(preferences);
  }, [preferences]);

  const setPreference = (key: keyof MindSensePreferences, value: boolean) => {
    setPreferences((current) => {
      const next = { ...current, [key]: value };
      saveMindSensePreferences(next);
      applyMindSensePreferences(next);
      return next;
    });
  };

  const exportAccountData = async () => {
    if (!user) return;
    setExporting(true);

    const [profileResult, moodResult, testResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase
        .from("mood_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("depression_tests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);

    setExporting(false);

    const firstError = profileResult.error || moodResult.error || testResult.error;
    if (firstError) {
      toast({ title: "Export failed", description: firstError.message, variant: "destructive" });
      return;
    }

    downloadJson(
      {
        exportedAt: new Date().toISOString(),
        account: {
          id: user.id,
          email: user.email,
          createdAt: user.created_at,
        },
        profile: (profileResult.data as ProfileRow | null) || null,
        moodEntries: ((moodResult.data as MoodEntry[] | null) || []).map((entry) => ({
          id: entry.id,
          mood: entry.mood,
          note: entry.note,
          tags: entry.tags,
          energy: entry.energy,
          sleepQuality: entry.sleep_quality,
          entryDate: entry.entry_date,
          createdAt: entry.created_at,
        })),
        testSubmissions: ((testResult.data as DepressionTest[] | null) || []).map((test) => ({
          id: test.id,
          status: test.status,
          textAnswers: test.text_answers,
          voicePath: test.voice_path,
          videoPath: test.video_path,
          createdAt: test.created_at,
        })),
      },
      `mindsense-account-data-${new Date().toISOString().slice(0, 10)}.json`,
    );

    toast({ title: "Export ready", description: "Your MindSense data has been downloaded as JSON." });
  };

  const sendPasswordReset = async () => {
    if (!user?.email) return;
    setResetSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetSending(false);

    if (error) {
      toast({ title: "Password reset failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Password reset email sent", description: "Check your inbox for the reset link." });
  };

  const clearLocalData = () => {
    localStorage.removeItem(ASSISTANT_STORAGE_KEY);
    localStorage.removeItem("mood-draft");
    localStorage.removeItem("med_streak");
    toast({ title: "Local wellness data cleared", description: "Assistant chat, mood draft, and meditation streak were removed from this browser." });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/signin");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-white to-violet-50 p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <Badge variant="secondary" className="mb-3 gap-1">
                <SettingsIcon className="h-3.5 w-3.5" />
                Account control
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Settings</h1>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                Manage privacy, browser preferences, exports, and account security from one place.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/profile">View Profile</Link>
            </Button>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Privacy Preferences
              </CardTitle>
              <CardDescription>These choices are saved on this browser for your wellness workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <PreferenceRow
                icon={Moon}
                title="Dark mode"
                description="Use a calmer dark interface across the dashboard."
                checked={preferences.darkMode}
                onCheckedChange={(checked) => setPreference("darkMode", checked)}
              />
              <PreferenceRow
                icon={Lock}
                title="Assistant memory"
                description="Save assistant chat history on this browser between sessions."
                checked={preferences.assistantMemory}
                onCheckedChange={(checked) => setPreference("assistantMemory", checked)}
              />
              <PreferenceRow
                icon={FileText}
                title="Mood draft saving"
                description="Keep unfinished mood notes on this browser until you submit them."
                checked={preferences.moodDrafts}
                onCheckedChange={(checked) => setPreference("moodDrafts", checked)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <KeyRound className="h-5 w-5 text-primary" />
                Account Security
              </CardTitle>
              <CardDescription>Use the same email you signed in with to manage secure access.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border bg-secondary/50 p-4 text-sm">
                <div className="font-medium">Signed in as</div>
                <div className="mt-1 break-all text-muted-foreground">{user?.email || "No email available"}</div>
              </div>
              <Button className="w-full justify-start" variant="outline" onClick={sendPasswordReset} disabled={resetSending || !user?.email}>
                <KeyRound className="h-4 w-4" />
                {resetSending ? "Sending reset link..." : "Send Password Reset Email"}
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Database className="h-5 w-5 text-primary" />
                Data Management
              </CardTitle>
              <CardDescription>Download your wellness records or remove local browser-only data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full justify-start" onClick={exportAccountData} disabled={exporting}>
                <Download className="h-4 w-4" />
                {exporting ? "Preparing export..." : "Export Account Data"}
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={clearLocalData}>
                <Eraser className="h-4 w-4" />
                Clear Local Assistant Data
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <LifeBuoy className="h-5 w-5 text-primary" />
                Support
              </CardTitle>
              <CardDescription>Profile deletion and sensitive account requests should go through support.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                MindSense stores assessment and mood data in your protected account. For permanent account deletion,
                request a manual review before records are removed.
              </div>
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link to="/contact">
                  <LifeBuoy className="h-4 w-4" />
                  Contact Support
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

type PreferenceRowProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

const PreferenceRow = ({ icon: Icon, title, description, checked, onCheckedChange }: PreferenceRowProps) => (
  <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
    <div className="flex min-w-0 gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <Label className="font-medium">{title}</Label>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
    <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title} />
  </div>
);

export default Settings;
