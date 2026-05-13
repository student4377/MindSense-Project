import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  ExternalLink,
  HeartHandshake,
  MessageCircle,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readMindSensePreferences } from "@/lib/preferences";

export type WellnessAssistantResource = {
  id: string;
  title: string;
  description?: string | null;
  topic?: string | null;
  category?: string | null;
  type?: string | null;
  duration?: string | null;
};

type AssistantAction =
  | { type: "route"; label: string; to: string }
  | { type: "external"; label: string; href: string }
  | { type: "resource"; label: string; resourceId: string };

type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: string;
  actions?: AssistantAction[];
};

type WellnessAssistantProps = {
  open: boolean;
  onClose: () => void;
  resources?: WellnessAssistantResource[];
  onOpenResource?: (resource: WellnessAssistantResource) => void;
};

const STORAGE_KEY = "mindsense-wellness-assistant-v1";

const QUICK_PROMPTS = [
  "I feel anxious",
  "I cannot sleep",
  "I feel sad",
  "Help me relax",
  "What should I do today?",
  "Show me resources",
];

const CRISIS_WORDS = [
  "suicide",
  "suicidal",
  "kill myself",
  "end my life",
  "hurt myself",
  "self harm",
  "self-harm",
  "no reason to live",
  "want to die",
  "can't go on",
  "cant go on",
];

const timeNow = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const firstMessage = (): AssistantMessage => ({
  id: makeId(),
  role: "assistant",
  time: timeNow(),
  text:
    "Hi, I am your MindSense wellness assistant. I can listen, help you calm down, suggest small next steps, and point you to mood tracking, therapy tools, or resources. What is on your mind?",
  actions: [
    { type: "route", label: "Mood Tracking", to: "/mood" },
    { type: "route", label: "Therapy Tools", to: "/therapy" },
  ],
});

const normalize = (value: string) => value.toLowerCase().replace(/[^\w\s']/g, " ");

const hasAny = (text: string, words: string[]) => words.some((word) => text.includes(word));

const findResources = (message: string, resources: WellnessAssistantResource[]) => {
  const query = normalize(message);
  const words = query.split(/\s+/).filter((word) => word.length > 3);

  return resources
    .map((resource) => {
      const haystack = normalize(
        `${resource.title} ${resource.description ?? ""} ${resource.topic ?? ""} ${resource.category ?? ""} ${resource.type ?? ""}`,
      );
      const score = words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
      return { resource, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ resource }) => resource);
};

const buildReply = (
  message: string,
  resources: WellnessAssistantResource[],
): Pick<AssistantMessage, "text" | "actions"> => {
  const text = normalize(message);
  const matchedResources = findResources(message, resources);

  if (hasAny(text, CRISIS_WORDS)) {
    return {
      text:
        "I am really glad you told me. Your safety matters more than this chat. If you might hurt yourself or are in immediate danger, call local emergency services now or go to the nearest emergency room. If you are in the U.S., call or text 988 for the Suicide & Crisis Lifeline. If you can, move away from anything you could use to hurt yourself and contact one trusted person right now.",
      actions: [
        { type: "external", label: "Call 988", href: "tel:988" },
        { type: "external", label: "Text 988", href: "sms:988" },
        { type: "route", label: "Contact Support", to: "/contact" },
      ],
    };
  }

  if (hasAny(text, ["hello", "hi", "salam", "assalam", "hey"])) {
    return {
      text:
        "Hi. I am here with you. You can say exactly how you feel, even if it is messy. Would you like to talk about your mood, anxiety, sleep, stress, or something else?",
      actions: [
        { type: "route", label: "Mood Tracking", to: "/mood" },
        { type: "route", label: "Therapy Tools", to: "/therapy" },
      ],
    };
  }

  if (hasAny(text, ["panic", "anxious", "anxiety", "afraid", "scared", "worry", "worried", "overthinking"])) {
    return {
      text:
        "That sounds uncomfortable. Try this for one minute: breathe in for 4, hold for 4, breathe out for 6. Then name 5 things you see, 4 things you feel, 3 things you hear, 2 things you smell, and 1 thing you can taste. After that, write down the single worry that feels loudest.",
      actions: [
        { type: "route", label: "Open Breathing Tools", to: "/therapy" },
        { type: "route", label: "Log Mood", to: "/mood" },
      ],
    };
  }

  if (hasAny(text, ["stress", "stressed", "overwhelmed", "pressure", "tired", "burnout", "burned out"])) {
    return {
      text:
        "You may be carrying too much at once. Pick one tiny next action: drink water, stretch for 60 seconds, write a two-item task list, or step away from the screen for five minutes. Small regulation first, problem solving second.",
      actions: [
        { type: "route", label: "Therapy Tools", to: "/therapy" },
        { type: "route", label: "Resources", to: "/resources" },
      ],
    };
  }

  if (hasAny(text, ["sleep", "insomnia", "can't sleep", "cant sleep", "night", "bed"])) {
    return {
      text:
        "Sleep trouble can make everything feel heavier. Tonight, try dim lights, no scrolling in bed, and a slow breathing cycle. If thoughts keep racing, write them down as a tomorrow list so your mind does not have to keep holding them.",
      actions: [
        { type: "route", label: "Sleep Tools", to: "/therapy" },
        { type: "route", label: "Sleep Resources", to: "/resources" },
      ],
    };
  }

  if (hasAny(text, ["sad", "low", "depressed", "empty", "hopeless", "cry", "crying", "lonely", "alone"])) {
    return {
      text:
        "I am sorry it feels this heavy. You do not have to solve everything right now. Try naming what you feel in one sentence, then do one caring action for your body: water, food, shower, sunlight, or messaging someone safe. If this feeling keeps returning, consider talking with a mental health professional.",
      actions: [
        { type: "route", label: "Start Check-In", to: "/test" },
        { type: "route", label: "Mood Tracking", to: "/mood" },
        { type: "route", label: "Professional Support", to: "/therapy" },
      ],
    };
  }

  if (hasAny(text, ["mood", "track", "journal", "log"])) {
    return {
      text:
        "Mood tracking works best when it is simple and honest. Go to Mood Tracking, choose your mood, add a short note, and tag what may have influenced it. Over time, patterns become easier to see.",
      actions: [{ type: "route", label: "Open Mood Tracking", to: "/mood" }],
    };
  }

  if (hasAny(text, ["test", "assessment", "depression test", "checkup", "check in", "check-in"])) {
    return {
      text:
        "You can start the guided assessment from the Depression Test page. Right now, text assessment and media capture are available; full voice/video model analysis can be added later.",
      actions: [{ type: "route", label: "Start Depression Test", to: "/test" }],
    };
  }

  if (hasAny(text, ["resource", "article", "video", "audio", "learn", "guide"])) {
    return {
      text:
        matchedResources.length > 0
          ? "I found a few resources that match what you asked about. You can open one now or browse the full resource library."
          : "The Resources page has articles, videos, audio, and wellness tools. Try searching by anxiety, sleep, stress, depression, or mindfulness.",
      actions: [
        ...matchedResources.map((resource) => ({ type: "resource" as const, label: resource.title, resourceId: resource.id })),
        { type: "route", label: "Open Resources", to: "/resources" },
      ],
    };
  }

  if (hasAny(text, ["motivation", "motivated", "focus", "productive", "study", "work"])) {
    return {
      text:
        "Try making the next step almost too small: two minutes of action, one open tab, one paragraph, one message, one stretch. Momentum often comes after starting, not before.",
      actions: [
        { type: "route", label: "Mood Tracking", to: "/mood" },
        { type: "route", label: "Therapy Tools", to: "/therapy" },
      ],
    };
  }

  if (matchedResources.length > 0) {
    return {
      text:
        "I found resources that may fit what you shared. You can open one, or keep talking and I will help you narrow it down.",
      actions: matchedResources.map((resource) => ({ type: "resource", label: resource.title, resourceId: resource.id })),
    };
  }

  return {
    text:
      "Thank you for sharing that. I am listening. What feels most important right now: calming your body, understanding the feeling, making a small plan, or finding support?",
    actions: [
      { type: "route", label: "Calming Tools", to: "/therapy" },
      { type: "route", label: "Mood Tracking", to: "/mood" },
      { type: "route", label: "Resources", to: "/resources" },
    ],
  };
};

export default function WellnessAssistant({
  open,
  onClose,
  resources = [],
  onOpenResource,
}: WellnessAssistantProps) {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [assistantMemory, setAssistantMemory] = useState(() => readMindSensePreferences().assistantMemory);
  const [messages, setMessages] = useState<AssistantMessage[]>(() => {
    if (!readMindSensePreferences().assistantMemory) return [firstMessage()];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AssistantMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignore invalid saved chat history.
    }
    return [firstMessage()];
  });
  const endRef = useRef<HTMLDivElement>(null);

  const resourceMap = useMemo(() => new Map(resources.map((resource) => [resource.id, resource])), [resources]);

  useEffect(() => {
    const syncPreferences = () => setAssistantMemory(readMindSensePreferences().assistantMemory);
    window.addEventListener("storage", syncPreferences);
    return () => window.removeEventListener("storage", syncPreferences);
  }, []);

  useEffect(() => {
    if (!assistantMemory) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
  }, [assistantMemory, messages]);

  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const sendMessage = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || typing) return;

    const userMessage: AssistantMessage = {
      id: makeId(),
      role: "user",
      text: trimmed,
      time: timeNow(),
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setTyping(true);

    window.setTimeout(() => {
      const reply = buildReply(trimmed, resources);
      setMessages((current) => [
        ...current,
        {
          id: makeId(),
          role: "assistant",
          time: timeNow(),
          ...reply,
        },
      ]);
      setTyping(false);
    }, 500);
  };

  const clearChat = () => {
    localStorage.removeItem(STORAGE_KEY);
    setMessages([firstMessage()]);
    setInput("");
  };

  const runAction = (action: AssistantAction) => {
    if (action.type === "route") {
      onClose();
      navigate(action.to);
      return;
    }
    if (action.type === "resource") {
      const resource = resourceMap.get(action.resourceId);
      if (resource && onOpenResource) {
        onClose();
        onOpenResource(resource);
      } else {
        onClose();
        navigate("/resources");
      }
      return;
    }
    window.location.href = action.href;
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/35 p-3 backdrop-blur-sm sm:items-center sm:justify-end sm:p-6"
          onClick={onClose}
        >
          <motion.section
            initial={{ y: 28, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 28, opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", damping: 24, stiffness: 240 }}
            onClick={(event) => event.stopPropagation()}
            className="flex h-[86vh] w-full max-w-[460px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:h-[720px] sm:max-h-[90vh]"
            aria-label="Wellness Assistant chat"
          >
            <header className="bg-gradient-to-r from-primary to-primary-glow p-4 text-primary-foreground">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">Wellness Assistant</h2>
                  <p className="truncate text-xs opacity-90">Supportive chat, tools, and resources</p>
                </div>
                <button
                  type="button"
                  aria-label="Close wellness assistant"
                  onClick={onClose}
                  className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="border-b border-border bg-secondary/60 px-4 py-3 text-xs text-secondary-foreground">
              <div className="flex gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>
                  I can support and guide you, but I am not a therapist. If you may be in immediate danger, contact emergency services now.
                </p>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-4">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[84%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      message.role === "user"
                        ? "rounded-br-sm bg-gradient-to-r from-primary to-primary-glow text-primary-foreground"
                        : "rounded-bl-sm border border-border bg-card"
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                    {message.actions && message.actions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.actions.map((action) => (
                          <button
                            key={`${message.id}-${action.label}`}
                            type="button"
                            onClick={() => runAction(action)}
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                              message.role === "user"
                                ? "bg-white/20 hover:bg-white/30"
                                : "bg-secondary text-secondary-foreground hover:bg-accent"
                            }`}
                          >
                            {action.type === "external" ? <ExternalLink className="h-3 w-3" /> : <HeartHandshake className="h-3 w-3" />}
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className={`mt-2 text-[10px] ${message.role === "user" ? "opacity-80" : "text-muted-foreground"}`}>
                      {message.time}
                    </div>
                  </div>
                </motion.div>
              ))}

              {typing && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3">
                    {[0, 1, 2].map((index) => (
                      <motion.span
                        key={index}
                        className="h-2 w-2 rounded-full bg-primary"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: index * 0.14 }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            <footer className="border-t border-border bg-card p-3">
              <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendMessage(prompt)}
                    className="shrink-0 rounded-full bg-secondary px-3 py-1.5 text-xs text-secondary-foreground hover:bg-accent"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") sendMessage(input);
                  }}
                  placeholder="Type how you feel..."
                  className="rounded-full"
                />
                <Button
                  type="button"
                  size="icon"
                  disabled={!input.trim() || typing}
                  onClick={() => sendMessage(input)}
                  className="rounded-full bg-gradient-to-r from-primary to-primary-glow"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="outline" onClick={clearChat} className="rounded-full" aria-label="Clear chat">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                <MessageCircle className="h-3 w-3" />
                {assistantMemory ? "Your chat is saved on this device only." : "Assistant memory is off for this browser."}
              </div>
            </footer>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
