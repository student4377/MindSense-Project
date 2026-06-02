import { useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AuthContext } from "@/hooks/authContext";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (event === "PASSWORD_RECOVERY" && window.location.pathname !== "/reset-password") {
        window.location.replace("/reset-password");
      }
    });

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const expMs = (session.expires_at ?? 0) * 1000;
        // If expired or expiring soon, refresh now so queries don't fire with a dead JWT.
        if (!expMs || expMs < Date.now() + 60_000) {
          const { data: refreshed, error } = await supabase.auth.refreshSession();
          if (error || !refreshed.session) {
            await supabase.auth.signOut().catch(() => {});
            setSession(null);
            setUser(null);
          } else {
            setSession(refreshed.session);
            setUser(refreshed.session.user);
          }
        } else {
          setSession(session);
          setUser(session.user);
        }
      }
      setLoading(false);
    })();

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return <AuthContext.Provider value={{ user, session, loading, signOut }}>{children}</AuthContext.Provider>;
};
