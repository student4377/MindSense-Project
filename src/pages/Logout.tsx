import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  Home,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Lock,
  LogIn,
  LogOut as LogOutIcon,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const reflections = [
  "Take care of yourself - you matter.",
  "Rest is productive too.",
  "Every small step forward is progress.",
  "Be kind to your mind today.",
  "You are doing better than you think.",
];

const Logout = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<"confirm" | "loading" | "done">("confirm");
  const reflection = useMemo(() => reflections[Math.floor(Math.random() * reflections.length)], []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setPhase("done");
      return;
    }

    let cancelled = false;
    supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setName(data?.name || user.email?.split("@")[0] || "");
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const handleLogout = async () => {
    setPhase("loading");
    await signOut();
    window.setTimeout(() => setPhase("done"), 700);
  };

  const displayName = name || "there";
  const progressValue = authLoading ? "35%" : phase === "confirm" ? "52%" : phase === "loading" ? "82%" : "100%";

  return (
    <div className="premium-page relative min-h-screen overflow-hidden">
      <div className="premium-grid pointer-events-none absolute inset-0 opacity-35" />
      <div className="ambient-beams pointer-events-none absolute inset-0 opacity-40" />

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 md:px-6">
        <Link to="/" className="group flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 shadow-[var(--shadow-card)] backdrop-blur-xl">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-sky-400 to-violet-400 text-primary-foreground shadow-[var(--shadow-soft)]">
            <Brain className="h-5 w-5 transition group-hover:scale-110" />
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-300 ring-4 ring-background" />
          </div>
          <div className="leading-tight">
            <div className="font-bold">MindSense</div>
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              AI Wellness
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {user && phase !== "done" ? (
            <Button variant="outline" className="hidden rounded-full border-white/10 bg-white/[0.04] sm:inline-flex" onClick={() => navigate("/dashboard")}>
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
          ) : (
            <Button variant="outline" className="hidden rounded-full border-white/10 bg-white/[0.04] sm:inline-flex" asChild>
              <Link to="/">
                <Home className="h-4 w-4" />
                Home
              </Link>
            </Button>
          )}
          {phase !== "done" && (
            <Button className="premium-button" onClick={handleLogout} disabled={authLoading || phase === "loading"}>
              {phase === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOutIcon className="h-4 w-4" />}
              Exit
            </Button>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100svh-5.5rem)] w-full max-w-7xl items-center gap-5 px-4 pb-8 md:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(24rem,0.72fr)]">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_18%_12%,hsl(var(--primary)/0.18),transparent_32%),radial-gradient(circle_at_88%_8%,rgba(167,139,250,0.18),transparent_28%),rgba(255,255,255,0.055)] p-5 shadow-[var(--shadow-card)] backdrop-blur-2xl md:p-7">
          <div className="premium-grid pointer-events-none absolute inset-0 opacity-25" />
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-primary">
              <ShieldCheck className="h-4 w-4" />
              Secure logout
            </div>
            <h1 className="mt-5 max-w-4xl text-5xl font-extrabold leading-[0.95] tracking-normal md:text-7xl">
              Step away safely.
              <span className="gradient-text block">Your care history stays protected.</span>
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
              Logging out closes access on this browser. Mood logs, depression test reports, resources, and support activity remain saved to your account for the next session.
            </p>

            <div className="mt-7 grid gap-3 md:grid-cols-3">
              <TrustCard icon={Lock} title="Private account" description="Dashboard access stops after logout." />
              <TrustCard icon={KeyRound} title="Session closed" description="Sign in again with your email." />
              <TrustCard icon={UserRound} title="Data retained" description="Wellness records stay in Supabase." />
            </div>
          </div>
        </section>

        <section className="relative">
          <div className="pointer-events-none absolute -left-10 top-10 h-36 w-36 rounded-full bg-primary/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 right-0 h-44 w-44 rounded-full bg-violet-500/20 blur-3xl" />

          <div className="premium-card relative overflow-hidden p-5 md:p-6">
            <div className="premium-grid pointer-events-none absolute inset-0 opacity-20" />
            <div className="relative">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Session status</p>
                  <h2 className="mt-1 text-2xl font-extrabold">
                    {authLoading ? "Checking" : phase === "confirm" ? "Still signed in" : phase === "loading" ? "Signing out" : "Signed out"}
                  </h2>
                </div>
                <motion.div
                  key={phase}
                  initial={{ scale: 0.88, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 190, damping: 15 }}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-sky-400 to-violet-400 text-primary-foreground shadow-[var(--shadow-glow)]"
                >
                  {authLoading || phase === "loading" ? <Loader2 className="h-6 w-6 animate-spin" /> : phase === "done" ? <CheckCircle2 className="h-6 w-6" /> : <LogOutIcon className="h-6 w-6" />}
                </motion.div>
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-primary via-sky-400 to-violet-400" animate={{ width: progressValue }} transition={{ duration: 0.45 }} />
              </div>

              <AnimatePresence mode="wait">
                {authLoading ? (
                  <StatePanel key="checking" eyebrow="Checking session" title="Preparing secure exit." description="MindSense is verifying the current browser session before changing account state." />
                ) : phase === "confirm" ? (
                  <motion.div key="confirm" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-6">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Confirm logout</p>
                    <h3 className="mt-2 text-3xl font-extrabold leading-tight">Leave for now, {displayName}?</h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      Your dashboard will require login again after this step.
                    </p>

                    <div className="my-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-bold">Before you go</div>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{reflection}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4" />
                        Stay signed in
                      </Button>
                      <Button className="premium-button" onClick={handleLogout}>
                        <LogOutIcon className="h-4 w-4" />
                        Log out
                      </Button>
                    </div>
                  </motion.div>
                ) : phase === "loading" ? (
                  <StatePanel key="loading" eyebrow="Closing session" title="Signing you out." description="MindSense is ending account access on this browser." />
                ) : (
                  <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-6">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Session closed</p>
                    <h3 className="mt-2 text-3xl font-extrabold leading-tight">You are safely signed out.</h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      Your MindSense records remain protected. You can return whenever you are ready.
                    </p>
                    <div className="my-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-muted-foreground">
                      {reflection}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" asChild>
                        <Link to="/">
                          <Home className="h-4 w-4" />
                          Home
                        </Link>
                      </Button>
                      <Button className="premium-button" asChild>
                        <Link to="/signin">
                          <LogIn className="h-4 w-4" />
                          Sign in again
                        </Link>
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

        </section>
      </main>
    </div>
  );
};

function StatePanel({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <motion.div key={eyebrow} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      <h3 className="mt-2 text-3xl font-extrabold leading-tight">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
    </motion.div>
  );
}

function TrustCard({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <motion.div whileHover={{ y: -3 }} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 font-bold">{title}</div>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
    </motion.div>
  );
}

export default Logout;
