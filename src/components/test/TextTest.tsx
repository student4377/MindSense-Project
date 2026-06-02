import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  CloudRain,
  Heart,
  Smile,
  Sparkles,
  Sun,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScreeningAnswer } from "@/lib/depressionAnalysis";

const QUESTIONS: Array<Pick<ScreeningAnswer, "id" | "question" | "domain">> = [
  {
    id: "interest",
    question: "Over the past two weeks, how often have you had little interest or pleasure in doing things?",
    domain: "interest",
  },
  {
    id: "mood",
    question: "Over the past two weeks, how often have you felt down, low, or hopeless?",
    domain: "mood",
  },
  {
    id: "sleep",
    question: "How often have you had trouble sleeping, sleeping too much, or waking without feeling rested?",
    domain: "sleep",
  },
  {
    id: "energy",
    question: "How often have you felt tired or had very little energy during the day?",
    domain: "energy",
  },
  {
    id: "appetite",
    question: "How often has your appetite changed, either eating much less or much more than usual?",
    domain: "appetite",
  },
  {
    id: "self-view",
    question: "How often have you felt bad about yourself or felt that you were not doing enough?",
    domain: "self_view",
  },
  {
    id: "focus",
    question: "How often have you had trouble concentrating on study, work, reading, or daily tasks?",
    domain: "focus",
  },
  {
    id: "movement",
    question: "How often have you felt physically slowed down, restless, or unable to settle?",
    domain: "movement",
  },
];

const OPTIONS: { icon: LucideIcon; label: string; phqScore: number; color: string; description: string }[] = [
  { icon: Sparkles, label: "Not at all", phqScore: 0, color: "#22d3ee", description: "This has not affected me" },
  { icon: Sun, label: "Several days", phqScore: 1, color: "#34d399", description: "It happened sometimes" },
  { icon: Waves, label: "More than half", phqScore: 2, color: "#facc15", description: "It happened often" },
  { icon: CloudRain, label: "Nearly every day", phqScore: 3, color: "#fb923c", description: "It happened most days" },
];

const ENCOURAGEMENTS: Record<number, string> = {
  2: "Thank you for answering honestly.",
  4: "You are moving through this with care.",
  6: "Almost there. Keep going gently.",
};

export default function TextTest({
  onComplete,
}: {
  onComplete: (answers: ScreeningAnswer[]) => void;
}) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<ScreeningAnswer[]>([]);
  const [done, setDone] = useState(false);
  const [encourage, setEncourage] = useState<string | null>(null);

  const handle = (option: (typeof OPTIONS)[number]) => {
    const question = QUESTIONS[i];
    const legacyScore = 1 + option.phqScore * (4 / 3);
    const next = [
      ...answers,
      {
        id: question.id,
        question: question.question,
        answer: option.label,
        phqScore: option.phqScore,
        score: Number(legacyScore.toFixed(2)),
        domain: question.domain,
      },
    ];
    setAnswers(next);
    if (i + 1 >= QUESTIONS.length) {
      setDone(true);
      return;
    }

    const encouragement = ENCOURAGEMENTS[i + 1];
    if (encouragement) {
      setEncourage(encouragement);
      setTimeout(() => {
        setEncourage(null);
        setI(i + 1);
      }, 820);
    } else {
      setI(i + 1);
    }
  };

  const progress = ((i + (done ? 1 : 0)) / QUESTIONS.length) * 100;

  return (
    <div className="space-y-5">
      <section className="premium-card overflow-hidden p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-muted-foreground">Question {Math.min(i + 1, QUESTIONS.length)} of {QUESTIONS.length}</div>
            <h2 className="mt-1 text-2xl font-extrabold">Questionnaire assessment</h2>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-sm font-semibold text-primary">
            {Math.round(progress)}%
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.08]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary via-sky-400 to-violet-400"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35 }}
          />
        </div>
      </section>

      <AnimatePresence mode="wait">
        {encourage ? (
          <motion.section
            key="encouragement"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="premium-card flex min-h-[24rem] items-center justify-center overflow-hidden p-8 text-center"
          >
            <div>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <Heart className="h-7 w-7" />
              </div>
              <div className="mt-5 text-3xl font-extrabold gradient-text md:text-4xl">{encourage}</div>
            </div>
          </motion.section>
        ) : !done ? (
          <motion.section
            key={i}
            initial={{ opacity: 0, x: 26 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -26 }}
            transition={{ duration: 0.3 }}
            className="premium-card relative overflow-hidden p-5 md:p-8"
          >
            <div className="premium-grid pointer-events-none absolute inset-0 opacity-20" />
            <div className="pointer-events-none absolute right-0 top-0 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                <Smile className="h-3.5 w-3.5" />
                Question {i + 1}
              </div>
              <h3 className="mt-5 max-w-4xl text-3xl font-extrabold leading-tight md:text-4xl">{QUESTIONS[i].question}</h3>
              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-5">
                {OPTIONS.map((option, index) => {
                  const Icon = option.icon;
                  return (
                    <motion.button
                      key={option.label}
                      onClick={() => handle(option)}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      whileHover={{ y: -5, scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      className="group relative min-h-[10rem] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-left transition hover:border-white/20 hover:bg-white/[0.07]"
                    >
                      <div className="absolute inset-0 opacity-0 transition group-hover:opacity-100" style={{ background: `radial-gradient(circle at 40% 0%, ${option.color}35, transparent 58%)` }} />
                      <div className="relative">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/20" style={{ color: option.color }}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="mt-5 text-lg font-extrabold">{option.label}</div>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">{option.description}</p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.section>
        ) : (
          <motion.section
            key="done"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="premium-card relative overflow-hidden p-8 text-center md:p-12"
          >
            <div className="premium-grid pointer-events-none absolute inset-0 opacity-20" />
            <div className="relative">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-glow)]">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="mt-6 text-3xl font-extrabold">Questionnaire complete</h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                Your questionnaire signal is complete. Continue to the required 20-second voice sample for multimodal fusion.
              </p>
              <Button onClick={() => onComplete(answers)} size="lg" className="premium-button mt-7 px-7">
                Continue to voice test
              </Button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
