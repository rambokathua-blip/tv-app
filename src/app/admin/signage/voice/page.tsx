"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Clock,
  Plus,
  Sparkles,
  CheckCircle2,
  Radio,
  Music,
} from "lucide-react";

interface AnnouncementItem {
  id: string;
  title: string;
  kind: "welcome" | "offer" | "marketing";
  lang: "hi-IN" | "en-IN";
  text: string;
  enabled: boolean;
}

export default function VoiceAnnouncementsPage() {
  const [masterEnabled, setMasterEnabled] = useState(true);
  const [volume, setVolume] = useState(80);
  const [frequencyMinutes, setFrequencyMinutes] = useState(3);
  const [quietHoursStart, setQuietHoursStart] = useState("21:00");
  const [quietHoursEnd, setQuietHoursEnd] = useState("08:00");

  // Continuous background audio states
  const [audioBgEnabled, setAudioBgEnabled] = useState(true);
  const [audioBgVolume, setAudioBgVolume] = useState(80);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const phoneAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/api/signage/admin/audio")
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.enabled === "boolean") setAudioBgEnabled(data.enabled);
        if (typeof data.volume === "number") setAudioBgVolume(data.volume);
      })
      .catch(() => {});
  }, []);

  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([
    {
      id: "a-1",
      title: "Store Welcome Announcement",
      kind: "welcome",
      lang: "hi-IN",
      text: "कथुआ फ्रेश में आपका स्वागत है। आज की ताज़ा सब्ज़ियाँ और फल विशेष छूट पर उपलब्ध हैं।",
      enabled: true,
    },
    {
      id: "a-2",
      title: "WhatsApp Channel Join Callout",
      kind: "marketing",
      lang: "hi-IN",
      text: "दुकान के टीवी पर दिया गया क्यूआर कोड स्कैन करें और रोज़ाना मंडी रेट्स पाएं।",
      enabled: true,
    },
    {
      id: "a-3",
      title: "Fresh Deals English Alert",
      kind: "offer",
      lang: "en-IN",
      text: "Welcome to Kathua Fresh! Check out today's special farm-fresh offers on our screens.",
      enabled: true,
    },
  ]);

  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Test speaking locally on phone or send command to TV
  const handleTestSpeak = (item: AnnouncementItem) => {
    setSpeakingId(item.id);
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(item.text);
      utterance.lang = item.lang;
      utterance.volume = volume / 100;
      utterance.onend = () => setSpeakingId(null);
      utterance.onerror = () => setSpeakingId(null);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setSpeakingId(null), 2000);
    }
  };

  const handlePlayOnTv = (item: AnnouncementItem) => {
    setFeedbackMsg(`Broadcasting announcement "${item.title}" to TV...`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleToggleBgAudio = async (enabled: boolean) => {
    setAudioBgEnabled(enabled);
    setFeedbackMsg(enabled ? "Store background audio enabled on TV" : "Store background audio muted on TV");
    setTimeout(() => setFeedbackMsg(null), 3000);
    try {
      await fetch("/api/signage/admin/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
    } catch {
      // ignore
    }
  };

  const handleUpdateBgVolume = async (vol: number) => {
    setAudioBgVolume(vol);
    try {
      await fetch("/api/signage/admin/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volume: vol }),
      });
    } catch {
      // ignore
    }
  };

  const handlePreviewPhoneAudio = () => {
    if (!phoneAudioRef.current) return;
    if (isPreviewPlaying) {
      phoneAudioRef.current.pause();
      setIsPreviewPlaying(false);
    } else {
      phoneAudioRef.current.volume = audioBgVolume / 100;
      phoneAudioRef.current
        .play()
        .then(() => setIsPreviewPlaying(true))
        .catch(() => {});
    }
  };

  const frequencies = [
    { label: "Every 2m", val: 2 },
    { label: "Every 3m", val: 3 },
    { label: "Every 5m", val: 5 },
    { label: "Every 10m", val: 10 },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-white">Voice & Audio</h1>
        <p className="text-xs text-slate-400">
          Smart Hindi & English speech announcements & background store audio
        </p>
      </div>

      {feedbackMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-2 text-xs text-emerald-400 font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Store Background Audio / Jingle Card */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-2xl ${
                audioBgEnabled
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                  : "bg-slate-800 text-slate-500"
              }`}
            >
              <Music className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>Store Background Audio</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold uppercase">
                  MP3 Jingle
                </span>
              </div>
              <div className="text-xs text-slate-400">
                {audioBgEnabled ? "Continuous Loop on TV Screen" : "Muted on TV Screen"}
              </div>
            </div>
          </div>

          <button
            onClick={() => handleToggleBgAudio(!audioBgEnabled)}
            className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
              audioBgEnabled ? "bg-emerald-500 justify-end" : "bg-slate-700 justify-start"
            }`}
          >
            <div className="bg-slate-950 w-4 h-4 rounded-full shadow-md transform transition-transform" />
          </button>
        </div>

        <div className="pt-2 border-t border-slate-800 space-y-3.5">
          {/* Audio track info */}
          <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <div className="text-xs font-bold text-slate-200 truncate">
                ElevenLabs - Bunty (Punchy, Crisp)
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                /store-audio.mp3 • Continuous Loop
              </div>
            </div>

            <button
              onClick={handlePreviewPhoneAudio}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                isPreviewPlaying
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200"
              }`}
            >
              {isPreviewPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Stop Preview</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Listen on Phone</span>
                </>
              )}
            </button>
          </div>

          {/* Volume control */}
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                TV Audio Volume
              </span>
              <span className="text-emerald-400">{audioBgVolume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={audioBgVolume}
              onChange={(e) => handleUpdateBgVolume(Number(e.target.value))}
              className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        {/* Hidden audio element for phone preview */}
        <audio
          ref={phoneAudioRef}
          src="/store-audio.mp3"
          onEnded={() => setIsPreviewPlaying(false)}
        />
      </div>

      {/* Master Audio Switch & Settings (PRD 9.5) */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-2xl ${
                masterEnabled
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                  : "bg-slate-800 text-slate-500"
              }`}
            >
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Voice Announcements</div>
              <div className="text-xs text-slate-400">
                {masterEnabled ? "Active on shop TV" : "Muted"}
              </div>
            </div>
          </div>

          <button
            onClick={() => setMasterEnabled(!masterEnabled)}
            className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
              masterEnabled ? "bg-emerald-500 justify-end" : "bg-slate-700 justify-start"
            }`}
          >
            <div className="bg-slate-950 w-4 h-4 rounded-full shadow-md transform transition-transform" />
          </button>
        </div>

        {masterEnabled && (
          <div className="pt-2 border-t border-slate-800 space-y-3.5">
            {/* Volume slider */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  TV Speaker Volume
                </span>
                <span className="text-emerald-400">{volume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Frequency chips */}
            <div>
              <div className="text-xs font-semibold text-slate-300 mb-1.5">
                Announcement Frequency
              </div>
              <div className="grid grid-cols-4 gap-2">
                {frequencies.map((f) => (
                  <button
                    key={f.val}
                    onClick={() => setFrequencyMinutes(f.val)}
                    className={`py-2 text-xs font-bold rounded-xl border transition-colors ${
                      frequencyMinutes === f.val
                        ? "bg-emerald-500 text-slate-950 border-emerald-400"
                        : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quiet hours */}
            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Quiet Hours (Off):
              </span>
              <span className="font-semibold text-slate-200">
                {quietHoursStart} - {quietHoursEnd}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Announcements List (PRD 9.5) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Configured Announcements
          </h2>
          <span className="text-xs text-slate-500">
            {announcements.length} available
          </span>
        </div>

        {announcements.map((item) => (
          <div
            key={item.id}
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{item.title}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold uppercase">
                    {item.lang}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed italic">
                  &ldquo;{item.text}&rdquo;
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                Type: {item.kind}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleTestSpeak(item)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{speakingId === item.id ? "Speaking..." : "Preview"}</span>
                </button>

                <button
                  onClick={() => handlePlayOnTv(item)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-xs font-bold"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Play on TV</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
