import { ReactNode } from "react";
import { Brain, CheckCircle2, ShieldCheck } from "lucide-react";
import Navbar from "@/components/Navbar";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  heroTitle: string;
  heroDescription: string;
  highlights: string[];
  compact?: boolean;
};

const AuthShell = ({
  eyebrow,
  title,
  description,
  children,
  footer,
  heroTitle,
  heroDescription,
  highlights,
  compact = false,
}: AuthShellProps) => (
  <div className="premium-page min-h-screen overflow-hidden">
    <Navbar />
    <main className="container relative mx-auto grid min-h-[calc(100svh-5.5rem)] items-center gap-8 px-4 py-4 md:px-6 lg:grid-cols-[0.95fr_0.85fr] xl:max-w-7xl">
      <div className="premium-grid absolute inset-0 opacity-40" />
      <div className="ambient-beams absolute inset-0 opacity-50" />

      <section className="relative hidden max-w-xl lg:block">
        <h1 className="text-5xl font-extrabold leading-[1.04] xl:text-[3.6rem]">
          {heroTitle}
        </h1>
        <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
          {heroDescription}
        </p>
        <div className="mt-6 grid max-w-lg gap-3">
          {highlights.map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span className="text-sm text-foreground">{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="relative mx-auto w-full max-w-[26rem] lg:mr-0">
        <div className="absolute -left-10 top-10 h-36 w-36 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-10 right-0 h-44 w-44 rounded-full bg-violet-500/20 blur-3xl" />
        <div className={`premium-card relative overflow-hidden ${compact ? "p-4 md:p-5" : "p-5 md:p-6"}`}>
          <div className={`${compact ? "mb-4" : "mb-5"} flex items-start justify-between gap-4`}>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">{eyebrow}</p>
              <h2 className="mt-2 text-2xl font-bold md:text-3xl">{title}</h2>
              {description && (
                <p className={`${compact ? "mt-1.5 leading-5" : "mt-2 leading-6"} text-sm text-muted-foreground`}>
                  {description}
                </p>
              )}
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <Brain className="h-6 w-6" />
            </div>
          </div>

          {children}

          {footer && <div className={`${compact ? "mt-4" : "mt-6"} text-center text-sm text-muted-foreground`}>{footer}</div>}

          <div className={`${compact ? "mt-4 pt-3" : "mt-6 pt-4"} flex items-center justify-center gap-2 border-t border-white/10 text-xs text-muted-foreground`}>
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Protected by Supabase authentication
          </div>
        </div>
      </section>
    </main>
  </div>
);

export default AuthShell;
