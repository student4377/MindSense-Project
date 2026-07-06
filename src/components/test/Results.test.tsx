import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Results from "./Results";
import type { FusionResult, ScreeningAnswer } from "@/lib/depressionAnalysis";
import type { TestData } from "@/pages/DepressionTest";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      email: "student@example.com",
      user_metadata: { name: "Student User" },
    },
  }),
}));

const domains: ScreeningAnswer["domain"][] = ["interest", "mood", "sleep", "energy", "appetite", "self_view", "focus", "movement"];

const data: TestData = {
  textAnswers: domains.map((domain, index) => ({
    id: domain,
    question: `Question ${domain}`,
    answer: index % 2 === 0 ? "Several days" : "Not at all",
    phqScore: index % 2,
    score: index % 2,
    domain,
  })),
  textNarrative: "My sleep and energy have changed recently, but I am trying to keep a steady routine.",
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
    qualityScore: 88,
    passed: true,
    issues: [],
  },
};

const result: FusionResult = {
  phqScore: 8,
  confidence: 0.62,
  severity: "mild",
  severityLabel: "Mild",
  recommendation: "Track mood and use supportive routines.",
  observations: ["PHQ-8 screening signal detected."],
  modelVersion: "mindsense-test",
  source: "learned_model",
  modalityDiagnostics: {
    gates: { text: 0.5, audio: 0.4, video: 0.35 },
  },
};

describe("Results report", () => {
  it("renders clinical screening summary and disclaimer", () => {
    render(
      <MemoryRouter>
        <Results data={data} result={result} onRetake={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getAllByText(/AI-assisted depression screening summary/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/PHQ-8 Score/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Mild/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/does not constitute a medical diagnosis/i).length).toBeGreaterThan(0);
  });
});
