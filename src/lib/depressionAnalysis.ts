export const AUDIO_SECONDS = 20;
export const VIDEO_SECONDS = 20;
export const MIN_SIGNAL_SECONDS = 15;

export const TEXT_NARRATIVE_PROMPT =
  "In a few sentences, describe how your mood, sleep, energy, stress, motivation, and daily routine have been during the past two weeks.";

export type DepressionSeverity = "minimal" | "mild" | "moderate" | "moderately_severe" | "severe";

export type ScreeningAnswer = {
  id: string;
  question: string;
  answer: string;
  phqScore: number;
  score: number;
  domain: "mood" | "interest" | "sleep" | "energy" | "appetite" | "self_view" | "focus" | "movement";
};

export type AudioSignalMetrics = {
  durationSeconds: number;
  averageVolume: number;
  peakVolume: number;
  voiceActivityRatio: number;
  silenceRatio: number;
  qualityScore: number;
  passed: boolean;
  issues: string[];
};

export type VideoSignalMetrics = {
  durationSeconds: number;
  sizeBytes: number;
  brightnessScore: number | null;
  qualityScore: number;
  passed: boolean;
  issues: string[];
};

export type LearnedFusionGates = {
  text: number | null;
  audio: number | null;
  video: number | null;
};

export type ModalityDiagnostics = {
  textConfidence?: number | null;
  audioConfidence?: number | null;
  videoConfidence?: number | null;
  gates?: LearnedFusionGates | null;
};

export type FusionResult = {
  phqScore: number;
  confidence: number;
  severity: DepressionSeverity;
  severityLabel: string;
  recommendation: string;
  observations: string[];
  modelVersion: string;
  source: "learned_model" | "questionnaire_baseline";
  modalityDiagnostics?: ModalityDiagnostics;
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const clampPhq = (value: number) => Math.max(0, Math.min(24, value));

const round = (value: number) => Math.round(value);

export const phqScoreFromAnswers = (answers: ScreeningAnswer[]) =>
  clampPhq(answers.reduce((sum, answer) => sum + answer.phqScore, 0));

export const interpretPhqSeverity = (score: number): DepressionSeverity => {
  const phq = clampPhq(score);
  if (phq < 5) return "minimal";
  if (phq < 10) return "mild";
  if (phq < 15) return "moderate";
  if (phq < 20) return "moderately_severe";
  return "severe";
};

export const severityLabelForPhq = (severity: DepressionSeverity) => {
  switch (severity) {
    case "minimal":
      return "Minimal";
    case "mild":
      return "Mild";
    case "moderate":
      return "Moderate";
    case "moderately_severe":
      return "Moderately Severe";
    case "severe":
      return "Severe";
  }
};

export const recommendationForSeverity = (severity: DepressionSeverity) => {
  switch (severity) {
    case "minimal":
      return "Keep tracking your mood and maintain your current wellness routines.";
    case "mild":
      return "Use mood tracking, sleep support, and short grounding exercises this week.";
    case "moderate":
      return "Add structured support habits and consider speaking with a trusted person or professional.";
    case "moderately_severe":
      return "Consider professional support soon and keep trusted support nearby.";
    case "severe":
      return "Consider urgent professional support and use crisis guidance if you feel unsafe.";
  }
};

export const buildQuestionnaireBaselineResult = (
  answers: ScreeningAnswer[],
  options?: {
    hasNarrative?: boolean;
    audioPassed?: boolean;
    videoPassed?: boolean;
  },
): FusionResult => {
  const phqScore = phqScoreFromAnswers(answers);
  const severity = interpretPhqSeverity(phqScore);
  const observations = [
    `Structured questionnaire PHQ signal is ${phqScore.toFixed(1)}/24.`,
    options?.hasNarrative
      ? "Open-ended text response captured for the trained NLP encoder."
      : "Open-ended text response was not captured.",
    options?.audioPassed
      ? "Voice recording passed quality checks and is ready for the learned audio encoder."
      : "Voice recording needs review before learned audio inference.",
    options?.videoPassed
      ? "Video recording passed quality checks and is ready for the learned visual encoder."
      : "Video recording needs review before learned visual inference.",
  ];

  return {
    phqScore,
    confidence: 0.45,
    severity,
    severityLabel: severityLabelForPhq(severity),
    recommendation: recommendationForSeverity(severity),
    observations,
    modelVersion: "questionnaire-baseline",
    source: "questionnaire_baseline",
  };
};

export const evaluateAudioQuality = (metrics: {
  durationSeconds: number;
  averageVolume: number;
  peakVolume: number;
  voiceActivityRatio: number;
}): AudioSignalMetrics => {
  const issues: string[] = [];
  const silenceRatio = clamp(1 - metrics.voiceActivityRatio, 0, 1);

  if (metrics.durationSeconds < MIN_SIGNAL_SECONDS) issues.push(`Recording must be at least ${MIN_SIGNAL_SECONDS} seconds.`);
  if (metrics.averageVolume < 8) issues.push("Voice is too quiet for reliable analysis.");
  if (metrics.peakVolume < 18) issues.push("No clear speech peak was detected.");
  if (metrics.voiceActivityRatio < 0.28) issues.push("Recording contains too much silence.");

  const durationScore = clamp((metrics.durationSeconds / AUDIO_SECONDS) * 100);
  const volumeScore = clamp((metrics.averageVolume / 32) * 100);
  const activityScore = clamp(metrics.voiceActivityRatio * 125);
  const qualityScore = round(durationScore * 0.3 + volumeScore * 0.35 + activityScore * 0.35);

  return {
    durationSeconds: metrics.durationSeconds,
    averageVolume: metrics.averageVolume,
    peakVolume: metrics.peakVolume,
    voiceActivityRatio: metrics.voiceActivityRatio,
    silenceRatio,
    qualityScore,
    passed: issues.length === 0,
    issues,
  };
};

export const evaluateVideoQuality = (metrics: {
  durationSeconds: number;
  sizeBytes: number;
  brightnessScore: number | null;
}): VideoSignalMetrics => {
  const issues: string[] = [];
  const sizeKb = metrics.sizeBytes / 1024;

  if (metrics.durationSeconds < MIN_SIGNAL_SECONDS) issues.push(`Video must be at least ${MIN_SIGNAL_SECONDS} seconds.`);
  if (sizeKb < 90) issues.push("Video file is too small for reliable analysis.");
  if (metrics.brightnessScore !== null && metrics.brightnessScore < 18) issues.push("Video appears too dark. Please improve lighting.");

  const durationScore = clamp((metrics.durationSeconds / VIDEO_SECONDS) * 100);
  const fileScore = clamp((sizeKb / 420) * 100);
  const brightnessScore = metrics.brightnessScore === null ? 72 : clamp((metrics.brightnessScore / 55) * 100);
  const qualityScore = round(durationScore * 0.35 + fileScore * 0.3 + brightnessScore * 0.35);

  return {
    durationSeconds: metrics.durationSeconds,
    sizeBytes: metrics.sizeBytes,
    brightnessScore: metrics.brightnessScore,
    qualityScore,
    passed: issues.length === 0,
    issues,
  };
};
