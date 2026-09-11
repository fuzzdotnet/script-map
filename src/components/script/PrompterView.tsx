"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronsUp,
  FlipVertical2,
  Maximize2,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAnnotationStore } from "@/hooks/useAnnotationStore";
import {
  buildPrompterBlocks,
  loadPrompterSettings,
  savePrompterSettings,
  pedalForKey,
  PEDAL_ACTIONS,
  MIN_FONT,
  MAX_FONT,
  FONT_STEP,
  MIN_SPEED,
  MAX_SPEED,
  SPEED_STEP,
  type Pedal,
  type PedalAction,
  type PrompterSettings,
} from "@/lib/prompter";
import type { Section } from "@/lib/supabase/types";

interface PrompterViewProps {
  sections: Section[];
}

/** Fraction of the viewport height where the "read here" line sits. */
const READ_LINE = 0.35;
/** Lines to jump back on a rewind pedal press. */
const REWIND_LINES = 3;
/** Hide the control bar this long after playback starts / last interaction. */
const UI_HIDE_MS = 3000;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function PrompterView({ sections }: PrompterViewProps) {
  const highlights = useAnnotationStore((s) => s.highlights);
  const exit = useAnnotationStore((s) => s.togglePresenterMode);

  // Only mounted after a client-side toggle, so reading localStorage here is safe.
  const [settings, setSettings] = useState<PrompterSettings>(loadPrompterSettings);
  const [playing, setPlaying] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [lastPedal, setLastPedal] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const playingRef = useRef(false);
  const speedRef = useRef(settings.speed);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    savePrompterSettings(settings);
    speedRef.current = settings.speed;
  }, [settings]);

  const blocks = useMemo(
    () => buildPrompterBlocks(sections, highlights, settings.scope),
    [sections, highlights, settings.scope]
  );

  const update = useCallback((patch: Partial<PrompterSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 900);
  }, []);

  // ---- Control bar auto-hide ------------------------------------------------

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playingRef.current) setUiVisible(false);
    }, UI_HIDE_MS);
  }, []);

  const revealUi = useCallback(() => {
    setUiVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  // ---- Playback actions -----------------------------------------------------

  const lineHeightPx = settings.fontSize * 16 * 1.6;

  const setPlayingState = useCallback(
    (next: boolean) => {
      playingRef.current = next;
      setPlaying(next);
      if (next) scheduleHide();
      else setUiVisible(true);
    },
    [scheduleHide]
  );

  const togglePlay = useCallback(() => {
    const el = scrollRef.current;
    if (!playingRef.current && el && el.scrollTop >= el.scrollHeight - el.clientHeight - 1) {
      // At the end: a play press restarts from the top.
      el.scrollTop = 0;
    }
    setPlayingState(!playingRef.current);
  }, [setPlayingState]);

  const rewind = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: Math.max(0, el.scrollTop - lineHeightPx * REWIND_LINES), behavior: "smooth" });
  }, [lineHeightPx]);

  const restart = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: "smooth" });
    setPlayingState(false);
  }, [setPlayingState]);

  const changeSpeed = useCallback(
    (delta: number) => {
      const speed = clamp(speedRef.current + delta, MIN_SPEED, MAX_SPEED);
      speedRef.current = speed;
      setSettings((s) => ({ ...s, speed }));
      showToast(`Speed ${speed / SPEED_STEP}`);
    },
    [showToast]
  );

  const changeFont = useCallback((delta: number) => {
    setSettings((s) => ({
      ...s,
      fontSize: Number(clamp(s.fontSize + delta, MIN_FONT, MAX_FONT).toFixed(1)),
    }));
  }, []);

  const runAction = useCallback(
    (action: PedalAction) => {
      switch (action) {
        case "play_pause":
          togglePlay();
          break;
        case "rewind":
          rewind();
          break;
        case "faster":
          changeSpeed(SPEED_STEP);
          break;
        case "slower":
          changeSpeed(-SPEED_STEP);
          break;
        case "restart":
          restart();
          break;
      }
    },
    [togglePlay, rewind, changeSpeed, restart]
  );

  // ---- Auto-scroll loop -----------------------------------------------------

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    // Sub-pixel scroll positions are dropped by the browser, so accumulate.
    let carry = 0;

    const tick = (now: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const dt = Math.min(now - last, 100) / 1000;
      last = now;
      carry += speedRef.current * dt;
      const step = Math.floor(carry);
      if (step > 0) {
        el.scrollTop += step;
        carry -= step;
      }
      if (el.scrollTop >= el.scrollHeight - el.clientHeight - 1) {
        setPlayingState(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, setPlayingState]);

  // ---- Pedal / keyboard input -----------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "SELECT" || target.tagName === "INPUT")) return;

      if (e.key === "Escape") {
        e.preventDefault();
        exit();
        return;
      }

      const pedal: Pedal | null = pedalForKey(e);
      if (!pedal) return;
      e.preventDefault();

      const action = pedal === "left" ? settings.leftPedal : settings.rightPedal;
      // Pedals held down auto-repeat; only speed changes should repeat.
      if (e.repeat && action !== "faster" && action !== "slower") return;

      setLastPedal(`${pedal === "left" ? "Left" : "Right"} pedal (${e.code || e.key})`);
      runAction(action);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settings.leftPedal, settings.rightPedal, runAction, exit]);

  // ---- Screen wake lock -----------------------------------------------------

  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        // Not granted (low battery, unsupported); the screen may dim.
      }
    };
    const onVisibility = () => {
      if (!cancelled && document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void lock?.release();
    };
  }, []);

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // ---- Fullscreen -------------------------------------------------------------

  const canFullscreen =
    typeof document !== "undefined" &&
    !!(document.documentElement.requestFullscreen ||
      (document.documentElement as { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen);

  const toggleFullscreen = () => {
    const root = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    const doc = document as Document & { webkitExitFullscreen?: () => void; webkitFullscreenElement?: Element | null };
    const active = document.fullscreenElement || doc.webkitFullscreenElement;
    if (active) {
      if (document.exitFullscreen) void document.exitFullscreen();
      else doc.webkitExitFullscreen?.();
    } else if (root.requestFullscreen) {
      void root.requestFullscreen().catch(() => {});
    } else {
      root.webkitRequestFullscreen?.();
    }
  };

  // ---- Render -----------------------------------------------------------------

  const readLinePct = settings.mirror ? (1 - READ_LINE) * 100 : READ_LINE * 100;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black text-white select-none"
      onPointerDown={revealUi}
    >
      {/* Scrolling script. The scroll container itself is flipped for mirror
          mode so scrollTop 0 is still the start of the script. */}
      <div
        ref={scrollRef}
        className="prompter-scroll flex-1 overflow-y-auto overscroll-contain"
        style={settings.mirror ? { transform: "scaleY(-1)" } : undefined}
      >
        <div
          className="mx-auto max-w-5xl px-8"
          style={{
            paddingTop: `${READ_LINE * 100}vh`,
            paddingBottom: `${(1 - READ_LINE) * 100 + 10}vh`,
            fontSize: `${settings.fontSize}rem`,
            lineHeight: 1.6,
          }}
        >
          {blocks.length === 0 ? (
            <p className="text-center text-white/50" style={{ fontSize: "1.25rem" }}>
              {settings.scope === "on_camera"
                ? "No on-camera text. Mark lines as “On Camera” in edit mode, or switch to Full script."
                : "This script is empty."}
            </p>
          ) : (
            blocks.map((block) =>
              block.kind === "heading" ? (
                <h2
                  key={block.key}
                  className="mt-[1.5em] mb-[0.5em] font-semibold uppercase tracking-widest text-white/45"
                  style={{ fontSize: "0.5em", lineHeight: 1.3 }}
                >
                  {block.text}
                </h2>
              ) : (
                <p key={block.key} className="mb-[0.8em] whitespace-pre-wrap font-medium">
                  {block.text}
                </p>
              )
            )
          )}
        </div>
      </div>

      {/* Read-here guide */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 h-px bg-amber-400/70"
        style={{ top: `${readLinePct}%` }}
      >
        <div className="absolute -top-1.5 left-2 h-3 w-3 rotate-45 bg-amber-400/80" />
        <div className="absolute -top-1.5 right-2 h-3 w-3 rotate-45 bg-amber-400/80" />
      </div>

      {/* Speed toast */}
      {toast && (
        <div className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 rounded-full bg-white/15 px-5 py-2 text-lg font-semibold backdrop-blur">
          {toast}
        </div>
      )}

      {/* Playing indicator when controls are hidden */}
      {!uiVisible && (
        <div className="pointer-events-none absolute bottom-4 right-4 h-3 w-3 animate-pulse rounded-full bg-emerald-400" />
      )}

      {/* Control bar */}
      <div
        className={`absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-2 border-t border-white/10 bg-black/85 px-3 py-3 backdrop-blur transition-opacity ${
          uiVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <Button variant="outline" size="icon" onClick={exit} title="Exit prompter (Esc)" className="border-white/20">
          <X className="h-5 w-5" />
        </Button>

        <div className="mx-1 flex overflow-hidden rounded-md border border-white/20">
          <button
            className={`px-3 py-2 text-sm ${settings.scope === "on_camera" ? "bg-white text-black" : "text-white/80"}`}
            onClick={() => update({ scope: "on_camera" })}
          >
            On camera
          </button>
          <button
            className={`px-3 py-2 text-sm ${settings.scope === "full" ? "bg-white text-black" : "text-white/80"}`}
            onClick={() => update({ scope: "full" })}
          >
            Full script
          </button>
        </div>

        <Button variant="outline" size="icon" onClick={restart} title="Back to top" className="border-white/20">
          <ChevronsUp className="h-5 w-5" />
        </Button>
        <Button variant="outline" size="icon" onClick={rewind} title="Jump back" className="border-white/20">
          <RotateCcw className="h-5 w-5" />
        </Button>
        <Button
          variant={playing ? "default" : "outline"}
          size="lg"
          onClick={togglePlay}
          title="Play / Pause"
          className="min-w-28 border-white/20"
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          {playing ? "Pause" : "Play"}
        </Button>

        <div className="mx-1 flex items-center gap-1 rounded-md border border-white/20 px-1">
          <Button variant="ghost" size="icon" onClick={() => changeSpeed(-SPEED_STEP)} title="Slower">
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-16 text-center text-sm tabular-nums">Speed {settings.speed / SPEED_STEP}</span>
          <Button variant="ghost" size="icon" onClick={() => changeSpeed(SPEED_STEP)} title="Faster">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="mx-1 flex items-center gap-1 rounded-md border border-white/20 px-1">
          <Button variant="ghost" size="icon" onClick={() => changeFont(-FONT_STEP)} title="Smaller text">
            <span className="text-xs font-bold">A</span>
          </Button>
          <span className="w-10 text-center text-sm tabular-nums">{settings.fontSize.toFixed(1)}</span>
          <Button variant="ghost" size="icon" onClick={() => changeFont(FONT_STEP)} title="Larger text">
            <span className="text-lg font-bold">A</span>
          </Button>
        </div>

        <Button
          variant={settings.mirror ? "default" : "outline"}
          size="icon"
          onClick={() => update({ mirror: !settings.mirror })}
          title="Mirror for beam-splitter glass"
          className="border-white/20"
        >
          <FlipVertical2 className="h-5 w-5" />
        </Button>

        {canFullscreen && (
          <Button variant="outline" size="icon" onClick={toggleFullscreen} title="Fullscreen" className="border-white/20">
            <Maximize2 className="h-5 w-5" />
          </Button>
        )}

        <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" title="Pedal settings" className="border-white/20">
              <Settings2 className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="w-80 space-y-3">
            <p className="text-sm font-semibold">Foot pedals</p>
            <p className="text-xs text-muted-foreground">
              Works with any Bluetooth pedal in keyboard mode (AirTurn modes 2, 3 and 5). Media
              mode (AirTurn mode 4) does not reach the browser.
            </p>
            <PedalSelect
              label="Left pedal"
              value={settings.leftPedal}
              onChange={(leftPedal) => update({ leftPedal })}
            />
            <PedalSelect
              label="Right pedal"
              value={settings.rightPedal}
              onChange={(rightPedal) => update({ rightPedal })}
            />
            <p className="text-xs text-muted-foreground">
              Last press: {lastPedal ?? "none yet — tap a pedal to test"}
            </p>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function PedalSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: PedalAction;
  onChange: (value: PedalAction) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <select
        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value as PedalAction)}
      >
        {PEDAL_ACTIONS.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </select>
    </label>
  );
}
