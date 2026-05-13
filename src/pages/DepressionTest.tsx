import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Brain, CheckCircle2, ClipboardList, Mic, Sparkles, Video } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import Instructions from "@/components/test/Instructions";
import TextTest from "@/components/test/TextTest";
import VoiceTest from "@/components/test/VoiceTest";
import VideoTest from "@/components/test/VideoTest";
import Results from "@/components/test/Results";

export type Phase = "intro" | "text" | "voice" | "video" | "result";

export type TestData = {
  textAnswers: { question: string; answer: string; score: number }[];
  voicePath?: string;
  videoPath?: string;
};

const phaseOrder: Phase[] = ["intro", "text", "voice", "video", "result"];

const phaseMeta: Record<Phase, { label: string; short: string; icon: typeof Sparkles }> = {
  intro: { label: "Prepare Assessment", short: "Prepare", icon: Sparkles },
  text: { label: "Questionnaire Analysis", short: "Text", icon: ClipboardList },
  voice: { label: "Voice Signal Capture", short: "Voice", icon: Mic },
  video: { label: "Video Emotion Capture", short: "Video", icon: Video },
  result: { label: "Wellness Report", short: "Report", icon: CheckCircle2 },
};

export default function DepressionTest() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [data, setData] = useState<TestData>({ textAnswers: [] });

  const idx = phaseOrder.indexOf(phase);
  const progress = (idx / (phaseOrder.length - 1)) * 100;
  const CurrentIcon = phaseMeta[phase].icon;

  const go = (p: Phase) => setPhase(p);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_18%_10%,hsl(var(--primary)/0.18),transparent_30%),radial-gradient(circle_at_88%_0%,rgba(167,139,250,0.18),transparent_28%),rgba(255,255,255,0.055)] p-5 shadow-[var(--shadow-card)] backdrop-blur-2xl md:p-7">
          <div className="premium-grid pointer-events-none absolute inset-0 opacity-25" />
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-stretch">
            <div className="rounded-[1.5rem] border border-white/10 bg-black/10 p-5 md:p-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
                <CurrentIcon className="h-4 w-4" />
                {phaseMeta[phase].label}
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-[1.03] md:text-5xl xl:text-6xl">
                Depression test,
                <span className="block gradient-text">guided with care.</span>
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
                Complete the questionnaire, then capture optional voice and video signals for the full multimodal MindSense report.
              </p>

              <div className="mt-7">
                <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>Step {idx + 1} of {phaseOrder.length}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-primary via-sky-400 to-violet-400"
                    initial={false}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0b1320]/78 p-5">
              <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
              <div className="relative">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Brain className="h-4 w-4 text-primary" />
                  Assessment Flow
                </div>
                <div className="space-y-3">
                  {phaseOrder.map((item, index) => {
                    const Icon = phaseMeta[item].icon;
                    const active = item === phase;
                    const complete = index < idx;
                    return (
                      <div
                        key={item}
                        className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
                          active
                            ? "border-primary/35 bg-primary/12 text-foreground shadow-[0_0_36px_rgba(45,212,191,0.12)]"
                            : complete
                              ? "border-emerald-300/20 bg-emerald-400/8 text-foreground"
                              : "border-white/10 bg-white/[0.035] text-muted-foreground"
                        }`}
                      >
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-primary text-primary-foreground" : "bg-white/[0.06]"}`}>
                          {complete ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <Icon className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold">{phaseMeta[item].short}</div>
                          <div className="text-xs text-muted-foreground">{phaseMeta[item].label}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35 }}
          >
            {phase === "intro" && <Instructions onStart={() => go("text")} />}
            {phase === "text" && (
              <TextTest
                onComplete={(answers) => {
                  setData((current) => ({ ...current, textAnswers: answers }));
                  go("voice");
                }}
              />
            )}
            {phase === "voice" && (
              <VoiceTest
                onComplete={(path) => {
                  setData((current) => ({ ...current, voicePath: path }));
                  go("video");
                }}
              />
            )}
            {phase === "video" && (
              <VideoTest
                textAnswers={data.textAnswers}
                voicePath={data.voicePath}
                onComplete={(path) => {
                  setData((current) => ({ ...current, videoPath: path }));
                  go("result");
                }}
              />
            )}
            {phase === "result" && (
              <Results
                data={data}
                onRetake={() => {
                  setData({ textAnswers: [] });
                  go("intro");
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
