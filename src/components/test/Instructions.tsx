import { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  ClipboardList,
  Headphones,
  Lightbulb,
  Mic,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  Video,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const formats: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: ClipboardList, title: "Questionnaire", text: "Answer guided mental wellness questions in a calm focused flow." },
  { icon: Mic, title: "Voice", text: "Record a short voice sample when you are ready for the multimodal step." },
  { icon: Video, title: "Video", text: "Capture a short well-lit video clip for future emotion analysis." },
];

const tips = [
  "Find a quiet, well-lit space.",
  "Answer honestly; there are no wrong answers.",
  "This is a wellness screening, not a medical diagnosis.",
];

export default function Instructions({ onStart }: { onStart: () => void }) {
  const [agreed, setAgreed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = () => {
    if (!("speechSynthesis" in window)) return;
    if (playing) {
      window.speechSynthesis.cancel();
      setPlaying(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(
      "Welcome to your MindSense wellness check. This assessment includes questionnaire, voice, and video steps. Please sit in a quiet, well lit place and answer honestly.",
    );
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onend = () => setPlaying(false);
    utterRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setPlaying(true);
  };

  return (
    <div className="grid gap-5">
      <section className="premium-card relative overflow-hidden p-5 md:p-7">
        <div className="premium-grid pointer-events-none absolute inset-0 opacity-25" />
        <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
              <Sparkles className="h-4 w-4" />
              Calm assessment setup
            </div>
            <h2 className="mt-5 text-3xl font-extrabold leading-tight md:text-4xl">
              Prepare for a focused MindSense check-in.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              The flow collects questionnaire answers and media readiness signals so your report can become more complete when the AI models are connected.
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-black/15 p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Before you start
            </div>
            <div className="space-y-2">
              {tips.map((tip) => (
                <div key={tip} className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {tip}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {formats.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className="premium-card p-5"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-bold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="premium-card p-5 md:p-6">
          <div className="flex items-center gap-2">
            <Headphones className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">Voice guidance</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Listen to a short overview before beginning the assessment.</p>
          <Button onClick={speak} variant="outline" className="mt-5 rounded-full border-white/10 bg-white/[0.04]">
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playing ? "Pause guidance" : "Play guidance"}
            <Volume2 className="h-4 w-4" />
          </Button>
        </section>

        <section className="premium-card p-5 md:p-6">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">Consent and privacy</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Your responses belong to your account and are used to build your wellness history and report.
          </p>
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <Checkbox checked={agreed} onCheckedChange={(value) => setAgreed(Boolean(value))} className="mt-0.5" />
            <span className="text-sm leading-6">
              I consent to saving my questionnaire and media responses for this MindSense wellness assessment.
            </span>
          </label>
          <div className="mt-5 flex justify-end">
            <Button disabled={!agreed} onClick={onStart} size="lg" className="premium-button px-7">
              Start assessment
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
