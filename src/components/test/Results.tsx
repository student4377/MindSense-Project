import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Download,
  HeartHandshake,
  Mic,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TestData } from "@/pages/DepressionTest";
import type { FusionResult } from "@/lib/depressionAnalysis";

type ReportModality = {
  icon: LucideIcon;
  label: string;
  value: number;
  detail: string;
  note: string;
  color: string;
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export default function Results({
  data,
  result,
  onRetake,
}: {
  data: TestData;
  result: FusionResult;
  onRetake: () => void;
}) {
  const navigate = useNavigate();
  const reportId = useMemo(() => `MS-${Date.now().toString(36).toUpperCase().slice(-6)}`, []);
  const generatedAt = useMemo(
    () =>
      new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date()),
    [],
  );

  const breakdown: ReportModality[] = [
    {
      icon: Brain,
      label: "Text Input",
      value: data.textNarrative?.trim() ? 100 : 75,
      detail: `${data.textAnswers.length} structured responses${data.textNarrative?.trim() ? " + written response" : ""}`,
      note: data.textNarrative?.trim() ? "Ready for transformer text encoder" : "Questionnaire-only fallback input",
      color: "#22d3ee",
    },
    {
      icon: Mic,
      label: "Audio",
      value: data.audioMetrics?.qualityScore ?? 0,
      detail: `${Math.round((data.audioMetrics?.voiceActivityRatio ?? 0) * 100)}% voice activity`,
      note: "Ready for learned audio encoder",
      color: "#a78bfa",
    },
    {
      icon: Video,
      label: "Video",
      value: data.videoMetrics?.qualityScore ?? 0,
      detail: `${Math.round(data.videoMetrics?.durationSeconds ?? 0)} second camera capture`,
      note: "Ready for learned visual encoder",
      color: "#34d399",
    },
  ];

  const phqPercent = clamp((result.phqScore / 24) * 100);
  const confidencePercent = clamp(result.confidence * 100);
  const sourceLabel = result.source === "learned_model" ? result.modelVersion : "Questionnaire baseline";

  const nextSteps =
    result.severity === "minimal"
      ? ["Keep tracking your mood weekly.", "Maintain sleep and movement routines.", "Use resources when stress rises."]
      : result.severity === "mild"
        ? ["Track mood for the next 7 days.", "Try a 3-minute breathing reset.", "Use sleep support if rest is poor."]
        : result.severity === "moderate"
          ? ["Use therapy/support tools today.", "Share how you feel with a trusted person.", "Consider professional support if this continues."]
          : result.severity === "moderately_severe"
            ? ["Consider professional support soon.", "Ask a trusted person to stay connected today.", "Use crisis guidance if you feel unsafe."]
          : ["Consider professional support soon.", "Use crisis guidance if you feel unsafe.", "Ask a trusted person to stay connected today."];

  const riskRows = [
    {
      label: "Severity band",
      value: result.severityLabel,
      screenTone:
        result.severity === "minimal" || result.severity === "mild"
          ? "text-emerald-300"
          : result.severity === "moderate"
            ? "text-amber-300"
            : "text-rose-300",
      printTone:
        result.severity === "minimal" || result.severity === "mild"
          ? "text-[#047857]"
          : result.severity === "moderate"
            ? "text-[#b45309]"
          : "text-[#be123c]",
    },
    { label: "PHQ prediction", value: `${result.phqScore.toFixed(1)}/24`, screenTone: "text-cyan-200", printTone: "text-[#0f172a]" },
    { label: "Model source", value: sourceLabel, screenTone: "text-cyan-200", printTone: "text-[#0f172a]" },
    { label: "Confidence", value: `${Math.round(confidencePercent)}%`, screenTone: "text-cyan-200", printTone: "text-[#0f172a]" },
  ];

  return (
    <div className="space-y-5">
      <motion.article
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="wellness-report-screen premium-card relative overflow-hidden rounded-[2rem]"
      >
        <div className="premium-grid pointer-events-none absolute inset-0 opacity-25" />
        <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-primary/18 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-violet-400/15 blur-3xl" />

        <header className="relative border-b border-white/10 p-5 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                MindSense Wellness Report
              </div>
              <h1 className="mt-5 max-w-3xl text-3xl font-extrabold leading-tight md:text-5xl">
                Multimodal depression screening summary
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                MindSense maps questionnaire, written text, voice, and video signals to a PHQ-8 prediction through learned multimodal fusion. This is a wellness screening result, not a medical diagnosis.
              </p>
            </div>
            <div className="min-w-52 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
              <DarkInfoRow label="Report ID" value={reportId} />
              <DarkInfoRow label="Generated" value={generatedAt} />
              <DarkInfoRow label="Session" value="Completed" />
            </div>
          </div>
        </header>

        <main className="relative p-5 md:p-7">
          <section className="grid gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
            <div className="rounded-[1.75rem] border border-primary/20 bg-primary/8 p-5">
              <ScreenGauge value={phqPercent} label="PHQ Severity" />
              <div className="mt-5 text-center">
                <div className="text-2xl font-extrabold">{result.severityLabel}</div>
                <div className="mt-1 text-sm text-muted-foreground">PHQ {result.phqScore.toFixed(1)}/24 · Confidence {Math.round(confidencePercent)}%</div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Executive Summary</div>
                  <h2 className="mt-2 text-2xl font-extrabold">Screening interpretation</h2>
                </div>
                <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  {sourceLabel}
                </span>
              </div>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">{result.recommendation}</p>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {riskRows.map((row) => (
                  <div key={row.label} className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
                    <div className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{row.label}</div>
                    <div className={`mt-1 text-base font-extrabold ${row.screenTone}`}>{row.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-5 grid gap-4 md:grid-cols-3">
            {breakdown.map((item, index) => (
              <ScreenModalityCard key={item.label} item={item} index={index} />
            ))}
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <DarkPanel icon={CheckCircle2} title="Key Observations">
              <div className="space-y-3">
                {result.observations.map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm leading-6 text-muted-foreground">
                    {item}
                  </div>
                ))}
              </div>
            </DarkPanel>

            <DarkPanel icon={HeartHandshake} title="Recommended Next Steps">
              <div className="space-y-3">
                {nextSteps.map((step, index) => (
                  <div key={step} className="flex gap-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm leading-6 text-muted-foreground">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{index + 1}</span>
                    {step}
                  </div>
                ))}
              </div>
            </DarkPanel>
          </section>

          {(result.severity === "moderately_severe" || result.severity === "severe") && (
            <section className="mt-5 rounded-[1.5rem] border border-amber-300/25 bg-amber-300/10 p-5 text-amber-50">
              <div className="flex gap-3">
                <AlertTriangle className="mt-1 h-5 w-5 shrink-0" />
                <div>
                  <h3 className="font-extrabold">Safety note</h3>
                  <p className="mt-1 text-sm leading-6">
                    If you feel unsafe or at immediate risk, contact local emergency services, go to the nearest hospital emergency department, or ask a trusted person to stay with you now.
                  </p>
                </div>
              </div>
            </section>
          )}

          <section className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/15 p-5">
            <h3 className="flex items-center gap-2 text-lg font-extrabold">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Important disclaimer
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              MindSense is an AI-assisted wellness screening platform. This report does not diagnose depression or replace a licensed mental health professional. When the Python service is connected, modality importance is learned by the model rather than assigned by manual percentages.
            </p>
          </section>
        </main>
      </motion.article>

      <PrintReport
        reportId={reportId}
        generatedAt={generatedAt}
        result={result}
        breakdown={breakdown}
        nextSteps={nextSteps}
        riskRows={riskRows}
      />

      <section className="report-actions premium-card flex flex-wrap items-center justify-between gap-3 p-4 md:p-5">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Report actions
          </div>
          <h2 className="mt-3 text-2xl font-extrabold">Save or continue from your report.</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Download creates the clean white printable report. The on-screen report stays dark inside MindSense.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={() => window.print()}>
            <Download className="h-4 w-4" />
            Download report
          </Button>
          <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={onRetake}>
            <RotateCcw className="h-4 w-4" />
            Retake test
          </Button>
          <Button className="premium-button" onClick={() => navigate("/therapy")}>
            <HeartHandshake className="h-4 w-4" />
            Therapy and support
          </Button>
        </div>
      </section>
    </div>
  );
}

function PrintReport({
  reportId,
  generatedAt,
  result,
  breakdown,
  nextSteps,
  riskRows,
}: {
  reportId: string;
  generatedAt: string;
  result: FusionResult;
  breakdown: ReportModality[];
  nextSteps: string[];
  riskRows: Array<{ label: string; value: string; printTone: string }>;
}) {
  const phqPercent = clamp((result.phqScore / 24) * 100);
  const confidencePercent = clamp(result.confidence * 100);
  const sourceLabel = result.source === "learned_model" ? result.modelVersion : "Questionnaire baseline";

  return (
    <article className="wellness-report-print hidden bg-white text-[#0f172a]">
      <section className="report-print-page bg-white">
        <div className="relative overflow-hidden rounded-[2rem] border border-[#dbeafe] bg-[linear-gradient(135deg,#f8fafc_0%,#ecfeff_46%,#f5f3ff_100%)] px-8 py-7">
          <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-cyan-200/45 blur-3xl" />
          <div className="absolute -bottom-16 left-1/2 h-40 w-40 rounded-full bg-violet-200/45 blur-3xl" />
          <div className="relative flex items-start justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#bae6fd] bg-white/80 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.18em] text-[#0f766e]">
                MindSense Wellness Report
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-tight text-[#020617]">
                Multimodal Depression Screening Summary
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#475569]">
                A structured wellness report mapping questionnaire, written text, audio, and video evidence to an interpretable PHQ-8 severity band.
              </p>
            </div>
            <div className="min-w-52 rounded-2xl border border-[#e2e8f0] bg-white/90 p-4 text-sm shadow-sm">
              <PrintInfoRow label="Report ID" value={reportId} />
              <PrintInfoRow label="Generated" value={generatedAt} />
              <PrintInfoRow label="Purpose" value="Wellness screening" />
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-[15rem_minmax(0,1fr)] gap-5">
          <div className="rounded-[1.5rem] border border-[#e2e8f0] bg-[#f8fafc] p-5">
            <PrintGauge value={phqPercent} label="PHQ Severity" />
            <div className="mt-4 text-center">
              <div className="text-lg font-extrabold text-[#020617]">{result.severityLabel}</div>
              <div className="mt-1 text-sm text-[#64748b]">PHQ {result.phqScore.toFixed(1)}/24 · Confidence {Math.round(confidencePercent)}%</div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[#e2e8f0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#0f766e]">Executive Summary</div>
                <h2 className="mt-2 text-2xl font-extrabold text-[#020617]">Screening interpretation</h2>
              </div>
              <span className="rounded-full border border-[#bae6fd] bg-[#ecfeff] px-3 py-1 text-xs font-bold text-[#0f766e]">
                {sourceLabel}
              </span>
            </div>
            <p className="mt-4 text-sm leading-7 text-[#475569]">{result.recommendation}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {riskRows.map((row) => (
                <div key={row.label} className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
                  <div className="text-xs font-bold uppercase tracking-[0.12em] text-[#64748b]">{row.label}</div>
                  <div className={`mt-1 text-base font-extrabold ${row.printTone}`}>{row.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-[#dbeafe] bg-[#eff6ff] p-5">
          <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#2563eb]">How to read this report</div>
          <p className="mt-2 text-sm leading-6 text-[#334155]">
            PHQ-8 severity is shown as a clinical-style band. When the learned Python service is connected, text, audio, and video embeddings are fused by trainable gates instead of manually assigned percentages.
          </p>
        </div>

        <PrintFooter page="1 of 2" />
      </section>

      <section className="report-print-page bg-white">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-4">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#0f766e]">Signal Breakdown</div>
            <h2 className="mt-1 text-3xl font-extrabold text-[#020617]">Multimodal evidence map</h2>
          </div>
          <div className="rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-4 py-2 text-xs font-bold text-[#475569]">
            MindSense - AI Depression Detection & Therapy
          </div>
        </div>

        <section className="report-print-modalities mt-5 grid grid-cols-3 gap-3">
          {breakdown.map((item) => (
            <PrintModalityCard key={item.label} item={item} />
          ))}
        </section>

        <section className="report-print-section mt-5 grid grid-cols-2 gap-5">
          <div className="rounded-[1.5rem] border border-[#e2e8f0] bg-white p-5 shadow-sm">
            <h3 className="text-xl font-extrabold text-[#020617]">Key Observations</h3>
            <div className="mt-4 space-y-3">
              {result.observations.map((item) => (
                <div key={item} className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm leading-6 text-[#475569]">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[#e2e8f0] bg-white p-5 shadow-sm">
            <h3 className="text-xl font-extrabold text-[#020617]">Recommended Next Steps</h3>
            <div className="mt-4 space-y-3">
              {nextSteps.map((step, index) => (
                <div key={step} className="flex gap-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm leading-6 text-[#475569]">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0f766e] text-xs font-bold text-white">{index + 1}</span>
                  {step}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="report-print-section mt-5 rounded-[1.5rem] border border-[#e2e8f0] bg-[#f8fafc] p-5">
          <h3 className="text-lg font-extrabold text-[#020617]">Important disclaimer</h3>
          <p className="mt-2 text-sm leading-6 text-[#475569]">
            MindSense is an AI-assisted wellness screening platform. This report does not diagnose depression or replace a licensed mental health professional. When the Python service is connected, modality importance is learned by the model rather than assigned by manual percentages.
          </p>
        </section>

        <PrintFooter page="2 of 2" />
      </section>
    </article>
  );
}

function DarkInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/10 py-2 first:pt-0 last:border-b-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-bold">{value}</span>
    </div>
  );
}

function PrintFooter({ page }: { page: string }) {
  return (
    <footer className="report-print-footer mt-6 flex items-center justify-between border-t border-[#e2e8f0] pt-4 text-xs font-semibold text-[#64748b]">
      <span>MindSense - AI Depression Detection & Therapy</span>
      <span>{page}</span>
    </footer>
  );
}

function PrintInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#e2e8f0] py-2 first:pt-0 last:border-b-0 last:pb-0">
      <span className="text-[#64748b]">{label}</span>
      <span className="text-right font-bold text-[#0f172a]">{value}</span>
    </div>
  );
}

function ScreenGauge({ value, label }: { value: number; label: string }) {
  return (
    <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-full border border-white/10 bg-black/20 p-4">
      <div
        className="flex h-full w-full items-center justify-center rounded-full p-3 shadow-[0_0_70px_rgba(45,212,191,0.16)]"
        style={{ background: `conic-gradient(hsl(var(--primary)) ${clamp(value) * 3.6}deg, rgba(255,255,255,0.1) 0deg)` }}
      >
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-white/10 bg-[#0b111d] text-center">
          <div className="text-5xl font-extrabold gradient-text">{Math.round(value)}</div>
          <div className="mt-1 text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">/100</div>
          <div className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">{label}</div>
        </div>
      </div>
    </div>
  );
}

function PrintGauge({ value, label }: { value: number; label: string }) {
  return (
    <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-full bg-white p-3 shadow-[0_20px_70px_rgba(14,165,233,0.12)]">
      <div
        className="flex h-full w-full items-center justify-center rounded-full p-3"
        style={{ background: `conic-gradient(#14b8a6 ${clamp(value) * 3.6}deg, #e2e8f0 0deg)` }}
      >
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white text-center">
          <div className="text-5xl font-extrabold text-[#020617]">{Math.round(value)}</div>
          <div className="mt-1 text-xs font-extrabold uppercase tracking-[0.16em] text-[#64748b]">/100</div>
          <div className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-[#0f766e]">{label}</div>
        </div>
      </div>
    </div>
  );
}

function ScreenModalityCard({ item, index }: { item: ReportModality; index: number }) {
  const Icon = item.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-[#06101d]" style={{ backgroundColor: item.color }}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">Evidence</span>
      </div>
      <div className="mt-5 text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">{item.label}</div>
      <div className="mt-2 text-4xl font-extrabold">{Math.round(item.value)}/100</div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
      <p className="mt-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-xs font-semibold leading-5 text-muted-foreground">{item.note}</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full" style={{ width: `${clamp(item.value)}%`, backgroundColor: item.color }} />
      </div>
    </motion.div>
  );
}

function PrintModalityCard({ item }: { item: ReportModality }) {
  const Icon = item.icon;
  return (
    <div className="report-print-card rounded-[1.25rem] border border-[#e2e8f0] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: item.color }}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-3 py-1 text-xs font-bold text-[#475569]">Evidence</span>
      </div>
      <div className="mt-4 text-xs font-extrabold uppercase tracking-[0.16em] text-[#64748b]">{item.label}</div>
      <div className="mt-2 text-3xl font-extrabold text-[#020617]">{Math.round(item.value)}/100</div>
      <p className="mt-2 text-sm leading-5 text-[#475569]">{item.detail}</p>
      <p className="mt-3 rounded-2xl bg-[#f8fafc] px-3 py-2 text-xs font-semibold leading-5 text-[#64748b]">{item.note}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e2e8f0]">
        <div className="h-full rounded-full" style={{ width: `${clamp(item.value)}%`, backgroundColor: item.color }} />
      </div>
    </div>
  );
}

function DarkPanel({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5">
      <h3 className="mb-4 flex items-center gap-2 text-xl font-extrabold">
        <Icon className="h-5 w-5 text-primary" />
        {title}
      </h3>
      {children}
    </section>
  );
}
