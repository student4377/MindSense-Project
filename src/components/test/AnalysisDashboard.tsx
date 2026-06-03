import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Brain,
  CheckCircle2,
  ClipboardList,
  Cpu,
  HeartPulse,
  Loader2,
  Mic,
  Radio,
  ScanFace,
  ShieldCheck,
  Video,
  Waves,
  type LucideIcon,
} from "lucide-react";
import type { TestData } from "@/pages/DepressionTest";
import type { FusionResult } from "@/lib/depressionAnalysis";

type AnalysisStage = "text" | "audio" | "video" | "fusion" | "report";

const STAGES: Array<{ id: AnalysisStage; label: string; detail: string; icon: LucideIcon }> = [
  { id: "text", label: "Text Processing", detail: "Structured questionnaire signal", icon: ClipboardList },
  { id: "audio", label: "Audio Processing", detail: "Voice clarity and activity checks", icon: Mic },
  { id: "video", label: "Video Processing", detail: "Lighting and capture readiness", icon: Video },
  { id: "fusion", label: "Multimodal Fusion", detail: "50% text, 25% audio, 25% video", icon: Brain },
  { id: "report", label: "Generating Report", detail: "White report document", icon: ShieldCheck },
];

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export default function AnalysisDashboard({
  data,
  result,
  onComplete,
}: {
  data: TestData;
  result: FusionResult;
  onComplete: () => Promise<void> | void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState("00:00");
  const sessionId = useMemo(
    () => Math.random().toString(16).slice(2, 6).toUpperCase() + "-" + Math.random().toString(16).slice(2, 6).toUpperCase(),
    [],
  );
  const phqPercent = clamp((result.phqScore / 24) * 100);
  const confidencePercent = clamp(result.confidence * 100);
  const audioQuality = clamp(data.audioMetrics?.qualityScore ?? 0);
  const videoQuality = clamp(data.videoMetrics?.qualityScore ?? 0);

  const textIndicators = useMemo(
    () => [
      { label: "PHQ severity", value: phqPercent, color: "bg-sky-400" },
      { label: "Model confidence", value: confidencePercent, color: "bg-violet-400" },
      { label: "Text gate", value: clamp((result.modalityDiagnostics?.gates?.text ?? 0) * 100), color: "bg-orange-400" },
      { label: "Narrative present", value: data.textNarrative?.trim() ? 100 : 0, color: "bg-emerald-400" },
    ],
    [confidencePercent, data.textNarrative, phqPercent, result.modalityDiagnostics?.gates?.text],
  );

  const videoIndicators = useMemo(
    () => [
      { label: "Lighting", value: clamp(((data.videoMetrics?.brightnessScore ?? 35) / 55) * 100), color: "bg-sky-400" },
      { label: "Duration", value: clamp(((data.videoMetrics?.durationSeconds ?? 0) / 20) * 100), color: "bg-violet-400" },
      { label: "File integrity", value: clamp(((data.videoMetrics?.sizeBytes ?? 0) / (420 * 1024)) * 100), color: "bg-emerald-400" },
      { label: "Capture quality", value: videoQuality, color: "bg-orange-400" },
    ],
    [data.videoMetrics, videoQuality],
  );

  const hasNarrative = Boolean(data.textNarrative?.trim());

  useEffect(() => {
    const interval = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(`00:${String(seconds).padStart(2, "0")}`);
    }, 500);
    return () => window.clearInterval(interval);
  }, [startedAt]);

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];

    STAGES.forEach((_, index) => {
      timers.push(
        window.setTimeout(() => {
          if (!cancelled) setActiveIndex(index);
        }, index * 1150),
      );
    });

    timers.push(
      window.setTimeout(() => {
        if (cancelled) return;
        setSaving(true);
        void Promise.resolve(onComplete()).finally(() => {
          if (!cancelled) setSaving(false);
        });
      }, STAGES.length * 1150 + 650),
    );

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [onComplete]);

  const progress = Math.min(100, Math.round(((activeIndex + (saving ? 1 : 0.45)) / STAGES.length) * 100));

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[#03101d] p-4 text-slate-100 shadow-[0_0_80px_rgba(14,165,233,0.16)] md:p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(34,211,238,0.16),transparent_36%),linear-gradient(90deg,rgba(14,165,233,0.1)_1px,transparent_1px),linear-gradient(rgba(14,165,233,0.08)_1px,transparent_1px)] bg-[size:100%_100%,42px_42px,42px_42px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />

      <div className="relative">
        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_24rem_1fr] lg:items-center">
          <div>
            <div className="text-lg font-extrabold uppercase tracking-[0.12em] text-cyan-300 md:text-2xl">
              Live Multimodal Analysis Dashboard
            </div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/80">
              MindSense depression screening fusion system
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-cyan-300/35 bg-cyan-400/10 px-5 py-3 shadow-[0_0_40px_rgba(34,211,238,0.12)]">
            <div className="text-sm font-bold uppercase tracking-[0.12em] text-sky-300">Analysis in progress...</div>
            <div className="mt-1 text-sm text-slate-200">Processing multimodal wellness signals</div>
          </div>
          <div className="flex flex-wrap items-center justify-start gap-3 text-xs text-slate-300 lg:justify-end">
            <span>Session ID: {sessionId}</span>
            <span className="h-4 w-px bg-white/10" />
            <span>Time: {elapsed}</span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 font-bold text-emerald-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
              Live
            </span>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(22rem,0.8fr)_minmax(0,0.95fr)]">
          <div className="grid gap-4">
            <DataPanel
              icon={ClipboardList}
              title="Text Analysis"
              status={activeIndex > 0 ? "Complete" : "Analyzing"}
              footerLabel="Confidence"
              footerValue={confidencePercent}
            >
              <div className="grid gap-4 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)]">
                <div className="rounded-xl border border-cyan-300/14 bg-slate-950/45 p-3">
                  <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Input Source</div>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    {data.textAnswers.length} required PHQ-style responses{hasNarrative ? " plus one written response" : ""} were completed for the questionnaire signal.
                  </p>
                </div>
                <GaugePanel label="PHQ Signal" value={phqPercent} accent="cyan" />
              </div>
              <div className="mt-4 rounded-xl border border-cyan-300/14 bg-slate-950/35 p-3">
                <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Detected indicators</div>
                <SignalBars items={textIndicators} />
              </div>
            </DataPanel>

            <DataPanel
              icon={ScanFace}
              title="Video Analysis"
              status={activeIndex > 2 ? "Complete" : activeIndex === 2 ? "Analyzing" : "Queued"}
              footerLabel="Video quality"
              footerValue={videoQuality}
            >
              <div className="grid gap-4 md:grid-cols-[12rem_minmax(0,1fr)]">
                <div className="relative min-h-48 overflow-hidden rounded-xl border border-cyan-300/14 bg-slate-950/50">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(34,211,238,0.15),transparent_45%)]" />
                  <div className="absolute left-1/2 top-1/2 h-28 w-20 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-cyan-300/60" />
                  <div className="absolute left-1/2 top-[42%] h-2 w-2 -translate-x-8 rounded-full bg-cyan-300" />
                  <div className="absolute left-1/2 top-[42%] h-2 w-2 translate-x-6 rounded-full bg-cyan-300" />
                  <div className="absolute left-1/2 top-[55%] h-8 w-px -translate-x-1/2 bg-cyan-300/40" />
                  <div className="absolute inset-x-7 top-1/2 h-px bg-cyan-300/20" />
                  <div className="absolute inset-y-7 left-1/2 w-px bg-cyan-300/20" />
                  <div className="absolute bottom-3 left-3 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-200">
                    Face frame ready
                  </div>
                </div>
                <div>
                  <SignalBars items={videoIndicators} />
                  <div className="mt-4 rounded-xl border border-cyan-300/14 bg-slate-950/35 p-3 text-sm leading-6 text-slate-300">
                    Duration {Math.round(data.videoMetrics?.durationSeconds ?? 0)}s. Brightness{" "}
                    {data.videoMetrics?.brightnessScore === null ? "not measured" : `${Math.round(data.videoMetrics?.brightnessScore ?? 0)}%`}.
                  </div>
                </div>
              </div>
            </DataPanel>
          </div>

          <div className="relative flex min-h-[34rem] flex-col items-center justify-center overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-slate-950/35 p-5 text-center">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.14),transparent_50%)]" />
            <FusionCore progress={progress} />
            <div className="relative mt-6 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">MindSense Learned Fusion Engine</div>
            <p className="relative mt-2 max-w-xs text-sm leading-6 text-slate-300">
              Projecting text, audio, and video embeddings into a learned PHQ-8 prediction space.
            </p>
            <div className="relative mt-6 w-full max-w-sm rounded-[1.5rem] border border-cyan-300/20 bg-slate-950/70 p-4 text-left">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-bold text-cyan-100">Analysis Progress</span>
                <span className="text-cyan-300">{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-cyan-950">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-cyan-300 to-violet-400"
                  animate={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-4 space-y-2">
                {STAGES.map((stage, index) => (
                  <StageRow key={stage.id} stage={stage} active={index === activeIndex} done={index < activeIndex || saving} />
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <DataPanel
              icon={Mic}
              title="Audio Analysis"
              status={activeIndex > 1 ? "Complete" : activeIndex === 1 ? "Analyzing" : "Queued"}
              footerLabel="Audio quality"
              footerValue={audioQuality}
            >
              <div className="rounded-xl border border-cyan-300/14 bg-slate-950/45 p-3">
                <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Live waveform</div>
                <Waveform activity={data.audioMetrics?.voiceActivityRatio ?? 0.35} />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_10rem]">
                <div className="rounded-xl border border-cyan-300/14 bg-slate-950/35 p-3">
                  <FeatureRows
                    rows={[
                      ["Voice activity", `${Math.round((data.audioMetrics?.voiceActivityRatio ?? 0) * 100)}%`],
                      ["Silence ratio", `${Math.round((data.audioMetrics?.silenceRatio ?? 0) * 100)}%`],
                      ["Peak volume", `${Math.round(data.audioMetrics?.peakVolume ?? 0)}`],
                      ["Language mode", "English / Urdu"],
                    ]}
                  />
                </div>
                <GaugePanel label="Signal Quality" value={audioQuality} accent="violet" compact />
              </div>
            </DataPanel>

            <DataPanel
              icon={HeartPulse}
              title="Wellness Report"
              status={saving ? "Saving" : activeIndex >= 4 ? "Generating" : "Queued"}
              footerLabel="Fusion confidence"
              footerValue={confidencePercent}
            >
              <div className="grid gap-4 md:grid-cols-[10rem_1fr]">
                <GaugePanel label="PHQ Severity" value={phqPercent} accent="emerald" compact />
                <div className="rounded-xl border border-cyan-300/14 bg-slate-950/35 p-3">
                  <FeatureRows
                    rows={[
                      ["PHQ prediction", `${result.phqScore.toFixed(1)}/24`],
                      ["Severity band", result.severityLabel],
                      ["Model source", result.source === "learned_model" ? result.modelVersion : "Questionnaire baseline"],
                      ["Confidence", `${Math.round(confidencePercent)}%`],
                    ]}
                  />
                </div>
              </div>
              <p className="mt-3 rounded-xl border border-cyan-300/14 bg-slate-950/35 p-3 text-sm leading-6 text-slate-300">
                {result.recommendation}
              </p>
            </DataPanel>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="rounded-[1.5rem] border border-cyan-300/18 bg-slate-950/45 p-4">
            <div className="text-sm font-bold uppercase tracking-[0.14em] text-cyan-300">Confidence Overview</div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <MiniDonut label="Model" value={confidencePercent} color="cyan" />
              <MiniDonut label="Audio" value={audioQuality} color="violet" />
              <MiniDonut label="Video" value={videoQuality} color="emerald" />
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-cyan-300/18 bg-slate-950/45 p-4">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-cyan-300">
              <Cpu className="h-4 w-4" />
              Thinking Log
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-300">
              {STAGES.map((stage, index) => (
                <div key={stage.id} className="flex items-center justify-between gap-3">
                  <span className="truncate">{stage.detail}</span>
                  <span className={`h-2 w-2 rounded-full ${index <= activeIndex ? "bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.9)]" : "bg-slate-700"}`} />
                </div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[1.5rem] border border-cyan-300/18 bg-slate-950/45 p-4">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-cyan-300">
              <Waves className="h-4 w-4" />
              Multimodal Fusion Visualization
            </div>
            <div className="relative mt-5 h-28">
              <FusionLines />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm font-bold text-cyan-200">
                Unified
                <br />
                Support Profile
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DataPanel({
  icon: Icon,
  title,
  status,
  footerLabel,
  footerValue,
  children,
}: {
  icon: LucideIcon;
  title: string;
  status: string;
  footerLabel: string;
  footerValue: number;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-cyan-300/25 bg-[#061a2b]/80 shadow-[inset_0_1px_0_rgba(125,211,252,0.18),0_0_30px_rgba(14,165,233,0.08)]">
      <div className="flex items-center justify-between gap-3 border-b border-cyan-300/18 bg-cyan-400/8 px-4 py-3">
        <h3 className="flex items-center gap-2 text-base font-extrabold uppercase tracking-[0.08em] text-slate-100">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-200">
            <Icon className="h-5 w-5" />
          </span>
          {title}
        </h3>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
          {status === "Complete" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> : <Radio className="h-3.5 w-3.5 animate-pulse text-cyan-300" />}
          {status}
        </span>
      </div>
      <div className="p-4">{children}</div>
      <div className="flex items-center gap-4 border-t border-cyan-300/14 px-4 py-3 text-sm">
        <span className="text-cyan-200">{footerLabel}</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-cyan-950">
          <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-300" style={{ width: `${clamp(footerValue)}%` }} />
        </div>
        <span className="font-bold text-cyan-200">{Math.round(footerValue)}%</span>
      </div>
    </div>
  );
}

function GaugePanel({ label, value, accent, compact = false }: { label: string; value: number; accent: "cyan" | "violet" | "emerald"; compact?: boolean }) {
  const colors = {
    cyan: "#22d3ee",
    violet: "#a78bfa",
    emerald: "#34d399",
  };
  const color = colors[accent];
  return (
    <div className={`flex flex-col items-center justify-center rounded-xl border border-cyan-300/14 bg-slate-950/45 p-3 ${compact ? "min-h-36" : "min-h-44"}`}>
      <div
        className={`${compact ? "h-24 w-24" : "h-32 w-32"} rounded-full p-2`}
        style={{ background: `conic-gradient(${color} ${clamp(value) * 3.6}deg, rgba(15,23,42,0.9) 0deg)` }}
      >
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#06101d]">
          <div className={`${compact ? "text-2xl" : "text-4xl"} font-extrabold text-slate-100`}>{Math.round(value)}%</div>
        </div>
      </div>
      <div className="mt-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">{label}</div>
    </div>
  );
}

function SignalBars({ items }: { items: Array<{ label: string; value: number; color: string }> }) {
  return (
    <div className="mt-3 space-y-3">
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 text-xs">
          <span className="text-slate-300">{item.label}</span>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div className={`h-full rounded-full ${item.color}`} style={{ width: `${clamp(item.value)}%` }} />
          </div>
          <span className="text-right text-slate-400">{Math.round(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

function FeatureRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="space-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-3 border-b border-white/5 pb-2 last:border-b-0 last:pb-0">
          <span className="text-slate-400">{label}</span>
          <span className="text-right font-semibold text-slate-100">{value}</span>
        </div>
      ))}
    </div>
  );
}

function Waveform({ activity }: { activity: number }) {
  const bars = Array.from({ length: 54 }, (_, index) => {
    const wave = Math.abs(Math.sin(index * 0.55)) * 32;
    const pulse = Math.abs(Math.cos(index * 0.19)) * 22;
    return 10 + (wave + pulse) * clamp(activity, 0.25, 0.95);
  });

  return (
    <div className="mt-4 flex h-24 items-center gap-1">
      {bars.map((height, index) => (
        <motion.div
          key={index}
          animate={{ height: [height * 0.68, height, height * 0.78] }}
          transition={{ repeat: Infinity, duration: 1.5 + (index % 7) * 0.08, delay: index * 0.015 }}
          className="w-1 flex-1 rounded-full bg-gradient-to-t from-violet-500 via-sky-400 to-cyan-300"
        />
      ))}
    </div>
  );
}

function FusionCore({ progress }: { progress: number }) {
  return (
    <div className="relative h-80 w-80">
      <motion.div
        className="absolute inset-0 rounded-full border border-cyan-300/25"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 28, ease: "linear" }}
      />
      <motion.div
        className="absolute inset-8 rounded-full border border-dashed border-sky-300/35"
        animate={{ rotate: -360 }}
        transition={{ repeat: Infinity, duration: 22, ease: "linear" }}
      />
      <div className="absolute inset-16 rounded-full border border-violet-300/25" />
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-cyan-300/70 via-cyan-300/10 to-cyan-300/70" />
      <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-gradient-to-r from-cyan-300/70 via-cyan-300/10 to-cyan-300/70" />

      <motion.div
        className="absolute inset-24 flex items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 via-sky-400 to-violet-500 text-slate-950 shadow-[0_0_70px_rgba(34,211,238,0.55)]"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ repeat: Infinity, duration: 2.4 }}
      >
        <Brain className="h-20 w-20" />
      </motion.div>

      {[
        { icon: ClipboardList, className: "left-6 top-1/2 -translate-y-1/2" },
        { icon: Mic, className: "right-6 top-1/2 -translate-y-1/2" },
        { icon: Video, className: "bottom-8 left-1/2 -translate-x-1/2" },
        { icon: HeartPulse, className: "left-1/2 top-8 -translate-x-1/2" },
      ].map((node, index) => {
        const Icon = node.icon;
        return (
          <motion.div
            key={index}
            className={`absolute ${node.className} flex h-14 w-14 items-center justify-center rounded-full border border-cyan-300/35 bg-cyan-400/12 text-cyan-200 shadow-[0_0_30px_rgba(34,211,238,0.22)]`}
            animate={{ boxShadow: ["0 0 20px rgba(34,211,238,0.18)", "0 0 42px rgba(34,211,238,0.45)", "0 0 20px rgba(34,211,238,0.18)"] }}
            transition={{ repeat: Infinity, duration: 2.1, delay: index * 0.2 }}
          >
            <Icon className="h-6 w-6" />
          </motion.div>
        );
      })}

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-cyan-300/20 bg-slate-950/70 px-4 py-1.5 text-xs font-bold text-cyan-200">
        {progress}% fused
      </div>
    </div>
  );
}

function StageRow({
  stage,
  active,
  done,
}: {
  stage: (typeof STAGES)[number];
  active: boolean;
  done: boolean;
}) {
  const Icon = stage.icon;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-cyan-300/10 bg-slate-950/45 p-2.5">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${done ? "bg-emerald-400 text-slate-950" : active ? "bg-cyan-400/15 text-cyan-200" : "bg-white/[0.06] text-slate-500"}`}>
        {done ? <CheckCircle2 className="h-4 w-4" /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-slate-100">{stage.label}</div>
        <div className="truncate text-xs text-slate-400">{stage.detail}</div>
      </div>
    </div>
  );
}

function MiniDonut({ label, value, color }: { label: string; value: number; color: "cyan" | "violet" | "emerald" }) {
  const colors = {
    cyan: "#22d3ee",
    violet: "#a78bfa",
    emerald: "#34d399",
  };
  return (
    <div className="text-center">
      <div
        className="mx-auto flex h-20 w-20 items-center justify-center rounded-full p-1.5"
        style={{ background: `conic-gradient(${colors[color]} ${clamp(value) * 3.6}deg, rgba(15,23,42,0.9) 0deg)` }}
      >
        <div className="flex h-full w-full items-center justify-center rounded-full bg-[#06101d] text-lg font-extrabold text-slate-100">
          {Math.round(value)}
        </div>
      </div>
      <div className="mt-2 text-xs text-slate-400">{label}</div>
    </div>
  );
}

function FusionLines() {
  return (
    <div className="absolute inset-0">
      {["top-3", "top-9", "top-16", "top-24"].map((top, index) => (
        <motion.div
          key={top}
          className={`absolute left-4 right-32 ${top} h-px origin-left bg-gradient-to-r from-cyan-300/10 via-cyan-300 to-transparent`}
          animate={{ scaleX: [0.4, 1, 0.55], opacity: [0.35, 1, 0.45] }}
          transition={{ repeat: Infinity, duration: 2 + index * 0.25, delay: index * 0.18 }}
        />
      ))}
      <div className="absolute right-28 top-1/2 h-20 w-20 -translate-y-1/2 rounded-full border border-cyan-300/25 shadow-[0_0_40px_rgba(34,211,238,0.2)]" />
      <div className="absolute right-32 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full bg-cyan-300/15 blur-sm" />
    </div>
  );
}
