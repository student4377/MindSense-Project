import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Bell,
  CheckCircle2,
  Database,
  Download,
  Eraser,
  FileText,
  KeyRound,
  LifeBuoy,
  Lock,
  LogOut,
  Mail,
  Moon,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Sun,
  type LucideIcon,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
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
type SupportActivity = Tables<"support_activity_history">;

const ASSISTANT_STORAGE_KEY = "mindsense-wellness-assistant-v1";

const isMissingSupportTableError = (message?: string) =>
  Boolean(message?.includes("schema cache") || message?.includes("does not exist"));

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

  const enabledPreferenceCount = useMemo(
    () => Object.values(preferences).filter(Boolean).length,
    [preferences],
  );

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

    const [profileResult, moodResult, testResult, supportResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase
        .from("mood_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("depression_tests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("support_activity_history").select("*").eq("user_id", user.id).order("completed_at", { ascending: false }),
    ]);

    setExporting(false);

    const firstError =
      profileResult.error ||
      moodResult.error ||
      testResult.error ||
      (supportResult.error && !isMissingSupportTableError(supportResult.error.message) ? supportResult.error : null);
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
        preferences,
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
        supportActivities: supportResult.error
          ? []
          : ((supportResult.data as SupportActivity[] | null) || []).map((activity) => ({
              id: activity.id,
              activityType: activity.activity_type,
              title: activity.title,
              durationSeconds: activity.duration_seconds,
              completedAt: activity.completed_at,
              metadata: activity.metadata,
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
    if (user?.id) localStorage.removeItem(`mindsense-dismissed-notifications-${user.id}`);
    toast({
      title: "Local browser data cleared",
      description: "Assistant chat, drafts, local streak cache, and dismissed header notices were removed from this browser.",
    });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/signin");
  };

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-5">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_16%_16%,hsl(var(--primary)/0.18),transparent_32%),radial-gradient(circle_at_88%_8%,rgba(167,139,250,0.18),transparent_28%),rgba(255,255,255,0.055)] p-5 shadow-[var(--shadow-card)] backdrop-blur-2xl md:p-7">
          <div className="premium-grid pointer-events-none absolute inset-0 opacity-25" />
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                <SettingsIcon className="h-4 w-4" />
                Account control
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-[0.95] tracking-normal md:text-6xl">
                Your workspace settings, tuned for privacy.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
                Manage appearance, browser memory, exports, and secure account access without leaving the MindSense dashboard.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button className="premium-button" asChild>
                  <Link to="/profile">
                    <ShieldCheck className="h-4 w-4" />
                    View Profile
                  </Link>
                </Button>
                <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={exportAccountData} disabled={exporting}>
                  <Download className="h-4 w-4" />
                  {exporting ? "Preparing..." : "Export Data"}
                </Button>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-black/10 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Current mode</div>
                  <div className="mt-1 text-2xl font-extrabold">{preferences.darkMode ? "Premium dark" : "Calm light"}</div>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  {preferences.darkMode ? <Moon className="h-6 w-6" /> : <Sun className="h-6 w-6" />}
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <SettingStat icon={Sparkles} label="Preferences" value={`${enabledPreferenceCount}/3`} />
                <SettingStat icon={Mail} label="Email" value={user?.email ? "Active" : "Missing"} />
                <SettingStat icon={Bell} label="Alerts" value="Header" />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="premium-card p-5 md:p-6">
            <SectionTitle icon={Sun} title="Appearance" description="Use a bright calm workspace or the deeper premium dark interface." />
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <ThemePreview
                active={!preferences.darkMode}
                icon={Sun}
                title="Calm light"
                description="A cleaner daylight workspace with softer contrast."
                onClick={() => setPreference("darkMode", false)}
              />
              <ThemePreview
                active={preferences.darkMode}
                icon={Moon}
                title="Premium dark"
                description="A focused dark mental wellness dashboard."
                onClick={() => setPreference("darkMode", true)}
              />
            </div>
          </div>

          <div className="premium-card p-5 md:p-6">
            <SectionTitle icon={ShieldCheck} title="Privacy Preferences" description="Browser-only settings that shape your local MindSense experience." />
            <div className="mt-5 space-y-3">
              <PreferenceRow
                icon={Moon}
                title="Premium dark mode"
                description="Turn off for the improved calm light interface."
                checked={preferences.darkMode}
                onCheckedChange={(checked) => setPreference("darkMode", checked)}
              />
              <PreferenceRow
                icon={Lock}
                title="Assistant memory"
                description="Keep wellness assistant chat history on this browser."
                checked={preferences.assistantMemory}
                onCheckedChange={(checked) => setPreference("assistantMemory", checked)}
              />
              <PreferenceRow
                icon={FileText}
                title="Mood draft saving"
                description="Keep unfinished mood notes locally until submitted."
                checked={preferences.moodDrafts}
                onCheckedChange={(checked) => setPreference("moodDrafts", checked)}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="premium-card p-5 md:p-6">
            <SectionTitle icon={KeyRound} title="Account Security" description="Manage secure access for the email connected to this account." />
            <div className="mt-5 space-y-3">
              <InfoRow icon={Mail} title="Signed in as" description={user?.email || "No email available"} />
              <ActionButton icon={KeyRound} label={resetSending ? "Sending reset link..." : "Send Password Reset Email"} onClick={sendPasswordReset} disabled={resetSending || !user?.email} />
              <ActionButton icon={LogOut} label="Sign Out" onClick={handleSignOut} variant="outline" />
            </div>
          </div>

          <div className="premium-card p-5 md:p-6">
            <SectionTitle icon={Database} title="Data Management" description="Download account records or clear browser-only wellness data." />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <ActionPanel
                icon={Download}
                title="Export account data"
                description="Includes profile, mood logs, assessments, preferences, and support sessions."
                action={exporting ? "Preparing export..." : "Download JSON"}
                onClick={exportAccountData}
                disabled={exporting}
              />
              <ActionPanel
                icon={Eraser}
                title="Clear browser data"
                description="Removes local assistant memory, mood draft, and dismissed notification state."
                action="Clear local data"
                onClick={clearLocalData}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <div className="premium-card p-5 md:p-6">
            <SectionTitle icon={Bell} title="Notification Center" description="Header reminders are generated from real profile, mood, and assessment signals." />
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-bold">Clean header alerts</div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Use the bell menu to open reminders and mark them read. Clearing browser data resets dismissed local notices.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="premium-card p-5 md:p-6">
            <SectionTitle icon={LifeBuoy} title="Support & Account Requests" description="Sensitive account requests should go through support review." />
            <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-6 text-foreground">
              MindSense stores assessment and mood data in your protected account. For permanent account deletion, request a manual review before records are removed.
            </div>
            <Button className="premium-button mt-4 w-full" asChild>
              <Link to="/contact">
                <LifeBuoy className="h-4 w-4" />
                Contact Support
              </Link>
            </Button>
          </div>
        </section>
      </motion.div>
    </DashboardLayout>
  );
};

function SectionTitle({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <Icon className="h-5 w-5 text-primary" />
        {title}
      </h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function SettingStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <Icon className="h-4 w-4 text-primary" />
      <div className="mt-2 text-sm font-extrabold">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function ThemePreview({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-2xl border p-4 text-left transition ${
        active ? "border-primary/45 bg-primary/10 shadow-[var(--shadow-glow)]" : "border-white/10 bg-white/[0.04] hover:border-primary/30 hover:bg-white/[0.07]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        {active && <CheckCircle2 className="h-5 w-5 text-primary" />}
      </div>
      <div className="mt-4 font-bold">{title}</div>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
    </button>
  );
}

type PreferenceRowProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

function PreferenceRow({ icon: Icon, title, description, checked, onCheckedChange }: PreferenceRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex min-w-0 gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <Label className="font-bold">{title}</Label>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title} />
    </div>
  );
}

function InfoRow({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
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

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  variant = "outline",
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "outline" | "default";
}) {
  return (
    <Button className="w-full justify-start rounded-full border-white/10 bg-white/[0.04]" variant={variant} onClick={onClick} disabled={disabled}>
      <Icon className="h-4 w-4" />
      {label}
    </Button>
  );
}

function ActionPanel({
  icon: Icon,
  title,
  description,
  action,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-primary/35 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-70"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 font-bold">{title}</div>
      <p className="mt-1 min-h-16 text-sm leading-6 text-muted-foreground">{description}</p>
      <div className="mt-3 text-sm font-bold text-primary">{action}</div>
    </button>
  );
}

export default Settings;
