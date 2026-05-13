import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Brain, Heart, LogOut, Loader2, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const quotes = [
  "Take care of yourself — you matter.",
  "Rest is productive too.",
  "Every small step forward is progress.",
  "Be kind to your mind today.",
  "You are doing better than you think.",
];

const Logout = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<"confirm" | "loading" | "done">("confirm");
  const [quote] = useState(() => quotes[Math.floor(Math.random() * quotes.length)]);

  useEffect(() => {
    if (!user) {
      setPhase("done");
      return;
    }
    supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setName(data?.name || user.email?.split("@")[0] || "Friend"));
  }, [user]);

  const handleLogout = async () => {
    setPhase("loading");
    await signOut();
    setTimeout(() => setPhase("done"), 900);
  };

  useEffect(() => {
    if (phase !== "done") return;
    const t = setTimeout(() => navigate("/"), 2200);
    return () => clearTimeout(t);
  }, [phase, navigate]);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-[hsl(210,40%,98%)] via-background to-[hsl(var(--primary)/0.08)] px-4">
      {/* Decorative blobs */}
      <motion.div
        aria-hidden
        className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.7, 0.5] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-[hsl(var(--primary-glow)/0.25)] blur-3xl"
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 10, repeat: Infinity }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-[0_20px_60px_-15px_hsl(var(--primary)/0.25)] p-8 md:p-10 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 180, damping: 14 }}
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-lg"
          >
            {phase === "loading" ? (
              <Loader2 className="h-9 w-9 animate-spin" />
            ) : phase === "done" ? (
              <Heart className="h-9 w-9" />
            ) : (
              <Brain className="h-9 w-9" />
            )}
          </motion.div>

          {phase === "confirm" && (
            <>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                Leaving so soon{name ? `, ${name}` : ""}?
              </h1>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                We'll keep your wellness journey safe until you return. You can sign back
                in anytime to continue where you left off.
              </p>

              <div className="my-6 flex items-center justify-center gap-2 rounded-2xl bg-secondary/60 px-4 py-3 text-sm text-foreground/80">
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <span className="italic">"{quote}"</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => navigate(-1)}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" /> Stay signed in
                </Button>
                <Button
                  className="flex-1 rounded-xl bg-gradient-to-r from-primary to-primary-glow"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" /> Yes, log me out
                </Button>
              </div>
            </>
          )}

          {phase === "loading" && (
            <>
              <h1 className="text-2xl font-bold text-foreground">Signing you out…</h1>
              <p className="mt-3 text-muted-foreground">
                Securely ending your session.
              </p>
            </>
          )}

          {phase === "done" && (
            <>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                Take care{name ? `, ${name}` : ""}.
              </h1>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                You've been safely logged out. Wishing you a peaceful day ahead.
              </p>
              <div className="my-6 rounded-2xl bg-secondary/60 px-4 py-3 text-sm italic text-foreground/80">
                "{quote}"
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => navigate("/")}
                >
                  Back to Home
                </Button>
                <Button
                  className="flex-1 rounded-xl bg-gradient-to-r from-primary to-primary-glow"
                  onClick={() => navigate("/signin")}
                >
                  Sign in again
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Redirecting to home shortly…
              </p>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Your data stays private and protected. 💙
        </p>
      </motion.div>
    </div>
  );
};

export default Logout;
