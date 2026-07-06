import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  HeartHandshake,
  LineChart,
  Mic,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import type { TestData } from "@/pages/DepressionTest";
import type { FusionResult, ScreeningAnswer } from "@/lib/depressionAnalysis";

type ReportModality = {
  icon: LucideIcon;
  label: string;
  value: number;
  detail: string;
  note: string;
  color: string;
};

type SymptomRow = {
  label: string;
  score: number;
  percent: number;
  answer: string;
};

type SeverityRange = {
  label: string;
  short: string;
  range: string;
  min: number;
  max: number;
  color: string;
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const severityRanges: SeverityRange[] = [
  { label: "Minimal", short: "Minimal", range: "0-4", min: 0, max: 4, color: "#10b981" },
  { label: "Mild", short: "Mild", range: "5-9", min: 5, max: 9, color: "#14b8a6" },
  { label: "Moderate", short: "Moderate", range: "10-14", min: 10, max: 14, color: "#f59e0b" },
  { label: "Moderately Severe", short: "Mod. Severe", range: "15-19", min: 15, max: 19, color: "#f97316" },
  { label: "Severe", short: "Severe", range: "20-24", min: 20, max: 24, color: "#ef4444" },
];

const domainLabels: Record<ScreeningAnswer["domain"], string> = {
  mood: "Mood",
  interest: "Interest",
  sleep: "Sleep Quality",
  energy: "Energy Level",
  appetite: "Appetite",
  self_view: "Self-Worth",
  focus: "Concentration",
  movement: "Movement",
};

const orderedDomains: ScreeningAnswer["domain"][] = [
  "interest",
  "mood",
  "sleep",
  "energy",
  "appetite",
  "self_view",
  "focus",
  "movement",
];

const riskProfile = (severity: FusionResult["severity"]) => {
  if (severity === "minimal" || severity === "mild") {
    return {
      label: "Low Risk",
      color: "#10b981",
      bg: "#ecfdf5",
      text: "Current screening pattern suggests lower support urgency. Continue regular mood tracking.",
    };
  }
  if (severity === "moderate") {
    return {
      label: "Moderate Risk",
      color: "#f59e0b",
      bg: "#fffbeb",
      text: "Current screening pattern suggests noticeable symptoms. Structured support is recommended.",
    };
  }
  if (severity === "moderately_severe") {
    return {
      label: "High Risk",
      color: "#f97316",
      bg: "#fff7ed",
      text: "Current screening pattern suggests elevated symptoms. Professional support should be considered soon.",
    };
  }
  return {
    label: "Critical Risk",
    color: "#ef4444",
    bg: "#fef2f2",
    text: "Current screening pattern suggests high symptom burden. Immediate support planning is recommended.",
  };
};

const clinicalNarrative = (result: FusionResult) => {
  const source =
    result.source === "learned_model"
      ? "The learned multimodal model analyzed questionnaire context, written text, audio features, and video features."
      : "The questionnaire baseline analyzed the structured PHQ-8 responses.";

  const severityText =
    result.severity === "minimal"
      ? "The pattern is currently consistent with minimal depressive symptom burden."
      : result.severity === "mild"
        ? "The pattern is consistent with mild depressive symptoms that may benefit from routine self-monitoring."
        : result.severity === "moderate"
          ? "The pattern is consistent with moderate depressive symptoms that may affect daily functioning."
          : result.severity === "moderately_severe"
            ? "The pattern is consistent with moderately severe symptoms and indicates a stronger need for support."
            : "The pattern is consistent with severe symptoms and should be treated as a high-support signal.";

  return `${source} ${severityText} This report is intended as an AI-assisted screening summary, not a medical diagnosis.`;
};

const confidenceNote = (confidencePercent: number) => {
  if (confidencePercent >= 75) return "High model certainty for this screening output.";
  if (confidencePercent >= 50) return "Moderate model certainty. Review symptoms and context together.";
  if (confidencePercent >= 25) return "Limited model certainty. Treat the score as a screening signal, not a firm conclusion.";
  return "Low model certainty. Use the result cautiously and rely on professional judgment for clinical decisions.";
};

const nextStepsForSeverity = (severity: FusionResult["severity"]) =>
  severity === "minimal"
    ? ["Continue weekly mood check-ins.", "Maintain consistent sleep, movement, and social routine.", "Use grounding exercises when stress increases."]
    : severity === "mild"
      ? ["Track mood and sleep for the next 7 days.", "Use a short breathing or mindfulness reset daily.", "Speak with a trusted person if symptoms persist."]
      : severity === "moderate"
        ? ["Create a structured support plan for this week.", "Consider speaking with a counselor or mental health professional.", "Share how you feel with someone trusted."]
        : severity === "moderately_severe"
          ? ["Consider professional support soon.", "Ask a trusted person to stay connected today.", "Use emergency or crisis support if you feel unsafe."]
          : ["Seek professional support as soon as possible.", "Do not stay alone if you feel unsafe.", "Contact local emergency or crisis services if there is immediate danger."];

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
  const { user } = useAuth();
  const reportId = useMemo(() => `MS-${Date.now().toString(36).toUpperCase().slice(-6)}`, []);
  const generatedAt = useMemo(
    () =>
      new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date()),
    [],
  );

  const patientName =
    String(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "MindSense user");
  const patientEmail = user?.email || "Not provided";
  const phqPercent = clamp((result.phqScore / 24) * 100);
  const confidencePercent = clamp(result.confidence * 100);
  const sourceLabel = result.source === "learned_model" ? result.modelVersion : "Questionnaire baseline";
  const risk = riskProfile(result.severity);
  const nextSteps = nextStepsForSeverity(result.severity);
  const narrative = clinicalNarrative(result);
  const observations = result.observations.filter((item) => item.trim()).slice(0, 4);

  const symptomRows = orderedDomains
    .map((domain) => {
      const answer = data.textAnswers.find((item) => item.domain === domain);
      if (!answer) return null;
      return {
        label: domainLabels[domain],
        score: answer.phqScore,
        percent: clamp((answer.phqScore / 3) * 100),
        answer: answer.answer,
      };
    })
    .filter(Boolean) as SymptomRow[];

  const learnedGates = result.modalityDiagnostics?.gates;
  const breakdown: ReportModality[] = [
    {
      icon: Brain,
      label: "Text Analysis",
      value: learnedGates?.text !== null && learnedGates?.text !== undefined ? learnedGates.text * 100 : data.textNarrative?.trim() ? 100 : 75,
      detail: `${data.textAnswers.length} PHQ-8 responses${data.textNarrative?.trim() ? " plus written narrative" : ""}`,
      note: learnedGates?.text !== null && learnedGates?.text !== undefined ? "Learned fusion gate contribution" : "Questionnaire and text readiness",
      color: "#0ea5e9",
    },
    {
      icon: Mic,
      label: "Audio Signal",
      value: learnedGates?.audio !== null && learnedGates?.audio !== undefined ? learnedGates.audio * 100 : data.audioMetrics?.qualityScore ?? 0,
      detail: `${Math.round((data.audioMetrics?.voiceActivityRatio ?? 0) * 100)}% voice activity`,
      note: learnedGates?.audio !== null && learnedGates?.audio !== undefined ? "Learned fusion gate contribution" : "Recording quality score",
      color: "#14b8a6",
    },
    {
      icon: Video,
      label: "Video Signal",
      value: learnedGates?.video !== null && learnedGates?.video !== undefined ? learnedGates.video * 100 : data.videoMetrics?.qualityScore ?? 0,
      detail: `${Math.round(data.videoMetrics?.durationSeconds ?? 0)} second camera capture`,
      note: learnedGates?.video !== null && learnedGates?.video !== undefined ? "Learned fusion gate contribution" : "Recording quality score",
      color: "#8b5cf6",
    },
  ];

  const summaryRows = [
    { label: "PHQ-8 Score", value: `${result.phqScore.toFixed(1)}/24` },
    { label: "Severity Level", value: result.severityLabel },
    { label: "AI Prediction Result", value: sourceLabel },
    { label: "Prediction Confidence", value: `${Math.round(confidencePercent)}%` },
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
                MindSense clinical-style report
              </div>
              <h1 className="mt-5 max-w-3xl text-3xl font-extrabold leading-tight md:text-5xl">
                AI-assisted depression screening summary
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                MindSense maps PHQ-8 responses, open text, voice, and video signals to a clinically interpretable screening report.
              </p>
            </div>
            <div className="min-w-52 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
              <DarkInfoRow label="Patient" value={patientName} />
              <DarkInfoRow label="Report ID" value={reportId} />
              <DarkInfoRow label="Generated" value={generatedAt} />
            </div>
          </div>
        </header>

        <main className="relative p-5 md:p-7">
          <section className="grid gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
            <div className="rounded-[1.75rem] border border-primary/20 bg-primary/8 p-5">
              <ScreenGauge value={phqPercent} label="PHQ-8 Severity" />
              <div className="mt-5 text-center">
                <div className="text-2xl font-extrabold">{result.severityLabel}</div>
                <div className="mt-1 text-sm text-muted-foreground">PHQ-8 {result.phqScore.toFixed(1)}/24 - Confidence {Math.round(confidencePercent)}%</div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Assessment Summary</div>
                  <h2 className="mt-2 text-2xl font-extrabold">Screening interpretation</h2>
                </div>
                <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  {sourceLabel}
                </span>
              </div>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">{narrative}</p>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {summaryRows.map((row) => (
                  <div key={row.label} className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
                    <div className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{row.label}</div>
                    <div className="mt-1 text-base font-extrabold text-cyan-200">{row.value}</div>
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

          {observations.length > 0 && (
            <section className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5">
              <h3 className="mb-4 flex items-center gap-2 text-xl font-extrabold">
                <FileText className="h-5 w-5 text-primary" />
                Model observations
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {observations.map((observation, index) => (
                  <div key={`${index}-${observation}`} className="flex gap-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm leading-6 text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{observation}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <DarkPanel icon={Activity} title="Symptom Signals">
              <div className="space-y-3">
                {symptomRows.slice(0, 5).map((item) => (
                  <SymptomBar key={item.label} item={item} dark />
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
        </main>
      </motion.article>

      <PrintReport
        reportId={reportId}
        generatedAt={generatedAt}
        patientName={patientName}
        patientEmail={patientEmail}
        result={result}
        breakdown={breakdown}
        symptomRows={symptomRows}
        nextSteps={nextSteps}
        risk={risk}
        narrative={narrative}
        confidencePercent={confidencePercent}
        sourceLabel={sourceLabel}
      />

      <section className="report-actions premium-card flex flex-wrap items-center justify-between gap-3 p-4 md:p-5">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Report actions
          </div>
          <h2 className="mt-3 text-2xl font-extrabold">Save or continue from your report.</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Download creates the clean white printable report. For best PDF export, disable browser headers and footers in the print dialog.
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
  patientName,
  patientEmail,
  result,
  breakdown,
  symptomRows,
  nextSteps,
  risk,
  narrative,
  confidencePercent,
  sourceLabel,
}: {
  reportId: string;
  generatedAt: string;
  patientName: string;
  patientEmail: string;
  result: FusionResult;
  breakdown: ReportModality[];
  symptomRows: SymptomRow[];
  nextSteps: string[];
  risk: ReturnType<typeof riskProfile>;
  narrative: string;
  confidencePercent: number;
  sourceLabel: string;
}) {
  const phqPercent = clamp((result.phqScore / 24) * 100);

  return (
    <article className="wellness-report-print hidden bg-white text-[#0f172a]">
      <section className="report-print-page report-cover-page">
        <div className="report-cover">
          <div className="report-brand-row">
            <div className="report-logo-mark">
              <Brain className="h-6 w-6" />
            </div>
            <div>
              <div className="report-logo-title">MindSense</div>
              <div className="report-logo-subtitle">AI Depression Detection System</div>
            </div>
          </div>

          <div className="report-cover-grid">
            <div>
              <div className="report-eyebrow">Depression Assessment Report</div>
              <h1>AI-Powered Mental Health Screening</h1>
              <p>
                A clinical-style PHQ-8 screening summary generated from questionnaire, text, audio, and video signals.
              </p>
            </div>
            <MentalHealthIllustration />
          </div>

          <div className="report-patient-grid">
            <PrintInfoCard label="Patient Name" value={patientName} />
            <PrintInfoCard label="Patient Email" value={patientEmail} />
            <PrintInfoCard label="Assessment Date & Time" value={generatedAt} />
            <PrintInfoCard label="Report ID" value={reportId} />
            <PrintInfoCard label="Generated By" value="MindSense AI Screening System" wide />
            <PrintInfoCard label="Assessment Status" value="Completed" />
          </div>
        </div>

        <section className="report-section">
          <SectionHeader icon={ClipboardList} eyebrow="Section 1" title="Assessment Summary" />
          <div className="report-summary-grid">
            <MetricTile label="PHQ-8 Score" value={`${result.phqScore.toFixed(1)}/24`} tone="#0ea5e9" />
            <MetricTile label="Severity Level" value={result.severityLabel} tone={risk.color} />
            <MetricTile label="AI Prediction Result" value={sourceLabel} tone="#14b8a6" compact />
            <MetricTile label="Prediction Confidence" value={`${Math.round(confidencePercent)}%`} tone="#8b5cf6" />
          </div>
        </section>

        <section className="report-section">
          <SectionHeader icon={TrendingUp} eyebrow="Section 2" title="Depression Severity Meter" />
          <SeverityMeter score={result.phqScore} />
        </section>

        <section className="report-section report-two-column">
          <div className="report-card">
            <SectionHeader icon={Brain} eyebrow="Section 3" title="AI Analysis" compact />
            <p className="report-narrative">{narrative}</p>
            {result.observations.length > 0 && (
              <div className="report-observation-list">
                {result.observations.slice(0, 4).map((observation, index) => (
                  <div key={`${index}-${observation}`} className="report-observation-item">
                    <span />
                    <p>{observation}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="report-card" style={{ background: risk.bg }}>
            <SectionHeader icon={ShieldCheck} eyebrow="Section 4" title="Risk Assessment" compact />
            <div className="risk-row">
              <span className="risk-dot" style={{ background: risk.color }} />
              <strong style={{ color: risk.color }}>{risk.label}</strong>
            </div>
            <p className="report-narrative">{risk.text}</p>
          </div>
        </section>

        <PrintFooter page="1 of 2" reportId={reportId} />
      </section>

      <section className="report-print-page">
        <div className="report-page-header">
          <div>
            <div className="report-eyebrow">MindSense Report Details</div>
            <h2>Clinical-Style Evidence Summary</h2>
          </div>
          <div className="report-id-pill">{reportId}</div>
        </div>

        <section className="report-section">
          <SectionHeader icon={Activity} eyebrow="Section 5" title="Symptom Analysis" />
          <div className="symptom-grid">
            {symptomRows.map((item) => (
              <SymptomBar key={item.label} item={item} />
            ))}
          </div>
        </section>

        <section className="report-section">
          <SectionHeader icon={FileText} eyebrow="Section 6" title="Detailed Score Interpretation" />
          <ScoreInterpretation currentSeverity={result.severityLabel} />
        </section>

        <section className="report-section report-two-column">
          <div className="report-card">
            <SectionHeader icon={Activity} eyebrow="Section 7" title="Confidence Visualization" compact />
            <div className="confidence-layout">
              <PrintGauge value={confidencePercent} label="Model Confidence" />
              <p>{confidenceNote(confidencePercent)}</p>
            </div>
          </div>

          <div className="report-card">
            <SectionHeader icon={LineChart} eyebrow="Section 8" title="Progress Tracking" compact />
            <div className="progress-placeholder">
              <div className="progress-mini-chart">
                <span style={{ height: "35%" }} />
                <span style={{ height: "48%" }} />
                <span style={{ height: `${Math.max(18, phqPercent)}%` }} />
              </div>
              <div>
                <strong>First assessment baseline</strong>
                <p>Future reports can compare previous and current PHQ-8 scores after more assessments are completed.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="report-section">
          <SectionHeader icon={Brain} eyebrow="Section 9" title="Multimodal Evidence" />
          <div className="report-modality-grid">
            {breakdown.map((item) => (
              <PrintModalityCard key={item.label} item={item} />
            ))}
          </div>
        </section>

        <section className="report-section report-two-column">
          <div className="report-card">
            <SectionHeader icon={HeartHandshake} eyebrow="Section 10" title="Personalized Recommendations" compact />
            <div className="recommendation-list">
              {nextSteps.map((step, index) => (
                <div key={step} className="recommendation-item">
                  <span>{index + 1}</span>
                  <p>{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="report-card disclaimer-card">
            <SectionHeader icon={AlertTriangle} eyebrow="Disclaimer" title="Important Note" compact />
            <p className="report-narrative">
              This report is generated using an AI-assisted depression screening system and is intended for educational and informational purposes only. It does not constitute a medical diagnosis. Users experiencing significant emotional distress should seek consultation from qualified mental health professionals.
            </p>
          </div>
        </section>

        <PrintFooter page="2 of 2" reportId={reportId} />
      </section>
    </article>
  );
}

function MentalHealthIllustration() {
  return (
    <div className="mental-illustration" aria-hidden="true">
      <div className="mental-head">
        <div className="mental-face" />
        <div className="mental-node node-one" />
        <div className="mental-node node-two" />
        <div className="mental-node node-three" />
        <div className="mental-arc" />
      </div>
      <div className="mental-card card-one" />
      <div className="mental-card card-two" />
    </div>
  );
}

function SectionHeader({ icon: Icon, eyebrow, title, compact = false }: { icon: LucideIcon; eyebrow: string; title: string; compact?: boolean }) {
  return (
    <div className={`report-section-header ${compact ? "compact" : ""}`}>
      <div className="report-section-icon">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="report-section-eyebrow">{eyebrow}</div>
        <h3>{title}</h3>
      </div>
    </div>
  );
}

function MetricTile({ label, value, tone, compact = false }: { label: string; value: string; tone: string; compact?: boolean }) {
  return (
    <div className="metric-tile" style={{ borderTopColor: tone }}>
      <div>{label}</div>
      <strong className={compact ? "compact-value" : ""}>{value}</strong>
    </div>
  );
}

function PrintInfoCard({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`print-info-card ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SeverityMeter({ score }: { score: number }) {
  const marker = clamp((score / 24) * 100);
  return (
    <div className="severity-meter">
      <div className="severity-track">
        {severityRanges.map((item) => (
          <div key={item.label} style={{ background: item.color }} />
        ))}
        <span className="severity-marker" style={{ left: `${marker}%` }}>
          <b>{score.toFixed(1)}</b>
        </span>
      </div>
      <div className="severity-label-grid">
        {severityRanges.map((item) => (
          <div key={item.label}>
            <strong>{item.short}</strong>
            <span>{item.range}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreInterpretation({ currentSeverity }: { currentSeverity: string }) {
  return (
    <div className="score-table">
      <div className="score-table-head">
        <span>Score Range</span>
        <span>Interpretation</span>
      </div>
      {severityRanges.map((item) => {
        const active = item.label === currentSeverity;
        return (
          <div key={item.label} className={active ? "active" : ""}>
            <span>{item.range}</span>
            <span>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function SymptomBar({ item, dark = false }: { item: SymptomRow; dark?: boolean }) {
  return (
    <div className={dark ? "symptom-row dark" : "symptom-row"}>
      <div className="symptom-row-top">
        <strong>{item.label}</strong>
        <span>{item.score}/3</span>
      </div>
      <div className="symptom-bar-track">
        <div style={{ width: `${item.percent}%` }} />
      </div>
      <p>{item.answer}</p>
    </div>
  );
}

function PrintGauge({ value, label }: { value: number; label: string }) {
  return (
    <div className="print-gauge" style={{ background: `conic-gradient(#14b8a6 ${clamp(value) * 3.6}deg, #e2e8f0 0deg)` }}>
      <div>
        <strong>{Math.round(value)}%</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function PrintModalityCard({ item }: { item: ReportModality }) {
  const Icon = item.icon;
  return (
    <div className="print-modality-card">
      <div className="print-modality-head">
        <span style={{ background: item.color }}>
          <Icon className="h-4 w-4" />
        </span>
        <strong>{Math.round(clamp(item.value))}%</strong>
      </div>
      <h4>{item.label}</h4>
      <p>{item.detail}</p>
      <small>{item.note}</small>
      <div className="print-modality-track">
        <div style={{ width: `${clamp(item.value)}%`, background: item.color }} />
      </div>
    </div>
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
      <div className="mt-2 text-4xl font-extrabold">{Math.round(clamp(item.value))}/100</div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
      <p className="mt-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-xs font-semibold leading-5 text-muted-foreground">{item.note}</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full" style={{ width: `${clamp(item.value)}%`, backgroundColor: item.color }} />
      </div>
    </motion.div>
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

function PrintFooter({ page, reportId }: { page: string; reportId: string }) {
  return (
    <footer className="report-print-footer">
      <span>MindSense - AI Depression Detection & Therapy</span>
      <span>{reportId} - Page {page}</span>
    </footer>
  );
}
