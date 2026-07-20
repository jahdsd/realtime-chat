import { useEffect, useMemo, useRef, useState } from "react";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  SkipForward,
  Play,
  Square,
  Send,
  Flag,
  Globe2,
  Sparkles,
  Users,
  Shield,
} from "lucide-react";

type Status = "idle" | "searching" | "connected";
type ChatMsg = { id: number; from: "me" | "stranger" | "system"; text: string };

const STRANGER_LINES = [
  "hey :)",
  "wo kommst du her?",
  "wie geht's?",
  "was machst du gerade?",
  "cool, ich mag deinen background",
  "hast du hobbies?",
  "hörst du gerade musik?",
  "spielst du games?",
];

const COUNTRIES = ["🇩🇪 Deutschland", "🇫🇷 Frankreich", "🇮🇹 Italien", "🇪🇸 Spanien", "🇳🇱 Niederlande", "🇧🇷 Brasilien", "🇯🇵 Japan", "🇺🇸 USA", "🇨🇦 Kanada", "🇬🇧 UK"];
const NAMES = ["Alex", "Sam", "Jordan", "Robin", "Kai", "Luca", "Mika", "Noa", "Yuki", "River"];

export default function Index() {
  const [status, setStatus] = useState<Status>("idle");
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [stranger, setStranger] = useState<{ name: string; country: string } | null>(null);
  const [onlineCount] = useState(() => 12000 + Math.floor(Math.random() * 4000));

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<number | null>(null);
  const strangerTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = s;
        if (localVideoRef.current) localVideoRef.current.srcObject = s;
      } catch {
        // permission denied — continue in demo mode
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
      if (strangerTimer.current) window.clearTimeout(strangerTimer.current);
    };
  }, []);

  useEffect(() => {
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = camOn));
  }, [camOn]);
  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = micOn));
  }, [micOn]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const pickStranger = () => ({
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    country: COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)],
  });

  const scheduleStrangerReply = (delay = 2500) => {
    if (strangerTimer.current) window.clearTimeout(strangerTimer.current);
    strangerTimer.current = window.setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          id: Date.now(),
          from: "stranger",
          text: STRANGER_LINES[Math.floor(Math.random() * STRANGER_LINES.length)],
        },
      ]);
    }, delay);
  };

  const connect = (delayMin = 1400, delayVar = 1400) => {
    setStranger(null);
    setMessages([]);
    setStatus("searching");
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      const s = pickStranger();
      setStranger(s);
      setStatus("connected");
      setMessages([{ id: Date.now(), from: "system", text: `Du bist mit ${s.name} verbunden` }]);
      scheduleStrangerReply(1600);
    }, delayMin + Math.random() * delayVar);
  };

  const stop = () => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    if (strangerTimer.current) window.clearTimeout(strangerTimer.current);
    setStatus("idle");
    setStranger(null);
    setMessages([]);
  };

  const send = () => {
    const t = input.trim();
    if (!t || status !== "connected") return;
    setMessages((m) => [...m, { id: Date.now(), from: "me", text: t }]);
    setInput("");
    scheduleStrangerReply(1200 + Math.random() * 1800);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header onlineCount={onlineCount} />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 md:gap-6">
          <section className="flex flex-col gap-4">
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden glass shadow-glow">
              <StrangerStage status={status} stranger={stranger} />

              <div className="absolute bottom-4 right-4 w-32 md:w-48 aspect-video rounded-xl overflow-hidden border border-border bg-black/60 shadow-lg">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`w-full h-full object-cover ${camOn ? "" : "opacity-0"}`}
                />
                {!camOn && (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
                    Kamera aus
                  </div>
                )}
                <div className="absolute top-1.5 left-2 text-[10px] uppercase tracking-wider text-white/80 bg-black/40 px-1.5 py-0.5 rounded">
                  Du
                </div>
              </div>

              {status === "connected" && stranger && (
                <div className="absolute top-4 left-4 flex items-center gap-2 glass rounded-full pl-1 pr-3 py-1">
                  <span className="h-6 w-6 rounded-full bg-gradient-brand flex items-center justify-center text-[11px] font-semibold">
                    {stranger.name[0]}
                  </span>
                  <span className="text-sm font-medium">{stranger.name}</span>
                  <span className="text-xs text-muted-foreground">{stranger.country}</span>
                  <span className="ml-1 h-2 w-2 rounded-full bg-[var(--success)] animate-pulse" />
                </div>
              )}
            </div>

            <Controls
              status={status}
              camOn={camOn}
              micOn={micOn}
              onToggleCam={() => setCamOn((v) => !v)}
              onToggleMic={() => setMicOn((v) => !v)}
              onStart={() => connect()}
              onStop={stop}
              onNext={() => connect(1200, 1200)}
            />
          </section>

          <aside className="glass rounded-2xl flex flex-col h-[480px] lg:h-auto lg:min-h-[560px] overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[var(--brand)]" />
                <h2 className="text-sm font-semibold">Chat</h2>
              </div>
              {status === "connected" && (
                <button className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition">
                  <Flag className="h-3.5 w-3.5" /> Melden
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-2 py-10">
                  <Sparkles className="h-6 w-6 opacity-60" />
                  <p className="text-sm max-w-[240px]">
                    {status === "idle"
                      ? "Klicke auf Start, um jemanden zu treffen."
                      : "Verbindung wird hergestellt…"}
                  </p>
                </div>
              )}
              {messages.map((m) => (
                <MessageBubble key={m.id} msg={m} />
              ))}
              <div ref={chatEndRef} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="p-3 border-t border-border flex items-center gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={status !== "connected"}
                placeholder={status === "connected" ? "Nachricht schreiben…" : "Zuerst verbinden…"}
                className="flex-1 bg-[var(--surface-elevated)] rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)] disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={status !== "connected" || !input.trim()}
                className="h-10 w-10 rounded-xl bg-gradient-brand text-[var(--brand-foreground)] flex items-center justify-center disabled:opacity-40 transition hover:scale-105"
                aria-label="Senden"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </aside>
        </div>

        <FeatureStrip />
      </main>

      <Footer />
    </div>
  );
}

function Header({ onlineCount }: { onlineCount: number }) {
  return (
    <header className="w-full border-b border-border/60">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-brand shadow-glow flex items-center justify-center">
            <Video className="h-5 w-5 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-bold tracking-tight">Ranvo</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Random Video Chat
            </div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4 text-[var(--success)]" />
          <span className="tabular-nums font-medium text-foreground">
            {onlineCount.toLocaleString("de-DE")}
          </span>
          <span>online</span>
        </div>
      </div>
    </header>
  );
}

function StrangerStage({ status, stranger }: { status: Status; stranger: { name: string; country: string } | null }) {
  if (status === "idle") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 gap-4 bg-[var(--surface)]/60">
        <div className="h-20 w-20 rounded-2xl bg-gradient-brand shadow-glow flex items-center justify-center">
          <Play className="h-9 w-9 text-white translate-x-0.5" />
        </div>
        <div className="max-w-md">
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight">
            Triff jemanden Neues.
          </h1>
          <p className="mt-2 text-muted-foreground text-sm md:text-base">
            Ein Klick, ein Fremder, eine Unterhaltung. Anonym, kostenlos, weltweit.
          </p>
        </div>
      </div>
    );
  }
  if (status === "searching") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-[var(--surface)]/70">
        <SearchingOrbs />
        <div className="text-center">
          <div className="text-lg font-semibold">Suche jemanden…</div>
          <div className="text-sm text-muted-foreground mt-1">
            Weltweite Nutzer werden gematcht
          </div>
        </div>
      </div>
    );
  }
  return <FakeStrangerVideo seed={stranger?.name ?? "x"} />;
}

function SearchingOrbs() {
  return (
    <div className="relative h-24 w-24">
      <span className="absolute inset-0 rounded-full bg-gradient-brand opacity-70 animate-ping" />
      <span className="absolute inset-2 rounded-full bg-gradient-brand opacity-90" />
      <span className="absolute inset-0 flex items-center justify-center">
        <Globe2 className="h-8 w-8 text-white" />
      </span>
    </div>
  );
}

function FakeStrangerVideo({ seed }: { seed: string }) {
  const hue = useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
    return h;
  }, [seed]);
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        background: `radial-gradient(80% 60% at 30% 30%, hsl(${hue} 70% 55% / 0.9), transparent 60%),
                     radial-gradient(70% 60% at 70% 70%, hsl(${(hue + 60) % 360} 70% 45% / 0.85), transparent 60%),
                     linear-gradient(135deg, hsl(${hue} 40% 20%), hsl(${(hue + 40) % 360} 40% 12%))`,
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-32 w-32 md:h-40 md:w-40 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-6xl md:text-7xl font-bold">
          {seed[0]?.toUpperCase()}
        </div>
      </div>
      <div className="absolute bottom-4 left-4 text-xs text-white/70 bg-black/30 rounded px-2 py-1">
        Demo-Video · echte P2P-Verbindung folgt im MVP
      </div>
    </div>
  );
}

function Controls({
  status,
  camOn,
  micOn,
  onToggleCam,
  onToggleMic,
  onStart,
  onStop,
  onNext,
}: {
  status: Status;
  camOn: boolean;
  micOn: boolean;
  onToggleCam: () => void;
  onToggleMic: () => void;
  onStart: () => void;
  onStop: () => void;
  onNext: () => void;
}) {
  return (
    <div className="glass rounded-2xl p-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <IconToggle active={camOn} onClick={onToggleCam} label={camOn ? "Kamera aus" : "Kamera an"}>
          {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </IconToggle>
        <IconToggle active={micOn} onClick={onToggleMic} label={micOn ? "Mikro aus" : "Mikro an"}>
          {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </IconToggle>
      </div>

      <div className="flex items-center gap-2">
        {status === "idle" && (
          <button
            onClick={onStart}
            className="h-12 px-6 rounded-xl bg-gradient-brand text-white font-semibold flex items-center gap-2 shadow-glow transition hover:scale-[1.02]"
          >
            <Play className="h-4 w-4" /> Start
          </button>
        )}
        {status !== "idle" && (
          <>
            <button
              onClick={onStop}
              className="h-12 px-4 rounded-xl bg-[var(--surface-elevated)] hover:bg-destructive/20 border border-border font-medium flex items-center gap-2 transition"
            >
              <Square className="h-4 w-4" /> Stop
            </button>
            <button
              onClick={onNext}
              className="h-12 px-6 rounded-xl bg-gradient-brand text-white font-semibold flex items-center gap-2 shadow-glow transition hover:scale-[1.02]"
            >
              <SkipForward className="h-4 w-4" /> Weiter
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function IconToggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`h-12 w-12 rounded-xl border border-border flex items-center justify-center transition ${
        active
          ? "bg-[var(--surface-elevated)] text-foreground hover:bg-[var(--surface-elevated)]/80"
          : "bg-destructive/20 text-destructive hover:bg-destructive/30"
      }`}
    >
      {children}
    </button>
  );
}

function MessageBubble({ msg }: { msg: ChatMsg }) {
  if (msg.from === "system") {
    return (
      <div className="text-center">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground bg-[var(--surface-elevated)] px-2 py-1 rounded-full">
          {msg.text}
        </span>
      </div>
    );
  }
  const isMe = msg.from === "me";
  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-snug ${
          isMe
            ? "bg-gradient-brand text-[var(--brand-foreground)] rounded-br-sm"
            : "bg-[var(--surface-elevated)] text-foreground rounded-bl-sm"
        }`}
      >
        {msg.text}
      </div>
    </div>
  );
}

function FeatureStrip() {
  const items = [
    { icon: Shield, title: "Anonym", desc: "Keine Anmeldung, keine Profile." },
    { icon: Globe2, title: "Weltweit", desc: "Menschen aus über 100 Ländern." },
    { icon: Sparkles, title: "Sofort", desc: "In unter 3 Sekunden verbunden." },
  ];
  return (
    <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
      {items.map(({ icon: Icon, title, desc }) => (
        <div key={title} className="glass rounded-2xl p-4 flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-brand flex items-center justify-center">
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-semibold">{title}</div>
            <div className="text-sm text-muted-foreground">{desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 mt-8">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
        <div>© {new Date().getFullYear()} Ranvo · Sei respektvoll. 18+.</div>
        <div className="flex gap-4">
          <a href="#" className="hover:text-foreground transition">Regeln</a>
          <a href="#" className="hover:text-foreground transition">Datenschutz</a>
          <a href="#" className="hover:text-foreground transition">Kontakt</a>
        </div>
      </div>
    </footer>
  );
}
