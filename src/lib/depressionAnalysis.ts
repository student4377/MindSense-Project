export const AUDIO_SECONDS = 20;
export const VIDEO_SECONDS = 20;
export const MIN_SIGNAL_SECONDS = 15;

export const FUSION_WEIGHTS = {
  text: 0.5,
  audio: 0.25,
  video: 0.25,
} as const;

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

export type FusionResult = {
  textScore: number;
  audioScore: number;
  videoScore: number;
  finalScore: number;
  confidence: number;
  severity: "minimal" | "mild" | "moderate" | "high" | "severe";
  severityLabel: string;
  recommendation: string;
  observations: string[];
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const round = (value: number) => Math.round(value);

export const questionnaireSignalScore = (answers: ScreeningAnswer[]) => {
  if (!answers.length) return 0;
  const total = answers.reduce((sum, answer) => sum + answer.phqScore, 0);
  return round((total / (answers.length * 3)) * 100);
};

export const questionnaireSeverityLabel = (score: number) => {
  if (score < 20) return "Minimal support signal";
  if (score < 38) return "Mild support signal";
  if (score < 58) return "Moderate support signal";
  if (score < 78) return "High support signal";
  return "Severe support signal";
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

export const buildFusionResult = (
  answers: ScreeningAnswer[],
  audio: AudioSignalMetrics,
  video: VideoSignalMetrics,
): FusionResult => {
  const textScore = questionnaireSignalScore(answers);
  const audioScore = clamp(audio.qualityScore);
  const videoScore = clamp(video.qualityScore);
  const finalScore = round(
    textScore * FUSION_WEIGHTS.text +
      audioScore * FUSION_WEIGHTS.audio +
      videoScore * FUSION_WEIGHTS.video,
  );
  const confidence = round(
    72 +
      (audio.passed ? 8 : 0) +
      (video.passed ? 8 : 0) +
      (answers.length >= 8 ? 6 : 0) +
      (audio.voiceActivityRatio > 0.45 ? 3 : 0) +
      ((video.brightnessScore ?? 35) > 28 ? 3 : 0),
  );

  const severity =
    finalScore < 20
      ? "minimal"
      : finalScore < 38
        ? "mild"
        : finalScore < 58
          ? "moderate"
          : finalScore < 78
            ? "high"
            : "severe";

  const severityLabel = questionnaireSeverityLabel(finalScore);
  const recommendation =
    severity === "minimal"
      ? "Keep tracking your mood and maintain your current wellness routines."
      : severity === "mild"
        ? "Use mood tracking, sleep support, and short grounding exercises this week."
        : severity === "moderate"
          ? "Add structured support habits and consider speaking with a trusted person or professional."
          : "Consider professional support soon and use crisis guidance if you feel unsafe.";

  const observations = [
    `Questionnaire contribution is ${Math.round(FUSION_WEIGHTS.text * 100)}% of the final score.`,
    `Voice sample passed clarity checks with ${Math.round(audio.voiceActivityRatio * 100)}% voice activity.`,
    `Video sample passed capture checks${video.brightnessScore === null ? "." : ` with ${Math.round(video.brightnessScore)}% brightness signal.`}`,
  ];

  return {
    textScore,
    audioScore,
    videoScore,
    finalScore,
    confidence: clamp(confidence),
    severity,
    severityLabel,
    recommendation,
    observations,
  };
};
