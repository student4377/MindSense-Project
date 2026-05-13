import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Mic, RefreshCw, ShieldCheck, Square, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DURATION = 10;

export default function VoiceTest({ onComplete }: { onComplete: (path: string) => void }) {
  const { user } = useAuth();
  const [state, setState] = useState<"idle" | "recording" | "review" | "uploading" | "done">("idle");
  const [count, setCount] = useState(DURATION);
  const [bars, setBars] = useState<number[]>(Array(28).fill(8));
  const [blob, setBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avgVolume, setAvgVolume] = useState(0);

  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const volumesRef = useRef<number[]>([]);

  const cleanup = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    audioCtxRef.current?.close().catch(() => {});
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  useEffect(() => () => cleanup(), []);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const frequencyData = new Uint8Array(analyser.frequencyBinCount);
      volumesRef.current = [];
      const tick = () => {
        analyser.getByteFrequencyData(frequencyData);
        setBars(Array.from(frequencyData).slice(0, 28).map((value) => 8 + (value / 255) * 60));
        const avg = frequencyData.reduce((sum, value) => sum + value, 0) / frequencyData.length;
        volumesRef.current.push(avg);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      const recorder = new MediaRecorder(stream);
      recRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = () => {
        const recordedBlob = new Blob(chunks, { type: "audio/webm" });
        setBlob(recordedBlob);
        setAudioUrl(URL.createObjectURL(recordedBlob));
        const avg = volumesRef.current.reduce((sum, value) => sum + value, 0) / (volumesRef.current.length || 1);
        setAvgVolume(avg);
        setState("review");
        cleanup();
      };
      recorder.start();
      setState("recording");
      setCount(DURATION);

      const interval = setInterval(() => {
        setCount((current) => {
          if (current <= 1) {
            clearInterval(interval);
            try {
              recorder.stop();
            } catch {
              // Recorder may already be stopped by the browser.
            }
            return 0;
          }
          return current - 1;
        });
      }, 1000);
    } catch {
      setError("Microphone permission denied. Please allow microphone access and try again.");
      setState("idle");
    }
  };

  const retry = () => {
    setBlob(null);
    setAudioUrl(null);
    setState("idle");
    setError(null);
  };

  const upload = async () => {
    if (!blob || !user) return;
    if (avgVolume < 5) {
      setError("We could not hear your voice clearly. Please record again in a quieter, louder setting.");
      return;
    }

    setState("uploading");
    const path = `${user.id}/voice-${Date.now()}.webm`;
    const { error: uploadError } = await supabase.storage.from("test-media").upload(path, blob, {
      contentType: "audio/webm",
    });
    if (uploadError) {
      toast.error("Upload failed. Please try again.");
      setState("review");
      return;
    }

    setState("done");
    setTimeout(() => onComplete(path), 520);
  };

  return (
    <section className="premium-card relative overflow-hidden p-5 md:p-8">
      <div className="premium-grid pointer-events-none absolute inset-0 opacity-20" />
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
            <Mic className="h-4 w-4" />
            Voice signal capture
          </div>
          <h2 className="mt-5 text-3xl font-extrabold leading-tight md:text-4xl">Record a calm 10-second voice sample.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
            Speak naturally in English or Urdu about how you feel today. MindSense saves the clip for the assessment record.
          </p>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Recording check
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Quiet room</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Clear voice</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">10 seconds</span>
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5 text-center">
          <div className="relative mx-auto mb-5 h-44 w-44">
            <motion.div
              animate={state === "recording" ? { scale: [1, 1.15, 1] } : { scale: 1 }}
              transition={{ repeat: state === "recording" ? Infinity : 0, duration: 1.6 }}
              className="absolute inset-0 rounded-full bg-primary/18"
            />
            <motion.div
              animate={state === "recording" ? { scale: [1, 1.32, 1], opacity: [0.45, 0, 0.45] } : { scale: 1, opacity: 0.25 }}
              transition={{ repeat: state === "recording" ? Infinity : 0, duration: 1.6 }}
              className="absolute inset-0 rounded-full bg-primary/28"
            />
            <div className="absolute inset-6 flex items-center justify-center rounded-full bg-gradient-to-br from-primary to-sky-400 text-primary-foreground shadow-[var(--shadow-glow)]">
              {state === "done" ? <CheckCircle2 className="h-12 w-12" /> : <Mic className="h-12 w-12" />}
            </div>
          </div>

          <div className="mb-4 flex h-20 items-end justify-center gap-1">
            {bars.map((height, index) => (
              <motion.div
                key={index}
                animate={{ height: state === "recording" ? height : 8 }}
                transition={{ duration: 0.1 }}
                className="w-1.5 rounded-full bg-gradient-to-t from-primary to-sky-300"
                style={{ height: 8 }}
              />
            ))}
          </div>

          {state === "recording" && <div className="mb-4 text-3xl font-extrabold text-primary">{count}s</div>}
          {error && <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</div>}
          {state === "review" && audioUrl && <audio controls src={audioUrl} className="mx-auto mb-4 w-full max-w-sm" />}

          <div className="flex flex-wrap items-center justify-center gap-3">
            {state === "idle" && (
              <Button onClick={start} size="lg" className="premium-button px-8">
                <Mic className="h-4 w-4" />
                Start voice recording
              </Button>
            )}
            {state === "recording" && (
              <Button onClick={() => recRef.current?.stop()} size="lg" variant="outline" className="rounded-full border-white/10 bg-white/[0.04]">
                <Square className="h-4 w-4" />
                Stop
              </Button>
            )}
            {state === "review" && (
              <>
                <Button onClick={retry} variant="outline" className="rounded-full border-white/10 bg-white/[0.04]">
                  <RefreshCw className="h-4 w-4" />
                  Record again
                </Button>
                <Button onClick={upload} className="premium-button px-8">
                  <Upload className="h-4 w-4" />
                  Continue to video
                </Button>
              </>
            )}
            {state === "uploading" && <div className="text-sm text-muted-foreground">Securely saving your recording...</div>}
            {state === "done" && (
              <div className="flex items-center gap-2 font-semibold text-primary">
                <CheckCircle2 className="h-5 w-5" />
                Voice response recorded
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
