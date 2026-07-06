import { afterEach, describe, expect, it, vi } from "vitest";
import { getAssessmentPrediction, type ModelPredictionRequest } from "./modelPrediction";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        createSignedUrl: vi.fn(),
      }),
    },
  },
}));

const baseRequest: ModelPredictionRequest = {
  userId: "user-1",
  textAnswers: [
    {
      id: "mood",
      question: "Mood question",
      answer: "Several days",
      phqScore: 1,
      score: 1,
      domain: "mood",
    },
  ],
  textNarrative: "I have felt tired recently but I am keeping a routine.",
  voicePath: "user-1/voice.webm",
  videoPath: "user-1/video.webm",
  audioFeaturesPath: "audio.csv",
  videoFeaturesPath: "video.csv",
  audioMetrics: {
    durationSeconds: 20,
    averageVolume: 20,
    peakVolume: 40,
    voiceActivityRatio: 0.6,
    silenceRatio: 0.4,
    qualityScore: 90,
    passed: true,
    issues: [],
  },
  videoMetrics: {
    durationSeconds: 20,
    sizeBytes: 512_000,
    brightnessScore: 55,
    qualityScore: 90,
    passed: true,
    issues: [],
  },
};

describe("model prediction client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("uses questionnaire baseline when ML API URL is not configured", async () => {
    vi.stubEnv("VITE_ML_API_URL", "");

    const result = await getAssessmentPrediction(baseRequest);

    expect(result.source).toBe("questionnaire_baseline");
    expect(result.phqScore).toBe(1);
    expect(result.modelVersion).toBe("questionnaire-baseline");
  });

  it("surfaces a clear error when the configured ML API cannot be reached", async () => {
    vi.stubEnv("VITE_ML_API_URL", "http://127.0.0.1:8999");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Failed to fetch")));

    await expect(getAssessmentPrediction(baseRequest)).rejects.toThrow("Cannot reach the MindSense ML API");
  });
});
