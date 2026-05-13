import Navbar from "@/components/Navbar";
import { Eye, Heart, ShieldCheck, Target } from "lucide-react";

const values = [
  {
    icon: Target,
    title: "Our Mission",
    desc: "Make mental health screening, mood tracking, and supportive guidance easier to access through calm AI tools.",
  },
  {
    icon: Eye,
    title: "Our Vision",
    desc: "A future where people understand emotional patterns early and can take action before stress becomes heavier.",
  },
  {
    icon: Heart,
    title: "Our Values",
    desc: "Empathy, privacy, clarity, and responsible support are at the center of every MindSense experience.",
  },
];

const About = () => (
  <div className="premium-page min-h-screen overflow-hidden">
    <Navbar />

    <main className="container relative mx-auto flex min-h-[calc(100svh-5.5rem)] flex-col justify-center px-4 py-5 md:px-6">
      <div className="premium-grid absolute inset-0 opacity-40" />
      <div className="relative grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <section className="max-w-2xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.28em] text-primary">About</p>
          <h1 className="text-5xl font-extrabold leading-tight md:text-6xl">
            Built for calmer, clearer mental wellness.
          </h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            MindSense is an AI-powered mental health platform for early depression screening, mood insights,
            report history, and supportive wellness guidance in one private workspace.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              { label: "Multimodal signals", value: "Text, voice, video" },
              { label: "User focus", value: "Private wellness clarity" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                <div className="text-sm text-muted-foreground">{item.label}</div>
                <div className="mt-1 font-semibold text-foreground">{item.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4">
          {values.map((card) => (
            <div key={card.title} className="premium-card p-5">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                  <card.icon className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{card.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.desc}</p>
                </div>
              </div>
            </div>
          ))}
          <div className="rounded-2xl border border-primary/20 bg-primary/10 p-5">
            <div className="flex items-center gap-3 font-semibold text-primary">
              <ShieldCheck className="h-5 w-5" />
              Support-first and privacy-aware
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              MindSense is designed to help users reflect and seek support. It does not replace professional medical care.
            </p>
          </div>
        </section>
      </div>
    </main>
  </div>
);

export default About;
