import type { Tables } from "@/integrations/supabase/types";
import type { Resource, ResourceMoodCategory } from "@/lib/resourceService";

type MoodEntry = Tables<"mood_entries">;
type DepressionTest = Tables<"depression_tests">;

type TextAnswer = {
  score?: number;
};

export type ResourceRecommendationContext = {
  moodLabel: string;
  primaryMood: ResourceMoodCategory;
  reasons: string[];
};

const includesAny = (values: string[], keywords: string[]) =>
  values.some((value) => keywords.some((keyword) => value.toLowerCase().includes(keyword)));

const getAssessmentWellnessScore = (test: DepressionTest | null) => {
  if (!test || !Array.isArray(test.text_answers)) return null;
  const scores = test.text_answers
    .filter((answer): answer is TextAnswer => typeof answer === "object" && answer !== null && "score" in answer)
    .map((answer) => Number(answer.score))
    .filter((score) => Number.isFinite(score));

  if (!scores.length) return null;
  const averageAnswerScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return Math.max(0, Math.min(100, Math.round(((5 - averageAnswerScore) / 4) * 100)));
};

export const buildResourceContext = (moods: MoodEntry[], latestTest: DepressionTest | null): ResourceRecommendationContext => {
  const recent = [...moods]
    .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime())
    .slice(0, 7);
  const latest = recent[0];
  const tags = recent.flatMap((entry) => entry.tags || []);
  const avg = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
  const averageMood = avg(recent.map((entry) => entry.mood));
  const averageSleep = avg(recent.map((entry) => entry.sleep_quality).filter((value): value is number => typeof value === "number"));
  const averageEnergy = avg(recent.map((entry) => entry.energy).filter((value): value is number => typeof value === "number"));
  const assessmentWellnessScore = getAssessmentWellnessScore(latestTest);

  const reasons: string[] = [];
  let primaryMood: ResourceMoodCategory = "mindfulness";

  if (assessmentWellnessScore !== null && assessmentWellnessScore < 35) {
    primaryMood = "overwhelmed";
    reasons.push("latest assessment suggests stronger support");
  } else if (assessmentWellnessScore !== null && assessmentWellnessScore < 55) {
    primaryMood = "stressed";
    reasons.push("latest assessment suggests structured support");
  } else if (averageSleep !== null && averageSleep < 5) {
    primaryMood = "sleep_support";
    reasons.push("recent sleep quality is low");
  } else if (includesAny(tags, ["stress", "pressure", "work", "study"])) {
    primaryMood = "stressed";
    reasons.push("recent tags show stress");
  } else if (includesAny(tags, ["anxiety", "panic", "overthinking", "worry"])) {
    primaryMood = "anxious";
    reasons.push("recent tags show anxiety or overthinking");
  } else if ((latest?.mood ?? 5) <= 2) {
    primaryMood = "overwhelmed";
    reasons.push("latest mood is low");
  } else if ((averageEnergy ?? 10) < 5) {
    primaryMood = "low_motivation";
    reasons.push("recent energy is low");
  } else if ((averageMood ?? 0) >= 4) {
    primaryMood = "focused";
    reasons.push("recent mood is steady");
  }

  if (latestTest?.created_at && assessmentWellnessScore === null) reasons.push("latest assessment is included");
  if (reasons.length === 0) reasons.push("start with general mindfulness resources");

  const moodLabel = primaryMood.replace(/_/g, " ");
  return { moodLabel, primaryMood, reasons };
};

export const recommendResources = (
  resources: Resource[],
  context: ResourceRecommendationContext,
  bookmarkedIds: Set<string>,
) => {
  const scored = resources
    .filter((resource) => resource.is_published)
    .map((resource) => {
      let score = 0;
      if (resource.mood_category === context.primaryMood) score += 8;
      if (resource.featured) score += 3;
      if (bookmarkedIds.has(resource.id)) score += 1;
      if (context.primaryMood === "stressed" && resource.tags?.some((tag) => ["breathing", "calm", "stress"].includes(tag.toLowerCase()))) score += 3;
      if (context.primaryMood === "sleep_support" && resource.tags?.some((tag) => tag.toLowerCase().includes("sleep"))) score += 3;
      if (context.primaryMood === "low_motivation" && resource.tags?.some((tag) => ["motivation", "productivity", "focus"].includes(tag.toLowerCase()))) score += 3;
      return { resource, score };
    })
    .sort((a, b) => b.score - a.score);

  const recommended = scored.filter((item) => item.score > 0).slice(0, 6).map((item) => item.resource);
  if (recommended.length > 0) return recommended;
  return scored.slice(0, 6).map((item) => item.resource);
};
