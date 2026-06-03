import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, CheckCircle2, Loader2, PlayCircle, RefreshCw, ShieldCheck, Square, Upload, Video, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { evaluateVideoQuality, type VideoSignalMetrics, VIDEO_SECONDS } from "@/lib/depressionAnalysis";

export default function VideoTest({
  onComplete,
}: {
  onComplete: (path: string, metrics: VideoSignalMetrics) => Promise<void> | void;
}) {
  const { user } = useAuth();
  const [state, setState] = useState<"idle" | "preview" | "recording" | "review" | "uploading" | "done">("idle");
  const [count, setCount] = useState(VIDEO_SECONDS);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [metrics, setMetrics] = useState<VideoSignalMetrics | null>(null);

  const liveRef = useRef<HTMLVideoElement>(null);
  const reviewRef = useRef<HTMLVideoElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const stopStream = () => streamRef.current?.getTracks().forEach((track) => track.stop());

  useEffect(() => () => stopStream(), []);

  const initCamera = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera is not available in this browser. Please use Chrome or Edge and try again.");
      setState("idle");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 480 },
          height: { ideal: 360 },
          frameRate: { ideal: 15, max: 20 },
        },
        audio: true,
      });
      streamRef.current = stream;
      if (liveRef.current) {
        liveRef.current.srcObject = stream;
        await liveRef.current.play();
      }
      setState("preview");
    } catch (requestError) {
      const errorName = requestError instanceof DOMException ? requestError.name : "";
      const message =
        errorName === "NotAllowedError" || errorName === "SecurityError"
          ? "Camera permission denied. Please allow camera access and try again."
          : errorName === "NotFoundError" || errorName === "DevicesNotFoundError"
            ? "Camera was not found. Please connect or enable your camera and try again."
            : errorName === "NotReadableError" || errorName === "TrackStartError"
              ? "Camera is already in use by another app. Close it and try again."
              : "Camera could not start. Please check camera and microphone access, then try again.";
      setError(message);
      setState("idle");
    }
  };

  const getMime = () => {
    const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
    return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || "video/webm";
  };

  const start = () => {
    if (!streamRef.current) return;
    setError(null);
    setMetrics(null);
    const recorder = new MediaRecorder(streamRef.current, {
      mimeType: getMime(),
      videoBitsPerSecond: 650_000,
      audioBitsPerSecond: 64_000,
    });
    recRef.current = recorder;
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = () => {
      const recordedBlob = new Blob(chunks.filter((chunk) => chunk.size > 0), {
        type: recorder.mimeType || chunks[0]?.type || "video/webm",
      });
      setBlob(recordedBlob);
      setVideoUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(recordedBlob);
      });
      setDurationSeconds(startedAtRef.current ? (Date.now() - startedAtRef.current) / 1000 : 0);
      stopStream();
      setState("review");
    };
    recorder.start(250);
    startedAtRef.current = Date.now();
    setState("recording");
    setCount(VIDEO_SECONDS);

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
  };

  const retry = () => {
    setBlob(null);
    setVideoUrl(null);
    setError(null);
    setMetrics(null);
    setDurationSeconds(0);
    initCamera();
  };

  const upload = async () => {
    if (!blob || !user) return;
    setError(null);
    const brightnessScore = await measureVideoBrightness(blob);
    const nextMetrics = evaluateVideoQuality({
      durationSeconds,
      sizeBytes: blob.size,
      brightnessScore,
    });
    setMetrics(nextMetrics);

    if (!nextMetrics.passed) {
      setError(nextMetrics.issues.join(" "));
      return;
    }

    setState("uploading");
    const ext = blob.type.includes("mp4") ? "mp4" : "webm";
    const videoPath = `${user.id}/video-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("test-media").upload(videoPath, blob, {
      contentType: blob.type,
    });
    if (uploadError) {
      toast.error("Upload failed. Please try again.");
      setState("review");
      return;
    }

    try {
      await onComplete(videoPath, nextMetrics);
    } catch {
      toast.error("Analysis could not start. Please try again.");
      setState("review");
    }
  };

  const playVideoPreview = async () => {
    const player = reviewRef.current;
    if (!player) return;

    try {
      player.currentTime = 0;
      player.muted = false;
      player.volume = 1;
      await player.play();
    } catch {
      setError("Video preview could not start. Use the video controls or record again.");
    }
  };

  return (
    <section className="premium-card relative overflow-hidden p-5 md:p-8">
      <div className="premium-grid pointer-events-none absolute inset-0 opacity-20" />
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-violet-400/15 blur-3xl" />
      <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_30rem] xl:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
            <Video className="h-4 w-4" />
            Video emotion capture
          </div>
          <h2 className="mt-5 text-3xl font-extrabold leading-tight md:text-4xl">Capture a clear 20-second video signal.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
            Look toward the camera and speak naturally. Video records camera and audio for the final multimodal assessment.
          </p>
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Video check
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Face visible</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Good lighting</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Camera steady</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">20 seconds</span>
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
          <div className="relative mx-auto aspect-video w-full overflow-hidden rounded-[1.5rem] border border-white/10 bg-black shadow-2xl">
            {state === "review" && videoUrl ? (
              <video
                key={videoUrl}
                ref={reviewRef}
                src={videoUrl}
                controls
                playsInline
                preload="metadata"
                onError={() => setError("Recorded video preview could not be loaded. Please record again.")}
                className="h-full w-full bg-black object-contain"
              />
            ) : (
              <video ref={liveRef} muted playsInline className="h-full w-full object-cover" />
            )}

            {state === "idle" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/65 text-white/80">
                <Camera className="h-10 w-10" />
                <span className="text-sm">Camera preview will appear here</span>
              </div>
            )}

            {(state === "preview" || state === "recording") && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-44 w-32 rounded-[50%] border-2 border-dashed border-white/70 md:h-56 md:w-40" />
              </div>
            )}

            {state === "recording" && (
              <>
                <motion.div
                  animate={{ opacity: [1, 0.35, 1] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                  className="pointer-events-none absolute inset-0 rounded-[1.5rem] ring-4 ring-rose-500 ring-inset"
                />
                <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold text-white">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                  REC {count}s
                </div>
              </>
            )}
          </div>

          {error && <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</div>}
          {state === "review" && (
            <div className="mt-4 space-y-3">
              <Button onClick={playVideoPreview} variant="outline" className="w-full rounded-full border-white/10 bg-white/[0.04]">
                <PlayCircle className="h-4 w-4" />
                Play video preview with audio
              </Button>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Volume2 className="h-3.5 w-3.5 text-primary" />
                If you cannot hear audio, check browser/tab volume and system sound.
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <MetricPill label="Duration" value={`${Math.round(durationSeconds)}s`} ok={durationSeconds >= 15} />
                <MetricPill label="Size" value={`${Math.round((blob?.size || 0) / 1024)}kb`} ok={(blob?.size || 0) > 90 * 1024} />
                <MetricPill label="Quality" value={metrics ? `${metrics.qualityScore}%` : "Ready"} ok={!metrics || metrics.passed} />
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {state === "idle" && (
              <Button onClick={initCamera} size="lg" className="premium-button px-8">
                <Camera className="h-4 w-4" />
                Enable camera
              </Button>
            )}
            {state === "preview" && (
              <Button onClick={start} size="lg" className="premium-button px-8">
                <Video className="h-4 w-4" />
                Start video recording
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
                  Upload video and analyze
                </Button>
              </>
            )}
            {state === "uploading" && (
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Uploading video sample. This can take a few seconds...
              </div>
            )}
            {state === "done" && (
              <div className="flex items-center gap-2 font-semibold text-primary">
                <CheckCircle2 className="h-5 w-5" />
                Video response recorded
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

async function measureVideoBrightness(blob: Blob): Promise<number | null> {
  if (typeof document === "undefined") return null;

  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);
    const finish = (value: number | null) => {
      cleanup();
      resolve(value);
    };

    video.onerror = () => finish(null);
    video.onloadedmetadata = () => {
      const midpoint = Number.isFinite(video.duration) ? Math.min(Math.max(video.duration / 2, 0.2), 2) : 0.2;
      video.currentTime = midpoint;
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = 90;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          finish(null);
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let total = 0;
        for (let index = 0; index < data.length; index += 4) {
          total += 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
        }
        finish((total / (data.length / 4) / 255) * 100);
      } catch {
        finish(null);
      }
    };
  });
}

function MetricPill({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={`rounded-xl border px-2 py-2 ${ok ? "border-primary/20 bg-primary/10 text-primary" : "border-rose-300/20 bg-rose-400/10 text-rose-100"}`}>
      <div className="font-extrabold">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-[0.12em] opacity-80">{label}</div>
    </div>
  );
}
