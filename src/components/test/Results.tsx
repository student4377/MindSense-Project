import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  Brain,
  Download,
  Heart,
  HeartHandshake,
  MessageCircle,
  Moon,
  RotateCcw,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import type { TestData } from "@/pages/DepressionTest";

export default function Results({ data, onRetake }: { data: TestData; onRetake: () => void }) {
  const navigate = useNavigate();
  const avg = useMemo(() => {
    if (!data.textAnswers.length) return 2.5;
    return data.textAnswers.reduce((sum, answer) => sum + answer.score, 0) / data.textAnswers.length;
  }, [data]);

  const wellness = Math.round(((5 - avg) / 4) * 100);
  const moodLabel =
    wellness >= 75
      ? "Balanced and positive"
      : wellness >= 50
        ? "Mostly steady"
        : wellness >= 30
          ? "Could use some care"
          : "Reach out for support";

  const trend = data.textAnswers.map((answer, index) => ({ q: index + 1, mood: 6 - answer.score }));
  const summary: { icon: LucideIcon; label: string; value: string; color: string }[] = [
    { icon: Activity, label: "Stress load", value: `${Math.round(avg * 18)}%`, color: "#fb923c" },
    { icon: Heart, label: "Emotional energy", value: `${Math.round((6 - avg) * 18)}%`, color: "#2dd4bf" },
    { icon: Users, label: "Social signal", value: avg < 3 ? "Active" : "Low", color: "#38bdf8" },
    { icon: Moon, label: "Sleep pattern", value: avg < 3 ? "Stable" : "Disturbed", color: "#a78bfa" },
  ];

  return (
    <div className="space-y-5">
      <section className="premium-card relative overflow-hidden p-5 md:p-7">
        <div className="premium-grid pointer-events-none absolute inset-0 opacity-20" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)] xl:items-center">
          <div className="mx-auto flex h-64 w-64 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] p-4">
            <div
              className="flex h-full w-full items-center justify-center rounded-full p-3"
              style={{ background: `conic-gradient(hsl(var(--primary)) ${wellness * 3.6}deg, rgba(255,255,255,0.1) 0deg)` }}
            >
              <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-white/10 bg-[#0b111d] text-center">
                <div className="text-5xl font-extrabold gradient-text">{wellness}</div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Wellness score</div>
              </div>
            </div>
          </div>

          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
              <Sparkles className="h-4 w-4" />
              Wellness snapshot
            </div>
            <h2 className="mt-5 text-3xl font-extrabold leading-tight md:text-4xl">{moodLabel}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              This is a supportive screening summary based on your questionnaire answers. It is not a medical diagnosis.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Text answers: {data.textAnswers.length}</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">{data.voicePath ? "Voice captured" : "No voice file"}</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">{data.videoPath ? "Video captured" : "No video file"}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="premium-card p-5"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]" style={{ color: item.color }}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{item.label}</div>
              <div className="mt-2 text-2xl font-extrabold">{item.value}</div>
            </motion.div>
          );
        })}
      </div>

      <section className="premium-card p-5 md:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-xl font-bold">
              <Activity className="h-5 w-5 text-primary" />
              Response Trend
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">How your answers moved across the questionnaire.</p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-muted-foreground">
            1 to 5 signal
          </span>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 16, right: 12, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="testTrendArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
              <XAxis dataKey="q" stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "16px",
                  color: "hsl(var(--foreground))",
                  boxShadow: "var(--shadow-card)",
                }}
              />
              <Area type="monotone" dataKey="mood" name="Mood signal" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#testTrendArea)" dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="premium-card p-5 md:p-6">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">AI Insights</h3>
            <span className="ml-auto rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Model pending</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Deeper text, voice, and video model insights can appear here once the AI models are connected.
          </p>
        </section>

        <section className="premium-card p-5 md:p-6">
          <div className="flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">Gentle next steps</h3>
          </div>
          <div className="mt-4 space-y-2">
            {["Try a short breathing exercise before sleep.", "Take a brief walk or stretch break today.", "Reach out to one person you trust.", "Write one honest sentence about how you feel."].map((item) => (
              <div key={item} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-muted-foreground">{item}</div>
            ))}
          </div>
        </section>
      </div>

      <section className="premium-card p-5 md:p-6">
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={() => window.print()}>
            <Download className="h-4 w-4" />
            Download report
          </Button>
          <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={onRetake}>
            <RotateCcw className="h-4 w-4" />
            Retake test
          </Button>
          <Button className="premium-button" onClick={() => navigate("/therapy")}>
            <HeartHandshake className="h-4 w-4" />
            Therapy and support
          </Button>
          <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04]" onClick={() => navigate("/therapy")}>
            <MessageCircle className="h-4 w-4" />
            Talk to support
          </Button>
        </div>
        <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
          If you feel at risk or in crisis, contact local emergency services or a trusted mental health professional.
        </p>
      </section>
    </div>
  );
}
