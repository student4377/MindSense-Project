import type { ResourceCategory, ResourceMoodCategory, ResourceSourcePlatform } from "@/lib/resourceService";

export type CuratedResourceCandidate = {
  title: string;
  description: string;
  category: ResourceCategory;
  mood_category: ResourceMoodCategory;
  external_url: string;
  thumbnail_url: string;
  tags: string[];
  estimated_duration: string;
  source_platform: ResourceSourcePlatform;
  featured?: boolean;
};

export const CURATED_RESOURCE_CANDIDATES: CuratedResourceCandidate[] = [
  {
    title: "Guided Meditation for Anxiety",
    description: "A gentle guided meditation for anxious thoughts and body tension.",
    category: "video",
    mood_category: "anxious",
    external_url: "https://www.youtube.com/watch?v=O-6f5wQXSu8",
    thumbnail_url: "https://img.youtube.com/vi/O-6f5wQXSu8/hqdefault.jpg",
    tags: ["anxiety", "meditation", "breathing", "calm"],
    estimated_duration: "10 min",
    source_platform: "youtube",
    featured: true,
  },
  {
    title: "Box Breathing Relaxation",
    description: "A short visual breathing exercise for stress and overwhelm.",
    category: "video",
    mood_category: "stressed",
    external_url: "https://www.youtube.com/watch?v=tEmt1Znux58",
    thumbnail_url: "https://img.youtube.com/vi/tEmt1Znux58/hqdefault.jpg",
    tags: ["stress", "breathing", "grounding"],
    estimated_duration: "5 min",
    source_platform: "youtube",
  },
  {
    title: "Deep Focus Music",
    description: "Calm focus music for studying, reading, and low-distraction work.",
    category: "audio",
    mood_category: "focused",
    external_url: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
    thumbnail_url: "https://img.youtube.com/vi/jfKfPfyJRdk/hqdefault.jpg",
    tags: ["focus", "productivity", "study", "motivation"],
    estimated_duration: "Live",
    source_platform: "youtube",
    featured: true,
  },
  {
    title: "Sleep Meditation Music",
    description: "Soft sleep-focused audio for winding down before bed.",
    category: "audio",
    mood_category: "sleep_support",
    external_url: "https://www.youtube.com/watch?v=1ZYbU82GVz4",
    thumbnail_url: "https://img.youtube.com/vi/1ZYbU82GVz4/hqdefault.jpg",
    tags: ["sleep", "relaxation", "night routine"],
    estimated_duration: "3 hr",
    source_platform: "youtube",
  },
  {
    title: "How to Manage Stress",
    description: "Practical stress-management guidance from a trusted mental health organization.",
    category: "article",
    mood_category: "stressed",
    external_url: "https://www.mentalhealth.org.uk/explore-mental-health/publications/how-manage-and-reduce-stress",
    thumbnail_url: "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&w=1200&q=80",
    tags: ["stress", "coping", "education"],
    estimated_duration: "6 min read",
    source_platform: "article",
  },
  {
    title: "Mindfulness Exercises",
    description: "Simple mindfulness exercises that can be practiced during a busy day.",
    category: "article",
    mood_category: "mindfulness",
    external_url: "https://www.mindful.org/mindfulness-how-to-do-it/",
    thumbnail_url: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80",
    tags: ["mindfulness", "self care", "grounding"],
    estimated_duration: "8 min read",
    source_platform: "article",
  },
  {
    title: "Overcoming Low Motivation",
    description: "Productivity and motivation guidance for getting started with small steps.",
    category: "video",
    mood_category: "low_motivation",
    external_url: "https://www.youtube.com/watch?v=75d_29QWELk",
    thumbnail_url: "https://img.youtube.com/vi/75d_29QWELk/hqdefault.jpg",
    tags: ["motivation", "productivity", "energy"],
    estimated_duration: "7 min",
    source_platform: "youtube",
  },
  {
    title: "Relaxing Ambient Music",
    description: "Calming ambient sound for relaxation and gentle resets.",
    category: "audio",
    mood_category: "calm",
    external_url: "https://www.youtube.com/watch?v=2OEL4P1Rz04",
    thumbnail_url: "https://img.youtube.com/vi/2OEL4P1Rz04/hqdefault.jpg",
    tags: ["calm", "relaxation", "audio"],
    estimated_duration: "Live",
    source_platform: "youtube",
  },
];
