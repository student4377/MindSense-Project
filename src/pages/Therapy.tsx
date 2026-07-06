import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  Copy,
  Heart,
  HeartHandshake,
  History,
  Loader2,
  MapPin,
  Moon,
  Music2,
  Pause,
  Phone,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  UserRound,
  Volume2,
  Waves,
  Wind,
  X,
  type LucideIcon,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { PAKISTAN_MENTAL_HEALTH_DIRECTORY } from "@/data/pakistanMentalHealthDirectory";
import {
  buildSupportPlan,
  type DepressionTest,
  type MoodEntry,
  type SupportRecommendation,
} from "@/lib/supportRecommendations";

type SupportActivity = Tables<"support_activity_history">;
type MeditationStreak = Tables<"meditation_streaks">;
type ProfessionalRecord = Tables<"mental_health_professionals">;

type DirectoryProfessional = {
  id: string;
  name: string;
  role: string;
  specialization: string;
  city: string;
  location: string;
  address: string | null;
  phone: string | null;
  map_url: string | null;
  featured?: boolean;
  verification_status?: string;
};

type ActivityPayload = {
  activity_type: string;
  title: string;
  duration_seconds?: number;
  metadata?: Record<string, unknown>;
};

type MeditationSession = {
  mins: number;
  label: string;
  desc: string;
  theme: string;
  intention: string;
  icon: LucideIcon;
  accent: string;
  ambientSrc: string;
  ambientLabel: string;
  phases: MeditationPhase[];
};

type MeditationPhase = {
  start: number;
  title: string;
  cue: string;
  guidance: string;
};

type AudioCategory = "stress relief" | "sleep" | "focus" | "meditation" | "relaxation";

type AudioTrack = {
  id: string;
  name: string;
  category: AudioCategory;
  icon: LucideIcon;
  color: string;
  detail: string;
  src: string;
};

const QUOTES = [
  "Healing is not linear. Be patient with yourself.",
  "Small steps every day lead to meaningful change.",
  "Rest is productive. Breathe and begin again.",
  "Your feelings are valid. You are not alone.",
  "Progress, not perfection.",
  "Be kind to your mind today.",
];

const BREATH_MODES = {
  Relax: { in: 4, hold: 4, out: 6, label: "Relax", detail: "A soft reset for tense moments." },
  Anxiety: { in: 4, hold: 7, out: 8, label: "Anxiety Relief", detail: "Longer exhale for nervous system calm." },
  Focus: { in: 4, hold: 4, out: 4, label: "Focus", detail: "Balanced box breathing for attention." },
  Sleep: { in: 4, hold: 7, out: 8, label: "Sleep", detail: "A slower pattern for night wind-down." },
} as const;

type BreathKey = keyof typeof BREATH_MODES;

const MEDITATION_SESSIONS: MeditationSession[] = [
  {
    mins: 2,
    label: "Quick Reset",
    desc: "Fast grounding for stress spikes",
    theme: "Grounding",
    intention: "Return attention to the present moment with breath, body, and one small anchor.",
    icon: Sparkles,
    accent: "#22d3ee",
    ambientSrc: "/audio/wellness/calm.mp3",
    ambientLabel: "Soft calm ambience",
    phases: [
      { start: 0, title: "Arrive", cue: "Drop your shoulders.", guidance: "Sit comfortably. Let your hands rest. Notice that this moment is safe enough to pause." },
      { start: 0.25, title: "Breathe", cue: "Inhale 4, exhale 6.", guidance: "Breathe in gently for four counts. Breathe out slowly for six counts. Let the exhale soften your body." },
      { start: 0.55, title: "Ground", cue: "Name what is here.", guidance: "Notice one thing you can see, one thing you can feel, and one sound around you." },
      { start: 0.82, title: "Return", cue: "Choose one next step.", guidance: "Take one final breath and choose the smallest helpful action you can do next." },
    ],
  },
  {
    mins: 5,
    label: "Gentle Reset",
    desc: "Breath and body scan",
    theme: "Body scan",
    intention: "Reduce mental noise by relaxing the body from face to feet.",
    icon: Waves,
    accent: "#34d399",
    ambientSrc: "/audio/wellness/nature.mp3",
    ambientLabel: "Nature meditation ambience",
    phases: [
      { start: 0, title: "Settle In", cue: "Find a steady posture.", guidance: "Let your spine be easy, not stiff. Allow your eyes to soften or close." },
      { start: 0.18, title: "Breath Anchor", cue: "Follow the breath.", guidance: "Notice where the breath is easiest to feel: nose, chest, or belly. Stay with that place." },
      { start: 0.4, title: "Body Scan", cue: "Relax face, jaw, shoulders.", guidance: "Move attention through your face, jaw, neck, and shoulders. Release any unnecessary effort." },
      { start: 0.65, title: "Steady Mind", cue: "Thoughts can pass.", guidance: "If thoughts appear, label them thinking and return gently to your breath." },
      { start: 0.86, title: "Close Kindly", cue: "Notice one useful feeling.", guidance: "Before ending, notice one small sign of calm, steadiness, or courage." },
    ],
  },
  {
    mins: 10,
    label: "Deep Calm",
    desc: "Longer emotional regulation",
    theme: "Deep calm",
    intention: "Create a longer calm state through breathing, body relaxation, and compassionate reflection.",
    icon: Moon,
    accent: "#a78bfa",
    ambientSrc: "/audio/wellness/ocean.mp3",
    ambientLabel: "Ocean relaxation ambience",
    phases: [
      { start: 0, title: "Prepare", cue: "Make space.", guidance: "Sit or lie down comfortably. Let the room hold you for the next few minutes." },
      { start: 0.12, title: "Slow Breathing", cue: "Breathe low and slow.", guidance: "Let each inhale be quiet. Let each exhale be longer than the inhale." },
      { start: 0.28, title: "Full Body Release", cue: "Soften from head to feet.", guidance: "Scan slowly from the top of the head to the feet, releasing tension area by area." },
      { start: 0.5, title: "Emotional Space", cue: "Make room for feelings.", guidance: "If a feeling is present, name it gently. You do not have to fight it or solve it right now." },
      { start: 0.72, title: "Compassion", cue: "Speak kindly inward.", guidance: "Offer yourself one kind sentence, like: I am doing my best in this moment." },
      { start: 0.9, title: "Reorient", cue: "Return slowly.", guidance: "Feel the support under you. Notice the room again. Carry one calm breath into what comes next." },
    ],
  },
];

const TRACKS: AudioTrack[] = [
  {
    id: "rain-stress-relief",
    name: "Rain Stress Relief",
    category: "stress relief",
    icon: Waves,
    color: "from-sky-400 to-cyan-500",
    detail: "Soft rain ambience for pressure, tension, and overthinking.",
    src: "/audio/wellness/rain.mp3",
  },
  {
    id: "calm-sleep-ambient",
    name: "Calm Sleep Ambient",
    category: "sleep",
    icon: Moon,
    color: "from-indigo-400 to-violet-500",
    detail: "Gentle calm audio for slowing down before sleep.",
    src: "/audio/wellness/calm.mp3",
  },
  {
    id: "soft-piano-focus",
    name: "Soft Piano Focus",
    category: "focus",
    icon: Music2,
    color: "from-cyan-400 to-blue-500",
    detail: "Light piano for studying, journaling, and low-distraction work.",
    src: "/audio/wellness/piano.mp3",
  },
  {
    id: "nature-meditation",
    name: "Nature Meditation",
    category: "meditation",
    icon: Brain,
    color: "from-teal-300 to-emerald-500",
    detail: "Natural ambience for breathing, grounding, and quiet sitting.",
    src: "/audio/wellness/nature.mp3",
  },
  {
    id: "ocean-relaxation",
    name: "Ocean Relaxation",
    category: "relaxation",
    icon: Sun,
    color: "from-teal-400 to-sky-500",
    detail: "Ocean soundscape for calm resets and emotional decompression.",
    src: "/audio/wellness/ocean.mp3",
  },
];

const FALLBACK_PROFESSIONALS: DirectoryProfessional[] = PAKISTAN_MENTAL_HEALTH_DIRECTORY.map((person) => ({
  id: person.id,
  name: person.name,
  role: person.role,
  specialization: person.specialization,
  city: person.city,
  location: person.location,
  address: person.address,
  phone: person.phone ?? null,
  map_url: null,
  featured: false,
  verification_status: "public_source",
}));

type SleepTip = {
  icon: LucideIcon;
  title: string;
  desc: string;
  detail: string;
  benefits: string[];
  steps: string[];
};

const SLEEP_TIPS: SleepTip[] = [
  {
    icon: Moon,
    title: "Consistent Schedule",
    desc: "Sleep and wake up at the same time daily.",
    detail: "A consistent schedule strengthens your circadian rhythm and makes rest easier to predict.",
    benefits: ["Improves sleep quality", "Supports daytime energy", "Helps emotional balance"],
    steps: ["Pick a fixed bedtime and wake time.", "Set a gentle bedtime reminder.", "Dim lights in the last hour."],
  },
  {
    icon: ShieldCheck,
    title: "Screen-Free Hour",
    desc: "Avoid screens 60 minutes before bed.",
    detail: "Reducing bright screens at night helps your mind slow down and supports natural melatonin timing.",
    benefits: ["Calmer mind", "Less late-night scrolling", "Faster wind-down"],
    steps: ["Put your phone away from the bed.", "Use warm lights.", "Replace scrolling with reading or breathing."],
  },
  {
    icon: Heart,
    title: "Journal Worries",
    desc: "Write down what is on your mind.",
    detail: "Writing worries down helps move them from mental loops into a clearer, more manageable place.",
    benefits: ["Reduces racing thoughts", "Creates emotional clarity", "Supports reflection"],
    steps: ["Write for five minutes.", "List one worry and one tiny next step.", "End with one thing you appreciate."],
  },
  {
    icon: Wind,
    title: "4-7-8 Breathing",
    desc: "Inhale 4, hold 7, exhale 8.",
    detail: "A longer exhale can cue your nervous system toward calm and help the body prepare for sleep.",
    benefits: ["Lowers tension", "Quiets the mind", "Easy to repeat in bed"],
    steps: ["Inhale through your nose for 4.", "Hold for 7.", "Exhale slowly for 8. Repeat 4 cycles."],
  },
];

const AFFIRMATIONS = [
  "Healing takes time, and that is okay.",
  "You deserve peace and kindness.",
  "Small progress is still progress.",
  "I am safe in this moment.",
  "My feelings are valid.",
  "I am doing the best I can.",
];

const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const formatDateTime = (value?: string | null) => {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

const localDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getYesterdayKey = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return localDateKey(date);
};

const isMissingSupportTableError = (message?: string) =>
  Boolean(message?.includes("schema cache") || message?.includes("does not exist"));

function Hero() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * QUOTES.length));

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_18%_12%,hsl(var(--primary)/0.18),transparent_30%),radial-gradient(circle_at_88%_0%,rgba(167,139,250,0.18),transparent_28%),rgba(255,255,255,0.055)] p-4 shadow-[var(--shadow-card)] backdrop-blur-2xl sm:p-5 md:p-6">
      <div className="premium-grid pointer-events-none absolute inset-0 opacity-25" />
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-stretch">
        <div className="min-w-0 rounded-[1.5rem] border border-white/10 bg-black/10 p-4 sm:p-5 md:p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
            <HeartHandshake className="h-4 w-4" />
            Therapy and Support
          </div>
          <h1 className="mt-4 max-w-3xl break-words text-[clamp(2.2rem,3.2vw,3.75rem)] font-extrabold leading-[1.05] [text-wrap:balance]">
            Your calm support hub,
            <span className="block gradient-text">guided by your data.</span>
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
            Turn mood entries and assessment results into realistic support actions: breathing, meditation, sleep routines,
            calming audio, and verified professional follow-up paths.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="premium-button">
              <Link to="/test">
                Begin Journey
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full border-white/10 bg-white/[0.04]">
              <Link to="/mood">Log Mood</Link>
            </Button>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0b1320]/78 p-4 sm:p-5">
          <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
              <Sparkles className="h-4 w-4" />
              Daily Motivation
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="min-h-24 text-xl font-extrabold leading-snug md:text-2xl"
              >
                {QUOTES[idx]}
              </motion.p>
            </AnimatePresence>
            <Button
              size="sm"
              variant="outline"
              className="mt-4 rounded-full border-white/10 bg-white/[0.04]"
              onClick={() => setIdx((current) => (current + 1 + Math.floor(Math.random() * (QUOTES.length - 1))) % QUOTES.length)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              New Motivation
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function CrisisSupportCard() {
  return (
    <section className="rounded-[1.5rem] border border-amber-300/20 bg-amber-300/10 p-5 md:p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-300/15 text-amber-200">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-amber-100">Crisis support in Pakistan</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-amber-100/75">
              MindSense is not emergency care. If there is immediate danger, call local emergency services, go to the nearest
              hospital emergency department, or ask a trusted person to stay with you right now.
            </p>
          </div>
        </div>
        <div className="grid gap-2 text-sm text-amber-50/85">
          <div className="rounded-2xl border border-amber-300/20 bg-black/10 p-3">
            <span className="font-bold text-amber-100">Emergency:</span> Police 15 or Rescue 1122 where available
          </div>
          <div className="rounded-2xl border border-amber-300/20 bg-black/10 p-3">
            <span className="font-bold text-amber-100">Next safe step:</span> contact a trusted family member, friend, doctor,
            or nearby hospital.
          </div>
        </div>
      </div>
    </section>
  );
}

function Breathing({ onComplete }: { onComplete: (payload: ActivityPayload) => void }) {
  const [mode, setMode] = useState<BreathKey>("Relax");
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");
  const [cycles, setCycles] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const current = BREATH_MODES[mode];

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    let timeout: ReturnType<typeof setTimeout>;

    const cycle = (nextPhase: "in" | "hold" | "out") => {
      setPhase(nextPhase);
      timeout = setTimeout(() => {
        if (nextPhase === "in") cycle("hold");
        else if (nextPhase === "hold") cycle("out");
        else {
          setCycles((count) => count + 1);
          cycle("in");
        }
      }, current[nextPhase] * 1000);
    };

    cycle("in");
    return () => clearTimeout(timeout);
  }, [current, running]);

  const reset = () => {
    setRunning(false);
    setPhase("in");
    setCycles(0);
    setSeconds(0);
  };

  const finishSession = () => {
    if (seconds >= 15 || cycles > 0) {
      onComplete({
        activity_type: "breathing",
        title: `${current.label} breathing`,
        duration_seconds: seconds,
        metadata: { cycles, mode, pattern: `${current.in}-${current.hold}-${current.out}` },
      });
    }
    reset();
  };

  const phaseText = phase === "in" ? "Breathe In" : phase === "hold" ? "Hold" : "Breathe Out";
  const scale = phase === "out" ? 0.9 : 1.35;

  return (
    <section id="breathing-tools" className="premium-card relative overflow-hidden p-5 md:p-6">
      <div className="premium-grid pointer-events-none absolute inset-0 opacity-20" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Wind className="h-5 w-5 text-primary" />
              Breathing Exercises
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Completed sessions are saved to your account history.</p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-muted-foreground">
            {current.in}-{current.hold}-{current.out}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {(Object.keys(BREATH_MODES) as BreathKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setMode(key);
                reset();
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                mode === key
                  ? "border-primary/35 bg-primary/15 text-primary"
                  : "border-white/10 bg-white/[0.04] text-muted-foreground hover:text-foreground"
              }`}
            >
              {BREATH_MODES[key].label}
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center py-6">
          <div className="relative flex h-64 w-64 items-center justify-center">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <motion.span
                key={item}
                className="absolute h-2 w-2 rounded-full bg-primary/70"
                animate={
                  running
                    ? {
                        x: [0, Math.cos((item * Math.PI) / 3) * 128],
                        y: [0, Math.sin((item * Math.PI) / 3) * 128],
                        opacity: [0.85, 0],
                        scale: [1, 0.5],
                      }
                    : { x: 0, y: 0, opacity: 0.35, scale: 1 }
                }
                transition={{ duration: 4, repeat: running ? Infinity : 0, delay: item * 0.35 }}
              />
            ))}
            <motion.div
              className="absolute inset-8 rounded-full bg-gradient-to-br from-primary/25 to-sky-400/30 blur-xl"
              animate={running ? { scale } : { scale: 1 }}
              transition={{ duration: current[phase], ease: "easeInOut" }}
            />
            <motion.div
              className="relative flex h-44 w-44 flex-col items-center justify-center rounded-full bg-gradient-to-br from-primary to-sky-400 text-primary-foreground shadow-[var(--shadow-glow)]"
              animate={running ? { scale } : { scale: 1 }}
              transition={{ duration: current[phase], ease: "easeInOut" }}
            >
              <div className="text-sm font-semibold opacity-90">{running ? phaseText : "Ready"}</div>
              <div className="mt-1 text-3xl font-extrabold">{running ? current[phase] : "--"}</div>
            </motion.div>
          </div>

          <div className="grid w-full max-w-md grid-cols-3 gap-3 text-center">
            <ToolStat label="Cycles" value={String(cycles)} />
            <ToolStat label="Time" value={formatTime(seconds)} />
            <ToolStat label="Pattern" value={`${current.in}-${current.hold}-${current.out}`} />
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {!running ? (
              <Button className="premium-button" onClick={() => setRunning(true)}>
                <Play className="h-4 w-4" />
                Start Session
              </Button>
            ) : (
              <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={() => setRunning(false)}>
                <Pause className="h-4 w-4" />
                Pause
              </Button>
            )}
            <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={finishSession}>
              <CheckCircle2 className="h-4 w-4" />
              End and Save
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ToolStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="text-xl font-extrabold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

const getMeditationPhase = (session: MeditationSession, elapsed: number, total: number) => {
  if (!total) return session.phases[0];
  const progress = elapsed / total;
  return session.phases.reduce((current, phase) => (progress >= phase.start ? phase : current), session.phases[0]);
};

function Meditation({
  streak,
  onComplete,
}: {
  streak: MeditationStreak | null;
  onComplete: (session: MeditationSession, durationSeconds: number) => void;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [ambientEnabled, setAmbientEnabled] = useState(true);
  const completedRef = useRef(false);
  const ambientRef = useRef<HTMLAudioElement | null>(null);

  const session = active !== null ? MEDITATION_SESSIONS[active] : null;
  const total = session ? session.mins * 60 : 0;
  const percent = total ? (elapsed / total) * 100 : 0;
  const done = total > 0 && elapsed >= total;
  const phase = session ? getMeditationPhase(session, elapsed, total) : null;

  const stopAmbience = useCallback(() => {
    if (!ambientRef.current) return;
    ambientRef.current.pause();
    ambientRef.current.currentTime = 0;
    ambientRef.current.src = "";
    ambientRef.current = null;
  }, []);

  const playAmbience = useCallback(
    async (current: MeditationSession) => {
      if (!ambientEnabled) return;
      stopAmbience();
      const audio = new Audio(current.ambientSrc);
      audio.loop = true;
      audio.volume = 0.35;
      ambientRef.current = audio;
      try {
        await audio.play();
      } catch {
        toast({ title: "Ambient audio blocked", description: "Use the sound button after starting if your browser blocks autoplay." });
      }
    },
    [ambientEnabled, stopAmbience],
  );

  useEffect(() => {
    if (!running || active === null) return;
    const total = MEDITATION_SESSIONS[active].mins * 60;
    const id = window.setInterval(() => {
      setElapsed((value) => {
        const next = Math.min(value + 1, total);
        if (next >= total) {
          window.clearInterval(id);
          setRunning(false);
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [active, running]);

  useEffect(() => {
    if (active === null || !done || completedRef.current) return;
    completedRef.current = true;
    stopAmbience();
    onComplete(MEDITATION_SESSIONS[active], total);
  }, [active, done, onComplete, stopAmbience, total]);

  useEffect(() => () => stopAmbience(), [stopAmbience]);

  const selectSession = (index: number) => {
    stopAmbience();
    setActive(index);
    setElapsed(0);
    setRunning(false);
    completedRef.current = false;
    window.speechSynthesis?.cancel();
  };

  const startSession = () => {
    if (!session) return;
    setRunning(true);
    void playAmbience(session);
  };

  const pauseSession = () => {
    setRunning(false);
    ambientRef.current?.pause();
    window.speechSynthesis?.cancel();
  };

  const resumeSession = () => {
    if (!session) return;
    setRunning(true);
    if (ambientEnabled && ambientRef.current) {
      ambientRef.current.play().catch(() => undefined);
    } else {
      void playAmbience(session);
    }
  };

  const toggleAmbience = () => {
    if (!session) {
      setAmbientEnabled((value) => !value);
      return;
    }
    if (ambientEnabled) {
      setAmbientEnabled(false);
      stopAmbience();
    } else {
      setAmbientEnabled(true);
      if (running) void playAmbience(session);
    }
  };

  const speakGuidance = () => {
    if (!phase || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${phase.title}. ${phase.guidance}`);
    utterance.rate = 0.88;
    utterance.pitch = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <section id="meditation-tools" className="premium-card relative overflow-hidden p-5 md:p-6">
      <div className="premium-grid pointer-events-none absolute inset-0 opacity-20" />
      <div className="pointer-events-none absolute -right-20 top-4 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Brain className="h-5 w-5 text-primary" />
              Guided Meditation
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Choose a guided path with live prompts, ambient sound, and account streak tracking.</p>
          </div>
          <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {streak?.streak_count ?? 0} day streak
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {MEDITATION_SESSIONS.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => selectSession(index)}
                className={`group rounded-2xl border p-4 text-left transition ${
                  active === index ? "border-primary/35 bg-primary/12 shadow-[0_0_36px_rgba(45,212,191,0.1)]" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl text-[#06101d]" style={{ backgroundColor: item.accent }}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-xs font-bold text-muted-foreground">
                    {item.mins}m
                  </span>
                </div>
                <div className="mt-4 font-extrabold">{item.label}</div>
                <div className="mt-1 text-xs font-semibold text-primary">{item.theme}</div>
                <div className="mt-2 text-xs leading-5 text-muted-foreground">{item.desc}</div>
              </button>
            );
          })}
        </div>

        {session && phase && (
          <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/10 p-5">
            <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-stretch">
              <div className="flex flex-col items-center justify-center rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-4">
                <div className="relative h-48 w-48">
                  <motion.div
                    className="absolute inset-8 rounded-full blur-2xl"
                    style={{ backgroundColor: session.accent }}
                    animate={running ? { scale: [0.95, 1.18, 0.95], opacity: [0.22, 0.42, 0.22] } : { scale: 1, opacity: 0.2 }}
                    transition={{ duration: 6, repeat: running ? Infinity : 0, ease: "easeInOut" }}
                  />
                  <svg viewBox="0 0 200 200" className="relative h-full w-full -rotate-90">
                    <circle cx="100" cy="100" r="80" stroke="rgba(255,255,255,0.1)" strokeWidth="12" fill="none" />
                    <motion.circle
                      cx="100"
                      cy="100"
                      r="80"
                      stroke={session.accent}
                      strokeWidth="12"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 80}
                      animate={{ strokeDashoffset: 2 * Math.PI * 80 * (1 - percent / 100) }}
                      transition={{ duration: 0.5 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    {done ? (
                      <>
                        <CheckCircle2 className="h-8 w-8 text-primary" />
                        <div className="mt-1 text-sm font-semibold">Saved</div>
                      </>
                    ) : (
                      <>
                        <div className="text-3xl font-extrabold">{formatTime(total - elapsed)}</div>
                        <div className="text-xs text-muted-foreground">remaining</div>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-4 grid w-full grid-cols-2 gap-2 text-center">
                  <ToolStat label="Elapsed" value={formatTime(elapsed)} />
                  <ToolStat label="Session" value={`${session.mins}m`} />
                </div>
              </div>

              <div className="min-w-0 rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">{session.theme}</div>
                    <h3 className="mt-2 text-2xl font-extrabold">{phase.title}</h3>
                  </div>
                  <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs font-semibold text-muted-foreground">
                    {session.ambientLabel}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-6 text-muted-foreground">{session.intention}</p>

                <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/10 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Current guidance</div>
                  <p className="mt-2 text-lg font-extrabold leading-snug">{phase.cue}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{phase.guidance}</p>
                </div>

                <div className="mt-5 space-y-2">
                  {session.phases.map((item) => {
                    const activePhase = item.title === phase.title;
                    const passed = percent / 100 >= item.start;
                    return (
                      <div key={item.title} className={`flex items-center gap-3 rounded-2xl border px-3 py-2 text-sm transition ${activePhase ? "border-primary/35 bg-primary/12" : "border-white/10 bg-black/10"}`}>
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${passed ? "bg-primary" : "bg-white/20"}`}
                          style={activePhase ? { backgroundColor: session.accent } : undefined}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold">{item.title}</div>
                          <div className="text-xs text-muted-foreground">{item.cue}</div>
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground">{Math.round(item.start * session.mins * 60)}s</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {!running && !done && (
                <Button className="premium-button" onClick={elapsed > 0 ? resumeSession : startSession}>
                  <Play className="h-4 w-4" />
                  {elapsed > 0 ? "Continue Guided Session" : "Start Guided Session"}
                </Button>
              )}
              {running && (
                <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={pauseSession}>
                  <Pause className="h-4 w-4" />
                  Pause
                </Button>
              )}
              <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={toggleAmbience}>
                <Volume2 className="h-4 w-4" />
                {ambientEnabled ? "Ambient on" : "Ambient off"}
              </Button>
              <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={speakGuidance} disabled={!phase}>
                <Sparkles className="h-4 w-4" />
                Read guidance
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Music({
  recommendedCategory,
  onPlay,
}: {
  recommendedCategory: AudioCategory;
  onPlay: (track: AudioTrack) => void;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current.src = "";
    audioRef.current = null;
  }, []);

  const startTrack = useCallback(
    (track: AudioTrack, index: number) => {
      stopAudio();
      const audio = new Audio(track.src);
      audio.loop = true;
      audio.volume = volume / 100;
      audio.preload = "auto";
      audioRef.current = audio;
      setActive(index);
      setProgress(0);
      audio.play()
        .then(() => {
          if (audioRef.current !== audio) return;
          setPlaying(true);
          onPlay(track);
        })
        .catch(() => {
          if (audioRef.current === audio) {
            stopAudio();
            setActive(null);
          }
          setPlaying(false);
          toast({ title: "Audio could not start", description: "Click play again or check that the audio file is available.", variant: "destructive" });
        });
    },
    [onPlay, stopAudio, volume],
  );

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) {
        setProgress((value) => (value + 0.35) % 100);
        return;
      }
      setProgress((audio.currentTime / audio.duration) * 100);
    }, 250);
    return () => window.clearInterval(id);
  }, [playing]);

  useEffect(() => () => stopAudio(), [stopAudio]);

  const activeTrack = active !== null ? TRACKS[active] : null;
  const ActiveIcon = activeTrack?.icon || Music2;

  return (
    <section id="wellness-audio" className="premium-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Music2 className="h-5 w-5 text-primary" />
            Wellness Audio
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Real calming audio for rain, nature, ocean, piano, sleep, and relaxation support.</p>
        </div>
        <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          Suggested: {recommendedCategory}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TRACKS.map((track, index) => {
          const Icon = track.icon;
          const isRecommended = track.category === recommendedCategory;
          return (
            <motion.button
              key={track.id}
              type="button"
              whileHover={{ y: -3, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (active === index && playing) {
                  audioRef.current?.pause();
                  setPlaying(false);
                  return;
                }
                startTrack(track, index);
              }}
              className={`relative overflow-hidden rounded-2xl border p-4 text-left transition ${
                active === index
                  ? "border-primary/35 bg-primary/12"
                  : isRecommended
                    ? "border-sky-300/25 bg-sky-300/10"
                    : "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]"
              }`}
            >
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${track.color} text-white`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-3 font-bold">{track.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">{track.detail}</div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] capitalize text-muted-foreground">
                  {track.category}
                </span>
                {active === index && playing && <span className="text-xs font-bold text-primary">Playing</span>}
              </div>
            </motion.button>
          );
        })}
      </div>

      {activeTrack && active !== null && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4">
          <div className="flex items-center gap-4">
            <motion.div
              className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${activeTrack.color} text-white shadow-[var(--shadow-glow)]`}
              animate={playing ? { rotate: 360 } : {}}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            >
              <ActiveIcon className="h-6 w-6" />
            </motion.div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{activeTrack.name}</div>
              <div className="mt-1 flex h-6 items-end gap-0.5">
                {Array.from({ length: 36 }).map((_, index) => (
                  <motion.span
                    key={index}
                    className="flex-1 rounded-sm bg-primary/60"
                    animate={playing ? { scaleY: [0.3, 0.9, 0.35] } : { scaleY: 0.3 }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: index * 0.025 }}
                    style={{ originY: 1 }}
                  />
                ))}
              </div>
            </div>
            <Button
              size="icon"
              className="rounded-full bg-primary text-primary-foreground"
              onClick={() => {
                if (playing) {
                  audioRef.current?.pause();
                  setPlaying(false);
                } else {
                  if (audioRef.current) {
                    audioRef.current.play().then(() => setPlaying(true)).catch(() => {
                      toast({ title: "Audio could not resume", description: "Try selecting the track again.", variant: "destructive" });
                    });
                  } else {
                    startTrack(activeTrack, active);
                  }
                }
              }}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-sky-400" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <input type="range" min={0} max={100} value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="flex-1 accent-primary" />
          </div>
        </div>
      )}
    </section>
  );
}

function SleepTipModal({
  tip,
  onClose,
  onComplete,
}: {
  tip: SleepTip;
  onClose: () => void;
  onComplete: (tip: SleepTip) => void;
}) {
  const Icon = tip.icon;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#030712]/72 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 18 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 18 }}
        transition={{ type: "spring", damping: 22, stiffness: 220 }}
        onClick={(event) => event.stopPropagation()}
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-white/10 bg-[#0b111d]/95 p-6 shadow-2xl"
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/[0.04] p-2 hover:bg-white/[0.08]">
          <X className="h-4 w-4" />
        </button>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <h3 className="mt-5 text-2xl font-extrabold">{tip.title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{tip.detail}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">Benefits</div>
            <div className="space-y-2">
              {tip.benefits.map((benefit) => (
                <div key={benefit} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-muted-foreground">
                  {benefit}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">Steps</div>
            <div className="space-y-2">
              {tip.steps.map((step, index) => (
                <div key={step} className="flex gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-muted-foreground">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>
        <Button
          onClick={() => {
            onComplete(tip);
            onClose();
          }}
          className="premium-button mt-6 w-full"
        >
          Mark step complete
        </Button>
      </motion.div>
    </motion.div>
  );
}

function Sleep({ onComplete }: { onComplete: (payload: ActivityPayload) => void }) {
  const [openTip, setOpenTip] = useState<SleepTip | null>(null);

  return (
    <section id="sleep-tools" className="premium-card p-5 md:p-6">
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <Moon className="h-5 w-5 text-primary" />
        Sleep Improvement
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Open a sleep guide and mark it complete when you finish the step.</p>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {SLEEP_TIPS.map((tip) => {
          const Icon = tip.icon;
          return (
            <motion.button
              key={tip.title}
              type="button"
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setOpenTip(tip)}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-primary/30 hover:bg-white/[0.06]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div className="mt-3 font-bold">{tip.title}</div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">{tip.desc}</div>
              <div className="mt-2 text-xs font-semibold text-primary">Open guide</div>
            </motion.button>
          );
        })}
      </div>
      <AnimatePresence>
        {openTip && (
          <SleepTipModal
            tip={openTip}
            onClose={() => setOpenTip(null)}
            onComplete={(tip) =>
              onComplete({
                activity_type: "sleep",
                title: `${tip.title} sleep step`,
                duration_seconds: 0,
                metadata: { guide: tip.title },
              })
            }
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function SessionHistory({ activities, onDelete }: { activities: SupportActivity[]; onDelete: (activity: SupportActivity) => void }) {
  return (
    <section className="premium-card p-5 md:p-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <History className="h-5 w-5 text-primary" />
          Session History
        </h2>
      <p className="mt-1 text-sm text-muted-foreground">Breathing, meditation, audio, and sleep completions are shown here when account tracking is enabled.</p>
        <div className="mt-5 space-y-3">
          {activities.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm leading-6 text-muted-foreground">
              No support activities completed yet. Start a breathing, meditation, audio, or sleep guide to build your history.
            </div>
          ) : (
            activities.slice(0, 8).map((activity) => (
              <div key={activity.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-bold">{activity.title}</div>
                  <div className="mt-1 text-xs capitalize text-muted-foreground">
                    {activity.activity_type} - {formatDateTime(activity.completed_at)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {activity.duration_seconds > 0 && (
                    <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs text-muted-foreground">
                      {formatTime(activity.duration_seconds)}
                    </span>
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 rounded-full border-rose-300/20 bg-rose-400/10 text-rose-100 hover:bg-rose-400/15"
                    onClick={() => onDelete(activity)}
                    aria-label={`Delete ${activity.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </section>
  );
}

function Affirmation() {
  const [index, setIndex] = useState(0);
  const current = AFFIRMATIONS[index];

  const speak = () => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(current);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <section className="premium-card relative overflow-hidden p-5 text-center md:p-6">
      <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-primary">Daily Affirmation</div>
        <AnimatePresence mode="wait">
          <motion.p key={index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mx-auto mt-3 max-w-2xl text-2xl font-extrabold leading-snug">
            {current}
          </motion.p>
        </AnimatePresence>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button className="premium-button" onClick={() => setIndex((value) => (value + 1) % AFFIRMATIONS.length)}>
            <Sparkles className="h-4 w-4" />
            New Affirmation
          </Button>
          <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={speak}>
            <Volume2 className="h-4 w-4" />
            Play
          </Button>
          <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={() => navigator.clipboard?.writeText(current)}>
            <Copy className="h-4 w-4" />
            Copy
          </Button>
        </div>
      </div>
    </section>
  );
}

function Professionals() {
  const [city, setCity] = useState("All");
  const [query, setQuery] = useState("");
  const [professionals, setProfessionals] = useState<DirectoryProfessional[]>(FALLBACK_PROFESSIONALS);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  const loadProfessionals = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("mental_health_professionals")
      .select("*")
      .eq("is_published", true)
      .order("featured", { ascending: false })
      .order("city", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      if (!isMissingSupportTableError(error.message)) {
        toast({ title: "Could not load professional directory", description: error.message, variant: "destructive" });
      }
      setProfessionals(FALLBACK_PROFESSIONALS);
      setUsingFallback(true);
    } else {
      setProfessionals(((data ?? []) as ProfessionalRecord[]).map((person) => ({
        id: person.id,
        name: person.name,
        role: person.role,
        specialization: person.specialization,
        city: person.city,
        location: person.location,
        address: person.address,
        phone: person.phone,
        map_url: person.map_url,
        featured: person.featured,
        verification_status: person.verification_status,
      })));
      setUsingFallback(false);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadProfessionals();
  }, [loadProfessionals]);

  const cities = useMemo(
    () => ["All", ...Array.from(new Set(professionals.map((item) => item.city))).sort()],
    [professionals],
  );

  const filtered = useMemo(
    () =>
      professionals.filter(
        (person) =>
          (city === "All" || person.city === city) &&
          [person.name, person.role, person.specialization, person.location, person.city, person.address ?? ""].some((value) => value.toLowerCase().includes(query.toLowerCase())),
      ),
    [city, professionals, query],
  );

  return (
    <section id="professional-directory" className="premium-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <MapPin className="h-5 w-5 text-primary" />
            Professional Directory
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Publicly sourced mental health professionals and services in Pakistan. Professional listings should be independently verified before seeking medical consultation.
          </p>
        </div>
        <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={() => void loadProfessionals()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {usingFallback && (
        <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-100">
          Directory database is not active yet, so MindSense is showing bundled public listings.
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, specialization, city, or hospital" className="rounded-full border-white/10 bg-background pl-9" />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {cities.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCity(item)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                city === item ? "border-primary/35 bg-primary/15 text-primary" : "border-white/10 bg-white/[0.04] text-muted-foreground hover:text-foreground"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-64 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
          ))
        ) : (
          filtered.map((person) => <ProfessionalCard key={person.id} person={person} />)
        )}
        {!loading && filtered.length === 0 && <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-muted-foreground">No professionals found.</div>}
      </div>
    </section>
  );
}

function ProfessionalCard({ person }: { person: DirectoryProfessional }) {
  const mapUrl = person.map_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${person.location} ${person.address ?? ""} ${person.city} Pakistan`)}`;

  return (
    <motion.div whileHover={{ y: -3 }} className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <UserRound className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-bold">{person.name}</div>
            {person.featured && <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Featured</span>}
          </div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">{person.role}</div>
        </div>
      </div>
      <div className="mt-4 space-y-2 text-sm text-muted-foreground">
        <div className="rounded-xl border border-white/10 bg-black/10 p-3">{person.specialization}</div>
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>
            {person.location}, {person.city}
          </span>
        </div>
        {person.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{person.phone}</span>
          </div>
        )}
      </div>
      <div className="mt-auto pt-4">
        <Button asChild size="sm" variant="outline" className="w-full rounded-full border-white/10 bg-white/[0.04]">
          <a href={mapUrl} target="_blank" rel="noreferrer">
            <MapPin className="h-3.5 w-3.5" />
            Map
          </a>
        </Button>
      </div>
    </motion.div>
  );
}

export default function Therapy() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [moodEntries, setMoodEntries] = useState<MoodEntry[]>([]);
  const [latestTest, setLatestTest] = useState<DepressionTest | null>(null);
  const [activities, setActivities] = useState<SupportActivity[]>([]);
  const [meditationStreak, setMeditationStreak] = useState<MeditationStreak | null>(null);

  const loadSupportData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const [moodResult, testResult, activityResult, streakResult] = await Promise.all([
      supabase.from("mood_entries").select("*").eq("user_id", user.id).order("entry_date", { ascending: false }).limit(30),
      supabase.from("depression_tests").select("*").eq("user_id", user.id).eq("status", "completed").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("support_activity_history").select("*").eq("user_id", user.id).order("completed_at", { ascending: false }).limit(20),
      supabase.from("meditation_streaks").select("*").eq("user_id", user.id).maybeSingle(),
    ]);

    if (moodResult.error) toast({ title: "Could not load mood data", description: moodResult.error.message, variant: "destructive" });
    if (testResult.error) toast({ title: "Could not load assessment data", description: testResult.error.message, variant: "destructive" });
    if (activityResult.error && !isMissingSupportTableError(activityResult.error.message)) {
      toast({ title: "Could not load support history", description: activityResult.error.message, variant: "destructive" });
    }
    if (streakResult.error && !isMissingSupportTableError(streakResult.error.message)) {
      toast({ title: "Could not load meditation streak", description: streakResult.error.message, variant: "destructive" });
    }

    setMoodEntries(moodResult.data ?? []);
    setLatestTest(testResult.data ?? null);
    setActivities(activityResult.data ?? []);
    setMeditationStreak(streakResult.data ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading) void loadSupportData();
  }, [authLoading, loadSupportData]);

  const supportPlan = useMemo(() => buildSupportPlan(moodEntries, latestTest), [latestTest, moodEntries]);
  const recommendedAudioCategory: AudioCategory = supportPlan.mood.poorSleep
    ? "sleep"
    : supportPlan.mood.stressSignal
      ? "stress relief"
      : supportPlan.mood.lowMotivation
        ? "focus"
        : supportPlan.mood.lowMood
          ? "relaxation"
          : "meditation";

  const logActivity = useCallback(
    async (payload: ActivityPayload) => {
      if (!user) {
        toast({ title: "Sign in required", description: "Please sign in to save support activity.", variant: "destructive" });
        return null;
      }

      const { data, error } = await supabase
        .from("support_activity_history")
        .insert({
          user_id: user.id,
          activity_type: payload.activity_type,
          title: payload.title,
          duration_seconds: payload.duration_seconds ?? 0,
          metadata: (payload.metadata ?? {}) as Json,
        })
        .select("*")
        .single();

      if (error) {
        if (isMissingSupportTableError(error.message)) return null;
        toast({ title: "Could not save activity", description: error.message, variant: "destructive" });
        return null;
      }

      setActivities((current) => [data, ...current].slice(0, 20));
      return data;
    },
    [user],
  );

  const trackRecommendation = useCallback(
    async (recommendation: SupportRecommendation, source: string) => {
      if (!user) return;
      const { error } = await supabase.from("support_recommendation_events").insert({
        user_id: user.id,
        recommendation_type: recommendation.category,
        title: recommendation.title,
        source,
        metadata: { recommendation_id: recommendation.id, tone: recommendation.tone } as Json,
      });
      if (error && !isMissingSupportTableError(error.message)) {
        toast({ title: "Could not track recommendation", description: error.message, variant: "destructive" });
      }
    },
    [user],
  );

  const handleMeditationComplete = useCallback(
    async (session: MeditationSession, durationSeconds: number) => {
      if (!user) {
        toast({ title: "Sign in required", description: "Please sign in to save meditation progress.", variant: "destructive" });
        return;
      }

      const today = localDateKey(new Date());
      const yesterday = getYesterdayKey();
      const previousDate = meditationStreak?.last_completed_date ?? null;
      const nextStreak =
        previousDate === today
          ? Math.max(meditationStreak?.streak_count ?? 0, 1)
          : previousDate === yesterday
            ? (meditationStreak?.streak_count ?? 0) + 1
            : 1;
      const nextCompleted = (meditationStreak?.completed_sessions ?? 0) + 1;
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from("meditation_streaks")
        .upsert(
          {
            user_id: user.id,
            streak_count: nextStreak,
            completed_sessions: nextCompleted,
            last_completed_at: now,
            last_completed_date: today,
            updated_at: now,
          },
          { onConflict: "user_id" },
        )
        .select("*")
        .single();

      if (error) {
        if (isMissingSupportTableError(error.message)) {
          toast({ title: "Meditation completed", description: "Progress tracking will activate after account tracking is enabled." });
          return;
        }
        toast({ title: "Could not save meditation streak", description: error.message, variant: "destructive" });
        return;
      }

      setMeditationStreak(data);
      const savedActivity = await logActivity({
        activity_type: "meditation",
        title: `${session.label} meditation`,
        duration_seconds: durationSeconds,
        metadata: {
          minutes: session.mins,
          theme: session.theme,
          ambience: session.ambientLabel,
          phases: session.phases.map((phase) => phase.title),
        },
      });
      toast({
        title: "Meditation saved",
        description: savedActivity ? "Your streak and session history were updated." : "Your meditation streak was updated.",
      });
    },
    [logActivity, meditationStreak, user],
  );

  const handleDeleteActivity = useCallback(
    async (activity: SupportActivity) => {
      if (!user) {
        toast({ title: "Sign in required", description: "Please sign in to manage session history.", variant: "destructive" });
        return;
      }
      if (!confirm(`Delete "${activity.title}" from session history?`)) return;

      const { error } = await supabase
        .from("support_activity_history")
        .delete()
        .eq("id", activity.id)
        .eq("user_id", user.id);

      if (error) {
        if (isMissingSupportTableError(error.message)) {
          toast({ title: "History tracking unavailable", description: "Session history deletion will work after account tracking is enabled.", variant: "destructive" });
          return;
        }
        toast({ title: "Could not delete session", description: error.message, variant: "destructive" });
        return;
      }

      setActivities((current) => current.filter((item) => item.id !== activity.id));
      toast({ title: "Session deleted", description: "The record was removed from your history." });
    },
    [user],
  );

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <Hero />

        <section id="therapy-tools">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-extrabold">Therapy Tools</h2>
              <p className="mt-1 text-sm text-muted-foreground">Account-connected support tools users can open anytime.</p>
            </div>
            <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={() => void loadSupportData()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <Breathing onComplete={(payload) => void logActivity(payload).then((saved) => saved && toast({ title: "Session saved", description: "Your breathing session was added to history." }))} />
            <Meditation streak={meditationStreak} onComplete={(session, duration) => void handleMeditationComplete(session, duration)} />
            <Music
              recommendedCategory={recommendedAudioCategory}
              onPlay={(track) => {
                void trackRecommendation(
                  {
                    id: `audio-${track.id}`,
                    title: track.name,
                    detail: track.detail,
                    reason: `Recommended category: ${recommendedAudioCategory}`,
                    action: "Play audio",
                    category: "audio",
                    tone: "focus",
                    priority: 6,
                  },
                  "wellness_audio",
                );
                void logActivity({
                  activity_type: "audio",
                  title: `Played ${track.name}`,
                  metadata: { category: track.category, track_id: track.id },
                });
              }}
            />
            <Sleep onComplete={(payload) => void logActivity(payload).then((saved) => saved && toast({ title: "Sleep step saved", description: "Your support history was updated." }))} />
          </div>
        </section>

        <SessionHistory activities={activities} onDelete={handleDeleteActivity} />

        <div className="space-y-5">
          <Professionals />
          <Affirmation />
        </div>

        <CrisisSupportCard />

        <div className="flex items-center justify-center gap-2 py-2 text-center text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          MindSense provides emotional wellness support and is not a substitute for professional medical care.
        </div>
      </div>
    </DashboardLayout>
  );
}
