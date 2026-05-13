import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  Lock,
  MessageCircle,
  Mic2,
  Play,
  ScanFace,
  ShieldCheck,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { PremiumTiltCard, Reveal, Stagger } from "@/components/PremiumMotion";

const features = [
  {
    icon: ClipboardList,
    title: "Questionnaire Intelligence",
    desc: "Guided text assessments convert user responses into structured wellness signals for reports and follow-up care.",
    badge: "Text analysis",
    metric: "21 prompts",
    to: "/test",
  },
  {
    icon: Mic2,
    title: "AI Voice Interaction",
    desc: "Voice capture supports natural emotional check-ins and prepares the platform for advanced speech model analysis.",
    badge: "Voice signal",
    metric: "Audio ready",
    to: "/test",
  },
  {
    icon: ScanFace,
    title: "Emotion & Video Analysis",
    desc: "Camera-based workflows are designed for facial emotion review, expression tracking, and multimodal fusion.",
    badge: "Video emotion",
    metric: "Face scan",
    to: "/test",
  },
  {
    icon: BarChart3,
    title: "Mood Analytics",
    desc: "Mood history, trends, wellness scores, and exports help users understand patterns across time.",
    badge: "Reports",
    metric: "Live charts",
    to: "/mood",
  },
];

const stats = [
  { label: "Assessment modes", value: "3", detail: "Questionnaire, voice, and video" },
  { label: "Guided check-in", value: "3 min", detail: "A simple first step for users" },
  { label: "Privacy", value: "Safe", detail: "Personal records stay account protected" },
  { label: "Insight views", value: "Live", detail: "Mood, reports, and wellness trends" },
];

const workflow = [
  { icon: ClipboardList, title: "Check in", text: "Answer guided questions in a calm, focused interface." },
  { icon: Waves, title: "Capture signals", text: "Add voice and video inputs when ready for multimodal review." },
  { icon: Brain, title: "Understand patterns", text: "Review wellness scores, mood trends, and report history." },
  { icon: HeartPulse, title: "Take action", text: "Open therapy tools, resources, and support recommendations." },
];

const productPreviews = [
  {
    icon: ClipboardList,
    title: "Guided assessment",
    desc: "A step-by-step check-in that feels calm, focused, and easy to complete.",
    to: "/test",
  },
  {
    icon: HeartPulse,
    title: "Mood tracking",
    desc: "Daily mood, energy, sleep, and notes become useful patterns over time.",
    to: "/mood",
  },
  {
    icon: BarChart3,
    title: "Reports",
    desc: "History and charts help users understand changes without feeling overwhelmed.",
    to: "/history",
  },
  {
    icon: MessageCircle,
    title: "Wellness assistant",
    desc: "A supportive chat experience that points users toward tools and resources.",
    to: "/therapy",
  },
];

const useCases = [
  {
    icon: Brain,
    title: "For students",
    desc: "Track stress, sleep, focus, and mood before they become harder to manage.",
  },
  {
    icon: HeartPulse,
    title: "For individuals",
    desc: "Build a clearer picture of emotional patterns with gentle check-ins.",
  },
  {
    icon: ShieldCheck,
    title: "For support teams",
    desc: "Give users a safer, more organized way to review wellness history.",
  },
];

const Index = () => {
  const [activeSignal, setActiveSignal] = useState(1);

  return (
    <div className="premium-page overflow-hidden">
      <Navbar />

      <main>
        <section className="relative overflow-hidden">
          <div className="premium-grid absolute inset-0 opacity-70" />
          <div className="ambient-beams absolute inset-0 opacity-80" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />

          <div className="container relative mx-auto grid min-h-[calc(100svh-6.25rem)] items-center gap-6 px-4 py-5 md:px-6 md:py-6 lg:grid-cols-[1.05fr_0.95fr]">
            <Reveal className="lg:self-start lg:pt-12 xl:pt-16">
              <div className="max-w-4xl">
                <h1 className="max-w-5xl text-6xl font-extrabold leading-[0.95] tracking-[-0.03em] md:text-7xl lg:text-[5.8rem] xl:text-[6.5rem]">
                  MindSense
                  <span className="mt-2 block max-w-4xl text-4xl leading-[1.05] md:text-5xl lg:text-6xl gradient-text animate-gradient-shift">
                    understands the signals behind your mood.
                  </span>
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                  A calm AI wellness workspace that helps users check in, track mood patterns, review reports,
                  and find support from one private dashboard.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Button asChild size="lg" className="premium-button px-7">
                    <Link to="/signup">
                      Take a 3-Minute Check-In
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-7 hover:bg-white/[0.08]">
                    <Link to="/signin">
                      <Play className="h-4 w-4" />
                      Open Dashboard
                    </Link>
                  </Button>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {["Private account data", "Clear reports", "Support-first design"].map((item) => (
                    <span key={item} className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.12} className="lg:justify-self-end">
              <HeroMultimodalVisual />
            </Reveal>
          </div>
        </section>

        <section className="container mx-auto px-4 py-8 md:px-6">
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <PremiumTiltCard key={stat.label} className="min-h-[150px] p-6">
                <div className="text-3xl font-extrabold gradient-text">{stat.value}</div>
                <div className="mt-3 font-semibold">{stat.label}</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{stat.detail}</p>
              </PremiumTiltCard>
            ))}
          </Stagger>
        </section>

        <section id="features" className="container mx-auto px-4 py-14 md:px-6">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">Platform</p>
              <h2 className="mt-3 text-4xl font-bold md:text-6xl">Built for emotional clarity, not just data collection.</h2>
              <p className="mt-5 text-muted-foreground">
                Every feature is designed to help users understand how they feel and what to do next.
              </p>
            </div>
          </Reveal>

          <Stagger className="mx-auto mt-9 grid max-w-6xl gap-5 md:grid-cols-2">
            {features.map((feature) => (
              <PremiumTiltCard key={feature.title} className="group min-h-[240px] p-5 md:p-6">
                <Link to={feature.to} className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary transition group-hover:scale-110">
                      <feature.icon className="h-7 w-7" />
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-muted-foreground">
                      {feature.badge}
                    </span>
                  </div>
                  <h3 className="mt-5 text-2xl font-semibold">{feature.title}</h3>
                  <p className="mt-3 min-h-[72px] text-sm leading-6 text-muted-foreground">{feature.desc}</p>
                  <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-5">
                    <span className="text-sm font-medium text-foreground">{feature.metric}</span>
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                      Explore
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              </PremiumTiltCard>
            ))}
          </Stagger>
        </section>

        <section className="relative border-y border-white/10 bg-white/[0.025] py-14">
          <div className="container mx-auto px-4 md:px-6">
            <Reveal>
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">Product preview</p>
                <h2 className="mt-3 text-4xl font-bold md:text-5xl">A complete wellness workspace, not a single test.</h2>
              </div>
            </Reveal>

            <Stagger className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {productPreviews.map((preview) => (
                <PremiumTiltCard key={preview.title} className="group min-h-[210px] p-5">
                  <Link to={preview.to} className="flex h-full flex-col">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                      <preview.icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-5 text-xl font-semibold">{preview.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{preview.desc}</p>
                    <div className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-medium text-primary">
                      Open preview
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                    </div>
                  </Link>
                </PremiumTiltCard>
              ))}
            </Stagger>
          </div>
        </section>

        <section className="container mx-auto px-4 py-14 md:px-6">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">Visualization</p>
              <h2 className="mt-3 text-4xl font-bold md:text-5xl">A calmer way to see mental health signals.</h2>
              <p className="mt-5 text-muted-foreground">
                Mood, questionnaire answers, voice readiness, video readiness, and support actions appear as one
                connected wellness flow.
              </p>
              <div className="mt-6 grid gap-3">
                {workflow.map((item, index) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => setActiveSignal(index)}
                    className={`rounded-2xl border p-3.5 text-left transition ${
                      activeSignal === index
                        ? "border-primary/40 bg-primary/10 shadow-[var(--shadow-soft)]"
                        : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-primary">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-semibold">{item.title}</div>
                        <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.12} className="h-full">
              <div className="relative h-full overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-[var(--shadow-card)] backdrop-blur-xl md:p-6">
                <div className="premium-grid absolute inset-0 opacity-40" />
                <div className="relative">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground">MindSense signal map</div>
                      <div className="text-2xl font-bold">Multimodal wellness layer</div>
                    </div>
                    <div className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs text-primary">Live preview</div>
                  </div>

                  <div className="relative mx-auto aspect-square max-w-[430px] rounded-[2rem] border border-white/10 bg-background/55 p-5">
                    <div className="absolute inset-8 rounded-[1.5rem] border border-white/10" />
                    <div className="absolute inset-20 rounded-[1rem] border border-primary/20" />
                    <motion.div
                      className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-3xl border border-primary/35 bg-primary/15 text-primary shadow-[var(--shadow-soft)]"
                      animate={{ scale: [1, 1.04, 1] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    >
                      <Brain className="h-10 w-10" />
                    </motion.div>
                    {workflow.map((item, index) => {
                      const positions = [
                        "left-[8%] top-[16%]",
                        "right-[7%] top-[19%]",
                        "right-[14%] bottom-[13%]",
                        "left-[10%] bottom-[16%]",
                      ];
                      return (
                        <motion.div
                          key={item.title}
                          className={`absolute ${positions[index]} flex h-16 w-16 items-center justify-center rounded-2xl border ${
                            activeSignal === index ? "border-primary/50 bg-primary/18 text-primary" : "border-white/10 bg-white/[0.06] text-muted-foreground"
                          }`}
                          animate={{ y: activeSignal === index ? [-3, 3, -3] : 0 }}
                          transition={{ duration: 2.4, repeat: activeSignal === index ? Infinity : 0 }}
                        >
                          <item.icon className="h-6 w-6" />
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="container mx-auto px-4 py-14 md:px-6">
          <div className="grid items-stretch gap-6 lg:grid-cols-2">
            <Reveal className="h-full">
              <div className="premium-card flex h-full flex-col overflow-hidden p-6 md:p-7">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="font-semibold">Wellness AI Assistant</div>
                    <div className="text-sm text-muted-foreground">Supportive chat, tools, and next steps</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <ChatBubble role="assistant" text="I can help you calm down, find resources, start mood tracking, or open a check-in." />
                  <ChatBubble role="user" text="I feel anxious and cannot focus." />
                  <ChatBubble role="assistant" text="Let's regulate first: breathe in for 4, hold for 4, breathe out for 6. Then choose one tiny task." />
                </div>
                <div className="mt-auto flex flex-wrap gap-2 pt-5">
                  {["Breathing", "Mood tracking", "Resources"].map((item) => (
                    <span key={item} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-muted-foreground">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.12} className="h-full">
              <div className="premium-card flex h-full flex-col p-6 md:p-7">
                <div className="flex items-center gap-2 text-primary">
                  <Lock className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-[0.22em]">Privacy first</span>
                </div>
                <h2 className="mt-4 text-3xl font-bold">A mental health product should feel safe before it feels smart.</h2>
                <p className="mt-4 text-muted-foreground">
                  MindSense keeps user accounts, assessment records, mood entries, and resource progress in the existing
                  Supabase-backed protected flow while the interface becomes calmer and more trustworthy.
                </p>
                <div className="mt-auto grid gap-3 pt-6">
                  {["Protected authenticated routes", "User-owned mood and test data", "Exportable history and reports"].map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <span className="text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="container mx-auto px-4 py-14 md:px-6">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">Use cases</p>
              <h2 className="mt-3 text-4xl font-bold md:text-5xl">Designed for people who need clarity, not pressure.</h2>
            </div>
          </Reveal>
          <Stagger className="mt-8 grid gap-5 md:grid-cols-3">
            {useCases.map((item) => (
              <PremiumTiltCard key={item.title} className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-xl font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.desc}</p>
              </PremiumTiltCard>
            ))}
          </Stagger>
        </section>

        <section className="container mx-auto px-4 pb-6 md:px-6">
          <Reveal>
            <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-6 text-amber-100 md:p-7">
              <div className="flex flex-col gap-4 md:flex-row md:items-start">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-300/15 text-amber-200">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Responsible wellness support</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    MindSense is built to support awareness, reflection, and early wellness guidance. It is not a
                    replacement for a licensed mental health professional or emergency care.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        <section className="container mx-auto px-4 pb-16 pt-8 md:px-6">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary/20 via-sky-400/10 to-violet-500/20 p-8 shadow-[var(--shadow-glow)] md:p-12">
              <div className="ambient-beams absolute inset-0 opacity-40" />
              <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <h2 className="text-4xl font-bold md:text-5xl">Take a 3-minute mental wellness check today.</h2>
                  <p className="mt-4 max-w-2xl text-muted-foreground">
                    Start gently, understand your patterns, and open support tools whenever you need them.
                  </p>
                </div>
                <Button asChild size="lg" className="premium-button px-7">
                  <Link to="/signup">
                    Create Account
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </div>
  );
};

const HeroMultimodalVisual = () => {
  const voiceBars = [22, 42, 30, 58, 38, 68, 48, 32, 54, 26];
  const chartBars = [32, 45, 40, 58, 53, 68, 60];
  const orbitNodes = [
    { icon: ClipboardList, label: "Text", className: "left-2 top-14 xl:top-16" },
    { icon: Mic2, label: "Voice", className: "right-3 top-14 xl:top-16" },
    { icon: ScanFace, label: "Video", className: "right-4 bottom-14 xl:bottom-16" },
    { icon: BarChart3, label: "Mood", className: "left-3 bottom-14 xl:bottom-16" },
  ];

  return (
    <div className="relative mx-auto w-full max-w-md md:max-w-lg xl:max-w-xl">
      <div className="absolute -left-8 top-8 h-36 w-36 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute -bottom-6 right-4 h-44 w-44 rounded-full bg-violet-500/20 blur-3xl" />

      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
        className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.065] p-3 shadow-[var(--shadow-glow)] backdrop-blur-2xl md:p-3.5 xl:p-4"
      >
        <div className="premium-grid absolute inset-0 opacity-35" />
        <div className="relative">
          <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-background/45 px-3.5 py-2">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-primary">MindSense AI fusion layer</div>
              <div className="mt-1 text-sm font-semibold xl:text-base">Multimodal detection console</div>
            </div>
            <div className="hidden rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] text-primary sm:block">
              Text + Voice + Video
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[0.7fr_1fr]">
            <div className="grid gap-3">
              <div className="rounded-[1.25rem] border border-white/10 bg-background/55 p-3">
                <div className="mb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    Questionnaire
                  </div>
                  <span className="text-xs text-muted-foreground">21 items</span>
                </div>
                <div className="space-y-2.5">
                  {["Mood", "Sleep", "Focus"].map((label, index) => (
                    <div key={label}>
                      <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                        <span>{label}</span>
                        <span>{[74, 58, 81][index]}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-violet-400"
                          initial={{ width: 0 }}
                          animate={{ width: `${[74, 58, 81][index]}%` }}
                          transition={{ duration: 1.1, delay: index * 0.14 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-white/10 bg-background/55 p-3">
                <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold">
                  <Mic2 className="h-4 w-4 text-primary" />
                  Voice pattern
                </div>
                <div className="flex h-16 items-center gap-1.5">
                  {voiceBars.map((height, index) => (
                    <motion.span
                      key={index}
                      className="w-2 flex-1 rounded-full bg-gradient-to-t from-primary to-sky-300"
                      style={{ height }}
                      animate={{ height: [height, Math.max(18, height - 18), height] }}
                      transition={{ duration: 1.6, repeat: Infinity, delay: index * 0.08 }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="relative min-h-[300px] overflow-hidden rounded-[1.45rem] border border-white/10 bg-background/55 p-3.5 xl:min-h-[330px]">
              <div className="absolute inset-x-10 top-8 h-28 rounded-full bg-gradient-to-r from-primary/20 via-sky-400/20 to-violet-400/20 blur-2xl" />
              <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/15 xl:h-56 xl:w-56" />
              <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-300/15 xl:h-44 xl:w-44" />

              <div className="relative flex h-44 items-center justify-center xl:h-52">
                {[0, 1, 2].map((ring) => (
                  <motion.div
                    key={ring}
                    className="absolute rounded-full border border-primary/20"
                    style={{ inset: `${ring * 22}px` }}
                    animate={{ scale: [1, 1.04, 1], opacity: [0.28, 0.62, 0.28] }}
                    transition={{ duration: 3.4 + ring, repeat: Infinity, delay: ring * 0.35 }}
                  />
                ))}

                {orbitNodes.map((node, index) => (
                  <motion.div
                    key={node.label}
                    className={`absolute ${node.className} z-20 flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.075] px-2.5 py-1.5 text-[11px] shadow-[var(--shadow-card)] backdrop-blur-xl`}
                    animate={{ y: [-3, 4, -3] }}
                    transition={{ duration: 2.8 + index * 0.2, repeat: Infinity, delay: index * 0.2 }}
                  >
                    <node.icon className="h-4 w-4 text-primary" />
                    {node.label}
                  </motion.div>
                ))}

                <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-[1.5rem] border border-primary/30 bg-primary/10 shadow-[var(--shadow-soft)] xl:h-28 xl:w-28">
                  <div className="absolute inset-3 rounded-[1.25rem] bg-gradient-to-br from-primary/25 via-sky-400/20 to-violet-400/25 blur-sm" />
                  <Brain className="relative h-12 w-12 text-primary xl:h-14 xl:w-14" />
                </div>
              </div>

              <div className="relative mt-1 grid gap-2.5 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-2.5">
                  <div className="mb-2.5 flex min-w-0 items-center gap-1.5">
                      <ScanFace className="h-4 w-4 text-primary" />
                    <span className="truncate text-[11px] font-semibold">Emotion scan</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {[62, 78, 44].map((value, index) => (
                      <div key={index} className="min-w-0 rounded-lg bg-white/[0.055] px-1 py-1.5 text-center">
                        <div className="text-[11px] font-bold leading-none">{value}%</div>
                        <div className="mt-1 whitespace-nowrap text-[8px] leading-none text-muted-foreground">{["Calm", "Focus", "Stress"][index]}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-3">
                  <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Mood report
                  </div>
                  <div className="flex h-12 items-end gap-1.5">
                    {chartBars.map((height, index) => (
                      <motion.span
                        key={index}
                        className="w-2 flex-1 rounded-full bg-gradient-to-t from-violet-400 to-primary"
                        style={{ height }}
                        animate={{ height: [height, Math.max(24, height - 12), height] }}
                        transition={{ duration: 1.9, repeat: Infinity, delay: index * 0.1 }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3 lg:col-span-2">
              {[
                { label: "Questionnaire", value: "Structured", icon: ClipboardList },
                { label: "Voice", value: "Tone ready", icon: Mic2 },
                { label: "Video", value: "Emotion map", icon: ScanFace },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.055] p-3">
                  <item.icon className="h-4 w-4 text-primary" />
                  <div className="mt-2 text-xs font-semibold">{item.value}</div>
                  <div className="text-[11px] text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

type ChatBubbleProps = {
  role: "assistant" | "user";
  text: string;
};

const ChatBubble = ({ role, text }: ChatBubbleProps) => (
  <div className={`flex ${role === "user" ? "justify-end" : "justify-start"}`}>
    <div
      className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm ${
        role === "user"
          ? "rounded-br-sm bg-primary text-primary-foreground"
          : "rounded-bl-sm border border-white/10 bg-white/[0.06] text-muted-foreground"
      }`}
    >
      {text}
    </div>
  </div>
);

export default Index;
