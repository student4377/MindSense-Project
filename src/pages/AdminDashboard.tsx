import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  FileWarning,
  Filter,
  Flag,
  HeartHandshake,
  Headphones,
  Layers,
  LayoutDashboard,
  LineChart,
  Loader2,
  Mail,
  MapPin,
  MessageSquareText,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  TrendingUp,
  Trash2,
  UserCog,
  UserRound,
  Users,
  Video,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { CURATED_RESOURCE_CANDIDATES, type CuratedResourceCandidate } from "@/data/curatedResourceDiscovery";
import {
  RESOURCE_MOOD_CATEGORIES,
  deleteResource,
  detectSourcePlatform,
  fetchResourceMetadata,
  listResources,
  saveResource,
  type Resource,
  type ResourceCategory,
  type ResourceMoodCategory,
} from "@/lib/resourceService";

type AccessState = "checking" | "allowed" | "denied";

type AdminOverviewStats = {
  totalUsers: number;
  activeUsers: number;
  depressionTestsCompleted: number;
  moodEntriesLogged: number;
  supportSessions: number;
  supportRequests: number;
  highRiskAlerts: number;
  publishedResources: number;
  resourceOpens: number;
  aiAnalysesCompleted: number;
  avgMood: number | null;
  avgEnergy: number | null;
  avgSleep: number | null;
  resourceCoverage: Record<ResourceCategory, number>;
  riskDistribution: {
    high: number;
    medium: number;
    steady: number;
    unknown: number;
  };
  generatedAt: string | null;
};

type AdminUserSummary = {
  user_id: string;
  name: string | null;
  email: string | null;
  joined_at: string;
  mood_entries: number;
  completed_tests: number;
  support_sessions: number;
  latest_activity: string | null;
  risk_level: "unknown" | "steady" | "medium" | "high";
  account_status: AdminReviewStatus;
};

type AdminReviewStatus = "active" | "watch" | "needs_support" | "restricted";
type AdminReviewPriority = "normal" | "medium" | "high";
type RiskLevel = "unknown" | "steady" | "medium" | "high";
type AlertStatus = "all" | "open" | "acknowledged" | "resolved";
type AlertPriority = "watch" | "high" | "urgent";
type ResourceStatusFilter = "all" | "published" | "draft" | "featured" | "needs_review";
type AiSensitivity = "low" | "balanced" | "high";
type AdminTabId = "overview" | "users" | "assessments" | "mood" | "resources" | "directory" | "messages" | "reports" | "settings";

type ContactMessage = Tables<"contacts">;

type AdminAiSettings = {
  textWeight: number;
  audioWeight: number;
  videoWeight: number;
  highRiskThreshold: number;
  watchThreshold: number;
  confidenceThreshold: number;
  analysisSensitivity: AiSensitivity;
  moderationEnabled: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
};

type AdminAuditLog = {
  log_id: string;
  admin_id: string;
  admin_name: string | null;
  admin_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

type AdminAuditLogInput = {
  action: string;
  entityType: string;
  summary: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

type AdminUserDetail = {
  profile: {
    userId: string;
    name: string | null;
    email: string | null;
    joinedAt: string | null;
  };
  reviewStatus: {
    reviewStatus: AdminReviewStatus;
    priority: AdminReviewPriority;
    adminNote: string | null;
    updatedAt: string | null;
  };
  moodSummary: {
    totalEntries: number;
    last7Entries: number;
    avgMood: number | null;
    avgEnergy: number | null;
    avgSleep: number | null;
    topTags: Array<{ tag: string; count: number }>;
  };
  latestTest: {
    createdAt: string | null;
    status: string | null;
    wellnessScore: number | null;
    answerCount: number;
    voiceCaptured: boolean;
    videoCaptured: boolean;
  } | null;
  testSummary: {
    completedTests: number;
  };
  supportSummary: {
    totalSessions: number;
    byType: Record<string, number>;
  };
  resourceSummary: {
    resourcesOpened: number;
    lastViewed: string | null;
  };
  activity: {
    latestActivity: string | null;
  };
  recentActivity: Array<{
    source: string;
    title: string;
    occurredAt: string;
    metadata: Record<string, unknown>;
  }>;
};

type AssessmentAnalytics = {
  totalCompleted: number;
  last7Completed: number;
  last30Completed: number;
  averageWellness: number | null;
  voiceCaptured: number;
  videoCaptured: number;
  severityDistribution: {
    high: number;
    medium: number;
    steady: number;
    unknown: number;
  };
  weeklyTrend: Array<{
    date: string;
    completed: number;
    avgWellness: number | null;
    highRisk: number;
  }>;
  recentAssessments: Array<{
    assessmentId: string;
    userId: string;
    name: string | null;
    email: string | null;
    createdAt: string;
    wellnessScore: number | null;
    riskLevel: RiskLevel;
    answerCount: number;
    voiceCaptured: boolean;
    videoCaptured: boolean;
    alertStatus: Exclude<AlertStatus, "all">;
  }>;
  generatedAt: string | null;
};

type RiskAlertRow = {
  assessment_id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  created_at: string;
  wellness_score: number;
  risk_level: "medium" | "high";
  answer_count: number;
  voice_captured: boolean;
  video_captured: boolean;
  alert_status: Exclude<AlertStatus, "all">;
  priority: AlertPriority;
  admin_note: string | null;
  updated_at: string | null;
};

type ProfessionalDirectoryEntry = Tables<"mental_health_professionals">;
type ProfessionalVerificationStatus = "public_source" | "admin_reviewed" | "needs_verification";

type ProfessionalFormState = {
  slug: string;
  name: string;
  role: string;
  specialization: string;
  city: string;
  location: string;
  address: string;
  phone: string;
  map_url: string;
  source_label: string;
  source_url: string;
  verification_status: ProfessionalVerificationStatus;
  is_published: boolean;
  featured: boolean;
};

type MoodAnalytics = {
  totalEntries: number;
  last7Entries: number;
  last30Entries: number;
  averageMood: number | null;
  averageEnergy: number | null;
  averageSleep: number | null;
  lowMoodSignals: number;
  poorSleepSignals: number;
  lowEnergySignals: number;
  moodDistribution: Record<"1" | "2" | "3" | "4" | "5", number>;
  dailyTrend: Array<{
    date: string;
    entries: number;
    avgMood: number | null;
    avgEnergy: number | null;
    avgSleep: number | null;
    lowMood: number;
  }>;
  tagSignals: Array<{
    tag: string;
    total: number;
    avgMood: number | null;
    lowMood: number;
    highMood: number;
  }>;
  recentLowMoodEntries: Array<{
    userId: string;
    name: string | null;
    email: string | null;
    mood: number;
    energy: number | null;
    sleepQuality: number | null;
    entryDate: string;
    createdAt: string;
    tags: string[];
  }>;
  generatedAt: string | null;
};

type ResourceFormState = {
  title: string;
  description: string;
  type: ResourceCategory;
  mood_category: ResourceMoodCategory;
  external_url: string;
  thumbnail_url: string;
  tags: string;
  estimated_duration: string;
  source_platform: string;
  featured: boolean;
  is_published: boolean;
};

const categoryIcon: Record<ResourceCategory, LucideIcon> = {
  article: BookOpen,
  video: Video,
  audio: Headphones,
};

const moodLabel = (value?: string | null) =>
  value ? value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Unassigned";

const REVIEW_STATUS_OPTIONS: Array<{ value: AdminReviewStatus; label: string; description: string }> = [
  { value: "active", label: "Active", description: "Normal account review state" },
  { value: "watch", label: "Watch", description: "Keep this user visible for follow-up" },
  { value: "needs_support", label: "Needs support", description: "Prioritize supportive follow-up" },
  { value: "restricted", label: "Restricted", description: "Show a restricted-account screen on user workspace pages" },
];

const REVIEW_PRIORITY_OPTIONS: Array<{ value: AdminReviewPriority; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const ADMIN_TABS: Array<{ id: AdminTabId; label: string; helper: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", helper: "Platform health", icon: LayoutDashboard },
  { id: "users", label: "Users", helper: "Profiles and review status", icon: Users },
  { id: "assessments", label: "Assessments", helper: "Tests and risk signals", icon: ClipboardList },
  { id: "mood", label: "Mood Analytics", helper: "Mood, sleep, energy", icon: LineChart },
  { id: "resources", label: "Resources", helper: "Content moderation", icon: BookOpen },
  { id: "directory", label: "Directory", helper: "Professionals", icon: MapPin },
  { id: "messages", label: "Messages", helper: "Contact inbox", icon: Mail },
  { id: "reports", label: "Reports", helper: "Exports", icon: Download },
  { id: "settings", label: "Settings & Audit", helper: "AI controls and logs", icon: SlidersHorizontal },
];

const getResourceUrl = (resource: Resource) => resource.external_url || resource.content_url || "";

const getResourceIssues = (resource: Resource) => {
  const issues: string[] = [];
  if (!getResourceUrl(resource)) issues.push("Missing URL");
  if (!resource.description?.trim()) issues.push("Needs description");
  if (!resource.thumbnail_url?.trim()) issues.push("Missing thumbnail");
  if (!(resource.estimated_duration || resource.duration)) issues.push("Missing duration");
  if (!resource.mood_category) issues.push("Mood category");
  if (!resource.tags?.length) issues.push("No tags");
  return issues;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);

const emptyProfessionalForm = (): ProfessionalFormState => ({
  slug: "",
  name: "",
  role: "",
  specialization: "",
  city: "",
  location: "",
  address: "",
  phone: "",
  map_url: "",
  source_label: "",
  source_url: "",
  verification_status: "public_source",
  is_published: true,
  featured: false,
});

const professionalToForm = (professional: ProfessionalDirectoryEntry): ProfessionalFormState => ({
  slug: professional.slug,
  name: professional.name,
  role: professional.role,
  specialization: professional.specialization,
  city: professional.city,
  location: professional.location,
  address: professional.address ?? "",
  phone: professional.phone ?? "",
  map_url: professional.map_url ?? "",
  source_label: professional.source_label ?? "",
  source_url: professional.source_url ?? "",
  verification_status: professional.verification_status as ProfessionalVerificationStatus,
  is_published: professional.is_published,
  featured: professional.featured,
});

const EMPTY_OVERVIEW: AdminOverviewStats = {
  totalUsers: 0,
  activeUsers: 0,
  depressionTestsCompleted: 0,
  moodEntriesLogged: 0,
  supportSessions: 0,
  supportRequests: 0,
  highRiskAlerts: 0,
  publishedResources: 0,
  resourceOpens: 0,
  aiAnalysesCompleted: 0,
  avgMood: null,
  avgEnergy: null,
  avgSleep: null,
  resourceCoverage: { article: 0, video: 0, audio: 0 },
  riskDistribution: { high: 0, medium: 0, steady: 0, unknown: 0 },
  generatedAt: null,
};

const EMPTY_MOOD_ANALYTICS: MoodAnalytics = {
  totalEntries: 0,
  last7Entries: 0,
  last30Entries: 0,
  averageMood: null,
  averageEnergy: null,
  averageSleep: null,
  lowMoodSignals: 0,
  poorSleepSignals: 0,
  lowEnergySignals: 0,
  moodDistribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
  dailyTrend: [],
  tagSignals: [],
  recentLowMoodEntries: [],
  generatedAt: null,
};

const EMPTY_ASSESSMENT_ANALYTICS: AssessmentAnalytics = {
  totalCompleted: 0,
  last7Completed: 0,
  last30Completed: 0,
  averageWellness: null,
  voiceCaptured: 0,
  videoCaptured: 0,
  severityDistribution: { high: 0, medium: 0, steady: 0, unknown: 0 },
  weeklyTrend: [],
  recentAssessments: [],
  generatedAt: null,
};

const DEFAULT_AI_SETTINGS: AdminAiSettings = {
  textWeight: 70,
  audioWeight: 15,
  videoWeight: 15,
  highRiskThreshold: 30,
  watchThreshold: 55,
  confidenceThreshold: 60,
  analysisSensitivity: "balanced",
  moderationEnabled: true,
  updatedBy: null,
  updatedAt: null,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toNumber = (value: unknown) => {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
};

const toNullableNumber = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
};

const normalizeAdminOverview = (payload: unknown): AdminOverviewStats => {
  if (!isRecord(payload)) return EMPTY_OVERVIEW;
  const coverage = isRecord(payload.resourceCoverage) ? payload.resourceCoverage : {};
  const risk = isRecord(payload.riskDistribution) ? payload.riskDistribution : {};

  return {
    totalUsers: toNumber(payload.totalUsers),
    activeUsers: toNumber(payload.activeUsers),
    depressionTestsCompleted: toNumber(payload.depressionTestsCompleted),
    moodEntriesLogged: toNumber(payload.moodEntriesLogged),
    supportSessions: toNumber(payload.supportSessions),
    supportRequests: toNumber(payload.supportRequests),
    highRiskAlerts: toNumber(payload.highRiskAlerts),
    publishedResources: toNumber(payload.publishedResources),
    resourceOpens: toNumber(payload.resourceOpens),
    aiAnalysesCompleted: toNumber(payload.aiAnalysesCompleted),
    avgMood: toNullableNumber(payload.avgMood),
    avgEnergy: toNullableNumber(payload.avgEnergy),
    avgSleep: toNullableNumber(payload.avgSleep),
    resourceCoverage: {
      article: toNumber(coverage.article),
      video: toNumber(coverage.video),
      audio: toNumber(coverage.audio),
    },
    riskDistribution: {
      high: toNumber(risk.high),
      medium: toNumber(risk.medium),
      steady: toNumber(risk.steady),
      unknown: toNumber(risk.unknown),
    },
    generatedAt: typeof payload.generatedAt === "string" ? payload.generatedAt : null,
  };
};

const formatAdminDate = (value?: string | null) => {
  if (!value) return "No activity yet";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
};

type ExportValue = string | number | boolean | null | undefined;
type ExportRow = Record<string, ExportValue>;

const exportDateStamp = () => new Date().toISOString().slice(0, 10);

const cleanExportValue = (value: ExportValue) => {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
};

const escapeCsvValue = (value: ExportValue) => {
  const cleaned = cleanExportValue(value);
  return /[",\n]/.test(cleaned) ? `"${cleaned.replace(/"/g, '""')}"` : cleaned;
};

const downloadTextFile = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const downloadCsvRows = (rows: ExportRow[], filename: string) => {
  if (rows.length === 0) {
    downloadTextFile("No records available\n", filename, "text/csv;charset=utf-8");
    return;
  }

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(",")),
  ].join("\n");

  downloadTextFile(csv, filename, "text/csv;charset=utf-8");
};

const adminExportFilename = (name: string, extension: "csv" | "json") =>
  `mindsense-admin-${name}-${exportDateStamp()}.${extension}`;

const normalizeReviewStatus = (value: unknown): AdminReviewStatus => {
  if (value === "watch" || value === "needs_support" || value === "restricted") return value;
  return "active";
};

const normalizeReviewPriority = (value: unknown): AdminReviewPriority => {
  if (value === "medium" || value === "high") return value;
  return "normal";
};

const normalizeRiskLevel = (value: unknown): RiskLevel => {
  if (value === "high" || value === "medium" || value === "steady") return value;
  return "unknown";
};

const normalizeAlertStatus = (value: unknown): Exclude<AlertStatus, "all"> => {
  if (value === "acknowledged" || value === "resolved") return value;
  return "open";
};

const normalizeAlertPriority = (value: unknown): AlertPriority => {
  if (value === "urgent" || value === "watch") return value;
  return "high";
};

const normalizeAiSensitivity = (value: unknown): AiSensitivity => {
  if (value === "low" || value === "high") return value;
  return "balanced";
};

const normalizeAdminAiSettings = (payload: unknown): AdminAiSettings => {
  if (!isRecord(payload)) return DEFAULT_AI_SETTINGS;
  return {
    textWeight: toNumber(payload.textWeight),
    audioWeight: toNumber(payload.audioWeight),
    videoWeight: toNumber(payload.videoWeight),
    highRiskThreshold: toNumber(payload.highRiskThreshold),
    watchThreshold: toNumber(payload.watchThreshold),
    confidenceThreshold: toNumber(payload.confidenceThreshold),
    analysisSensitivity: normalizeAiSensitivity(payload.analysisSensitivity),
    moderationEnabled: typeof payload.moderationEnabled === "boolean" ? payload.moderationEnabled : true,
    updatedBy: typeof payload.updatedBy === "string" ? payload.updatedBy : null,
    updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : null,
  };
};

const normalizeAdminAuditLog = (item: AdminAuditLog): AdminAuditLog => ({
  ...item,
  admin_name: typeof item.admin_name === "string" ? item.admin_name : null,
  admin_email: typeof item.admin_email === "string" ? item.admin_email : null,
  entity_id: typeof item.entity_id === "string" ? item.entity_id : null,
  metadata: isRecord(item.metadata) ? item.metadata : {},
});

const normalizeMoodAnalytics = (payload: unknown): MoodAnalytics => {
  if (!isRecord(payload)) return EMPTY_MOOD_ANALYTICS;
  const distribution = isRecord(payload.moodDistribution) ? payload.moodDistribution : {};

  return {
    totalEntries: toNumber(payload.totalEntries),
    last7Entries: toNumber(payload.last7Entries),
    last30Entries: toNumber(payload.last30Entries),
    averageMood: toNullableNumber(payload.averageMood),
    averageEnergy: toNullableNumber(payload.averageEnergy),
    averageSleep: toNullableNumber(payload.averageSleep),
    lowMoodSignals: toNumber(payload.lowMoodSignals),
    poorSleepSignals: toNumber(payload.poorSleepSignals),
    lowEnergySignals: toNumber(payload.lowEnergySignals),
    moodDistribution: {
      "1": toNumber(distribution["1"]),
      "2": toNumber(distribution["2"]),
      "3": toNumber(distribution["3"]),
      "4": toNumber(distribution["4"]),
      "5": toNumber(distribution["5"]),
    },
    dailyTrend: Array.isArray(payload.dailyTrend)
      ? payload.dailyTrend.filter(isRecord).map((item) => ({
          date: typeof item.date === "string" ? item.date : "",
          entries: toNumber(item.entries),
          avgMood: toNullableNumber(item.avgMood),
          avgEnergy: toNullableNumber(item.avgEnergy),
          avgSleep: toNullableNumber(item.avgSleep),
          lowMood: toNumber(item.lowMood),
        }))
      : [],
    tagSignals: Array.isArray(payload.tagSignals)
      ? payload.tagSignals.filter(isRecord).map((item) => ({
          tag: String(item.tag || ""),
          total: toNumber(item.total),
          avgMood: toNullableNumber(item.avgMood),
          lowMood: toNumber(item.lowMood),
          highMood: toNumber(item.highMood),
        })).filter((item) => item.tag)
      : [],
    recentLowMoodEntries: Array.isArray(payload.recentLowMoodEntries)
      ? payload.recentLowMoodEntries.filter(isRecord).map((item) => ({
          userId: String(item.userId || ""),
          name: typeof item.name === "string" ? item.name : null,
          email: typeof item.email === "string" ? item.email : null,
          mood: toNumber(item.mood),
          energy: toNullableNumber(item.energy),
          sleepQuality: toNullableNumber(item.sleepQuality),
          entryDate: typeof item.entryDate === "string" ? item.entryDate : "",
          createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
          tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
        })).filter((item) => item.userId)
      : [],
    generatedAt: typeof payload.generatedAt === "string" ? payload.generatedAt : null,
  };
};

const normalizeTopTags = (value: unknown): Array<{ tag: string; count: number }> =>
  Array.isArray(value)
    ? value
        .filter(isRecord)
        .map((item) => ({ tag: String(item.tag || ""), count: toNumber(item.count) }))
        .filter((item) => item.tag)
    : [];

const normalizeNumberRecord = (value: unknown): Record<string, number> => {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toNumber(item)]));
};

const normalizeRecentActivity = (value: unknown): AdminUserDetail["recentActivity"] =>
  Array.isArray(value)
    ? value.filter(isRecord).map((item) => ({
        source: String(item.source || "activity"),
        title: String(item.title || "Activity"),
        occurredAt: typeof item.occurredAt === "string" ? item.occurredAt : "",
        metadata: isRecord(item.metadata) ? item.metadata : {},
      }))
    : [];

const normalizeAssessmentAnalytics = (payload: unknown): AssessmentAnalytics => {
  if (!isRecord(payload)) return EMPTY_ASSESSMENT_ANALYTICS;
  const severity = isRecord(payload.severityDistribution) ? payload.severityDistribution : {};

  return {
    totalCompleted: toNumber(payload.totalCompleted),
    last7Completed: toNumber(payload.last7Completed),
    last30Completed: toNumber(payload.last30Completed),
    averageWellness: toNullableNumber(payload.averageWellness),
    voiceCaptured: toNumber(payload.voiceCaptured),
    videoCaptured: toNumber(payload.videoCaptured),
    severityDistribution: {
      high: toNumber(severity.high),
      medium: toNumber(severity.medium),
      steady: toNumber(severity.steady),
      unknown: toNumber(severity.unknown),
    },
    weeklyTrend: Array.isArray(payload.weeklyTrend)
      ? payload.weeklyTrend.filter(isRecord).map((item) => ({
          date: typeof item.date === "string" ? item.date : "",
          completed: toNumber(item.completed),
          avgWellness: toNullableNumber(item.avgWellness),
          highRisk: toNumber(item.highRisk),
        }))
      : [],
    recentAssessments: Array.isArray(payload.recentAssessments)
      ? payload.recentAssessments.filter(isRecord).map((item) => ({
          assessmentId: String(item.assessmentId || ""),
          userId: String(item.userId || ""),
          name: typeof item.name === "string" ? item.name : null,
          email: typeof item.email === "string" ? item.email : null,
          createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
          wellnessScore: toNullableNumber(item.wellnessScore),
          riskLevel: normalizeRiskLevel(item.riskLevel),
          answerCount: toNumber(item.answerCount),
          voiceCaptured: Boolean(item.voiceCaptured),
          videoCaptured: Boolean(item.videoCaptured),
          alertStatus: normalizeAlertStatus(item.alertStatus),
        })).filter((item) => item.assessmentId)
      : [],
    generatedAt: typeof payload.generatedAt === "string" ? payload.generatedAt : null,
  };
};

const normalizeAdminUserDetail = (payload: unknown, fallbackUserId: string): AdminUserDetail => {
  const data = isRecord(payload) ? payload : {};
  const profile = isRecord(data.profile) ? data.profile : {};
  const review = isRecord(data.reviewStatus) ? data.reviewStatus : {};
  const mood = isRecord(data.moodSummary) ? data.moodSummary : {};
  const testSummary = isRecord(data.testSummary) ? data.testSummary : {};
  const supportSummary = isRecord(data.supportSummary) ? data.supportSummary : {};
  const resourceSummary = isRecord(data.resourceSummary) ? data.resourceSummary : {};
  const activity = isRecord(data.activity) ? data.activity : {};
  const latestTest = isRecord(data.latestTest) ? data.latestTest : null;

  return {
    profile: {
      userId: typeof profile.userId === "string" ? profile.userId : fallbackUserId,
      name: typeof profile.name === "string" ? profile.name : null,
      email: typeof profile.email === "string" ? profile.email : null,
      joinedAt: typeof profile.joinedAt === "string" ? profile.joinedAt : null,
    },
    reviewStatus: {
      reviewStatus: normalizeReviewStatus(review.reviewStatus),
      priority: normalizeReviewPriority(review.priority),
      adminNote: typeof review.adminNote === "string" ? review.adminNote : null,
      updatedAt: typeof review.updatedAt === "string" ? review.updatedAt : null,
    },
    moodSummary: {
      totalEntries: toNumber(mood.totalEntries),
      last7Entries: toNumber(mood.last7Entries),
      avgMood: toNullableNumber(mood.avgMood),
      avgEnergy: toNullableNumber(mood.avgEnergy),
      avgSleep: toNullableNumber(mood.avgSleep),
      topTags: normalizeTopTags(mood.topTags),
    },
    latestTest: latestTest
      ? {
          createdAt: typeof latestTest.createdAt === "string" ? latestTest.createdAt : null,
          status: typeof latestTest.status === "string" ? latestTest.status : null,
          wellnessScore: toNullableNumber(latestTest.wellnessScore),
          answerCount: toNumber(latestTest.answerCount),
          voiceCaptured: Boolean(latestTest.voiceCaptured),
          videoCaptured: Boolean(latestTest.videoCaptured),
        }
      : null,
    testSummary: {
      completedTests: toNumber(testSummary.completedTests),
    },
    supportSummary: {
      totalSessions: toNumber(supportSummary.totalSessions),
      byType: normalizeNumberRecord(supportSummary.byType),
    },
    resourceSummary: {
      resourcesOpened: toNumber(resourceSummary.resourcesOpened),
      lastViewed: typeof resourceSummary.lastViewed === "string" ? resourceSummary.lastViewed : null,
    },
    activity: {
      latestActivity: typeof activity.latestActivity === "string" ? activity.latestActivity : null,
    },
    recentActivity: normalizeRecentActivity(data.recentActivity),
  };
};

const normalizeAdminUserSummary = (item: AdminUserSummary): AdminUserSummary => ({
  ...item,
  risk_level: ["unknown", "steady", "medium", "high"].includes(item.risk_level) ? item.risk_level : "unknown",
  account_status: normalizeReviewStatus(item.account_status),
});

const AdminDashboard = () => {
  const { user } = useAuth();
  const [access, setAccess] = useState<AccessState>("checking");
  const [resources, setResources] = useState<Resource[]>([]);
  const [overview, setOverview] = useState<AdminOverviewStats | null>(null);
  const [userSummaries, setUserSummaries] = useState<AdminUserSummary[]>([]);
  const [assessmentAnalytics, setAssessmentAnalytics] = useState<AssessmentAnalytics | null>(null);
  const [riskAlerts, setRiskAlerts] = useState<RiskAlertRow[]>([]);
  const [moodAnalytics, setMoodAnalytics] = useState<MoodAnalytics | null>(null);
  const [professionals, setProfessionals] = useState<ProfessionalDirectoryEntry[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [aiSettings, setAiSettings] = useState<AdminAiSettings>(DEFAULT_AI_SETTINGS);
  const [aiSettingsDraft, setAiSettingsDraft] = useState<AdminAiSettings>(DEFAULT_AI_SETTINGS);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [assessmentLoading, setAssessmentLoading] = useState(true);
  const [moodAnalyticsLoading, setMoodAnalyticsLoading] = useState(true);
  const [professionalsLoading, setProfessionalsLoading] = useState(true);
  const [contactMessagesLoading, setContactMessagesLoading] = useState(true);
  const [aiSettingsLoading, setAiSettingsLoading] = useState(true);
  const [aiSettingsSaving, setAiSettingsSaving] = useState(false);
  const [auditLoading, setAuditLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [overviewError, setOverviewError] = useState("");
  const [assessmentError, setAssessmentError] = useState("");
  const [moodAnalyticsError, setMoodAnalyticsError] = useState("");
  const [professionalsError, setProfessionalsError] = useState("");
  const [contactMessagesError, setContactMessagesError] = useState("");
  const [aiSettingsError, setAiSettingsError] = useState("");
  const [auditError, setAuditError] = useState("");
  const [search, setSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [alertStatusFilter, setAlertStatusFilter] = useState<AlertStatus>("all");
  const [professionalSearch, setProfessionalSearch] = useState("");
  const [professionalCityFilter, setProfessionalCityFilter] = useState("all");
  const [auditEntityFilter, setAuditEntityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ResourceStatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | ResourceCategory>("all");
  const [moodFilter, setMoodFilter] = useState<"all" | ResourceMoodCategory>("all");
  const [editing, setEditing] = useState<Resource | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [professionalEditing, setProfessionalEditing] = useState<ProfessionalDirectoryEntry | null>(null);
  const [professionalModalOpen, setProfessionalModalOpen] = useState(false);
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUserDetail | null>(null);
  const [userDetailOpen, setUserDetailOpen] = useState(false);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [userDetailError, setUserDetailError] = useState("");
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTabId>("overview");

  const checkAccess = useCallback(async () => {
    if (!user) return;
    setAccess("checking");
    const { data, error } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (error || !data) {
      setAccess("denied");
      setLoading(false);
      return;
    }
    setAccess("allowed");
  }, [user]);

  const loadResources = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError("");
    const { data, error, compatibilityMode } = await listResources(true);
    if (error) {
      setLoadError(error.message);
      setResources([]);
    } else {
      setResources(data);
      if (compatibilityMode) {
        setLoadError("Resources are running in compatibility mode. Apply the premium resources migration to enable publish states and mood metadata.");
      }
    }
    setLoading(false);
  }, [user]);

  const loadAdminUsers = useCallback(async (nextSearch = "") => {
    if (!user) return;
    setUsersLoading(true);
    const { data, error } = await supabase.rpc("get_admin_user_summaries", { _limit: 12, _search: nextSearch.trim() });

    if (error) {
      setUserSummaries([]);
      setOverviewError((current) => [current, error.message].filter(Boolean).join(" "));
    } else {
      setUserSummaries(((data || []) as AdminUserSummary[]).map(normalizeAdminUserSummary));
    }

    setUsersLoading(false);
  }, [user]);

  const loadAdminOverview = useCallback(async () => {
    if (!user) return;
    setOverviewLoading(true);
    setUsersLoading(true);
    setOverviewError("");

    const [overviewResult, usersResult] = await Promise.all([
      supabase.rpc("get_admin_overview"),
      supabase.rpc("get_admin_user_summaries", { _limit: 12, _search: "" }),
    ]);

    if (overviewResult.error) {
      setOverview(null);
      setOverviewError(overviewResult.error.message);
    } else {
      setOverview(normalizeAdminOverview(overviewResult.data));
    }

    if (usersResult.error) {
      setUserSummaries([]);
      setOverviewError((current) => [current, usersResult.error.message].filter(Boolean).join(" "));
    } else {
      setUserSummaries(((usersResult.data || []) as AdminUserSummary[]).map(normalizeAdminUserSummary));
    }

    setOverviewLoading(false);
    setUsersLoading(false);
  }, [user]);

  const loadAssessmentCenter = useCallback(async () => {
    if (!user) return;
    setAssessmentLoading(true);
    setAssessmentError("");

    const [analyticsResult, alertsResult] = await Promise.all([
      supabase.rpc("get_admin_assessment_analytics"),
      supabase.rpc("get_admin_risk_alerts", { _limit: 12, _status: alertStatusFilter }),
    ]);

    if (analyticsResult.error) {
      setAssessmentAnalytics(null);
      setAssessmentError(analyticsResult.error.message);
    } else {
      setAssessmentAnalytics(normalizeAssessmentAnalytics(analyticsResult.data));
    }

    if (alertsResult.error) {
      setRiskAlerts([]);
      setAssessmentError((current) => [current, alertsResult.error.message].filter(Boolean).join(" "));
    } else {
      setRiskAlerts(((alertsResult.data || []) as RiskAlertRow[]).map((alert) => ({
        ...alert,
        risk_level: alert.risk_level === "high" ? "high" : "medium",
        alert_status: normalizeAlertStatus(alert.alert_status),
        priority: normalizeAlertPriority(alert.priority),
      })));
    }

    setAssessmentLoading(false);
  }, [alertStatusFilter, user]);

  const loadMoodAnalytics = useCallback(async () => {
    if (!user) return;
    setMoodAnalyticsLoading(true);
    setMoodAnalyticsError("");

    const { data, error } = await supabase.rpc("get_admin_mood_analytics");

    if (error) {
      setMoodAnalytics(null);
      setMoodAnalyticsError(error.message);
    } else {
      setMoodAnalytics(normalizeMoodAnalytics(data));
    }

    setMoodAnalyticsLoading(false);
  }, [user]);

  const loadProfessionals = useCallback(async () => {
    if (!user) return;
    setProfessionalsLoading(true);
    setProfessionalsError("");

    const { data, error } = await supabase
      .from("mental_health_professionals")
      .select("*")
      .order("featured", { ascending: false })
      .order("city", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      setProfessionals([]);
      setProfessionalsError(error.message);
    } else {
      setProfessionals((data ?? []) as ProfessionalDirectoryEntry[]);
    }

    setProfessionalsLoading(false);
  }, [user]);

  const loadContactMessages = useCallback(async () => {
    if (!user) return;
    setContactMessagesLoading(true);
    setContactMessagesError("");

    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      setContactMessages([]);
      setContactMessagesError(error.message);
    } else {
      setContactMessages((data ?? []) as ContactMessage[]);
    }

    setContactMessagesLoading(false);
  }, [user]);

  const loadAiSettings = useCallback(async () => {
    if (!user) return;
    setAiSettingsLoading(true);
    setAiSettingsError("");

    const { data, error } = await supabase.rpc("get_admin_ai_settings");

    if (error) {
      setAiSettings(DEFAULT_AI_SETTINGS);
      setAiSettingsDraft(DEFAULT_AI_SETTINGS);
      setAiSettingsError(error.message);
    } else {
      const normalized = normalizeAdminAiSettings(data);
      setAiSettings(normalized);
      setAiSettingsDraft(normalized);
    }

    setAiSettingsLoading(false);
  }, [user]);

  const loadAuditLogs = useCallback(async (nextEntityType = auditEntityFilter) => {
    if (!user) return;
    setAuditLoading(true);
    setAuditError("");

    const { data, error } = await supabase.rpc("get_admin_audit_logs", {
      _limit: 30,
      _entity_type: nextEntityType,
    });

    if (error) {
      setAuditLogs([]);
      setAuditError(error.message);
    } else {
      setAuditLogs(((data || []) as AdminAuditLog[]).map(normalizeAdminAuditLog));
    }

    setAuditLoading(false);
  }, [auditEntityFilter, user]);

  const recordAdminAuditLog = useCallback(async ({
    action,
    entityType,
    summary,
    entityId,
    metadata = {},
  }: AdminAuditLogInput) => {
    if (!user) return;
    const { error } = await supabase.rpc("record_admin_audit_log", {
      _action: action,
      _entity_type: entityType,
      _summary: summary,
      _entity_id: entityId ?? null,
      _metadata: metadata as Json,
    });

    if (!error) {
      await loadAuditLogs();
    }
  }, [loadAuditLogs, user]);

  useEffect(() => {
    void checkAccess();
  }, [checkAccess]);

  useEffect(() => {
    if (access === "allowed") {
      void loadResources();
      void loadAdminOverview();
      void loadAssessmentCenter();
      void loadMoodAnalytics();
      void loadProfessionals();
      void loadContactMessages();
      void loadAiSettings();
      void loadAuditLogs();
    }
  }, [access, loadAdminOverview, loadAiSettings, loadAssessmentCenter, loadAuditLogs, loadContactMessages, loadMoodAnalytics, loadProfessionals, loadResources]);

  useEffect(() => {
    if (access !== "allowed" || activeAdminTab !== "users") return;
    const searchTimer = window.setTimeout(() => {
      void loadAdminUsers(userSearch);
    }, 300);

    return () => window.clearTimeout(searchTimer);
  }, [access, activeAdminTab, loadAdminUsers, userSearch]);

  const stats = useMemo(
    () => ({
      total: resources.length,
      published: resources.filter((resource) => resource.is_published).length,
      drafts: resources.filter((resource) => !resource.is_published).length,
      featured: resources.filter((resource) => resource.featured).length,
      needsReview: resources.filter((resource) => getResourceIssues(resource).length > 0).length,
      article: resources.filter((resource) => resource.type === "article").length,
      video: resources.filter((resource) => resource.type === "video").length,
      audio: resources.filter((resource) => resource.type === "audio").length,
    }),
    [resources],
  );

  const filteredResources = useMemo(() => {
      const query = search.trim().toLowerCase();
      return resources.filter((resource) => {
        if (statusFilter === "published" && !resource.is_published) return false;
        if (statusFilter === "draft" && resource.is_published) return false;
        if (statusFilter === "featured" && !resource.featured) return false;
        if (statusFilter === "needs_review" && getResourceIssues(resource).length === 0) return false;
        if (typeFilter !== "all" && resource.type !== typeFilter) return false;
        if (moodFilter !== "all" && resource.mood_category !== moodFilter) return false;
        if (!query) return true;
        return `${resource.title} ${resource.description ?? ""} ${resource.mood_category ?? ""} ${(resource.tags || []).join(" ")}`
          .toLowerCase()
          .includes(query);
      });
  }, [moodFilter, resources, search, statusFilter, typeFilter]);

  const professionalCities = useMemo(
    () => ["all", ...Array.from(new Set(professionals.map((professional) => professional.city))).sort()],
    [professionals],
  );

  const filteredProfessionals = useMemo(() => {
    const query = professionalSearch.trim().toLowerCase();
    return professionals.filter((professional) => {
      if (professionalCityFilter !== "all" && professional.city !== professionalCityFilter) return false;
      if (!query) return true;
      return [
        professional.name,
        professional.role,
        professional.specialization,
        professional.city,
        professional.location,
        professional.address ?? "",
        professional.phone ?? "",
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [professionalCityFilter, professionalSearch, professionals]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const importCandidate = async (candidate: CuratedResourceCandidate) => {
    if (!user) return;
    const { error } = await saveResource({
      title: candidate.title,
      description: candidate.description,
      type: candidate.category,
      category: candidate.category,
      mood_category: candidate.mood_category,
      topic: candidate.mood_category,
      external_url: candidate.external_url,
      content_url: candidate.external_url,
      thumbnail_url: candidate.thumbnail_url,
      tags: candidate.tags,
      estimated_duration: candidate.estimated_duration,
      duration: candidate.estimated_duration,
      source_platform: candidate.source_platform,
      featured: candidate.featured ?? false,
      is_published: false,
      created_by: user.id,
    });

    if (error) {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Imported as draft", description: "Review it before publishing to users." });
    await recordAdminAuditLog({
      action: "resource.import",
      entityType: "resource",
      entityId: candidate.external_url,
      summary: `Imported draft resource: ${candidate.title}`,
      metadata: { type: candidate.category, moodCategory: candidate.mood_category, sourcePlatform: candidate.source_platform },
    });
    await loadResources();
    await loadAdminOverview();
  };

  const updateResourceModeration = async (resource: Resource, patch: Partial<Pick<Resource, "featured" | "is_published">>, successTitle: string) => {
    if (!user) return;
    const { error } = await saveResource(
      {
        title: resource.title,
        description: resource.description,
        type: resource.type,
        category: resource.category || resource.type,
        topic: resource.topic || resource.mood_category,
        mood_category: resource.mood_category,
        external_url: resource.external_url || resource.content_url,
        content_url: resource.content_url || resource.external_url,
        thumbnail_url: resource.thumbnail_url,
        content_body: resource.content_body,
        tags: resource.tags || [],
        estimated_duration: resource.estimated_duration || resource.duration,
        duration: resource.duration || resource.estimated_duration,
        source_platform: resource.source_platform,
        featured: patch.featured ?? resource.featured,
        is_published: patch.is_published ?? resource.is_published,
        created_by: resource.created_by || user.id,
      },
      resource.id,
    );

    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: successTitle });
    await recordAdminAuditLog({
      action: "resource.update",
      entityType: "resource",
      entityId: resource.id,
      summary: `${successTitle}: ${resource.title}`,
      metadata: patch,
    });
    await loadResources();
    await loadAdminOverview();
  };

  const removeResource = async (resource: Resource) => {
    if (!confirm(`Delete "${resource.title}"?`)) return;
    const { error } = await deleteResource(resource.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Resource deleted" });
    await recordAdminAuditLog({
      action: "resource.delete",
      entityType: "resource",
      entityId: resource.id,
      summary: `Deleted resource: ${resource.title}`,
      metadata: { type: resource.type, moodCategory: resource.mood_category },
    });
    await loadResources();
    await loadAdminOverview();
  };

  const openUserDetail = async (userId: string) => {
    setUserDetailOpen(true);
    setUserDetailLoading(true);
    setUserDetailError("");
    setSelectedUserDetail(null);

    const { data, error } = await supabase.rpc("get_admin_user_detail", { _user_id: userId });
    if (error) {
      setUserDetailError(error.message);
    } else {
      setSelectedUserDetail(normalizeAdminUserDetail(data, userId));
    }

    setUserDetailLoading(false);
  };

  const saveUserReviewStatus = async (
    detail: AdminUserDetail,
    reviewStatus: AdminReviewStatus,
    priority: AdminReviewPriority,
    adminNote: string,
  ) => {
    const { data, error } = await supabase.rpc("set_admin_user_review_status", {
      _user_id: detail.profile.userId,
      _review_status: reviewStatus,
      _priority: priority,
      _admin_note: adminNote,
    });

    if (error) {
      toast({ title: "Could not save review status", description: error.message, variant: "destructive" });
      return;
    }

    const nextReview = isRecord(data)
      ? {
          reviewStatus: normalizeReviewStatus(data.reviewStatus),
          priority: normalizeReviewPriority(data.priority),
          adminNote: typeof data.adminNote === "string" ? data.adminNote : null,
          updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
        }
      : detail.reviewStatus;

    setSelectedUserDetail({ ...detail, reviewStatus: nextReview });
    toast({ title: "User review status saved" });
    await recordAdminAuditLog({
      action: "user.review_status",
      entityType: "user",
      entityId: detail.profile.userId,
      summary: `Updated user review status to ${moodLabel(reviewStatus)}`,
      metadata: { priority, hasNote: Boolean(adminNote.trim()) },
    });
    await loadAdminUsers(userSearch);
  };

  const updateRiskAlertStatus = async (
    alert: RiskAlertRow,
    status: Exclude<AlertStatus, "all">,
    note = alert.admin_note || "",
  ) => {
    const { error } = await supabase.rpc("set_admin_risk_alert_status", {
      _assessment_id: alert.assessment_id,
      _alert_status: status,
      _priority: alert.priority,
      _admin_note: note,
    });

    if (error) {
      toast({ title: "Could not update alert", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: status === "resolved" ? "Alert resolved" : "Alert acknowledged" });
    await recordAdminAuditLog({
      action: "risk_alert.update",
      entityType: "assessment",
      entityId: alert.assessment_id,
      summary: `Marked risk alert as ${moodLabel(status)}`,
      metadata: { userId: alert.user_id, wellnessScore: alert.wellness_score, priority: alert.priority },
    });
    await loadAssessmentCenter();
    await loadAdminOverview();
  };

  const saveProfessional = async (form: ProfessionalFormState, id?: string) => {
    if (!user) return;
    const name = form.name.trim();
    const role = form.role.trim();
    const specialization = form.specialization.trim();
    const city = form.city.trim();
    const location = form.location.trim();

    if (!name || !role || !specialization || !city || !location) {
      toast({ title: "Missing professional details", description: "Name, role, specialization, city, and location are required.", variant: "destructive" });
      return;
    }

    const baseSlug = form.slug.trim() || slugify(`${name}-${city}-${location}`);
    const payload = {
      slug: id ? baseSlug : `${baseSlug || "professional"}-${Date.now()}`,
      name,
      role,
      specialization,
      city,
      location,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      map_url: form.map_url.trim() || null,
      source_label: form.source_label.trim() || null,
      source_url: form.source_url.trim() || null,
      verification_status: form.verification_status,
      is_published: form.is_published,
      featured: form.featured,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    };

    const query = id
      ? supabase.from("mental_health_professionals").update(payload).eq("id", id)
      : supabase.from("mental_health_professionals").insert(payload);
    const { error } = await query;

    if (error) {
      toast({ title: "Could not save professional", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: id ? "Professional updated" : "Professional added" });
    await recordAdminAuditLog({
      action: id ? "professional.update" : "professional.create",
      entityType: "professional",
      entityId: id ?? payload.slug,
      summary: `${id ? "Updated" : "Added"} professional listing: ${name}`,
      metadata: { city, specialization, published: form.is_published, featured: form.featured },
    });
    setProfessionalModalOpen(false);
    setProfessionalEditing(null);
    await loadProfessionals();
  };

  const updateProfessionalFlags = async (professional: ProfessionalDirectoryEntry, patch: Partial<Pick<ProfessionalDirectoryEntry, "is_published" | "featured" | "verification_status">>) => {
    const { error } = await supabase
      .from("mental_health_professionals")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", professional.id);

    if (error) {
      toast({ title: "Could not update professional", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Professional directory updated" });
    await recordAdminAuditLog({
      action: "professional.visibility",
      entityType: "professional",
      entityId: professional.id,
      summary: `Updated professional listing: ${professional.name}`,
      metadata: patch,
    });
    await loadProfessionals();
  };

  const removeProfessional = async (professional: ProfessionalDirectoryEntry) => {
    if (!confirm(`Delete "${professional.name}" from the professional directory?`)) return;
    const { error } = await supabase.from("mental_health_professionals").delete().eq("id", professional.id);
    if (error) {
      toast({ title: "Could not delete professional", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Professional removed" });
    await recordAdminAuditLog({
      action: "professional.delete",
      entityType: "professional",
      entityId: professional.id,
      summary: `Removed professional listing: ${professional.name}`,
      metadata: { city: professional.city, specialization: professional.specialization },
    });
    await loadProfessionals();
  };

  const saveAiSettings = async (nextSettings = aiSettingsDraft) => {
    if (!user) return;
    const weightTotal = nextSettings.textWeight + nextSettings.audioWeight + nextSettings.videoWeight;
    if (weightTotal !== 100) {
      toast({ title: "Fusion weights must equal 100%", description: `Current total is ${weightTotal}%.`, variant: "destructive" });
      return;
    }

    if (nextSettings.highRiskThreshold >= nextSettings.watchThreshold) {
      toast({
        title: "Risk thresholds need adjustment",
        description: "High-risk threshold must be lower than the watch threshold.",
        variant: "destructive",
      });
      return;
    }

    setAiSettingsSaving(true);
    setAiSettingsError("");

    const { data, error } = await supabase.rpc("set_admin_ai_settings", {
      _text_weight: nextSettings.textWeight,
      _audio_weight: nextSettings.audioWeight,
      _video_weight: nextSettings.videoWeight,
      _high_risk_threshold: nextSettings.highRiskThreshold,
      _watch_threshold: nextSettings.watchThreshold,
      _confidence_threshold: nextSettings.confidenceThreshold,
      _analysis_sensitivity: nextSettings.analysisSensitivity,
      _moderation_enabled: nextSettings.moderationEnabled,
    });

    if (error) {
      setAiSettingsError(error.message);
      toast({ title: "Could not save AI settings", description: error.message, variant: "destructive" });
      setAiSettingsSaving(false);
      return;
    }

    const normalized = normalizeAdminAiSettings(data);
    setAiSettings(normalized);
    setAiSettingsDraft(normalized);
    setAiSettingsSaving(false);
    toast({ title: "AI model settings saved", description: "Future admin calculations can use these governance controls." });
    await recordAdminAuditLog({
      action: "ai_settings.update",
      entityType: "ai_settings",
      entityId: "default",
      summary: "Updated AI model governance settings",
      metadata: {
        textWeight: normalized.textWeight,
        audioWeight: normalized.audioWeight,
        videoWeight: normalized.videoWeight,
        highRiskThreshold: normalized.highRiskThreshold,
        watchThreshold: normalized.watchThreshold,
        sensitivity: normalized.analysisSensitivity,
      },
    });
  };

  const resetAiSettings = async () => {
    await saveAiSettings(DEFAULT_AI_SETTINGS);
  };

  const exportPlatformSummary = () => {
    downloadTextFile(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          overview: overview || EMPTY_OVERVIEW,
          assessmentAnalytics: assessmentAnalytics || EMPTY_ASSESSMENT_ANALYTICS,
          moodAnalytics: moodAnalytics || EMPTY_MOOD_ANALYTICS,
          resourceStats: stats,
          professionalDirectory: {
            total: professionals.length,
            published: professionals.filter((professional) => professional.is_published).length,
            featured: professionals.filter((professional) => professional.featured).length,
          },
          aiSettings,
          note: "Admin export contains aggregate operational data and omits private journal notes/raw assessment answers.",
        },
        null,
        2,
      ),
      adminExportFilename("platform-summary", "json"),
      "application/json;charset=utf-8",
    );
    toast({ title: "Platform summary exported" });
  };

  const exportUsersSnapshot = async () => {
    const { data, error } = await supabase.rpc("get_admin_user_summaries", { _limit: 50, _search: "" });
    if (error) {
      toast({ title: "User export failed", description: error.message, variant: "destructive" });
      return;
    }

    downloadCsvRows(
      ((data || []) as AdminUserSummary[]).map(normalizeAdminUserSummary).map((item) => ({
        user_id: item.user_id,
        name: item.name,
        email: item.email,
        joined_at: item.joined_at,
        latest_activity: item.latest_activity,
        mood_entries: item.mood_entries,
        completed_tests: item.completed_tests,
        support_sessions: item.support_sessions,
        risk_level: item.risk_level,
        account_status: item.account_status,
      })),
      adminExportFilename("users-snapshot", "csv"),
    );
    toast({ title: "Users snapshot exported" });
  };

  const exportAssessmentSignals = () => {
    const analytics = assessmentAnalytics || EMPTY_ASSESSMENT_ANALYTICS;
    downloadCsvRows(
      analytics.recentAssessments.map((item) => ({
        assessment_id: item.assessmentId,
        user_id: item.userId,
        name: item.name,
        email: item.email,
        created_at: item.createdAt,
        wellness_score: item.wellnessScore,
        risk_level: item.riskLevel,
        answer_count: item.answerCount,
        voice_captured: item.voiceCaptured,
        video_captured: item.videoCaptured,
        alert_status: item.alertStatus,
      })),
      adminExportFilename("assessment-signals", "csv"),
    );
    toast({ title: "Assessment signals exported" });
  };

  const exportMoodTrend = () => {
    const analytics = moodAnalytics || EMPTY_MOOD_ANALYTICS;
    downloadCsvRows(
      analytics.dailyTrend.map((item) => ({
        date: item.date,
        entries: item.entries,
        avg_mood: item.avgMood,
        avg_energy: item.avgEnergy,
        avg_sleep: item.avgSleep,
        low_mood_signals: item.lowMood,
      })),
      adminExportFilename("mood-trend", "csv"),
    );
    toast({ title: "Mood trend exported" });
  };

  const exportResourceCatalog = () => {
    downloadCsvRows(
      resources.map((resource) => ({
        id: resource.id,
        title: resource.title,
        type: resource.type,
        mood_category: resource.mood_category,
        source_platform: resource.source_platform,
        is_published: resource.is_published,
        featured: resource.featured,
        estimated_duration: resource.estimated_duration || resource.duration,
        external_url: resource.external_url || resource.content_url,
        created_at: resource.created_at,
        updated_at: resource.updated_at,
      })),
      adminExportFilename("resource-catalog", "csv"),
    );
    toast({ title: "Resource catalog exported" });
  };

  const exportProfessionalDirectory = () => {
    downloadCsvRows(
      professionals.map((professional) => ({
        id: professional.id,
        name: professional.name,
        role: professional.role,
        specialization: professional.specialization,
        city: professional.city,
        location: professional.location,
        phone: professional.phone,
        verification_status: professional.verification_status,
        is_published: professional.is_published,
        featured: professional.featured,
        source_label: professional.source_label,
        source_url: professional.source_url,
      })),
      adminExportFilename("professional-directory", "csv"),
    );
    toast({ title: "Professional directory exported" });
  };

  if (access === "checking") {
    return (
      <DashboardLayout>
        <div className="premium-card flex min-h-[24rem] items-center justify-center p-8">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Checking admin access...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (access === "denied") {
    return (
      <DashboardLayout>
        <section className="premium-card relative overflow-hidden p-8">
          <div className="premium-grid pointer-events-none absolute inset-0 opacity-20" />
          <div className="relative max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-sm font-semibold text-amber-100">
              <ShieldCheck className="h-4 w-4" />
              Admin only
            </div>
            <h1 className="mt-5 text-4xl font-extrabold">Admin dashboard is not available for this account.</h1>
            <p className="mt-3 text-muted-foreground">
              User accounts can continue using MindSense normally. Admin tools stay separate so user pages remain clean and safe.
            </p>
          </div>
        </section>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <section className="premium-card relative overflow-hidden p-5 md:p-7">
          <div className="premium-grid pointer-events-none absolute inset-0 opacity-25" />
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                <ShieldCheck className="h-4 w-4" />
                Admin workspace
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-[1.04] md:text-5xl">
                MindSense admin command,
                <span className="block gradient-text">built for real oversight.</span>
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
                Monitor platform health, review wellness signals, moderate resources, and keep admin controls separate from the user experience.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="rounded-full border-white/10 bg-white/[0.04]"
                onClick={() => {
                  void loadResources();
                  void loadAdminOverview();
                  void loadAssessmentCenter();
                  void loadMoodAnalytics();
                  void loadProfessionals();
                  void loadContactMessages();
                  void loadAiSettings();
                  void loadAuditLogs();
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button className="premium-button" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Add Resource
              </Button>
            </div>
          </div>
        </section>

        {loadError && (
          <section className="rounded-[1.5rem] border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
            {loadError}
          </section>
        )}

        {overviewError && (
          <section className="rounded-[1.5rem] border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
            Admin overview could not be loaded. Apply the admin dashboard foundation migration in Supabase. {overviewError}
          </section>
        )}

        {assessmentError && (
          <section className="rounded-[1.5rem] border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
            Assessment analytics could not be loaded. Apply the admin assessment alert center migration in Supabase. {assessmentError}
          </section>
        )}

        {moodAnalyticsError && (
          <section className="rounded-[1.5rem] border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
            Mood analytics could not be loaded. Apply the admin mood analytics migration in Supabase. {moodAnalyticsError}
          </section>
        )}

        {professionalsError && (
          <section className="rounded-[1.5rem] border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
            Professional directory management could not be loaded. Apply the professional directory migration in Supabase. {professionalsError}
          </section>
        )}

        {contactMessagesError && (
          <section className="rounded-[1.5rem] border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
            Contact messages could not be loaded. Apply the contact admin read policy migration in Supabase. {contactMessagesError}
          </section>
        )}

        {aiSettingsError && (
          <section className="rounded-[1.5rem] border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
            AI model settings could not be loaded. Apply the admin AI model settings migration in Supabase. {aiSettingsError}
          </section>
        )}

        {auditError && (
          <section className="rounded-[1.5rem] border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
            Admin audit logs could not be loaded. Apply the admin audit log migration in Supabase. {auditError}
          </section>
        )}

        <AdminTabNavigation activeTab={activeAdminTab} onChange={setActiveAdminTab} />

        <AnimatePresence mode="wait">
          <motion.div
            key={activeAdminTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {activeAdminTab === "overview" && (
              <>
                <AdminOverviewPanel overview={overview || EMPTY_OVERVIEW} loading={overviewLoading} />
                <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
                  <SystemStatusPanel
                    overview={overview || EMPTY_OVERVIEW}
                    resources={resources}
                    riskAlerts={riskAlerts}
                    errors={{
                      resources: loadError,
                      overview: overviewError,
                      assessments: assessmentError,
                      mood: moodAnalyticsError,
                      directory: professionalsError,
                      aiSettings: aiSettingsError,
                      audit: auditError,
                    }}
                  />
                  <AdminSignalPanel overview={overview || EMPTY_OVERVIEW} resources={resources} resourceStats={stats} />
                </section>
              </>
            )}

            {activeAdminTab === "users" && (
              <AdminUserIntelligence
                users={userSummaries}
                loading={usersLoading}
                search={userSearch}
                onSearchChange={setUserSearch}
                onSearch={() => void loadAdminUsers(userSearch)}
                onOpenUser={(userId) => void openUserDetail(userId)}
              />
            )}

            {activeAdminTab === "assessments" && (
              <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.95fr)]">
                <AssessmentAnalyticsPanel analytics={assessmentAnalytics || EMPTY_ASSESSMENT_ANALYTICS} loading={assessmentLoading} />
                <HighRiskAlertCenter
                  alerts={riskAlerts}
                  loading={assessmentLoading}
                  statusFilter={alertStatusFilter}
                  onStatusFilterChange={setAlertStatusFilter}
                  onRefresh={() => void loadAssessmentCenter()}
                  onUpdateAlert={(alert, status) => void updateRiskAlertStatus(alert, status)}
                />
              </section>
            )}

            {activeAdminTab === "mood" && (
              <MoodIntelligencePanel
                analytics={moodAnalytics || EMPTY_MOOD_ANALYTICS}
                loading={moodAnalyticsLoading}
                onRefresh={() => void loadMoodAnalytics()}
              />
            )}

            {activeAdminTab === "resources" && (
              <>
                <ResourceHealthCoveragePanel resources={resources} loading={loading} onCreate={openCreate} />
                <ResourceModerationCenter
                  resources={resources}
                  loading={loading}
                  onEdit={(resource) => {
                    setEditing(resource);
                    setModalOpen(true);
                  }}
                  onDelete={removeResource}
                  onTogglePublished={(resource) =>
                    updateResourceModeration(
                      resource,
                      { is_published: !resource.is_published },
                      resource.is_published ? "Resource moved to draft" : "Resource published",
                    )
                  }
                  onToggleFeatured={(resource) =>
                    updateResourceModeration(
                      resource,
                      { featured: !resource.featured },
                      resource.featured ? "Resource removed from featured" : "Resource marked as featured",
                    )
                  }
                />

                <section className="premium-card p-5 md:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="flex items-center gap-2 text-2xl font-extrabold">
                        <Filter className="h-5 w-5 text-primary" />
                        Resource Manager
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">Only published resources appear on the user Resources page.</p>
                    </div>
                    <div className="flex w-full flex-col gap-2 xl:w-auto xl:flex-row">
                      <div className="relative xl:w-72">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search admin resources..." className="rounded-full border-white/10 bg-white/[0.06] pl-9" />
                      </div>
                      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ResourceStatusFilter)} className="h-10 rounded-full border border-white/10 bg-background px-4 text-sm">
                        <option value="all">All status</option>
                        <option value="published">Published</option>
                        <option value="draft">Drafts</option>
                        <option value="featured">Featured</option>
                        <option value="needs_review">Needs review</option>
                      </select>
                      <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "all" | ResourceCategory)} className="h-10 rounded-full border border-white/10 bg-background px-4 text-sm">
                        <option value="all">All types</option>
                        <option value="article">Articles</option>
                        <option value="video">Videos</option>
                        <option value="audio">Audio</option>
                      </select>
                      <select value={moodFilter} onChange={(event) => setMoodFilter(event.target.value as "all" | ResourceMoodCategory)} className="h-10 rounded-full border border-white/10 bg-background px-4 text-sm">
                        {RESOURCE_MOOD_CATEGORIES.map((item) => (
                          <option key={item} value={item}>{item === "all" ? "All moods" : moodLabel(item)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-2 md:grid-cols-5">
                    <ResourceCountPill label="Total" value={stats.total} />
                    <ResourceCountPill label="Published" value={stats.published} />
                    <ResourceCountPill label="Drafts" value={stats.drafts} />
                    <ResourceCountPill label="Featured" value={stats.featured} />
                    <ResourceCountPill label="Review" value={stats.needsReview} tone="warning" />
                  </div>

                  {loading ? (
                    <div className="mt-5 grid gap-3">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
                      ))}
                    </div>
                  ) : filteredResources.length === 0 ? (
                    <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
                      <BookOpen className="mx-auto h-8 w-8 text-primary" />
                      <h3 className="mt-3 text-lg font-bold">No resources found</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Create a new resource or import one from curated discovery.</p>
                    </div>
                  ) : (
                    <div className="mt-5 grid gap-3">
                      {filteredResources.map((resource) => (
                        <AdminResourceRow
                          key={resource.id}
                          resource={resource}
                          onEdit={() => {
                            setEditing(resource);
                            setModalOpen(true);
                          }}
                          onDelete={() => void removeResource(resource)}
                          onTogglePublished={() =>
                            void updateResourceModeration(
                              resource,
                              { is_published: !resource.is_published },
                              resource.is_published ? "Resource moved to draft" : "Resource published",
                            )
                          }
                          onToggleFeatured={() =>
                            void updateResourceModeration(
                              resource,
                              { featured: !resource.featured },
                              resource.featured ? "Resource removed from featured" : "Resource marked as featured",
                            )
                          }
                        />
                      ))}
                    </div>
                  )}
                </section>

                <AdminDiscoveryPanel resources={resources} onImport={importCandidate} />
              </>
            )}

            {activeAdminTab === "directory" && (
              <ProfessionalDirectoryManagement
                professionals={filteredProfessionals}
                totalCount={professionals.length}
                cities={professionalCities}
                cityFilter={professionalCityFilter}
                search={professionalSearch}
                loading={professionalsLoading}
                onCityFilterChange={setProfessionalCityFilter}
                onSearchChange={setProfessionalSearch}
                onRefresh={() => void loadProfessionals()}
                onCreate={() => {
                  setProfessionalEditing(null);
                  setProfessionalModalOpen(true);
                }}
                onEdit={(professional) => {
                  setProfessionalEditing(professional);
                  setProfessionalModalOpen(true);
                }}
                onDelete={(professional) => void removeProfessional(professional)}
                onTogglePublished={(professional) => void updateProfessionalFlags(professional, { is_published: !professional.is_published })}
                onToggleFeatured={(professional) => void updateProfessionalFlags(professional, { featured: !professional.featured })}
              />
            )}

            {activeAdminTab === "messages" && (
              <ContactMessagesPanel
                messages={contactMessages}
                loading={contactMessagesLoading}
                onRefresh={() => void loadContactMessages()}
              />
            )}

            {activeAdminTab === "reports" && (
              <ReportsExportsPanel
                loading={overviewLoading || assessmentLoading || moodAnalyticsLoading || loading || professionalsLoading || aiSettingsLoading}
                exports={[
                  {
                    title: "Platform Summary",
                    description: "JSON snapshot of overview, risk, mood, resource, and directory metrics.",
                    format: "JSON",
                    icon: FileText,
                    onExport: exportPlatformSummary,
                  },
                  {
                    title: "Users Snapshot",
                    description: "CSV of up to 50 user summaries, risk levels, and activity counts.",
                    format: "CSV",
                    icon: Users,
                    onExport: () => void exportUsersSnapshot(),
                  },
                  {
                    title: "Assessment Signals",
                    description: "CSV of recent assessment risk signals without raw answers or media.",
                    format: "CSV",
                    icon: ClipboardList,
                    onExport: exportAssessmentSignals,
                  },
                  {
                    title: "Mood Trend",
                    description: "CSV of aggregate daily mood, sleep, energy, and low-signal counts.",
                    format: "CSV",
                    icon: LineChart,
                    onExport: exportMoodTrend,
                  },
                  {
                    title: "Resource Catalog",
                    description: "CSV of admin resource metadata and publish/feature state.",
                    format: "CSV",
                    icon: BookOpen,
                    onExport: exportResourceCatalog,
                  },
                  {
                    title: "Professional Directory",
                    description: "CSV of professional listings, verification state, and visibility.",
                    format: "CSV",
                    icon: MapPin,
                    onExport: exportProfessionalDirectory,
                  },
                ]}
              />
            )}

            {activeAdminTab === "settings" && (
              <>
                <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
                  <AiModelSettingsPanel
                    settings={aiSettings}
                    draft={aiSettingsDraft}
                    loading={aiSettingsLoading}
                    saving={aiSettingsSaving}
                    onDraftChange={setAiSettingsDraft}
                    onSave={() => void saveAiSettings()}
                    onReset={() => void resetAiSettings()}
                    onRefresh={() => void loadAiSettings()}
                  />
                  <AdminSecurityPanel
                    adminName={typeof user?.user_metadata?.name === "string" ? user.user_metadata.name : null}
                    adminEmail={user?.email ?? null}
                    aiSettings={aiSettings}
                    auditEnabled={!auditError}
                    onRefreshAccess={() => void checkAccess()}
                  />
                </section>
                <AdminAuditLogPanel
                  logs={auditLogs}
                  loading={auditLoading}
                  entityFilter={auditEntityFilter}
                  onEntityFilterChange={(nextFilter) => {
                    setAuditEntityFilter(nextFilter);
                    void loadAuditLogs(nextFilter);
                  }}
                  onRefresh={() => void loadAuditLogs()}
                />
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <AdminResourceModal
            editing={editing}
            userId={user?.id}
            onAuditLog={recordAdminAuditLog}
            onClose={() => setModalOpen(false)}
            onSaved={() => {
              setModalOpen(false);
              void loadResources();
              void loadAdminOverview();
            }}
          />
        )}
        {userDetailOpen && (
          <AdminUserDetailModal
            detail={selectedUserDetail}
            loading={userDetailLoading}
            error={userDetailError}
            onClose={() => {
              setUserDetailOpen(false);
              setSelectedUserDetail(null);
            }}
            onSave={saveUserReviewStatus}
          />
        )}
        {professionalModalOpen && (
          <ProfessionalModal
            professional={professionalEditing}
            onClose={() => {
              setProfessionalModalOpen(false);
              setProfessionalEditing(null);
            }}
            onSave={(form) => void saveProfessional(form, professionalEditing?.id)}
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

function AdminTabNavigation({
  activeTab,
  onChange,
}: {
  activeTab: AdminTabId;
  onChange: (tab: AdminTabId) => void;
}) {
  return (
    <section className="sticky top-24 z-20 rounded-[1.5rem] border border-white/10 bg-background/75 p-2 shadow-[var(--shadow-card)] backdrop-blur-2xl">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {ADMIN_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`group flex min-w-[11rem] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                active
                  ? "border-primary/35 bg-primary/15 text-primary shadow-[0_0_24px_rgba(45,212,191,0.12)]"
                  : "border-white/10 bg-white/[0.035] text-muted-foreground hover:border-primary/20 hover:bg-white/[0.06] hover:text-foreground"
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
                  active ? "border-primary/30 bg-primary/15" : "border-white/10 bg-black/10 group-hover:text-primary"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-extrabold">{tab.label}</span>
                <span className="mt-0.5 block truncate text-xs opacity-75">{tab.helper}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AdminOverviewPanel({ overview, loading }: { overview: AdminOverviewStats; loading: boolean }) {
  const cards: Array<{
    icon: LucideIcon;
    label: string;
    value: number;
    helper: string;
    tone: "primary" | "sky" | "violet" | "amber" | "rose";
  }> = [
    { icon: Users, label: "Total Users", value: overview.totalUsers, helper: "Registered MindSense profiles", tone: "primary" },
    { icon: Activity, label: "Active Users", value: overview.activeUsers, helper: "Activity during the last 7 days", tone: "sky" },
    { icon: ClipboardList, label: "Completed Tests", value: overview.depressionTestsCompleted, helper: "Questionnaire assessments saved", tone: "violet" },
    { icon: LineChart, label: "Mood Entries", value: overview.moodEntriesLogged, helper: "Daily mood records logged", tone: "primary" },
    { icon: HeartHandshake, label: "Support Sessions", value: overview.supportSessions, helper: "Breathing, audio, and meditation activity", tone: "sky" },
    { icon: ShieldAlert, label: "High-Risk Signals", value: overview.highRiskAlerts, helper: "Supportive alerts from completed tests", tone: "rose" },
    { icon: Eye, label: "Published Resources", value: overview.publishedResources, helper: "Visible in user resources", tone: "primary" },
    { icon: TrendingUp, label: "Resource Opens", value: overview.resourceOpens, helper: "Tracked resource engagement", tone: "amber" },
    { icon: Zap, label: "AI Analyses", value: overview.aiAnalysesCompleted, helper: "Rows in analysis results table", tone: "violet" },
  ];

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card, index) => (
        <AdminMetricCard key={card.label} {...card} index={index} loading={loading} />
      ))}
    </section>
  );
}

function AdminMetricCard({
  icon: Icon,
  label,
  value,
  helper,
  tone,
  index,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  helper: string;
  tone: "primary" | "sky" | "violet" | "amber" | "rose";
  index: number;
  loading: boolean;
}) {
  const toneClass = {
    primary: "from-primary/18 to-cyan-400/8 text-primary",
    sky: "from-sky-400/18 to-primary/8 text-sky-200",
    violet: "from-violet-400/18 to-sky-400/8 text-violet-200",
    amber: "from-amber-300/18 to-primary/8 text-amber-100",
    rose: "from-rose-400/18 to-amber-300/8 text-rose-100",
  }[tone];

  if (loading) {
    return <div className="h-40 animate-pulse rounded-[1.5rem] border border-white/10 bg-white/[0.04]" />;
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.035, duration: 0.28 }}
      whileHover={{ y: -3, scale: 1.01 }}
      className={`relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-gradient-to-br ${toneClass} p-5 shadow-[var(--shadow-card)]`}
    >
      <div className="premium-grid pointer-events-none absolute inset-0 opacity-20" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <div className="mt-3 text-4xl font-extrabold text-foreground">
            <AnimatedNumber value={value} />
          </div>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="relative mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <BarChart3 className="h-4 w-4" />
        {helper}
      </div>
    </motion.article>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const start = display;
    const end = Number.isFinite(value) ? value : 0;
    const startedAt = performance.now();
    const duration = 650;
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

function AdminUserIntelligence({
  users,
  loading,
  search,
  onSearchChange,
  onSearch,
  onOpenUser,
}: {
  users: AdminUserSummary[];
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  onOpenUser: (userId: string) => void;
}) {
  return (
    <section className="premium-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold">
            <UserCog className="h-5 w-5 text-primary" />
            User Management
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Search users, review safe activity summaries, and mark admin follow-up status.</p>
        </div>
        <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
          Privacy safe
        </Badge>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSearch();
            }}
            placeholder="Search users by name or email..."
            className="rounded-full border-white/10 bg-white/[0.06] pl-9"
          />
        </div>
        <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={onSearch}>
          <Search className="h-4 w-4" />
          Search
        </Button>
      </div>

      {loading ? (
        <div className="mt-5 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center text-sm text-muted-foreground">
          {search.trim() ? "No users match this search." : "No user activity is available yet."}
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {users.map((item) => (
            <div key={item.user_id} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-extrabold">{item.name || item.email || "MindSense user"}</h3>
                  <RiskBadge risk={item.risk_level} />
                  <ReviewStatusBadge status={item.account_status} />
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">{item.email || "No email available"}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground md:w-[18rem]">
                <MiniUserStat label="Mood" value={item.mood_entries} />
                <MiniUserStat label="Tests" value={item.completed_tests} />
                <MiniUserStat label="Support" value={item.support_sessions} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground md:col-span-2">
                <span>Last activity: {formatAdminDate(item.latest_activity)}</span>
                <Button size="sm" variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={() => onOpenUser(item.user_id)}>
                  View details
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MiniUserStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-2">
      <div className="text-base font-extrabold text-foreground">{value}</div>
      <div>{label}</div>
    </div>
  );
}

function RiskBadge({ risk }: { risk: AdminUserSummary["risk_level"] }) {
  const styles = {
    high: "border-rose-300/30 bg-rose-400/12 text-rose-100",
    medium: "border-amber-300/30 bg-amber-300/12 text-amber-100",
    steady: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
    unknown: "border-white/10 bg-white/[0.04] text-muted-foreground",
  }[risk];

  return <Badge variant="outline" className={`${styles} capitalize`}>{risk === "medium" ? "watch" : risk}</Badge>;
}

function ReviewStatusBadge({ status }: { status: AdminReviewStatus }) {
  const styles = {
    active: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
    watch: "border-amber-300/25 bg-amber-300/10 text-amber-100",
    needs_support: "border-sky-300/25 bg-sky-400/10 text-sky-100",
    restricted: "border-rose-300/25 bg-rose-400/10 text-rose-100",
  }[status];

  return <Badge variant="outline" className={`${styles}`}>{moodLabel(status)}</Badge>;
}

function AssessmentAnalyticsPanel({ analytics, loading }: { analytics: AssessmentAnalytics; loading: boolean }) {
  const severityTotal = Object.values(analytics.severityDistribution).reduce((sum, value) => sum + value, 0);
  const maxDaily = Math.max(1, ...analytics.weeklyTrend.map((item) => item.completed));

  return (
    <section className="premium-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold">
            <ClipboardList className="h-5 w-5 text-primary" />
            Depression Test Analytics
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Questionnaire oversight without exposing raw answers or media files.</p>
        </div>
        <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
          Screening data
        </Badge>
      </div>

      {loading ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <DetailMetric label="Completed" value={analytics.totalCompleted} helper={`${analytics.last7Completed} in last 7 days`} />
            <DetailMetric label="30-day volume" value={analytics.last30Completed} helper="Recent assessment activity" />
            <DetailMetric label="Avg wellness" value={analytics.averageWellness !== null ? `${analytics.averageWellness}%` : "No data"} helper="From questionnaire score" />
            <DetailMetric label="Media captures" value={`${analytics.voiceCaptured}/${analytics.videoCaptured}`} helper="Voice / video captured" />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
              <h3 className="text-lg font-extrabold">Severity Distribution</h3>
              <div className="mt-4 space-y-3">
                <SignalBar label="High support signal" value={analytics.severityDistribution.high} total={severityTotal} tone="bg-rose-300" />
                <SignalBar label="Watch signal" value={analytics.severityDistribution.medium} total={severityTotal} tone="bg-amber-300" />
                <SignalBar label="Steady signal" value={analytics.severityDistribution.steady} total={severityTotal} tone="bg-primary" />
                <SignalBar label="Unknown score" value={analytics.severityDistribution.unknown} total={severityTotal} tone="bg-slate-400" />
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-extrabold">14-Day Trend</h3>
                <span className="text-xs text-muted-foreground">Completed tests</span>
              </div>
              {analytics.weeklyTrend.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-5 text-sm text-muted-foreground">No completed assessments yet.</div>
              ) : (
                <div className="mt-4 flex h-40 items-end gap-2">
                  {analytics.weeklyTrend.map((item) => {
                    const height = Math.max(10, (item.completed / maxDaily) * 100);
                    return (
                      <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                        <div className="relative flex h-28 w-full items-end overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className={`w-full rounded-full ${item.highRisk > 0 ? "bg-gradient-to-t from-rose-400 to-amber-200" : "bg-gradient-to-t from-primary to-sky-300"}`}
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <span className="truncate text-[10px] text-muted-foreground">{new Date(item.date).toLocaleDateString("en", { day: "numeric", month: "short" })}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
            <div className="mb-1 flex items-center gap-2 font-extrabold">
              <AlertTriangle className="h-4 w-4" />
              Clinical safety note
            </div>
            These analytics are wellness screening signals only. MindSense does not diagnose depression or replace professional evaluation.
          </div>
        </>
      )}
    </section>
  );
}

function HighRiskAlertCenter({
  alerts,
  loading,
  statusFilter,
  onStatusFilterChange,
  onRefresh,
  onUpdateAlert,
}: {
  alerts: RiskAlertRow[];
  loading: boolean;
  statusFilter: AlertStatus;
  onStatusFilterChange: (status: AlertStatus) => void;
  onRefresh: () => void;
  onUpdateAlert: (alert: RiskAlertRow, status: Exclude<AlertStatus, "all">) => void;
}) {
  return (
    <section className="premium-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold">
            <ShieldAlert className="h-5 w-5 text-primary" />
            High-Risk Alert Center
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Recent assessments with stronger support signals.</p>
        </div>
        <div className="flex gap-2">
          <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value as AlertStatus)} className="h-10 rounded-full border border-white/10 bg-background px-4 text-sm">
            <option value="all">All alerts</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
          <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="mt-5 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-7 text-center">
          <CheckCircle className="mx-auto h-9 w-9 text-primary" />
          <h3 className="mt-3 text-lg font-extrabold">No matching alerts</h3>
          <p className="mt-1 text-sm text-muted-foreground">Alerts appear after completed assessments show stronger support signals.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {alerts.map((alert) => (
            <RiskAlertCard key={alert.assessment_id} alert={alert} onUpdate={onUpdateAlert} />
          ))}
        </div>
      )}
    </section>
  );
}

function RiskAlertCard({ alert, onUpdate }: { alert: RiskAlertRow; onUpdate: (alert: RiskAlertRow, status: Exclude<AlertStatus, "all">) => void }) {
  const displayName = alert.name || alert.email || "MindSense user";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <RiskBadge risk={alert.risk_level} />
            <AlertPriorityBadge priority={alert.priority} />
            <AlertStatusBadge status={alert.alert_status} />
            <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-xs text-muted-foreground">{alert.wellness_score}% wellness</span>
          </div>
          <h3 className="mt-3 truncate font-extrabold">{displayName}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{alert.email || "No email available"} / {formatAdminDate(alert.created_at)}</p>
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
            <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1">{alert.answer_count} answers</span>
            <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1">{alert.voice_captured ? "Voice captured" : "No voice"}</span>
            <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1">{alert.video_captured ? "Video captured" : "No video"}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          {alert.alert_status !== "acknowledged" && (
            <Button size="sm" variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={() => onUpdate(alert, "acknowledged")}>
              <Eye className="h-4 w-4" />
              Acknowledge
            </Button>
          )}
          {alert.alert_status !== "resolved" && (
            <Button size="sm" className="premium-button" onClick={() => onUpdate(alert, "resolved")}>
              <CheckCircle2 className="h-4 w-4" />
              Resolve
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function AlertStatusBadge({ status }: { status: Exclude<AlertStatus, "all"> }) {
  const styles = {
    open: "border-rose-300/25 bg-rose-400/10 text-rose-100",
    acknowledged: "border-amber-300/25 bg-amber-300/10 text-amber-100",
    resolved: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
  }[status];

  return <Badge variant="outline" className={styles}>{moodLabel(status)}</Badge>;
}

function AlertPriorityBadge({ priority }: { priority: AlertPriority }) {
  const styles = {
    urgent: "border-rose-300/30 bg-rose-400/15 text-rose-100",
    high: "border-amber-300/30 bg-amber-300/12 text-amber-100",
    watch: "border-white/10 bg-white/[0.04] text-muted-foreground",
  }[priority];

  return <Badge variant="outline" className={styles}>{moodLabel(priority)}</Badge>;
}

function MoodIntelligencePanel({
  analytics,
  loading,
  onRefresh,
}: {
  analytics: MoodAnalytics;
  loading: boolean;
  onRefresh: () => void;
}) {
  const distributionTotal = Object.values(analytics.moodDistribution).reduce((sum, value) => sum + value, 0);
  const maxDailyEntries = Math.max(1, ...analytics.dailyTrend.map((item) => item.entries));

  return (
    <section className="premium-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold">
            <LineChart className="h-5 w-5 text-primary" />
            Mood Intelligence
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Aggregate mood, sleep, energy, and tag patterns. Journal notes stay private.
          </p>
        </div>
        <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <DetailMetric label="Total mood logs" value={analytics.totalEntries} helper={`${analytics.last7Entries} this week`} />
            <DetailMetric label="30-day logs" value={analytics.last30Entries} helper="Recent mood volume" />
            <DetailMetric label="Average mood" value={analytics.averageMood !== null ? `${analytics.averageMood}/5` : "No data"} helper="All recorded entries" />
            <DetailMetric label="Energy" value={analytics.averageEnergy !== null ? `${analytics.averageEnergy}/10` : "No data"} helper="Average energy" />
            <DetailMetric label="Sleep" value={analytics.averageSleep !== null ? `${analytics.averageSleep}/10` : "No data"} helper="Average sleep" />
            <DetailMetric label="Low signals" value={analytics.lowMoodSignals} helper="Last 7 days" />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]">
            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-extrabold">14-Day Mood Trend</h3>
                  <p className="text-xs text-muted-foreground">Bars show entry volume, labels show average mood.</p>
                </div>
                <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                  <CalendarDays className="mr-1 h-3.5 w-3.5" />
                  Last 14 days
                </Badge>
              </div>

              {analytics.dailyTrend.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-6 text-center text-sm text-muted-foreground">
                  No mood entries have been logged yet.
                </div>
              ) : (
                <div className="mt-5 flex h-48 items-end gap-2">
                  {analytics.dailyTrend.map((item) => {
                    const height = Math.max(8, (item.entries / maxDailyEntries) * 100);
                    const isLow = item.avgMood !== null && item.avgMood <= 2;
                    return (
                      <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                        <div className="flex h-32 w-full items-end overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className={`w-full rounded-full ${isLow ? "bg-gradient-to-t from-rose-400 to-amber-200" : "bg-gradient-to-t from-primary to-sky-300"}`}
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold">{item.avgMood !== null ? item.avgMood : "-"}</span>
                        <span className="truncate text-[10px] text-muted-foreground">{new Date(item.date).toLocaleDateString("en", { day: "numeric", month: "short" })}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-5">
              <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
                <h3 className="text-lg font-extrabold">Mood Distribution</h3>
                <div className="mt-4 space-y-3">
                  {(["1", "2", "3", "4", "5"] as const).map((mood) => (
                    <SignalBar
                      key={mood}
                      label={`${mood}/5 mood`}
                      value={analytics.moodDistribution[mood]}
                      total={distributionTotal}
                      tone={Number(mood) <= 2 ? "bg-rose-300" : Number(mood) === 3 ? "bg-amber-300" : "bg-primary"}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
                <h3 className="text-lg font-extrabold">Wellness Load</h3>
                <div className="mt-4 grid gap-2">
                  <SignalTile label="Poor sleep signals" value={analytics.poorSleepSignals} />
                  <SignalTile label="Low energy signals" value={analytics.lowEnergySignals} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
              <h3 className="flex items-center gap-2 text-lg font-extrabold">
                <Layers className="h-4 w-4 text-primary" />
                Tag Signals
              </h3>
              {analytics.tagSignals.length === 0 ? (
                <p className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-muted-foreground">
                  Tags will appear after users add context tags to mood entries.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {analytics.tagSignals.map((tag) => (
                    <div key={tag.tag} className="rounded-2xl border border-white/10 bg-black/10 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="font-extrabold">{moodLabel(tag.tag)}</h4>
                        <span className="text-xs text-muted-foreground">{tag.total} entries</span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
                        <MiniUserStat label="Avg mood" value={tag.avgMood ?? 0} />
                        <MiniUserStat label="Low" value={tag.lowMood} />
                        <MiniUserStat label="High" value={tag.highMood} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
              <h3 className="flex items-center gap-2 text-lg font-extrabold">
                <ShieldAlert className="h-4 w-4 text-primary" />
                Low Mood Watchlist
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">Recent low mood entries without journal notes.</p>
              {analytics.recentLowMoodEntries.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-6 text-center text-sm text-muted-foreground">
                  No recent low mood signals are available.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {analytics.recentLowMoodEntries.map((entry) => (
                    <div key={`${entry.userId}-${entry.createdAt}`} className="grid gap-3 rounded-2xl border border-white/10 bg-black/10 p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="truncate font-extrabold">{entry.name || entry.email || "MindSense user"}</h4>
                          <Badge variant="outline" className="border-rose-300/25 bg-rose-400/10 text-rose-100">
                            Mood {entry.mood}/5
                          </Badge>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{entry.email || "No email available"} / {formatAdminDate(entry.createdAt)}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">Energy {entry.energy ?? "-"}/10</span>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">Sleep {entry.sleepQuality ?? "-"}/10</span>
                        {entry.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-primary">{moodLabel(tag)}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function ProfessionalDirectoryManagement({
  professionals,
  totalCount,
  cities,
  cityFilter,
  search,
  loading,
  onCityFilterChange,
  onSearchChange,
  onRefresh,
  onCreate,
  onEdit,
  onDelete,
  onTogglePublished,
  onToggleFeatured,
}: {
  professionals: ProfessionalDirectoryEntry[];
  totalCount: number;
  cities: string[];
  cityFilter: string;
  search: string;
  loading: boolean;
  onCityFilterChange: (city: string) => void;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onCreate: () => void;
  onEdit: (professional: ProfessionalDirectoryEntry) => void;
  onDelete: (professional: ProfessionalDirectoryEntry) => void;
  onTogglePublished: (professional: ProfessionalDirectoryEntry) => void;
  onToggleFeatured: (professional: ProfessionalDirectoryEntry) => void;
}) {
  const publishedCount = professionals.filter((professional) => professional.is_published).length;
  const reviewCount = professionals.filter((professional) => professional.verification_status === "needs_verification").length;

  return (
    <section className="premium-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold">
            <MapPin className="h-5 w-5 text-primary" />
            Professional Directory Manager
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Manage Pakistan-based professional listings shown on the Therapy & Support page. Listings remain informational and should be independently verified.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button className="premium-button" onClick={onCreate}>
            <Plus className="h-4 w-4" />
            Add Professional
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-2 md:grid-cols-4">
        <ResourceCountPill label="Total" value={totalCount} />
        <ResourceCountPill label="Visible" value={publishedCount} />
        <ResourceCountPill label="Filtered" value={professionals.length} />
        <ResourceCountPill label="Needs Review" value={reviewCount} tone={reviewCount ? "warning" : "default"} />
      </div>

      <div className="mt-5 flex flex-col gap-2 xl:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search professionals, city, hospital, specialization..."
            className="rounded-full border-white/10 bg-white/[0.06] pl-9"
          />
        </div>
        <select value={cityFilter} onChange={(event) => onCityFilterChange(event.target.value)} className="h-10 rounded-full border border-white/10 bg-background px-4 text-sm">
          {cities.map((city) => (
            <option key={city} value={city}>{city === "all" ? "All cities" : city}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="mt-5 grid gap-3 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-72 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
          ))}
        </div>
      ) : professionals.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <UserRound className="mx-auto h-9 w-9 text-primary" />
          <h3 className="mt-3 text-lg font-extrabold">No professionals found</h3>
          <p className="mt-1 text-sm text-muted-foreground">Add a professional listing or adjust the filters.</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 xl:grid-cols-3">
          {professionals.map((professional) => (
            <ProfessionalAdminCard
              key={professional.id}
              professional={professional}
              onEdit={onEdit}
              onDelete={onDelete}
              onTogglePublished={onTogglePublished}
              onToggleFeatured={onToggleFeatured}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ProfessionalAdminCard({
  professional,
  onEdit,
  onDelete,
  onTogglePublished,
  onToggleFeatured,
}: {
  professional: ProfessionalDirectoryEntry;
  onEdit: (professional: ProfessionalDirectoryEntry) => void;
  onDelete: (professional: ProfessionalDirectoryEntry) => void;
  onTogglePublished: (professional: ProfessionalDirectoryEntry) => void;
  onToggleFeatured: (professional: ProfessionalDirectoryEntry) => void;
}) {
  const mapUrl = professional.map_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${professional.location} ${professional.address ?? ""} ${professional.city} Pakistan`)}`;

  return (
    <motion.article whileHover={{ y: -3 }} className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <UserRound className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-extrabold">{professional.name}</h3>
            <Badge variant="outline" className={professional.is_published ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100" : "border-white/10 bg-white/[0.04] text-muted-foreground"}>
              {professional.is_published ? "Visible" : "Draft"}
            </Badge>
            {professional.featured && <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">Featured</Badge>}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{professional.role}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm text-muted-foreground">
        <div className="rounded-xl border border-white/10 bg-black/10 p-3 text-foreground">{professional.specialization}</div>
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>{professional.location}, {professional.city}</span>
        </div>
        {professional.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{professional.phone}</span>
          </div>
        )}
        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-2 text-xs">
          Verification: {moodLabel(professional.verification_status)}
        </div>
      </div>

      <div className="mt-auto grid gap-2 pt-4">
        <Button asChild size="sm" variant="outline" className="rounded-full border-white/10 bg-white/[0.04]">
          <a href={mapUrl} target="_blank" rel="noreferrer">
            <MapPin className="h-3.5 w-3.5" />
            Map
          </a>
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={() => onEdit(professional)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button size="sm" variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={() => onTogglePublished(professional)}>
            {professional.is_published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {professional.is_published ? "Hide" : "Show"}
          </Button>
          <Button size="sm" variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={() => onToggleFeatured(professional)}>
            <Star className="h-3.5 w-3.5" />
            {professional.featured ? "Unfeature" : "Feature"}
          </Button>
          <Button size="sm" variant="outline" className="rounded-full border-rose-300/25 bg-rose-400/10 text-rose-100" onClick={() => onDelete(professional)}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>
    </motion.article>
  );
}

function AiModelSettingsPanel({
  settings,
  draft,
  loading,
  saving,
  onDraftChange,
  onSave,
  onReset,
  onRefresh,
}: {
  settings: AdminAiSettings;
  draft: AdminAiSettings;
  loading: boolean;
  saving: boolean;
  onDraftChange: (settings: AdminAiSettings) => void;
  onSave: () => void;
  onReset: () => void;
  onRefresh: () => void;
}) {
  const weightTotal = draft.textWeight + draft.audioWeight + draft.videoWeight;
  const weightsValid = weightTotal === 100;
  const thresholdsValid = draft.highRiskThreshold < draft.watchThreshold;
  const updatedLabel = settings.updatedAt ? formatAdminDate(settings.updatedAt) : "Default controls";

  const update = (patch: Partial<AdminAiSettings>) => onDraftChange({ ...draft, ...patch });

  return (
    <section className="premium-card relative overflow-hidden p-5 md:p-6">
      <div className="premium-grid pointer-events-none absolute inset-0 opacity-20" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            AI Model Settings
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Configure fusion weights, risk thresholds, confidence rules, and moderation behavior from one protected admin control panel.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
            Updated {updatedLabel}
          </Badge>
          <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={onRefresh} disabled={loading || saving}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      <div className="relative mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-extrabold">Fusion Weights</h3>
              <p className="mt-1 text-sm text-muted-foreground">Balance questionnaire, voice, and video contribution to the final wellness signal.</p>
            </div>
            <Badge
              variant="outline"
              className={weightsValid ? "border-primary/20 bg-primary/10 text-primary" : "border-rose-300/25 bg-rose-400/10 text-rose-100"}
            >
              Total {weightTotal}%
            </Badge>
          </div>

          <div className="mt-5 space-y-4">
            <AiSettingSlider
              label="Text questionnaire"
              description="Current core screening input"
              value={draft.textWeight}
              min={0}
              max={100}
              suffix="%"
              tone="from-primary to-sky-300"
              onChange={(value) => update({ textWeight: value })}
            />
            <AiSettingSlider
              label="Voice analysis"
              description="Reserved for voice model testing"
              value={draft.audioWeight}
              min={0}
              max={100}
              suffix="%"
              tone="from-cyan-300 to-violet-300"
              onChange={(value) => update({ audioWeight: value })}
            />
            <AiSettingSlider
              label="Video emotion"
              description="Reserved for video model testing"
              value={draft.videoWeight}
              min={0}
              max={100}
              suffix="%"
              tone="from-violet-300 to-fuchsia-300"
              onChange={(value) => update({ videoWeight: value })}
            />
          </div>

          {!weightsValid && (
            <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100">
              Fusion weights must add up to exactly 100% before saving.
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 md:p-5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-extrabold">Risk Thresholds</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">These controls govern admin alert labels and review urgency.</p>
            <div className="mt-5 space-y-4">
              <AiSettingSlider
                label="High-risk alert"
                value={draft.highRiskThreshold}
                min={5}
                max={80}
                suffix="%"
                tone="from-rose-300 to-amber-300"
                onChange={(value) => update({ highRiskThreshold: value })}
              />
              <AiSettingSlider
                label="Watch threshold"
                value={draft.watchThreshold}
                min={10}
                max={95}
                suffix="%"
                tone="from-amber-300 to-primary"
                onChange={(value) => update({ watchThreshold: value })}
              />
              <AiSettingSlider
                label="Confidence floor"
                value={draft.confidenceThreshold}
                min={0}
                max={100}
                suffix="%"
                tone="from-primary to-violet-300"
                onChange={(value) => update({ confidenceThreshold: value })}
              />
            </div>
            {!thresholdsValid && (
              <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100">
                High-risk threshold must stay lower than watch threshold.
              </div>
            )}
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 md:p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-extrabold">Analysis Behavior</h3>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {(["low", "balanced", "high"] as AiSensitivity[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => update({ analysisSensitivity: option })}
                  className={`rounded-2xl border px-3 py-3 text-sm font-bold transition ${
                    draft.analysisSensitivity === option
                      ? "border-primary/40 bg-primary/15 text-primary shadow-[0_0_24px_rgba(45,212,191,0.12)]"
                      : "border-white/10 bg-white/[0.035] text-muted-foreground hover:border-primary/25 hover:text-foreground"
                  }`}
                >
                  {moodLabel(option)}
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/10 p-4">
              <div>
                <Label htmlFor="ai-moderation-enabled" className="font-extrabold">Safety moderation</Label>
                <p className="mt-1 text-sm text-muted-foreground">Keep admin-facing warning states and review language active.</p>
              </div>
              <Switch
                id="ai-moderation-enabled"
                checked={draft.moderationEnabled}
                onCheckedChange={(checked) => update({ moderationEnabled: checked })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-5 flex flex-col gap-3 rounded-[1.5rem] border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>These settings support wellness triage and admin review. MindSense does not provide a clinical diagnosis.</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={onReset} disabled={saving || loading}>
            Reset Defaults
          </Button>
          <Button className="premium-button" onClick={onSave} disabled={saving || loading || !weightsValid || !thresholdsValid}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving" : "Save Settings"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function AiSettingSlider({
  label,
  description,
  value,
  min,
  max,
  suffix,
  tone,
  onChange,
}: {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  tone: string;
  onChange: (value: number) => void;
}) {
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="font-extrabold">{label}</div>
          {description && <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>}
        </div>
        <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-extrabold text-primary">
          {value}{suffix}
        </div>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-white/[0.08]">
        <div className={`h-full rounded-full bg-gradient-to-r ${tone}`} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </div>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full accent-cyan-300"
      />
    </div>
  );
}

const AUDIT_FILTERS = [
  { value: "all", label: "All" },
  { value: "resource", label: "Resources" },
  { value: "user", label: "Users" },
  { value: "assessment", label: "Assessments" },
  { value: "professional", label: "Directory" },
  { value: "ai_settings", label: "AI Settings" },
];

function AdminAuditLogPanel({
  logs,
  loading,
  entityFilter,
  onEntityFilterChange,
  onRefresh,
}: {
  logs: AdminAuditLog[];
  loading: boolean;
  entityFilter: string;
  onEntityFilterChange: (filter: string) => void;
  onRefresh: () => void;
}) {
  return (
    <section className="premium-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold">
            <Activity className="h-5 w-5 text-primary" />
            Audit Log & Admin Activity
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Recent admin actions are stored in Supabase for traceability across resources, users, risk alerts, directory listings, and AI settings.
          </p>
        </div>
        <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={onRefresh} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {AUDIT_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => onEntityFilterChange(filter.value)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition ${
              entityFilter === filter.value
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-white/10 bg-white/[0.035] text-muted-foreground hover:border-primary/25 hover:text-foreground"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-primary" />
          <h3 className="mt-3 text-lg font-extrabold">No admin activity yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">New admin changes will appear here after the audit migration is applied.</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {logs.map((log) => (
            <motion.article
              key={log.log_id}
              whileHover={{ y: -2 }}
              className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                      {moodLabel(log.entity_type)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatAdminDate(log.created_at)}</span>
                  </div>
                  <h3 className="mt-3 text-base font-extrabold">{log.summary}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {log.admin_name || log.admin_email || "Admin"} - {log.action.replace(/\./g, " / ")}
                  </p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/10 text-primary">
                  <Activity className="h-4 w-4" />
                </div>
              </div>
              {log.entity_id && (
                <div className="mt-3 truncate rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-xs text-muted-foreground">
                  ID: {log.entity_id}
                </div>
              )}
            </motion.article>
          ))}
        </div>
      )}
    </section>
  );
}

function SystemStatusPanel({
  overview,
  resources,
  riskAlerts,
  errors,
}: {
  overview: AdminOverviewStats;
  resources: Resource[];
  riskAlerts: RiskAlertRow[];
  errors: Record<string, string>;
}) {
  const draftCount = resources.filter((resource) => !resource.is_published).length;
  const reviewCount = resources.filter((resource) => getResourceIssues(resource).length > 0).length;
  const openRiskAlerts = riskAlerts.filter((alert) => alert.alert_status !== "resolved").length;
  const activeErrors = Object.entries(errors).filter(([, value]) => Boolean(value));

  const checks = [
    {
      label: "Supabase data layer",
      value: activeErrors.length === 0 ? "Healthy" : "Needs attention",
      detail: activeErrors.length === 0 ? "All loaded admin modules responded." : `${activeErrors.length} admin module${activeErrors.length > 1 ? "s" : ""} need review.`,
      healthy: activeErrors.length === 0,
    },
    {
      label: "Assessment safety queue",
      value: openRiskAlerts > 0 ? `${openRiskAlerts} open` : "Clear",
      detail: openRiskAlerts > 0 ? "Review open wellness alerts." : "No open high-risk queue items in the current view.",
      healthy: openRiskAlerts === 0,
    },
    {
      label: "Voice/video model queue",
      value: "Not configured",
      detail: "Voice and video models are intentionally pending until the project is ready for testing.",
      healthy: true,
    },
  ];

  return (
    <section className="premium-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold">
            <Zap className="h-5 w-5 text-primary" />
            System Status
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Live admin health signals from real loaded modules, queues, and moderation states.</p>
        </div>
        <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
          {overview.generatedAt ? `Synced ${formatAdminDate(overview.generatedAt)}` : "Awaiting sync"}
        </Badge>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {checks.map((check) => (
          <div key={check.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{check.label}</div>
                <div className="mt-2 text-xl font-extrabold">{check.value}</div>
              </div>
              <span className={`h-3 w-3 rounded-full ${check.healthy ? "bg-primary shadow-[0_0_16px_rgba(45,212,191,0.55)]" : "bg-amber-300"}`} />
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{check.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/10 p-4">
        <h3 className="font-extrabold">Admin Notifications</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <SystemNotice label="Open risk alerts" value={openRiskAlerts} tone={openRiskAlerts > 0 ? "warn" : "ok"} />
          <SystemNotice label="Draft resources" value={draftCount} tone={draftCount > 0 ? "info" : "ok"} />
          <SystemNotice label="Resources needing review" value={reviewCount} tone={reviewCount > 0 ? "warn" : "ok"} />
        </div>
      </div>
    </section>
  );
}

function SystemNotice({ label, value, tone }: { label: string; value: number; tone: "ok" | "warn" | "info" }) {
  const toneClass =
    tone === "warn"
      ? "border-amber-300/25 bg-amber-300/10 text-amber-100"
      : tone === "info"
        ? "border-sky-300/25 bg-sky-300/10 text-sky-100"
        : "border-primary/20 bg-primary/10 text-primary";
  return (
    <div className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${toneClass}`}>
      <span className="text-sm font-bold">{label}</span>
      <span className="text-lg font-extrabold">{value}</span>
    </div>
  );
}

function AdminSecurityPanel({
  adminName,
  adminEmail,
  aiSettings,
  auditEnabled,
  onRefreshAccess,
}: {
  adminName: string | null;
  adminEmail: string | null;
  aiSettings: AdminAiSettings;
  auditEnabled: boolean;
  onRefreshAccess: () => void;
}) {
  return (
    <section className="premium-card p-5 md:p-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-extrabold">
          <UserCog className="h-5 w-5 text-primary" />
          Admin Profile & Security
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Protected route state and account-level admin controls.</p>
      </div>

      <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-lg font-extrabold text-primary">
            {(adminName || adminEmail || "A").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-extrabold">{adminName || "MindSense Admin"}</h3>
            <p className="truncate text-sm text-muted-foreground">{adminEmail || "Authenticated admin account"}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <SecurityRow label="Role" value="Administrator" healthy />
        <SecurityRow label="Protected route" value="Active" healthy />
        <SecurityRow label="Audit logging" value={auditEnabled ? "Enabled" : "Needs migration"} healthy={auditEnabled} />
        <SecurityRow label="AI settings" value={aiSettings.updatedAt ? "Custom" : "Defaults"} healthy />
      </div>

      <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
        Admin tools can review operational signals, but raw private journal notes and raw assessment answers should stay out of routine admin views.
      </div>

      <Button variant="outline" className="mt-5 w-full rounded-full border-white/10 bg-white/[0.04]" onClick={onRefreshAccess}>
        <ShieldCheck className="h-4 w-4" />
        Recheck Admin Access
      </Button>
    </section>
  );
}

function SecurityRow({ label, value, healthy }: { label: string; value: string; healthy: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
      <span className="text-sm font-semibold text-muted-foreground">{label}</span>
      <span className={`rounded-full border px-3 py-1 text-xs font-extrabold ${healthy ? "border-primary/20 bg-primary/10 text-primary" : "border-amber-300/25 bg-amber-300/10 text-amber-100"}`}>
        {value}
      </span>
    </div>
  );
}

type AdminExportAction = {
  title: string;
  description: string;
  format: "CSV" | "JSON";
  icon: LucideIcon;
  onExport: () => void;
};

function ContactMessagesPanel({
  messages,
  loading,
  onRefresh,
}: {
  messages: ContactMessage[];
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <section className="premium-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold">
            <Mail className="h-5 w-5 text-primary" />
            Contact Messages
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Messages submitted from the public Contact page. Only admin accounts can read these records.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
            {messages.length} stored
          </Badge>
          <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={onRefresh} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <Mail className="mx-auto h-8 w-8 text-primary" />
          <h3 className="mt-3 text-lg font-extrabold">No contact messages yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">New user messages will appear here after they submit the Contact form.</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 xl:grid-cols-2">
          {messages.map((message) => (
            <motion.article
              key={message.id}
              whileHover={{ y: -2 }}
              className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-extrabold">{message.name}</h3>
                  <p className="mt-1 flex items-center gap-2 truncate text-sm text-muted-foreground">
                    <Mail className="h-4 w-4 text-primary" />
                    {message.email}
                  </p>
                </div>
                <Badge variant="outline" className="border-white/10 text-muted-foreground">
                  {formatAdminDate(message.created_at)}
                </Badge>
              </div>
              <p className="mt-4 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/10 p-4 text-sm leading-6 text-muted-foreground">
                {message.message}
              </p>
              <div className="mt-4 flex justify-end">
                <a
                  href={`mailto:${message.email}?subject=${encodeURIComponent("MindSense contact response")}`}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold transition hover:border-primary/30 hover:text-primary"
                >
                  <ExternalLink className="h-4 w-4" />
                  Reply by email
                </a>
              </div>
            </motion.article>
          ))}
        </div>
      )}
    </section>
  );
}

function ReportsExportsPanel({ exports, loading }: { exports: AdminExportAction[]; loading: boolean }) {
  return (
    <section className="premium-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold">
            <Download className="h-5 w-5 text-primary" />
            Reports & Exports
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Download admin-safe platform snapshots for review, presentation, and operational reporting.
          </p>
        </div>
        <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
          No private journal notes
        </Badge>
      </div>

      <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
        <div className="mb-1 flex items-center gap-2 font-extrabold">
          <ShieldCheck className="h-4 w-4" />
          Privacy boundary
        </div>
        Exports include aggregate signals, statuses, and metadata. Raw assessment answers and mood reflections are intentionally excluded.
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {exports.map((item) => (
          <ExportActionCard key={item.title} action={item} disabled={loading} />
        ))}
      </div>
    </section>
  );
}

function ExportActionCard({ action, disabled }: { action: AdminExportAction; disabled: boolean }) {
  const Icon = action.icon;
  return (
    <motion.article whileHover={{ y: disabled ? 0 : -3 }} className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-extrabold">{action.title}</h3>
            <Badge variant="outline" className="border-white/10 bg-black/10 text-muted-foreground">
              {action.format}
            </Badge>
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{action.description}</p>
        </div>
      </div>
      <Button disabled={disabled} className="premium-button mt-4 w-full" onClick={action.onExport}>
        {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {disabled ? "Preparing Data" : "Download"}
      </Button>
    </motion.article>
  );
}

function AdminSignalPanel({
  overview,
  resources,
  resourceStats,
}: {
  overview: AdminOverviewStats;
  resources: Resource[];
  resourceStats: { total: number; published: number; drafts: number; featured: number; needsReview: number; article: number; video: number; audio: number };
}) {
  const publishedResources = resources.filter((resource) => resource.is_published);
  const coveredMoods = new Set(publishedResources.map((resource) => resource.mood_category).filter(Boolean));
  const missingMoodCategories = RESOURCE_MOOD_CATEGORIES
    .filter((item): item is ResourceMoodCategory => item !== "all")
    .filter((item) => !coveredMoods.has(item))
    .slice(0, 5);
  const riskTotal = Object.values(overview.riskDistribution).reduce((sum, value) => sum + value, 0);

  return (
    <section className="premium-card p-5 md:p-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-extrabold">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Control Signals
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Operational health from real platform tables.</p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <SignalTile label="Avg Mood" value={overview.avgMood ? `${overview.avgMood}/5` : "No data"} />
        <SignalTile label="Energy" value={overview.avgEnergy ? `${overview.avgEnergy}/10` : "No data"} />
        <SignalTile label="Sleep" value={overview.avgSleep ? `${overview.avgSleep}/10` : "No data"} />
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-extrabold">Assessment Risk Distribution</h3>
          <span className="text-xs text-muted-foreground">{riskTotal} completed tests</span>
        </div>
        <div className="space-y-3">
          <SignalBar label="High support signal" value={overview.riskDistribution.high} total={riskTotal} tone="bg-rose-300" />
          <SignalBar label="Watch signal" value={overview.riskDistribution.medium} total={riskTotal} tone="bg-amber-300" />
          <SignalBar label="Steady signal" value={overview.riskDistribution.steady} total={riskTotal} tone="bg-primary" />
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-extrabold">Resource Coverage</h3>
          <span className="text-xs text-muted-foreground">{resourceStats.total} total</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <SignalTile label="Articles" value={resourceStats.article} />
          <SignalTile label="Videos" value={resourceStats.video} />
          <SignalTile label="Audio" value={resourceStats.audio} />
        </div>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/10 p-3 text-sm text-muted-foreground">
          {missingMoodCategories.length > 0
            ? `Missing published mood coverage: ${missingMoodCategories.map(moodLabel).join(", ")}.`
            : "Every mood category has at least one published resource."}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
        <div className="mb-1 flex items-center gap-2 font-extrabold">
          <AlertTriangle className="h-4 w-4" />
          Ethical guardrail
        </div>
        MindSense is a wellness screening and support platform. Admin alerts should guide safe follow-up, not clinical diagnosis.
      </div>
    </section>
  );
}

function SignalTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-extrabold">{value}</div>
    </div>
  );
}

function SignalBar({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{value} / {percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function ResourceHealthCoveragePanel({ resources, loading, onCreate }: { resources: Resource[]; loading: boolean; onCreate: () => void }) {
  const published = resources.filter((resource) => resource.is_published);
  const drafts = resources.filter((resource) => !resource.is_published).length;
  const moodRows = RESOURCE_MOOD_CATEGORIES
    .filter((item): item is ResourceMoodCategory => item !== "all")
    .map((mood) => {
      const items = published.filter((resource) => resource.mood_category === mood);
      return {
        mood,
        total: items.length,
        article: items.filter((resource) => resource.type === "article").length,
        video: items.filter((resource) => resource.type === "video").length,
        audio: items.filter((resource) => resource.type === "audio").length,
      };
    });
  const missing = moodRows.filter((row) => row.total === 0);
  const weak = moodRows.filter((row) => row.total > 0 && row.total < 2);
  const needsAttention = [...missing, ...weak].slice(0, 4);

  return (
    <section className="premium-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold">
            <Layers className="h-5 w-5 text-primary" />
            Resource Health & Coverage
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Shows whether published resources cover the emotional states used by user recommendations.
          </p>
        </div>
        <Button className="premium-button" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          Add Resource
        </Button>
      </div>

      {loading ? (
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <SignalTile label="Published" value={published.length} />
            <SignalTile label="Drafts" value={drafts} />
            <SignalTile label="Missing moods" value={missing.length} />
            <SignalTile label="Thin coverage" value={weak.length} />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {moodRows.map((row) => (
              <motion.article
                key={row.mood}
                whileHover={{ y: -2 }}
                className={`rounded-[1.35rem] border p-4 ${
                  row.total === 0
                    ? "border-amber-300/25 bg-amber-300/10"
                    : row.total < 2
                      ? "border-sky-300/25 bg-sky-300/10"
                      : "border-white/10 bg-white/[0.04]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold">{moodLabel(row.mood)}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{row.total} published resources</p>
                  </div>
                  {row.total === 0 ? (
                    <AlertTriangle className="h-5 w-5 text-amber-200" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <ResourceTypeMiniStat icon={BookOpen} label="Art" value={row.article} />
                  <ResourceTypeMiniStat icon={Video} label="Vid" value={row.video} />
                  <ResourceTypeMiniStat icon={Headphones} label="Aud" value={row.audio} />
                </div>
              </motion.article>
            ))}
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-extrabold">Recommended admin action</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {needsAttention.length > 0
                    ? `Add or publish more resources for: ${needsAttention.map((item) => moodLabel(item.mood)).join(", ")}.`
                    : "Coverage is healthy across all recommendation mood categories."}
                </p>
              </div>
              <Badge variant="outline" className={needsAttention.length > 0 ? "border-amber-300/25 bg-amber-300/10 text-amber-100" : "border-primary/20 bg-primary/10 text-primary"}>
                {needsAttention.length > 0 ? "Needs curation" : "Healthy"}
              </Badge>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function ResourceTypeMiniStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-2">
      <Icon className="mx-auto h-3.5 w-3.5 text-primary" />
      <div className="mt-1 font-extrabold">{value}</div>
      <div className="text-[0.65rem] text-muted-foreground">{label}</div>
    </div>
  );
}

function ResourceModerationCenter({
  resources,
  loading,
  onEdit,
  onDelete,
  onTogglePublished,
  onToggleFeatured,
}: {
  resources: Resource[];
  loading: boolean;
  onEdit: (resource: Resource) => void;
  onDelete: (resource: Resource) => void | Promise<void>;
  onTogglePublished: (resource: Resource) => void | Promise<void>;
  onToggleFeatured: (resource: Resource) => void | Promise<void>;
}) {
  const drafts = resources.filter((resource) => !resource.is_published).slice(0, 4);
  const needsReview = resources
    .map((resource) => ({ resource, issues: getResourceIssues(resource) }))
    .filter((item) => item.issues.length > 0)
    .slice(0, 4);

  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <div className="premium-card p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-extrabold">
              <EyeOff className="h-5 w-5 text-primary" />
              Draft Review Queue
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Review imported drafts before they become visible to users.</p>
          </div>
          <Badge variant="outline" className="border-amber-300/25 bg-amber-300/10 text-amber-100">{drafts.length} waiting</Badge>
        </div>

        {loading ? (
          <ModerationSkeleton />
        ) : drafts.length === 0 ? (
          <ModerationEmpty icon={CheckCircle2} title="No drafts waiting" text="Imported resources will appear here before publishing." />
        ) : (
          <div className="mt-5 space-y-3">
            {drafts.map((resource) => (
              <ResourceReviewItem
                key={resource.id}
                resource={resource}
                issues={getResourceIssues(resource)}
                primaryAction="Publish"
                onPrimary={() => void onTogglePublished(resource)}
                onEdit={() => onEdit(resource)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="premium-card p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-extrabold">
              <FileWarning className="h-5 w-5 text-primary" />
              Resource Health
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Quality checks for missing metadata, weak previews, and incomplete categorization.</p>
          </div>
          <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">{needsReview.length} shown</Badge>
        </div>

        {loading ? (
          <ModerationSkeleton />
        ) : needsReview.length === 0 ? (
          <ModerationEmpty icon={CheckCircle2} title="Resources look complete" text="No missing metadata was found in the current library." />
        ) : (
          <div className="mt-5 space-y-3">
            {needsReview.map(({ resource, issues }) => (
              <ResourceReviewItem
                key={resource.id}
                resource={resource}
                issues={issues}
                primaryAction="Edit"
                onPrimary={() => onEdit(resource)}
                onEdit={() => onEdit(resource)}
                onDelete={() => void onDelete(resource)}
                onToggleFeatured={() => void onToggleFeatured(resource)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ResourceReviewItem({
  resource,
  issues,
  primaryAction,
  onPrimary,
  onEdit,
  onDelete,
  onToggleFeatured,
}: {
  resource: Resource;
  issues: string[];
  primaryAction: string;
  onPrimary: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  onToggleFeatured?: () => void;
}) {
  const Icon = categoryIcon[resource.type] || BookOpen;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </div>
            <Badge variant="outline" className="border-white/10 capitalize text-muted-foreground">{resource.type}</Badge>
            <Badge variant="outline" className="border-white/10 text-muted-foreground">{moodLabel(resource.mood_category)}</Badge>
            {resource.featured && <Badge className="bg-amber-400 text-slate-950 hover:bg-amber-400">Featured</Badge>}
          </div>
          <h3 className="mt-3 line-clamp-1 font-extrabold">{resource.title}</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {issues.length ? (
              issues.slice(0, 4).map((issue) => (
                <span key={issue} className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-xs text-amber-100">{issue}</span>
              ))
            ) : (
              <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-100">Ready</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <Button size="sm" className="premium-button" onClick={onPrimary}>{primaryAction}</Button>
          <Button size="sm" variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={onEdit}>Edit</Button>
          {onToggleFeatured && (
            <Button size="sm" variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={onToggleFeatured}>
              <Star className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button size="sm" variant="outline" className="rounded-full border-rose-300/20 bg-rose-400/10 text-rose-100 hover:bg-rose-400/15" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ModerationSkeleton() {
  return (
    <div className="mt-5 space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
      ))}
    </div>
  );
}

function ModerationEmpty({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-7 text-center">
      <Icon className="mx-auto h-8 w-8 text-primary" />
      <h3 className="mt-3 text-lg font-extrabold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function ResourceCountPill({ label, value, tone }: { label: string; value: number; tone?: "warning" }) {
  return (
    <div className={`rounded-2xl border p-3 ${tone === "warning" ? "border-amber-300/20 bg-amber-300/10" : "border-white/10 bg-white/[0.04]"}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
    </div>
  );
}

function AdminResourceRow({
  resource,
  onEdit,
  onDelete,
  onTogglePublished,
  onToggleFeatured,
}: {
  resource: Resource;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublished: () => void;
  onToggleFeatured: () => void;
}) {
  const Icon = categoryIcon[resource.type] || BookOpen;
  const issues = getResourceIssues(resource);
  const externalUrl = getResourceUrl(resource);

  return (
    <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 md:grid-cols-[6rem_minmax(0,1fr)_auto] md:items-center">
      <div className="h-24 overflow-hidden rounded-xl bg-black/20 md:h-20">
        {resource.thumbnail_url ? (
          <img src={resource.thumbnail_url} alt={resource.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-primary">
            <Icon className="h-6 w-6" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={resource.is_published ? "secondary" : "outline"} className={resource.is_published ? "" : "border-amber-300/40 bg-amber-300/10 text-amber-100"}>
            {resource.is_published ? "Published" : "Draft"}
          </Badge>
          {resource.featured && <Badge className="bg-amber-400 text-slate-950 hover:bg-amber-400">Featured</Badge>}
          <Badge variant="outline" className="border-white/10 capitalize text-muted-foreground">{resource.type}</Badge>
          <Badge variant="outline" className="border-white/10 text-muted-foreground">{moodLabel(resource.mood_category)}</Badge>
        </div>
        <h3 className="mt-2 truncate text-lg font-extrabold">{resource.title}</h3>
        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{resource.description || "No description added."}</p>
        {issues.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {issues.slice(0, 3).map((issue) => (
              <span key={issue} className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[11px] text-amber-100">{issue}</span>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        {externalUrl && (
          <Button size="sm" variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={() => window.open(externalUrl, "_blank", "noopener,noreferrer")}>
            <ExternalLink className="h-4 w-4" />
          </Button>
        )}
        <Button size="sm" variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={onTogglePublished}>
          {resource.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {resource.is_published ? "Draft" : "Publish"}
        </Button>
        <Button size="sm" variant="outline" className={`rounded-full border-white/10 bg-white/[0.04] ${resource.featured ? "text-amber-100" : ""}`} onClick={onToggleFeatured}>
          <Star className="h-4 w-4" />
          {resource.featured ? "Unfeature" : "Feature"}
        </Button>
        <Button size="sm" variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
        <Button size="sm" variant="outline" className="rounded-full border-rose-300/20 bg-rose-400/10 text-rose-100 hover:bg-rose-400/15" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>
    </div>
  );
}

function AdminDiscoveryPanel({ resources, onImport }: { resources: Resource[]; onImport: (candidate: CuratedResourceCandidate) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const importedByUrl = useMemo(() => {
    const map = new Map<string, Resource>();
    resources.forEach((resource) => {
      const url = getResourceUrl(resource).toLowerCase();
      if (url) map.set(url, resource);
    });
    return map;
  }, [resources]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CURATED_RESOURCE_CANDIDATES;
    return CURATED_RESOURCE_CANDIDATES.filter((candidate) =>
      `${candidate.title} ${candidate.description} ${candidate.category} ${candidate.mood_category} ${candidate.tags.join(" ")}`
        .toLowerCase()
        .includes(q),
    );
  }, [query]);

  return (
    <section className="premium-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold">
            <Layers className="h-5 w-5 text-primary" />
            Curated Discovery
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Import external resources as drafts, then verify and publish them.</p>
        </div>
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try anxiety, sleep, focus..." className="rounded-full border-white/10 bg-white/[0.06] pl-9" />
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {results.map((candidate) => {
          const imported = importedByUrl.get(candidate.external_url.toLowerCase());
          return (
            <div key={candidate.external_url} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="aspect-video overflow-hidden rounded-xl bg-black/20">
                <img src={candidate.thumbnail_url} alt={candidate.title} className="h-full w-full object-cover" />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-white/10 capitalize text-muted-foreground">{candidate.category}</Badge>
                <Badge variant="outline" className="border-white/10 text-muted-foreground">{moodLabel(candidate.mood_category)}</Badge>
                {imported && (
                  <Badge className={imported.is_published ? "bg-emerald-300 text-slate-950 hover:bg-emerald-300" : "bg-amber-400 text-slate-950 hover:bg-amber-400"}>
                    {imported.is_published ? "Published" : "Imported draft"}
                  </Badge>
                )}
              </div>
              <div className="mt-3 font-bold leading-snug">{candidate.title}</div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{candidate.description}</p>
              <div className="mt-2 text-xs text-muted-foreground">{candidate.estimated_duration} - {candidate.source_platform}</div>
              <Button size="sm" className="premium-button mt-3 w-full" onClick={() => void onImport(candidate)} disabled={Boolean(imported)}>
                {imported ? "Already Imported" : "Import Draft"}
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AdminField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 rounded-xl border-white/10 bg-white/[0.06]"
      />
    </div>
  );
}

function ProfessionalModal({
  professional,
  onClose,
  onSave,
}: {
  professional: ProfessionalDirectoryEntry | null;
  onClose: () => void;
  onSave: (form: ProfessionalFormState) => void;
}) {
  const [form, setForm] = useState<ProfessionalFormState>(() => professional ? professionalToForm(professional) : emptyProfessionalForm());
  const update = <K extends keyof ProfessionalFormState>(key: K, value: ProfessionalFormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    setForm(professional ? professionalToForm(professional) : emptyProfessionalForm());
  }, [professional]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ y: 18, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 18, opacity: 0, scale: 0.98 }}
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[1.5rem] border border-white/10 bg-background p-5 shadow-[var(--shadow-card)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold">{professional ? "Edit professional" : "Add professional"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Listings are informational and should be independently verified.</p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <AdminField label="Name" value={form.name} onChange={(value) => update("name", value)} />
          <AdminField label="Role" value={form.role} onChange={(value) => update("role", value)} />
          <AdminField label="Specialization" value={form.specialization} onChange={(value) => update("specialization", value)} />
          <AdminField label="City" value={form.city} onChange={(value) => update("city", value)} />
          <AdminField label="Clinic / hospital / service" value={form.location} onChange={(value) => update("location", value)} />
          <AdminField label="Phone" value={form.phone} onChange={(value) => update("phone", value)} />
          <div className="md:col-span-2">
            <AdminField label="Address" value={form.address} onChange={(value) => update("address", value)} />
          </div>
          <AdminField label="Map URL" value={form.map_url} onChange={(value) => update("map_url", value)} />
          <AdminField label="Source label" value={form.source_label} onChange={(value) => update("source_label", value)} />
          <AdminField label="Source URL" value={form.source_url} onChange={(value) => update("source_url", value)} />
          <AdminField label="Slug" value={form.slug} onChange={(value) => update("slug", slugify(value))} placeholder="Auto-generated if empty" />
          <div>
            <Label>Verification status</Label>
            <select
              value={form.verification_status}
              onChange={(event) => update("verification_status", event.target.value as ProfessionalVerificationStatus)}
              className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-background px-3 text-sm"
            >
              <option value="public_source">Public source</option>
              <option value="admin_reviewed">Admin reviewed</option>
              <option value="needs_verification">Needs verification</option>
            </select>
          </div>
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="professional-published">Published</Label>
              <Switch id="professional-published" checked={form.is_published} onCheckedChange={(checked) => update("is_published", checked)} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="professional-featured">Featured</Label>
              <Switch id="professional-featured" checked={form.featured} onCheckedChange={(checked) => update("featured", checked)} />
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={onClose}>Cancel</Button>
          <Button className="premium-button" onClick={() => onSave(form)}>
            <Save className="h-4 w-4" />
            Save Professional
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AdminResourceModal({
  editing,
  userId,
  onAuditLog,
  onClose,
  onSaved,
}: {
  editing: Resource | null;
  userId?: string;
  onAuditLog: (entry: AdminAuditLogInput) => Promise<void>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ResourceFormState>({
    title: editing?.title || "",
    description: editing?.description || "",
    type: editing?.type || "article",
    mood_category: editing?.mood_category || "mindfulness",
    external_url: editing?.external_url || editing?.content_url || "",
    thumbnail_url: editing?.thumbnail_url || "",
    tags: (editing?.tags || []).join(", "),
    estimated_duration: editing?.estimated_duration || editing?.duration || "",
    source_platform: editing?.source_platform || "",
    featured: editing?.featured || false,
    is_published: editing?.is_published ?? false,
  });
  const [extracting, setExtracting] = useState(false);

  const extractMetadata = async () => {
    if (!form.external_url.trim()) {
      toast({ title: "URL required", description: "Paste a resource URL first.", variant: "destructive" });
      return;
    }
    setExtracting(true);
    const meta = await fetchResourceMetadata(form.external_url.trim());
    setForm((current) => ({
      ...current,
      title: current.title || meta.title || "",
      description: current.description || meta.description || "",
      thumbnail_url: current.thumbnail_url || meta.thumbnail_url || "",
      source_platform: meta.source_platform,
    }));
    setExtracting(false);
  };

  const submit = async () => {
    if (!userId) return;
    if (!form.title.trim() || !form.external_url.trim()) {
      toast({ title: "Resource needs title and URL", variant: "destructive" });
      return;
    }

    const source = form.source_platform || detectSourcePlatform(form.external_url);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      type: form.type,
      category: form.type,
      mood_category: form.mood_category,
      topic: form.mood_category,
      external_url: form.external_url.trim(),
      content_url: form.external_url.trim(),
      thumbnail_url: form.thumbnail_url.trim() || null,
      tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      estimated_duration: form.estimated_duration.trim() || null,
      duration: form.estimated_duration.trim() || null,
      source_platform: source,
      featured: form.featured,
      is_published: form.is_published,
      created_by: userId,
    };

    const { error } = await saveResource(payload, editing?.id);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: editing ? "Resource updated" : "Resource created" });
      await onAuditLog({
        action: editing ? "resource.update" : "resource.create",
        entityType: "resource",
        entityId: editing?.id ?? payload.external_url,
        summary: `${editing ? "Updated" : "Created"} resource: ${payload.title}`,
        metadata: {
          type: payload.type,
          moodCategory: payload.mood_category,
          sourcePlatform: payload.source_platform,
          published: payload.is_published,
          featured: payload.featured,
        },
      });
      onSaved();
    }
  };

  return (
    <ModalShell onClose={onClose} wide>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold">{editing ? "Edit Resource" : "New Resource"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Store metadata only. Users see published resources on the Resources page.</p>
        </div>
        <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="space-y-2 md:col-span-2">
          <Label>External URL</Label>
          <div className="flex gap-2">
            <Input value={form.external_url} onChange={(event) => setForm({ ...form, external_url: event.target.value })} placeholder="YouTube, Spotify, SoundCloud, article URL..." className="border-white/10 bg-background" />
            <Button variant="outline" className="shrink-0 rounded-full border-white/10 bg-white/[0.04]" onClick={extractMetadata} disabled={extracting}>
              {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Extract
            </Button>
          </div>
        </label>
        <label className="space-y-2 md:col-span-2">
          <Label>Title</Label>
          <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="border-white/10 bg-background" />
        </label>
        <label className="space-y-2 md:col-span-2">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} className="border-white/10 bg-background" />
        </label>
        <label className="space-y-2">
          <Label>Category</Label>
          <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as ResourceCategory })} className="h-10 w-full rounded-md border border-white/10 bg-background px-3 text-sm">
            <option value="article">Article</option>
            <option value="video">Video</option>
            <option value="audio">Audio</option>
          </select>
        </label>
        <label className="space-y-2">
          <Label>Mood category</Label>
          <select value={form.mood_category} onChange={(event) => setForm({ ...form, mood_category: event.target.value as ResourceMoodCategory })} className="h-10 w-full rounded-md border border-white/10 bg-background px-3 text-sm">
            {RESOURCE_MOOD_CATEGORIES.filter((item) => item !== "all").map((item) => (
              <option key={item} value={item}>{moodLabel(item)}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <Label>Duration</Label>
          <Input value={form.estimated_duration} onChange={(event) => setForm({ ...form, estimated_duration: event.target.value })} placeholder="5 min, 8 min read, Live" className="border-white/10 bg-background" />
        </label>
        <label className="space-y-2">
          <Label>Source platform</Label>
          <Input value={form.source_platform} onChange={(event) => setForm({ ...form, source_platform: event.target.value })} placeholder="youtube, spotify, article..." className="border-white/10 bg-background" />
        </label>
        <label className="space-y-2 md:col-span-2">
          <Label>Thumbnail URL</Label>
          <Input value={form.thumbnail_url} onChange={(event) => setForm({ ...form, thumbnail_url: event.target.value })} className="border-white/10 bg-background" />
        </label>
        <label className="space-y-2 md:col-span-2">
          <Label>Tags</Label>
          <Input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="stress, sleep, productivity" className="border-white/10 bg-background" />
        </label>
        <div className="flex flex-wrap items-center gap-6 md:col-span-2">
          <label className="flex items-center gap-3">
            <Switch checked={form.featured} onCheckedChange={(value) => setForm({ ...form, featured: value })} />
            <span className="text-sm font-semibold">Featured</span>
          </label>
          <label className="flex items-center gap-3">
            <Switch checked={form.is_published} onCheckedChange={(value) => setForm({ ...form, is_published: value })} />
            <span className="text-sm font-semibold">Published</span>
          </label>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={onClose}>Cancel</Button>
        <Button className="premium-button" onClick={submit}>{editing ? "Save changes" : "Create resource"}</Button>
      </div>
    </ModalShell>
  );
}

function AdminUserDetailModal({
  detail,
  loading,
  error,
  onClose,
  onSave,
}: {
  detail: AdminUserDetail | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onSave: (detail: AdminUserDetail, status: AdminReviewStatus, priority: AdminReviewPriority, note: string) => Promise<void>;
}) {
  const [status, setStatus] = useState<AdminReviewStatus>("active");
  const [priority, setPriority] = useState<AdminReviewPriority>("normal");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!detail) return;
    setStatus(detail.reviewStatus.reviewStatus);
    setPriority(detail.reviewStatus.priority);
    setNote(detail.reviewStatus.adminNote || "");
  }, [detail]);

  const save = async () => {
    if (!detail) return;
    setSaving(true);
    await onSave(detail, status, priority, note);
    setSaving(false);
  };

  return (
    <ModalShell onClose={onClose} wide>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold">
            <UserCog className="h-5 w-5 text-primary" />
            User detail
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Privacy-safe activity summary for admin review. Mood notes and media files are not displayed.</p>
        </div>
        <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
          <X className="h-5 w-5" />
        </button>
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
          ))}
        </div>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-5 text-sm text-rose-100">{error}</div>
      ) : detail ? (
        <div className="mt-6 space-y-5">
          <section className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-2xl font-extrabold">{detail.profile.name || "MindSense user"}</h3>
                  <ReviewStatusBadge status={detail.reviewStatus.reviewStatus} />
                  <Badge variant="outline" className="border-white/10 text-muted-foreground capitalize">{detail.reviewStatus.priority} priority</Badge>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                  <span className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    {detail.profile.email || "No email available"}
                  </span>
                  <span className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    Joined {formatAdminDate(detail.profile.joinedAt)}
                  </span>
                </div>
              </div>
              <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-50 lg:max-w-xs">
                Admin review status is a follow-up marker only. It does not block sign-in or replace emergency care workflows.
              </div>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <DetailMetric label="Mood entries" value={detail.moodSummary.totalEntries} helper={`${detail.moodSummary.last7Entries} in last 7 days`} />
            <DetailMetric label="Avg mood" value={detail.moodSummary.avgMood ? `${detail.moodSummary.avgMood}/5` : "No data"} helper="Last 7 days" />
            <DetailMetric label="Tests" value={detail.testSummary.completedTests} helper={detail.latestTest ? `${detail.latestTest.wellnessScore ?? 0}% latest` : "No completed test"} />
            <DetailMetric label="Support" value={detail.supportSummary.totalSessions} helper="Completed sessions" />
            <DetailMetric label="Resources" value={detail.resourceSummary.resourcesOpened} helper="Opened resources" />
          </section>

          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="space-y-5">
              <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-5">
                <h3 className="flex items-center gap-2 text-lg font-extrabold">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Latest Assessment
                </h3>
                {detail.latestTest ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <DetailMetric label="Wellness score" value={detail.latestTest.wellnessScore !== null ? `${detail.latestTest.wellnessScore}%` : "Unknown"} helper={formatAdminDate(detail.latestTest.createdAt)} />
                    <DetailMetric label="Answers" value={detail.latestTest.answerCount} helper={`${detail.latestTest.voiceCaptured ? "Voice captured" : "No voice"} / ${detail.latestTest.videoCaptured ? "Video captured" : "No video"}`} />
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">No completed depression test is available for this user.</p>
                )}
              </div>

              <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-5">
                <h3 className="flex items-center gap-2 text-lg font-extrabold">
                  <Activity className="h-5 w-5 text-primary" />
                  Recent Activity
                </h3>
                {detail.recentActivity.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">No activity has been recorded yet.</p>
                ) : (
                  <div className="mt-4 space-y-2">
                    {detail.recentActivity.map((event, index) => (
                      <div key={`${event.source}-${event.occurredAt}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/10 p-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <ActivitySourceBadge source={event.source} />
                            <span className="font-bold">{event.title}</span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{formatAdminDate(event.occurredAt)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <aside className="space-y-5">
              <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-5">
                <h3 className="flex items-center gap-2 text-lg font-extrabold">
                  <Flag className="h-5 w-5 text-primary" />
                  Review Status
                </h3>
                <div className="mt-4 space-y-3">
                  <label className="space-y-2">
                    <Label>Status</Label>
                    <select value={status} onChange={(event) => setStatus(event.target.value as AdminReviewStatus)} className="h-10 w-full rounded-md border border-white/10 bg-background px-3 text-sm">
                      {REVIEW_STATUS_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <Label>Priority</Label>
                    <select value={priority} onChange={(event) => setPriority(event.target.value as AdminReviewPriority)} className="h-10 w-full rounded-md border border-white/10 bg-background px-3 text-sm">
                      {REVIEW_PRIORITY_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <Label>Admin note</Label>
                    <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} className="border-white/10 bg-background" placeholder="Internal review note..." />
                  </label>
                  <Button className="premium-button w-full" onClick={save} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save review
                  </Button>
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-5">
                <h3 className="flex items-center gap-2 text-lg font-extrabold">
                  <MessageSquareText className="h-5 w-5 text-primary" />
                  Patterns
                </h3>
                <div className="mt-4 space-y-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Top mood tags</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {detail.moodSummary.topTags.length ? detail.moodSummary.topTags.map((tag) => (
                        <span key={tag.tag} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-muted-foreground">{tag.tag} {tag.count}</span>
                      )) : <span className="text-sm text-muted-foreground">No tags yet</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Support activity</div>
                    <div className="mt-2 space-y-1.5">
                      {Object.keys(detail.supportSummary.byType).length ? Object.entries(detail.supportSummary.byType).map(([type, count]) => (
                        <div key={type} className="flex justify-between rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-sm">
                          <span className="capitalize text-muted-foreground">{type}</span>
                          <span className="font-bold">{count}</span>
                        </div>
                      )) : <span className="text-sm text-muted-foreground">No support sessions yet</span>}
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </section>
        </div>
      ) : null}
    </ModalShell>
  );
}

function DetailMetric({ label, value, helper }: { label: string; value: string | number; helper: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-extrabold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{helper}</div>
    </div>
  );
}

function ActivitySourceBadge({ source }: { source: string }) {
  const styles = {
    mood: "border-primary/25 bg-primary/10 text-primary",
    assessment: "border-violet-300/25 bg-violet-400/10 text-violet-100",
    support: "border-sky-300/25 bg-sky-400/10 text-sky-100",
  }[source] || "border-white/10 bg-white/[0.04] text-muted-foreground";

  return <Badge variant="outline" className={styles}>{moodLabel(source)}</Badge>;
}

function ModalShell({ children, onClose, wide }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#030712]/72 p-4 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 18 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 18 }}
        transition={{ type: "spring", damping: 22, stiffness: 220 }}
        onClick={(event) => event.stopPropagation()}
        className={`${wide ? "max-w-5xl" : "max-w-xl"} my-4 max-h-[calc(100vh-2rem)] w-full overflow-y-auto rounded-[1.75rem] border border-white/10 bg-[#121826] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.55)] md:p-6`}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export default AdminDashboard;
