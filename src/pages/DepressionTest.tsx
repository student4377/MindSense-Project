import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, Brain, CheckCircle2, ClipboardList, Mic, Sparkles, Video } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import Instructions from "@/components/test/Instructions";
import TextTest from "@/components/test/TextTest";
import VoiceTest from "@/components/test/VoiceTest";
import VideoTest from "@/components/test/VideoTest";
import AnalysisDashboard from "@/components/test/AnalysisDashboard";
import Results from "@/components/test/Results";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { toast } from "@/components/ui/use-toast";
import { updateHeaderTestCache } from "@/lib/headerCache";
import {
  buildFusionResult,
  type AudioSignalMetrics,
  type FusionResult,
  type ScreeningAnswer,
  type VideoSignalMetrics,
} from "@/lib/depressionAnalysis";

export type Phase = "intro" | "text" | "voice" | "video" | "analysis" | "result";

export type TestData = {
  textAnswers: ScreeningAnswer[];
  voicePath?: string;
  videoPath?: string;
  audioMetrics?: AudioSignalMetrics;
  videoMetrics?: VideoSignalMetrics;
};

type DepressionTestRow = Tables<"depression_tests">;

const phaseOrder: Phase[] = ["intro", "text", "voice", "video", "analysis", "result"];

const phaseMeta: Record<Phase, { label: string; short: string; icon: typeof Sparkles }> = {
  intro: { label: "Prepare Assessment", short: "Prepare", icon: Sparkles },
  text: { label: "Questionnaire Analysis", short: "Text", icon: ClipboardList },
  voice: { label: "Voice Signal Capture", short: "Voice", icon: Mic },
  video: { label: "Video Emotion Capture", short: "Video", icon: Video },
  analysis: { label: "Multimodal Fusion", short: "Fusion", icon: Activity },
  result: { label: "Wellness Report", short: "Report", icon: CheckCircle2 },
};

export default function DepressionTest() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("intro");
  const [data, setData] = useState<TestData>({ textAnswers: [] });
  const [analysisResult, setAnalysisResult] = useState<FusionResult | null>(null);
  const saveStartedRef = useRef(false);

  const idx = phaseOrder.indexOf(phase);
  const progress = (idx / (phaseOrder.length - 1)) * 100;
  const CurrentIcon = phaseMeta[phase].icon;

  const go = useCallback((p: Phase) => setPhase(p), []);

  const persistAssessment = useCallback(async () => {
    if (saveStartedRef.current || !analysisResult) {
      go("result");
      return;
    }

    saveStartedRef.current = true;
    if (!user || !data.voicePath || !data.videoPath || !data.audioMetrics || !data.videoMetrics) {
      toast({
        title: "Assessment saved locally only",
        description: "MindSense could not confirm every required signal before saving.",
        variant: "destructive",
      });
      go("result");
      return;
    }

    const { data: savedTest, error } = await supabase
      .from("depression_tests")
      .insert({
        user_id: user.id,
        text_answers: data.textAnswers as unknown as Json,
        voice_path: data.voicePath,
        video_path: data.videoPath,
        status: "completed",
      })
      .select("*")
      .single();

    if (error) {
      toast({
        title: "Assessment could not be saved",
        description: error.message,
        variant: "destructive",
      });
      go("result");
      return;
    }

    updateHeaderTestCache(user.id, savedTest as DepressionTestRow);

    const { error: resultError } = await supabase.from("results").insert({
      user_id: user.id,
      text_sentiment: `Questionnaire support signal ${analysisResult.textScore}/100`,
      voice_emotion: `Voice signal ${analysisResult.audioScore}/100`,
      face_emotion: `Video signal ${analysisResult.videoScore}/100`,
      depression_level: analysisResult.severityLabel,
      recommendation: analysisResult.recommendation,
    });

    if (resultError) {
      toast({
        title: "Report saved with limited analytics",
        description: resultError.message,
      });
    }

    go("result");
  }, [analysisResult, data.audioMetrics, data.textAnswers, data.videoMetrics, data.videoPath, data.voicePath, go, user]);

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
                Complete all three required inputs: questionnaire, 20-second voice, and 20-second video. The final report uses a 50/25/25 fusion.
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
                onComplete={(path, metrics) => {
                  setData((current) => ({ ...current, voicePath: path, audioMetrics: metrics }));
                  go("video");
                }}
              />
            )}
            {phase === "video" && (
              <VideoTest
                onComplete={(path, metrics) => {
                  if (!data.audioMetrics) {
                    toast({
                      title: "Voice signal missing",
                      description: "Please complete the voice step again before video analysis.",
                      variant: "destructive",
                    });
                    go("voice");
                    return;
                  }

                  const nextData = { ...data, videoPath: path, videoMetrics: metrics };
                  const nextResult = buildFusionResult(nextData.textAnswers, data.audioMetrics, metrics);
                  setData(nextData);
                  setAnalysisResult(nextResult);
                  saveStartedRef.current = false;
                  go("analysis");
                }}
              />
            )}
            {phase === "analysis" && analysisResult && (
              <AnalysisDashboard data={data} result={analysisResult} onComplete={persistAssessment} />
            )}
            {phase === "result" && (
              analysisResult ? (
                <Results
                  data={data}
                  result={analysisResult}
                  onRetake={() => {
                    setData({ textAnswers: [] });
                    setAnalysisResult(null);
                    saveStartedRef.current = false;
                    go("intro");
                  }}
                />
              ) : (
                <Instructions onStart={() => go("text")} />
              )
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
