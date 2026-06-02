import { ReactNode, useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Brain,
  LayoutDashboard,
  ClipboardList,
  HeartHandshake,
  LineChart,
  History,
  BookOpen,
  User,
  Settings,
  LogOut,
  Search,
  Bell,
  Headphones,
  Menu,
  X,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  HEADER_CACHE_UPDATED_EVENT,
  readHeaderCache,
  todayKey,
  writeHeaderCache,
  type HeaderCache,
  type HeaderCacheUpdate,
} from "@/lib/headerCache";

type ProfileRow = Tables<"profiles">;
type MoodEntry = Tables<"mood_entries">;
type DepressionTest = Tables<"depression_tests">;

type AccountAccessStatus = {
  reviewStatus: "active" | "watch" | "needs_support" | "restricted";
  priority: "normal" | "medium" | "high";
  updatedAt: string | null;
  isAdmin: boolean;
  restricted: boolean;
};

type HeaderNotification = {
  id: string;
  title: string;
  description: string;
  to: string;
  tone: "info" | "success" | "warning";
  icon: LucideIcon;
};

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/mood", label: "Mood Tracking", icon: LineChart },
  { to: "/test", label: "Depression Test", icon: ClipboardList },
  { to: "/therapy", label: "Therapy & Support", icon: HeartHandshake },
  { to: "/history", label: "History & Reports", icon: History },
  { to: "/resources", label: "Resources", icon: BookOpen },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: Settings },
];

const adminItem = { to: "/admin", label: "Admin Dashboard", icon: ShieldCheck };

const searchableItems = [
  {
    to: "/dashboard",
    label: "Dashboard",
    description: "Overview and quick wellness actions",
    keywords: ["home", "overview", "main"],
    icon: LayoutDashboard,
  },
  {
    to: "/mood",
    label: "Mood Tracking",
    description: "Add mood entries and review mood patterns",
    keywords: ["mood", "journal", "log", "energy", "sleep quality"],
    icon: LineChart,
  },
  {
    to: "/test",
    label: "Depression Test",
    description: "Start or continue your assessment",
    keywords: ["assessment", "check", "depression", "question"],
    icon: ClipboardList,
  },
  {
    to: "/therapy",
    label: "Therapy & Support",
    description: "Breathing, meditation, professional support",
    keywords: ["breathing", "sleep", "anxiety", "stress", "doctor", "therapy", "support"],
    icon: HeartHandshake,
  },
  {
    to: "/history",
    label: "History & Reports",
    description: "View reports, charts, and exports",
    keywords: ["report", "history", "chart", "export", "progress"],
    icon: History,
  },
  {
    to: "/resources",
    label: "Resources",
    description: "Articles, videos, audio, and guides",
    keywords: ["article", "video", "audio", "guide", "learn"],
    icon: BookOpen,
  },
  {
    to: "/profile",
    label: "Profile",
    description: "Manage your personal information",
    keywords: ["account", "name", "email", "personal"],
    icon: User,
  },
  {
    to: "/settings",
    label: "Settings",
    description: "Privacy, data, password, and preferences",
    keywords: ["privacy", "password", "dark", "export", "assistant"],
    icon: Settings,
  },
  {
    to: "/contact",
    label: "Contact Support",
    description: "Get help from the support page",
    keywords: ["help", "contact", "support", "emergency"],
    icon: Headphones,
  },
];

const adminSearchItem = {
  to: "/admin",
  label: "Admin Dashboard",
  description: "Manage published resources and admin content",
  keywords: ["admin", "resource manager", "publish", "draft", "moderation"],
  icon: ShieldCheck,
};

export const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const initialHeaderCache = useMemo(() => readHeaderCache(user?.id), [user?.id]);
  const [name, setName] = useState(() => initialHeaderCache?.name || user?.user_metadata?.name || "");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(() => initialHeaderCache?.profile ?? null);
  const [isAdmin, setIsAdmin] = useState(() => initialHeaderCache?.isAdmin ?? false);
  const [todayMood, setTodayMood] = useState<MoodEntry | null>(() => initialHeaderCache?.todayMood ?? null);
  const [latestTest, setLatestTest] = useState<DepressionTest | null>(() => initialHeaderCache?.latestTest ?? null);
  const [testCount, setTestCount] = useState(() => initialHeaderCache?.testCount ?? 0);
  const [accessStatus, setAccessStatus] = useState<AccountAccessStatus>({
    reviewStatus: "active",
    priority: "normal",
    updatedAt: null,
    isAdmin: false,
    restricted: false,
  });
  const [accessStatusLoading, setAccessStatusLoading] = useState(() => Boolean(user));
  const [headerLoading, setHeaderLoading] = useState(() => !initialHeaderCache);
  const [headerReady, setHeaderReady] = useState(() => Boolean(initialHeaderCache));
  const [dismissedNotifications, setDismissedNotifications] = useState<string[]>([]);
  const [dismissedReady, setDismissedReady] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setName("");
      setProfile(null);
      setIsAdmin(false);
      setTodayMood(null);
      setLatestTest(null);
      setTestCount(0);
      setAccessStatus({ reviewStatus: "active", priority: "normal", updatedAt: null, isAdmin: false, restricted: false });
      setAccessStatusLoading(false);
      setHeaderReady(false);
      setHeaderLoading(false);
      return;
    }
    let cancelled = false;
    const currentDateKey = todayKey();

    const cached = readHeaderCache(user.id, { dateKey: currentDateKey, removeExpired: true });
    if (cached) {
      setProfile(cached.profile);
      setName(cached.name);
      setIsAdmin(cached.isAdmin ?? false);
      setTodayMood(cached.todayMood);
      setLatestTest(cached.latestTest);
      setTestCount(cached.testCount);
      setHeaderReady(true);
    }

    const loadHeaderData = async () => {
      setHeaderLoading(true);
      const [profileResult, adminResult, todayMoodResult, latestTestResult, testCountResult, accessStatusResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("mood_entries")
          .select("*")
          .eq("user_id", user.id)
          .eq("entry_date", todayKey())
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
        supabase.from("depression_tests").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.rpc("get_current_user_access_status"),
      ]);

      if (cancelled) return;

      const profileData = (profileResult.data as ProfileRow | null) || null;
      const moodData = (todayMoodResult.data as MoodEntry | null) || null;
      const testData = (latestTestResult.data as DepressionTest | null) || null;
      const resolvedName = profileData?.name || user.user_metadata?.name || user.email?.split("@")[0] || "User";
      const resolvedTestCount = testCountResult.count || 0;
      const resolvedIsAdmin = Boolean(adminResult.data);
      const accessPayload =
        accessStatusResult.data && typeof accessStatusResult.data === "object" && !Array.isArray(accessStatusResult.data)
          ? (accessStatusResult.data as Record<string, unknown>)
          : {};
      const resolvedAccessStatus: AccountAccessStatus = accessStatusResult.error
        ? { reviewStatus: "active", priority: "normal", updatedAt: null, isAdmin: resolvedIsAdmin, restricted: false }
        : {
            reviewStatus:
              accessPayload.reviewStatus === "watch" ||
              accessPayload.reviewStatus === "needs_support" ||
              accessPayload.reviewStatus === "restricted"
                ? accessPayload.reviewStatus
                : "active",
            priority: accessPayload.priority === "medium" || accessPayload.priority === "high" ? accessPayload.priority : "normal",
            updatedAt: typeof accessPayload.updatedAt === "string" ? accessPayload.updatedAt : null,
            isAdmin: Boolean(accessPayload.isAdmin) || resolvedIsAdmin,
            restricted: Boolean(accessPayload.restricted) && !resolvedIsAdmin,
          };

      setProfile(profileData);
      setName(resolvedName);
      setIsAdmin(resolvedIsAdmin);
      setTodayMood(moodData);
      setLatestTest(testData);
      setTestCount(resolvedTestCount);
      setAccessStatus(resolvedAccessStatus);
      setAccessStatusLoading(false);
      setHeaderReady(true);
      setHeaderLoading(false);

      try {
        const cache: HeaderCache = {
          dateKey: currentDateKey,
          name: resolvedName,
          isAdmin: resolvedIsAdmin,
          profile: profileData,
          todayMood: moodData,
          latestTest: testData,
          testCount: resolvedTestCount,
        };
        writeHeaderCache(user.id, cache);
      } catch {
        // Header cache is only for smoother navigation; ignore storage failures.
      }
    };

    loadHeaderData();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;
    const currentUserId = user.id;

    const handleHeaderCacheUpdate = (event: Event) => {
      const detail = (event as CustomEvent<HeaderCacheUpdate>).detail;
      if (detail?.userId !== currentUserId) return;

      setProfile(detail.cache.profile);
      setName(detail.cache.name);
      setIsAdmin(detail.cache.isAdmin ?? false);
      setTodayMood(detail.cache.todayMood);
      setLatestTest(detail.cache.latestTest);
      setTestCount(detail.cache.testCount);
      setHeaderReady(true);
      setHeaderLoading(false);
    };

    window.addEventListener(HEADER_CACHE_UPDATED_EVENT, handleHeaderCacheUpdate);
    return () => window.removeEventListener(HEADER_CACHE_UPDATED_EVENT, handleHeaderCacheUpdate);
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setDismissedNotifications([]);
      setDismissedReady(false);
      return;
    }
    const key = `mindsense-dismissed-notifications-${user.id}`;
    try {
      const saved = localStorage.getItem(key);
      setDismissedNotifications(saved ? JSON.parse(saved) : []);
    } catch {
      localStorage.removeItem(key);
      setDismissedNotifications([]);
    } finally {
      setDismissedReady(true);
    }
  }, [user]);

  useEffect(() => {
    setSearchOpen(false);
    setSearchTerm("");
    setNotificationOpen(false);
  }, [location.pathname]);

  const displayName = name || user?.user_metadata?.name || user?.email?.split("@")[0] || "User";
  const accountRole = isAdmin ? "Admin" : "User";
  const initial = displayName.charAt(0).toUpperCase();
  const AdminIcon = adminItem.icon;
  const closeMobile = () => setMobileOpen(false);
  const saveDismissedNotifications = (ids: string[]) => {
    setDismissedNotifications(ids);
    if (user) {
      localStorage.setItem(`mindsense-dismissed-notifications-${user.id}`, JSON.stringify(ids));
    }
  };

  const notifications = useMemo<HeaderNotification[]>(() => {
    if (!user || !headerReady) return [];

    const output: HeaderNotification[] = [];
    if (!profile?.name) {
      output.push({
        id: "complete-profile",
        title: "Complete your profile",
        description: "Add your name so your account feels personal.",
        to: "/profile",
        tone: "info",
        icon: User,
      });
    }

    if (!todayMood) {
      output.push({
        id: `mood-${todayKey()}`,
        title: "Mood check-in is waiting",
        description: "Track today's mood from the Mood Tracking page.",
        to: "/mood",
        tone: "warning",
        icon: LineChart,
      });
    } else if (todayMood.mood <= 2) {
      output.push({
        id: `low-mood-${todayMood.id}`,
        title: "Low mood noted today",
        description: "Open support tools if you want a calming reset.",
        to: "/therapy",
        tone: "warning",
        icon: HeartHandshake,
      });
    }

    if (testCount === 0) {
      output.push({
        id: "first-assessment",
        title: "Start your first assessment",
        description: "Complete the depression test to build your baseline report.",
        to: "/test",
        tone: "info",
        icon: ClipboardList,
      });
    } else if (latestTest?.status && latestTest.status !== "completed") {
      output.push({
        id: `test-status-${latestTest.id}`,
        title: "Assessment needs attention",
        description: `Latest assessment status: ${latestTest.status}.`,
        to: "/history",
        tone: "info",
        icon: Clock,
      });
    }

    if (!output.length) {
      output.push({
        id: "all-clear",
        title: "You are up to date",
        description: "Profile, mood check-in, and assessment data look current.",
        to: "/dashboard",
        tone: "success",
        icon: CheckCircle2,
      });
    }

    return output;
  }, [headerReady, latestTest, profile?.name, testCount, todayMood, user]);

  const notificationsReady = headerReady && dismissedReady;
  const activeNotifications = notifications.filter((notification) => !dismissedNotifications.includes(notification.id));
  const notificationCount = notificationsReady ? activeNotifications.filter((notification) => notification.id !== "all-clear").length : 0;
  const visibleNotifications = notificationsReady
    ? activeNotifications.length
      ? activeNotifications
      : notifications.filter((notification) => notification.id === "all-clear")
    : [];

  const searchResults = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const availableItems = isAdmin ? [...searchableItems, adminSearchItem] : searchableItems;
    if (!query) return availableItems.slice(0, 5);

    return availableItems
      .map((item) => {
        const haystack = `${item.label} ${item.description} ${item.keywords.join(" ")}`.toLowerCase();
        const words = query.split(/\s+/).filter(Boolean);
        const score = words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
        return { item, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item)
      .slice(0, 6);
  }, [isAdmin, searchTerm]);

  const goToSearchResult = (to: string) => {
    setSearchOpen(false);
    setSearchTerm("");
    navigate(to);
  };

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (searchResults[0]) {
      goToSearchResult(searchResults[0].to);
      return;
    }
    navigate("/resources");
  };

  if (user && accessStatusLoading) {
    return (
      <div className="premium-page relative flex min-h-screen items-center justify-center overflow-hidden p-4">
        <div className="premium-grid pointer-events-none fixed inset-0 opacity-35" />
        <div className="glass-panel relative z-10 w-full max-w-md rounded-3xl border-white/10 p-8 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 animate-pulse text-primary" />
          <h1 className="mt-4 text-2xl font-extrabold">Checking account access</h1>
          <p className="mt-2 text-sm text-muted-foreground">MindSense is confirming your account status before opening the workspace.</p>
        </div>
      </div>
    );
  }

  if (accessStatus.restricted && !accessStatus.isAdmin && !isAdmin) {
    return (
      <div className="premium-page relative flex min-h-screen items-center justify-center overflow-hidden p-4">
        <div className="premium-grid pointer-events-none fixed inset-0 opacity-35" />
        <div className="ambient-beams pointer-events-none fixed inset-0 opacity-40" />
        <section className="glass-panel relative z-10 w-full max-w-2xl overflow-hidden rounded-[2rem] border-white/10 p-6 text-center md:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-300/15 blur-3xl" />
          <div className="relative">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-300/10 text-amber-100">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <Badge variant="outline" className="mt-5 border-amber-300/25 bg-amber-300/10 text-amber-100">
              Account restricted
            </Badge>
            <h1 className="mt-5 text-3xl font-extrabold md:text-4xl">Your MindSense workspace is temporarily limited.</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground md:text-base">
              An administrator has restricted this account. You can still sign out or contact the MindSense team for help.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button className="premium-button" onClick={() => navigate("/contact")}>
                <Headphones className="h-4 w-4" />
                Contact Team
              </Button>
              <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={() => navigate("/logout")}>
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left text-sm text-muted-foreground">
              This is a soft access restriction for project safety. It does not delete your account or remove your saved wellness data.
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="premium-page relative flex min-h-screen overflow-hidden">
      <div className="premium-grid pointer-events-none fixed inset-0 opacity-35" />
      <div className="ambient-beams pointer-events-none fixed inset-0 opacity-40" />
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={closeMobile}
          />
          <aside className="glass-panel relative flex h-full w-80 max-w-[85vw] flex-col border-r border-white/10 shadow-2xl">
            <div className="px-5 py-5 flex items-center gap-2 border-b border-border">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-sky-400 to-violet-400 text-primary-foreground shadow-[var(--shadow-soft)]">
                <Brain className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-primary text-lg leading-tight">MindSense</div>
                <div className="text-[10px] text-muted-foreground">Mental Health System</div>
              </div>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={closeMobile}
                className="ml-auto flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end
                  onClick={closeMobile}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                      isActive
                        ? "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-[var(--shadow-soft)]"
                        : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                    }`
                  }
                >
                  <it.icon className="h-4 w-4" />
                  {it.label}
                </NavLink>
              ))}
              <button
                onClick={() => {
                  closeMobile();
                  navigate("/logout");
                }}
                className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
              {isAdmin && (
                <NavLink
                  to={adminItem.to}
                  end
                  onClick={closeMobile}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                      isActive
                        ? "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-[var(--shadow-soft)]"
                        : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                    }`
                  }
                >
                  <AdminIcon className="h-4 w-4" />
                  {adminItem.label}
                </NavLink>
              )}
            </nav>

            <div className="m-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-sm">
              <div className="flex items-center gap-2 font-semibold">
                <Headphones className="h-4 w-4 text-primary" /> Need Help?
              </div>
              <p className="text-xs text-muted-foreground mt-1">We are here for you.</p>
              <Button size="sm" variant="outline" className="mt-3 w-full rounded-full border-white/10 bg-white/[0.04]" onClick={() => navigate("/contact")}>Contact Support</Button>
            </div>
          </aside>
        </div>
      )}

      {/* Sidebar */}
      <aside className="glass-panel relative z-10 m-3 hidden h-[calc(100vh-1.5rem)] w-72 shrink-0 flex-col rounded-3xl border-white/10 lg:flex">
        <div className="px-6 py-6 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-sky-400 to-violet-400 text-primary-foreground shadow-[var(--shadow-soft)]">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-primary text-lg leading-tight">MindSense</div>
            <div className="text-[10px] text-muted-foreground">Mental Health System</div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-[var(--shadow-soft)]"
                    : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                }`
              }
            >
              <it.icon className="h-4 w-4 transition group-hover:scale-110" />
              {it.label}
            </NavLink>
          ))}
          <button
            onClick={() => navigate("/logout")}
            className="w-full flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
          {isAdmin && (
            <NavLink
              to={adminItem.to}
              end
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-[var(--shadow-soft)]"
                    : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                }`
              }
            >
              <AdminIcon className="h-4 w-4 transition group-hover:scale-110" />
              {adminItem.label}
            </NavLink>
          )}
        </nav>

        <div className="m-4 rounded-2xl border border-primary/20 bg-primary/10 p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <Headphones className="h-4 w-4 text-primary" /> Need Help?
          </div>
          <p className="text-xs text-muted-foreground mt-1">We are here for you.</p>
          <Button size="sm" variant="outline" className="mt-3 w-full rounded-full border-white/10 bg-white/[0.04]" onClick={() => navigate("/contact")}>Contact Support</Button>
        </div>
      </aside>

      {/* Main */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="glass-panel sticky top-3 z-30 mx-3 mt-3 rounded-2xl border-white/10">
          <div className="flex h-16 items-center gap-4 px-4 md:px-8">
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setMobileOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <form className="relative hidden flex-1 max-w-xl sm:block" onSubmit={submitSearch}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setSearchOpen(false);
                }}
                placeholder="Search pages, tools, reports..."
                className="rounded-full border-white/10 bg-white/[0.06] pl-9"
              />
              {searchOpen && (
                <div className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-xl border border-white/15 bg-[#111827]/95 shadow-[var(--shadow-card)] backdrop-blur-2xl">
                  <div className="border-b border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                    {searchTerm.trim() ? "Search results" : "Quick navigation"}
                  </div>
                  {searchResults.length > 0 ? (
                    <div className="max-h-80 overflow-y-auto p-2">
                      {searchResults.map((result) => (
                        <button
                          key={result.to}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => goToSearchResult(result.to)}
                          className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-foreground transition hover:bg-white/[0.08]"
                        >
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                            <result.icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{result.label}</div>
                            <div className="truncate text-xs text-slate-300">{result.description}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-sm text-slate-300">
                      No exact match. Press Enter to open Resources and browse support content.
                    </div>
                  )}
                </div>
              )}
            </form>
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationOpen((open) => !open)}
                className="relative h-10 w-10 rounded-full bg-white/[0.06] flex items-center justify-center transition hover:bg-white/[0.1]"
                aria-label="Open notifications"
              >
                <Bell className="h-4 w-4" />
                {notificationsReady && notificationCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 rounded-full bg-primary px-1 text-[10px] text-primary-foreground flex items-center justify-center">
                    {notificationCount}
                  </span>
                )}
              </button>
              {notificationOpen && (
                <div className="absolute right-0 top-12 z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-white/15 bg-popover text-popover-foreground shadow-[0_24px_70px_rgba(0,0,0,0.38)]">
                  <div className="flex items-center justify-between border-b border-white/10 bg-secondary/45 px-4 py-3">
                    <div>
                      <div className="font-semibold text-foreground">Notifications</div>
                      <div className="text-xs text-muted-foreground">
                        {!notificationsReady || headerLoading ? "Checking updates..." : `${notificationCount} active update${notificationCount === 1 ? "" : "s"}`}
                      </div>
                    </div>
                    {notificationsReady && notificationCount > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => saveDismissedNotifications(notifications.map((notification) => notification.id))}
                      >
                        Mark read
                      </Button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto p-2">
                    {!notificationsReady ? (
                      <div className="px-3 py-4 text-sm text-muted-foreground">Checking your latest profile, mood, and assessment updates...</div>
                    ) : (
                      visibleNotifications.map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() => {
                            setNotificationOpen(false);
                            navigate(notification.to);
                          }}
                          className="flex w-full gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-white/[0.08]"
                        >
                          <div
                            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                              notification.tone === "success"
                                ? "bg-emerald-400/15 text-emerald-300"
                                : notification.tone === "warning"
                                  ? "bg-amber-400/15 text-amber-300"
                                  : "bg-primary/12 text-primary"
                            }`}
                          >
                            <notification.icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-semibold text-foreground">{notification.title}</div>
                              {notification.tone === "warning" && (
                                <Badge variant="outline" className="border-amber-300/50 px-1.5 py-0 text-[10px] text-amber-300">
                                  Action
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{notification.description}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="border-t border-white/10 px-4 py-3">
                    <Button className="w-full rounded-full border-white/15 bg-white/[0.06] hover:bg-white/[0.1]" variant="outline" size="sm" onClick={() => navigate("/history")}>
                      View Reports
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate("/profile")}
              className="flex items-center gap-3 rounded-full px-2 py-1.5 transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Open profile"
            >
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary via-sky-400 to-violet-400 text-primary-foreground flex items-center justify-center font-bold shadow-[var(--shadow-soft)]">
                {initial}
              </div>
              <div className="hidden sm:block leading-tight">
                <div className="text-sm font-semibold">{displayName}</div>
                <div className="text-[11px] text-muted-foreground">{accountRole}</div>
              </div>
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>

        <footer className="mx-3 mb-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-center text-xs text-muted-foreground md:px-8">
          © {new Date().getFullYear()} MindSense Mental Health System. All rights reserved.
        </footer>
      </div>
    </div>
  );
};

export default DashboardLayout;

