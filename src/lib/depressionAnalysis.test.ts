import { describe, expect, it } from "vitest";
import { buildQuestionnaireBaselineResult, interpretPhqSeverity, phqScoreFromAnswers, type ScreeningAnswer } from "./depressionAnalysis";

const answer = (id: string, phqScore: number): ScreeningAnswer => ({
  id,
  question: id,
  answer: String(phqScore),
  phqScore,
  score: phqScore,
  domain: "mood",
});

describe("PHQ-8 interpretation", () => {
  it("uses standard continuous severity boundaries", () => {
    expect(interpretPhqSeverity(0)).toBe("minimal");
    expect(interpretPhqSeverity(4.99)).toBe("minimal");
    expect(interpretPhqSeverity(5)).toBe("mild");
    expect(interpretPhqSeverity(10)).toBe("moderate");
    expect(interpretPhqSeverity(15)).toBe("moderately_severe");
    expect(interpretPhqSeverity(20)).toBe("severe");
    expect(interpretPhqSeverity(99)).toBe("severe");
  });

  it("clamps questionnaire score to PHQ-8 range", () => {
    expect(phqScoreFromAnswers([answer("a", 12), answer("b", 18)])).toBe(24);
  });

  it("builds questionnaire baseline without learned-model fusion", () => {
    const result = buildQuestionnaireBaselineResult([answer("a", 2), answer("b", 3)], {
      hasNarrative: true,
      audioPassed: true,
      videoPassed: false,
    });

    expect(result.source).toBe("questionnaire_baseline");
    expect(result.phqScore).toBe(5);
    expect(result.severity).toBe("mild");
    expect(result.observations.join(" ")).toContain("Voice recording passed");
  });
});
