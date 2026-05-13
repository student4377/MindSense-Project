import type { Json, Tables } from "@/integrations/supabase/types";

export type MoodEntry = Tables<"mood_entries">;
export type DepressionTest = Tables<"depression_tests">;

export type SupportRecommendation = {
  id: string;
  title: string;
  detail: string;
  reason: string;
  action: string;
  route?: string;
  category: "breathing" | "meditation" | "audio" | "sleep" | "journaling" | "professional" | "assessment";
  tone: "primary" | "calm" | "sleep" | "focus" | "urgent";
  priority: number;
};

export type DepressionSummary = {
  label: string;
  severity: "unknown" | "minimal" | "mild" | "moderate" | "higher";
  wellnessScore: number | null;
  averageAnswerScore: number | null;
  hasVoice: boolean;
  hasVideo: boolean;
  createdAt: string | null;
};

export type MoodSummary = {
  latestMood: number | null;
  averageMood: number | null;
  averageSleep: number | null;
  averageEnergy: number | null;
  lowMood: boolean;
  poorSleep: boolean;
  stressSignal: boolean;
  lowMotivation: boolean;
  latestTags: string[];
  entriesUsed: number;
};

export type SupportPlan = {
  depression: DepressionSummary;
  mood: MoodSummary;
  recommendations: SupportRecommendation[];
  todayAction: SupportRecommendation;
};

type TextAnswer = {
  score?: number;
  question?: string;
  answer?: string;
};

const DEFAULT_ACTION: SupportRecommendation = {
  id: "start-checkin",
  title: "Start with a mood check-in",
  detail: "Add today’s mood so MindSense can personalize your support tools with real data.",
  reason: "No recent mood signal is available yet.",
  action: "Log mood",
  route: "/mood",
  category: "assessment",
  tone: "primary",
  priority: 10,
};

function parseAnswers(value: Json): TextAnswer[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is TextAnswer => typeof item === "object" && item !== null && "score" in item);
}

export function getDepressionSummary(test: DepressionTest | null): DepressionSummary {
  if (!test) {
    return {
      label: "No completed assessment",
      severity: "unknown",
      wellnessScore: null,
      averageAnswerScore: null,
      hasVoice: false,
      hasVideo: false,
      createdAt: null,
    };
  }

  const scores = parseAnswers(test.text_answers)
    .map((answer) => Number(answer.score))
    .filter((score) => Number.isFinite(score));
  const averageAnswerScore = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
  const wellnessScore = averageAnswerScore === null ? null : Math.max(0, Math.min(100, Math.round(((5 - averageAnswerScore) / 4) * 100)));
  const severity =
    wellnessScore === null
      ? "unknown"
      : wellnessScore >= 75
        ? "minimal"
        : wellnessScore >= 55
          ? "mild"
          : wellnessScore >= 35
            ? "moderate"
            : "higher";

  const label =
    severity === "minimal"
      ? "Mostly steady"
      : severity === "mild"
        ? "Needs light support"
        : severity === "moderate"
          ? "Needs structured care"
          : severity === "higher"
            ? "Professional support recommended"
            : "Assessment signal limited";

  return {
    label,
    severity,
    wellnessScore,
    averageAnswerScore,
    hasVoice: Boolean(test.voice_path),
    hasVideo: Boolean(test.video_path),
    createdAt: test.created_at,
  };
}

export function getMoodSummary(entries: MoodEntry[]): MoodSummary {
  const sorted = [...entries].sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());
  const recent = sorted.slice(0, 7);
  const latest = recent[0] ?? null;
  const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
  const latestTags = latest?.tags ?? [];
  const allTags = recent.flatMap((entry) => entry.tags ?? []).map((tag) => tag.toLowerCase());
  const stressSignal = allTags.some((tag) => ["stress", "anxiety", "overthinking", "work", "study", "panic"].some((keyword) => tag.includes(keyword)));
  const lowMotivation = allTags.some((tag) => ["motivation", "tired", "fatigue", "productivity", "focus"].some((keyword) => tag.includes(keyword)));
  const averageMood = average(recent.map((entry) => entry.mood));
  const averageSleep = average(recent.map((entry) => entry.sleep_quality).filter((value): value is number => typeof value === "number"));
  const averageEnergy = average(recent.map((entry) => entry.energy).filter((value): value is number => typeof value === "number"));

  return {
    latestMood: latest?.mood ?? null,
    averageMood,
    averageSleep,
    averageEnergy,
    lowMood: (latest?.mood ?? 5) <= 2 || (averageMood ?? 5) < 2.8,
    poorSleep: (latest?.sleep_quality ?? 10) <= 4 || (averageSleep ?? 10) < 5,
    stressSignal,
    lowMotivation: lowMotivation || (averageEnergy ?? 10) < 5,
    latestTags,
    entriesUsed: recent.length,
  };
}

export function buildSupportPlan(entries: MoodEntry[], latestTest: DepressionTest | null): SupportPlan {
  const depression = getDepressionSummary(latestTest);
  const mood = getMoodSummary(entries);
  const recommendations: SupportRecommendation[] = [];

  if (depression.severity === "unknown") {
    recommendations.push({
      id: "complete-assessment",
      title: "Complete your depression assessment",
      detail: "Run the questionnaire and media capture when ready so support suggestions can reflect your assessment results.",
      reason: "No completed depression test is available.",
      action: "Begin assessment",
      route: "/test",
      category: "assessment",
      tone: "primary",
      priority: 9,
    });
  }

  if (mood.entriesUsed === 0) {
    recommendations.push(DEFAULT_ACTION);
  }

  if (depression.severity === "higher" || depression.severity === "moderate") {
    recommendations.push({
      id: "professional-support",
      title: depression.severity === "higher" ? "Consider professional support soon" : "Add a professional support option",
      detail: "Use the public directory below to identify qualified support and independently verify details before consultation.",
      reason: `Latest assessment: ${depression.label}.`,
      action: "View directory",
      category: "professional",
      tone: depression.severity === "higher" ? "urgent" : "primary",
      priority: depression.severity === "higher" ? 1 : 4,
    });
  }

  if (mood.lowMood) {
    recommendations.push({
      id: "low-mood-grounding",
      title: "Use a calming grounding session",
      detail: "A short meditation or breathing routine is a gentle first step when mood is low.",
      reason: `Recent mood signal is ${mood.latestMood ?? Math.round((mood.averageMood ?? 0) * 10) / 10}/5.`,
      action: "Start calming tool",
      category: "meditation",
      tone: "calm",
      priority: 2,
    });
  }

  if (mood.stressSignal) {
    recommendations.push({
      id: "stress-breathing",
      title: "Try anxiety-relief breathing",
      detail: "Use a slower exhale pattern to reduce stress load before choosing the next task.",
      reason: "Recent mood tags include stress or anxiety signals.",
      action: "Start breathing",
      category: "breathing",
      tone: "primary",
      priority: 3,
    });
  }

  if (mood.poorSleep) {
    recommendations.push({
      id: "sleep-routine",
      title: "Protect tonight’s sleep routine",
      detail: "Choose one screen-free wind-down action and one sleep audio track tonight.",
      reason: `Recent sleep quality is ${mood.averageSleep ? `${mood.averageSleep.toFixed(1)}/10` : "low"}.`,
      action: "Open sleep routine",
      category: "sleep",
      tone: "sleep",
      priority: 3,
    });
  }

  if (mood.lowMotivation) {
    recommendations.push({
      id: "focus-audio",
      title: "Use a focus audio reset",
      detail: "Start a light focus soundscape for five minutes before a small task.",
      reason: "Recent energy or motivation signals look low.",
      action: "Play focus audio",
      category: "audio",
      tone: "focus",
      priority: 5,
    });
  }

  if (!recommendations.some((item) => item.id === "journal-reflection")) {
    recommendations.push({
      id: "journal-reflection",
      title: "Write one honest reflection",
      detail: "Journal one sentence about what affected your mood today.",
      reason: "Reflection helps connect mood entries with real-life context.",
      action: "Open mood journal",
      route: "/mood",
      category: "journaling",
      tone: "calm",
      priority: 7,
    });
  }

  const ordered = recommendations
    .reduce<SupportRecommendation[]>((unique, item) => (unique.some((entry) => entry.id === item.id) ? unique : [...unique, item]), [])
    .sort((a, b) => a.priority - b.priority);

  return {
    depression,
    mood,
    recommendations: ordered,
    todayAction: ordered[0] ?? DEFAULT_ACTION,
  };
}
