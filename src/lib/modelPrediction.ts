import {
  buildQuestionnaireBaselineResult,
  interpretPhqSeverity,
  recommendationForSeverity,
  severityLabelForPhq,
  type AudioSignalMetrics,
  type FusionResult,
  type ScreeningAnswer,
  type VideoSignalMetrics,
} from "@/lib/depressionAnalysis";

export type ModelPredictionRequest = {
  userId: string;
  textAnswers: ScreeningAnswer[];
  textNarrative?: string;
  voicePath: string;
  videoPath: string;
  audioMetrics: AudioSignalMetrics;
  videoMetrics: VideoSignalMetrics;
};

type ApiModelPrediction = {
  phq_score: number;
  depression_severity?: string;
  confidence?: number;
  model_version?: string;
  explanation?: string;
  observations?: string[];
  modality_gates?: {
    text?: number | null;
    audio?: number | null;
    video?: number | null;
  };
  modality_confidence?: {
    text?: number | null;
    audio?: number | null;
    video?: number | null;
  };
};

const mlApiUrl = () => import.meta.env.VITE_ML_API_URL?.replace(/\/$/, "");

const normalizeConfidence = (value: number | undefined) => {
  if (!Number.isFinite(value)) return 0.5;
  const numeric = Number(value);
  return numeric > 1 ? Math.max(0, Math.min(1, numeric / 100)) : Math.max(0, Math.min(1, numeric));
};

const toFusionResult = (prediction: ApiModelPrediction): FusionResult => {
  const phqScore = Math.max(0, Math.min(24, Number(prediction.phq_score)));
  const severity = interpretPhqSeverity(phqScore);
  const observations = prediction.observations?.length
    ? prediction.observations
    : [
        prediction.explanation || "PHQ-8 score predicted by the learned multimodal model.",
        "Text, audio, and video modality importance is learned by the gated fusion layer.",
      ];

  return {
    phqScore,
    confidence: normalizeConfidence(prediction.confidence),
    severity,
    severityLabel: severityLabelForPhq(severity),
    recommendation: recommendationForSeverity(severity),
    observations,
    modelVersion: prediction.model_version || "mindsense-mm-v1",
    source: "learned_model",
    modalityDiagnostics: {
      textConfidence: prediction.modality_confidence?.text ?? null,
      audioConfidence: prediction.modality_confidence?.audio ?? null,
      videoConfidence: prediction.modality_confidence?.video ?? null,
      gates: prediction.modality_gates
        ? {
            text: prediction.modality_gates.text ?? null,
            audio: prediction.modality_gates.audio ?? null,
            video: prediction.modality_gates.video ?? null,
          }
        : null,
    },
  };
};

export const getAssessmentPrediction = async (
  request: ModelPredictionRequest,
  accessToken?: string | null,
): Promise<FusionResult> => {
  const baseUrl = mlApiUrl();
  if (!baseUrl) {
    return buildQuestionnaireBaselineResult(request.textAnswers, {
      hasNarrative: Boolean(request.textNarrative?.trim()),
      audioPassed: request.audioMetrics.passed,
      videoPassed: request.videoMetrics.passed,
    });
  }

  const response = await fetch(`${baseUrl}/predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      user_id: request.userId,
      text_answers: request.textAnswers,
      text_narrative: request.textNarrative || "",
      voice_path: request.voicePath,
      video_path: request.videoPath,
      audio_quality: request.audioMetrics,
      video_quality: request.videoMetrics,
    }),
  });

  if (!response.ok) {
    throw new Error(`Model API returned ${response.status}`);
  }

  return toFusionResult((await response.json()) as ApiModelPrediction);
};
