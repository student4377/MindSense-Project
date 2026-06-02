import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Brain, LayoutDashboard, LogIn, Menu, Sparkles, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const publicNavItems = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/features", label: "Features" },
  { to: "/contact", label: "Contact" },
];

const Navbar = ({ showNavigation = true }: { showNavigation?: boolean }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const navItems = user ? [{ to: "/", label: "Home" }] : publicNavItems;

  return (
    <header className="sticky left-0 right-0 top-0 z-50 px-3 pt-3 md:px-6">
      <motion.nav
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto flex h-16 max-w-7xl items-center justify-between rounded-2xl border border-white/10 bg-background/65 px-4 shadow-[var(--shadow-card)] backdrop-blur-2xl md:px-5"
      >
        <Link to="/" className="group flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-sky-400 to-violet-400 text-primary-foreground shadow-[var(--shadow-soft)]">
            <Brain className="h-5 w-5 transition group-hover:scale-110" />
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-300 ring-4 ring-background" />
          </div>
          <div className="leading-tight">
            <div className="font-bold text-foreground">MindSense</div>
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              AI Wellness
            </div>
          </div>
        </Link>

        {showNavigation && (
          <div className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm font-medium transition ${
                    isActive ? "bg-white/10 text-foreground shadow-sm" : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        )}

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <Button variant="outline" size="sm" className="rounded-full border-white/10 bg-white/[0.04]" onClick={() => navigate("/dashboard")}>
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Button>
              <Button size="sm" className="premium-button" onClick={() => navigate("/logout")}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" className="rounded-full border-white/10 bg-white/[0.04]" onClick={() => navigate("/signin")}>
                <LogIn className="h-4 w-4" />
                Login
              </Button>
              <Button size="sm" className="premium-button" onClick={() => navigate("/signup")}>
                <UserPlus className="h-4 w-4" />
                Signup
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label="Open navigation menu"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] md:hidden"
          onClick={() => setOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>
      </motion.nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 p-3 backdrop-blur-xl md:hidden"
          >
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="glass-panel rounded-2xl p-4"
            >
              <div className="flex items-center justify-between">
                <Link to="/" onClick={() => setOpen(false)} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                    <Brain className="h-5 w-5" />
                  </div>
                  <div className="font-bold">MindSense</div>
                </Link>
                <button
                  type="button"
                  aria-label="Close navigation menu"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06]"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {showNavigation && (
                <div className="mt-6 grid gap-2">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        `rounded-xl px-4 py-3 text-sm font-medium ${
                          isActive ? "bg-primary text-primary-foreground" : "bg-white/[0.04] text-muted-foreground"
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              )}
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="rounded-full border-white/10 bg-white/[0.04]"
                  onClick={() => {
                    setOpen(false);
                    navigate(user ? "/dashboard" : "/signin");
                  }}
                >
                  {user ? "Dashboard" : "Login"}
                </Button>
                <Button
                  className="premium-button"
                  onClick={() => {
                    setOpen(false);
                    navigate(user ? "/logout" : "/signup");
                  }}
                >
                  {user ? "Logout" : "Signup"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
