import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, CheckCircle2, RefreshCw, ShieldCheck, Square, Upload, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DURATION = 10;

export default function VideoTest({
  textAnswers,
  voicePath,
  onComplete,
}: {
  textAnswers: { question: string; answer: string; score: number }[];
  voicePath?: string;
  onComplete: (path: string) => void;
}) {
  const { user } = useAuth();
  const [state, setState] = useState<"idle" | "preview" | "recording" | "review" | "uploading" | "done">("idle");
  const [count, setCount] = useState(DURATION);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const liveRef = useRef<HTMLVideoElement>(null);
  const reviewRef = useRef<HTMLVideoElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = () => streamRef.current?.getTracks().forEach((track) => track.stop());

  useEffect(() => () => stopStream(), []);

  const initCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: true });
      streamRef.current = stream;
      if (liveRef.current) {
        liveRef.current.srcObject = stream;
        await liveRef.current.play();
      }
      setState("preview");
    } catch {
      setError("Camera permission denied. Please allow camera and microphone access.");
    }
  };

  const getMime = () => {
    const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
    return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || "video/webm";
  };

  const start = () => {
    if (!streamRef.current) return;
    const recorder = new MediaRecorder(streamRef.current, { mimeType: getMime() });
    recRef.current = recorder;
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = () => {
      const recordedBlob = new Blob(chunks, { type: chunks[0]?.type || "video/webm" });
      setBlob(recordedBlob);
      setVideoUrl(URL.createObjectURL(recordedBlob));
      stopStream();
      setState("review");
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
  };

  const retry = () => {
    setBlob(null);
    setVideoUrl(null);
    setError(null);
    initCamera();
  };

  const upload = async () => {
    if (!blob || !user) return;
    if (blob.size < 30000) {
      setError("Your video appears unclear. Please record again with better lighting and camera stability.");
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

    await supabase.from("depression_tests").insert({
      user_id: user.id,
      text_answers: textAnswers,
      voice_path: voicePath || null,
      video_path: videoPath,
      status: "completed",
    });

    setState("done");
    setTimeout(() => onComplete(videoPath), 520);
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
          <h2 className="mt-5 text-3xl font-extrabold leading-tight md:text-4xl">Capture a short, well-lit video signal.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
            Look toward the camera for 10 seconds. This completes the multimodal assessment record for your report.
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
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
          <div className="relative mx-auto aspect-video w-full overflow-hidden rounded-[1.5rem] border border-white/10 bg-black shadow-2xl">
            {state === "review" && videoUrl ? (
              <video ref={reviewRef} src={videoUrl} controls className="h-full w-full object-cover" />
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
                  Generate assessment
                </Button>
              </>
            )}
            {state === "uploading" && <div className="text-sm text-muted-foreground">Securely saving your recording and submission...</div>}
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
