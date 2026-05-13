import Navbar from "@/components/Navbar";
import { BarChart3, BookOpen, Brain, HeartHandshake, ScanFace, Shield } from "lucide-react";

const items = [
  { icon: ScanFace, title: "AI Emotion Detection", desc: "Review emotional signals from face, voice, and text workflows." },
  { icon: Brain, title: "Questionnaire Analysis", desc: "Structured screening turns user answers into clear wellness reports." },
  { icon: BarChart3, title: "Mood Tracking", desc: "Daily logs and charts help users understand emotional patterns." },
  { icon: Shield, title: "Privacy & Security", desc: "Account-protected records keep personal wellness data organized." },
  { icon: HeartHandshake, title: "Therapy Support", desc: "Guided exercises and assistant conversations support next steps." },
  { icon: BookOpen, title: "Mental Health Resources", desc: "Helpful articles, tools, and crisis-aware support pathways." },
];

const Features = () => (
  <div className="premium-page min-h-screen overflow-hidden">
    <Navbar />

    <main className="container relative mx-auto flex min-h-[calc(100svh-5.5rem)] flex-col justify-center px-4 py-5 md:px-6">
      <div className="ambient-beams absolute inset-0 opacity-60" />
      <section className="relative mb-6 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">Features</p>
        <h1 className="mt-2 text-5xl font-extrabold leading-tight md:text-6xl">Everything users need in one wellness platform.</h1>
      </section>

      <section className="relative grid gap-4 md:grid-cols-3">
        {items.map((feature) => (
          <div key={feature.title} className="premium-card premium-card-hover min-h-[160px] p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <feature.icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{feature.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </section>
    </main>
  </div>
);

export default Features;
