import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Mic, PlayCircle, RefreshCw, ShieldCheck, Square, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AUDIO_SECONDS, evaluateAudioQuality, type AudioSignalMetrics } from "@/lib/depressionAnalysis";

export default function VoiceTest({ onComplete }: { onComplete: (path: string, metrics: AudioSignalMetrics) => void }) {
  const { user } = useAuth();
  const [state, setState] = useState<"idle" | "recording" | "review" | "uploading" | "done">("idle");
  const [count, setCount] = useState(AUDIO_SECONDS);
  const [bars, setBars] = useState<number[]>(Array(28).fill(8));
  const [blob, setBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<AudioSignalMetrics | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const audioReviewRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const volumesRef = useRef<number[]>([]);
  const startedAtRef = useRef<number | null>(null);

  const cleanup = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    audioCtxRef.current?.close().catch(() => {});
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  useEffect(() => () => cleanup(), []);

  const start = async () => {
    setError(null);
    setMetrics(null);
    if (!window.isSecureContext) {
      setError("Microphone access needs a secure page. Open MindSense on localhost or HTTPS, then try again.");
      setState("idle");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone is not available in this browser. Please use Chrome or Edge and try again.");
      setState("idle");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setError("Audio recording is not supported in this browser. Please use Chrome or Edge and try again.");
      setState("idle");
      return;
    }

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

      const recorder = new MediaRecorder(stream, { audioBitsPerSecond: 64_000 });
      recRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = () => {
        const recordedBlob = new Blob(chunks, { type: "audio/webm" });
        setBlob(recordedBlob);
        setAudioUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return URL.createObjectURL(recordedBlob);
        });
        const samples = volumesRef.current;
        const averageVolume = samples.reduce((sum, value) => sum + value, 0) / (samples.length || 1);
        const peakVolume = samples.length ? Math.max(...samples) : 0;
        const activeFrames = samples.filter((value) => value > 9).length;
        const durationSeconds = startedAtRef.current ? (Date.now() - startedAtRef.current) / 1000 : 0;
        const nextMetrics = evaluateAudioQuality({
          durationSeconds,
          averageVolume,
          peakVolume,
          voiceActivityRatio: samples.length ? activeFrames / samples.length : 0,
        });
        setMetrics(nextMetrics);
        if (!nextMetrics.passed) {
          setError(nextMetrics.issues.join(" "));
        }
        setState("review");
        cleanup();
      };
      recorder.start();
      startedAtRef.current = Date.now();
      setState("recording");
      setCount(AUDIO_SECONDS);

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
    } catch (requestError) {
      const errorName = requestError instanceof DOMException ? requestError.name : "";
      const message =
        errorName === "NotAllowedError" || errorName === "SecurityError"
          ? "Microphone permission is blocked. Click the lock icon in the address bar, allow Microphone, refresh, and try again."
          : errorName === "NotFoundError" || errorName === "DevicesNotFoundError"
            ? "No microphone was found. Please connect or enable your microphone and try again."
            : errorName === "NotReadableError" || errorName === "TrackStartError"
              ? "Microphone is already in use by another app. Close it and try again."
              : "Microphone could not start. Please check browser microphone permission and try again.";
      cleanup();
      setError(message);
      setState("idle");
    }
  };

  const retry = () => {
    setBlob(null);
    setAudioUrl(null);
    setMetrics(null);
    setState("idle");
    setError(null);
  };

  const upload = async () => {
    if (!blob || !user) return;
    if (!metrics?.passed) {
      setError(metrics?.issues.join(" ") || "We could not hear your voice clearly. Please record again.");
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

    onComplete(path, metrics);
  };

  const playAudioPreview = async () => {
    const player = audioReviewRef.current;
    if (!player) return;

    try {
      player.currentTime = 0;
      player.volume = 1;
      await player.play();
    } catch {
      setError("Audio preview could not start. Use the audio controls or record again.");
    }
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
          <h2 className="mt-5 text-3xl font-extrabold leading-tight md:text-4xl">Record a clear 20-second voice sample.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
            Speak naturally in English or Urdu about your mood, sleep, energy, stress, motivation, and daily routine.
          </p>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Recording check
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Quiet room</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Clear voice</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">20 seconds</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">English or Urdu</span>
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
          {state === "review" && audioUrl && (
            <div className="mx-auto mb-4 max-w-sm space-y-3">
              <audio
                key={audioUrl}
                ref={audioReviewRef}
                controls
                preload="metadata"
                src={audioUrl}
                onError={() => setError("Audio preview could not be loaded. Please record again.")}
                className="w-full"
              />
              <Button onClick={playAudioPreview} variant="outline" className="w-full rounded-full border-white/10 bg-white/[0.04]">
                <PlayCircle className="h-4 w-4" />
                Play voice preview
              </Button>
            </div>
          )}
          {state === "review" && metrics && (
            <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
              <MetricPill label="Duration" value={`${Math.round(metrics.durationSeconds)}s`} ok={metrics.durationSeconds >= 15} />
              <MetricPill label="Voice" value={`${Math.round(metrics.voiceActivityRatio * 100)}%`} ok={metrics.voiceActivityRatio >= 0.28} />
              <MetricPill label="Quality" value={`${metrics.qualityScore}%`} ok={metrics.passed} />
            </div>
          )}

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
                <Button onClick={upload} disabled={!metrics?.passed} className="premium-button px-8">
                  <Upload className="h-4 w-4" />
                  Upload voice and continue
                </Button>
              </>
            )}
            {state === "uploading" && (
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Uploading voice sample, then video will open...
              </div>
            )}
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

function MetricPill({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={`rounded-xl border px-2 py-2 ${ok ? "border-primary/20 bg-primary/10 text-primary" : "border-rose-300/20 bg-rose-400/10 text-rose-100"}`}>
      <div className="font-extrabold">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-[0.12em] opacity-80">{label}</div>
    </div>
  );
}
