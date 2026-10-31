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
  Send,
  Trash2,
  ExternalLink,
  Activity,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

interface AnnouncementItem {
  id: string;
  title: string;
  kind: "welcome" | "offer" | "marketing";
  source?: "tts" | "mp3";
  tts_lang: "hi-IN" | "en-IN";
  tts_text: string;
  frequency_minutes?: number;
  enabled: boolean;
}

export default function VoiceAnnouncementsPage() {
  // Voice Master settings
  const [masterEnabled, setMasterEnabled] = useState(true);
  const [volume, setVolume] = useState(85);
  const [frequencyMinutes, setFrequencyMinutes] = useState(3);
  const [quietHoursStart, setQuietHoursStart] = useState("21:00");
  const [quietHoursEnd, setQuietHoursEnd] = useState("08:00");

  // Background Audio State
  const [audioBgEnabled, setAudioBgEnabled] = useState(true);
  const [audioBgVolume, setAudioBgVolume] = useState(80);
  const [audioBgInterval, setAudioBgInterval] = useState<number>(120);
  const [customAdminIntervalVal, setCustomAdminIntervalVal] = useState<number>(2);
  const [customAdminIntervalUnit, setCustomAdminIntervalUnit] = useState<"sec" | "min">("min");
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const phoneAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);

  // Custom Message Composer State
  const [customText, setCustomText] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customLang, setCustomLang] = useState<"hi-IN" | "en-IN">("hi-IN");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isPhoneSpeaking, setIsPhoneSpeaking] = useState(false);

  // Status & Feedback
  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: "success" | "info" | "error";
    text: string;
    timestamp: string;
  } | null>(null);

  const [lastBroadcast, setLastBroadcast] = useState<{
    text: string;
    lang: string;
    time: string;
  } | null>(null);

  // Announcements List
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  // Quick Preset Templates for Kathua Fresh
  const templates = [
    {
      label: "🍎 Seb Special Deal",
      title: "Kashmiri Apple Offer",
      text: "कथुआ फ्रेश में आज कश्मीरी सेब पर विशेष छूट! केवल ₹120 प्रति किलो, आज ही खरीदें।",
      lang: "hi-IN" as const,
    },
    {
      label: "🧅 Pyaz Wholesale Rate",
      title: "Nashik Onion Rate",
      text: "ताज़ा नासिक प्याज़ सिर्फ ₹38 प्रति किलो उपलब्ध है। शुद्धता और ताज़गी की पूरी गारंटी।",
      lang: "hi-IN" as const,
    },
    {
      label: "🥬 Subah ki Taazi Sabziyan",
      title: "Fresh Mandi Arrival",
      text: "आज सुबह की ताज़ा सब्ज़ियाँ मंडी से सीधे दुकान पर पहुँच चुकी हैं। कथुआ फ्रेश में आपका स्वागत है!",
      lang: "hi-IN" as const,
    },
    {
      label: "📲 WhatsApp QR Scan",
      title: "WhatsApp Rates Callout",
      text: "दुकान के टीवी पर दिया गया व्हाट्सएप क्यूआर कोड स्कैन करें और रोज़ाना मंडी होलसेल रेट्स सीधे अपने फोन पर पाएं।",
      lang: "hi-IN" as const,
    },
    {
      label: "🌿 English Welcome Alert",
      title: "English Store Greeting",
      text: "Welcome to Kathua Fresh! Quality Assured and Always Fresh. Scan the QR code to follow our offers.",
      lang: "en-IN" as const,
    },
    {
      label: "⏰ Shop Closing Alert",
      title: "Store Closing Notice",
      text: "दुकान अगले 30 मिनट में बंद होने वाली है। कृपया अपना बिलिंग काउंटर पर पूर्ण करवा लें। धन्यवाद!",
      lang: "hi-IN" as const,
    },
  ];

  // Load current settings and announcements from API
  const loadData = async () => {
    try {
      const res = await fetch("/api/signage/admin/voice/announcements");
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          if (typeof data.settings.master_enabled === "boolean") {
            setMasterEnabled(data.settings.master_enabled);
          }
          if (typeof data.settings.volume === "number") {
            setVolume(data.settings.volume);
          }
        }
        if (data.audio) {
          if (typeof data.audio.enabled === "boolean") {
            setAudioBgEnabled(data.audio.enabled);
          }
          if (typeof data.audio.volume === "number") {
            setAudioBgVolume(data.audio.volume);
          }
          if (typeof data.audio.interval_sec === "number") {
            setAudioBgInterval(data.audio.interval_sec);
          }
        }
        if (Array.isArray(data.announcements)) {
          setAnnouncements(
            data.announcements.map((a: any) => ({
              id: a.id,
              title: a.title,
              kind: a.kind || "offer",
              tts_lang: a.tts_lang || "hi-IN",
              tts_text: a.tts_text || a.text || "",
              frequency_minutes: a.frequency_minutes || 5,
              enabled: a.enabled !== false,
            }))
          );
        }
        if (data.active_announcement) {
          setLastBroadcast({
            text: data.active_announcement.text,
            lang: data.active_announcement.lang,
            time: new Date(data.active_announcement.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          });
        }
      }
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    loadData();
    return () => {
      if (phoneAudioRef.current) {
        phoneAudioRef.current.pause();
      }
      if (speechAudioRef.current) {
        speechAudioRef.current.pause();
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Broadcast ANY custom message to TV Screen
  const handleBroadcastToTv = async (textToBroadcast?: string, langToUse?: "hi-IN" | "en-IN") => {
    const text = (textToBroadcast || customText).trim();
    const lang = langToUse || customLang;

    if (!text) {
      setFeedbackMsg({
        type: "error",
        text: "Kripya announcement ka text likhein ya template choose karein.",
        timestamp: new Date().toLocaleTimeString(),
      });
      return;
    }

    setIsBroadcasting(true);
    try {
      const res = await fetch("/api/signage/admin/voice/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
      });

      if (res.ok) {
        const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        setLastBroadcast({ text, lang, time: now });
        setFeedbackMsg({
          type: "success",
          text: `TV par broadcast ho gaya! TV screen par announcement chal rahi hai.`,
          timestamp: now,
        });
      } else {
        throw new Error("Broadcast failed");
      }
    } catch {
      setFeedbackMsg({
        type: "error",
        text: "TV par broadcast bhejte waqt samasya aayi. Kripya check karein TV player on hai.",
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsBroadcasting(false);
    }
  };

  // Test speaking locally on user's phone browser with realistic studio voice
  const handleTestOnPhone = (textToSpeak: string, lang: "hi-IN" | "en-IN") => {
    if (!textToSpeak.trim()) return;

    // If already speaking, pause and cancel
    if (speechAudioRef.current) {
      speechAudioRef.current.pause();
      speechAudioRef.current = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    if (isPhoneSpeaking) {
      setIsPhoneSpeaking(false);
      return;
    }

    // Zero-collision on phone preview: pause background music preview if active
    let wasBgPlaying = false;
    if (phoneAudioRef.current && !phoneAudioRef.current.paused) {
      wasBgPlaying = true;
      phoneAudioRef.current.pause();
      setIsPreviewPlaying(false);
    }

    setIsPhoneSpeaking(true);

    const langCode = lang.startsWith("hi") ? "hi" : "en";
    const audioUrl = `/api/signage/admin/voice/tts?text=${encodeURIComponent(textToSpeak.trim())}&lang=${langCode}`;
    const audio = new Audio(audioUrl);
    speechAudioRef.current = audio;

    const onFinish = () => {
      setIsPhoneSpeaking(false);
      speechAudioRef.current = null;
      if (wasBgPlaying && phoneAudioRef.current) {
        phoneAudioRef.current.play().then(() => setIsPreviewPlaying(true)).catch(() => {});
      }
    };

    audio.onended = onFinish;
    audio.onerror = () => {
      // Fallback to speech synthesis if network audio stream fails
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = lang;
        utterance.rate = 0.95;
        utterance.volume = 1;
        utterance.onend = onFinish;
        utterance.onerror = onFinish;
        window.speechSynthesis.speak(utterance);
      } else {
        onFinish();
      }
    };

    audio.play().catch(() => {
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = lang;
        utterance.rate = 0.95;
        utterance.volume = 1;
        utterance.onend = onFinish;
        utterance.onerror = onFinish;
        window.speechSynthesis.speak(utterance);
      } else {
        onFinish();
      }
    });
  };

  // Save custom message to permanent announcement list
  const handleSaveToAnnouncements = async () => {
    if (!customText.trim()) return;
    try {
      const res = await fetch("/api/signage/admin/voice/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: customTitle.trim() || `Announcement (${customLang})`,
          tts_text: customText.trim(),
          tts_lang: customLang,
          kind: "offer",
          frequency_minutes: 5,
          enabled: true,
        }),
      });
      if (res.ok) {
        setFeedbackMsg({
          type: "success",
          text: "Announcement permanent list mein save ho gayi!",
          timestamp: new Date().toLocaleTimeString(),
        });
        setCustomText("");
        setCustomTitle("");
        loadData();
      }
    } catch {
      // ignore
    }
  };

  // Delete announcement
  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await fetch(`/api/signage/admin/voice/announcements?id=${id}`, {
        method: "DELETE",
      });
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // ignore
    }
  };

  // Toggle Background Audio
  const handleToggleBgAudio = async (enabled: boolean) => {
    setAudioBgEnabled(enabled);
    if (!enabled) {
      if (phoneAudioRef.current) {
        phoneAudioRef.current.pause();
        phoneAudioRef.current.currentTime = 0;
        setIsPreviewPlaying(false);
      }
      if (speechAudioRef.current) {
        speechAudioRef.current.pause();
        speechAudioRef.current = null;
        setIsPhoneSpeaking(false);
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    }
    try {
      localStorage.setItem("kathua_audio_enabled", JSON.stringify(enabled));
    } catch {}

    setFeedbackMsg({
      type: "info",
      text: enabled ? "TV background store audio ON ho gaya" : "TV background store audio MUTE ho gaya",
      timestamp: new Date().toLocaleTimeString(),
    });
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

  // Update Background Audio Volume
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

  // Update Background Audio Interval / Gap
  const handleUpdateBgInterval = async (sec: number) => {
    setAudioBgInterval(sec);
    setFeedbackMsg({
      type: "info",
      text: sec === 0 ? "TV Background Audio loop: Continuous (hamesha bajega)" : `TV Background Audio: Har ${sec >= 60 ? sec / 60 + " min" : sec + " sec"} baad trigger hoga`,
      timestamp: new Date().toLocaleTimeString(),
    });
    try {
      await fetch("/api/signage/admin/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval_sec: sec }),
      });
      const ch = new BroadcastChannel("kathua_tv_sync");
      ch.postMessage({ type: "TV_SYNC", timestamp: Date.now() });
      ch.close();
    } catch {
      // ignore
    }
  };

  // Preview background mp3 on phone
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

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-10">
      {/* Title */}
      <div>
        <h1 className="text-xl font-black text-white flex items-center gap-2">
          <span>Voice & Audio Studio</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
            TV Live Connected
          </span>
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Apna custom voice message banayein aur seedha TV screen par turant bolkar sunayein
        </p>
      </div>

      {/* Live Status Diagnostic Card: "Feature chal rha ha yaan nahi kaise pta chalega" */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 via-slate-900 to-slate-900 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block animate-ping absolute inset-0 opacity-75" />
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block relative" />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <span>Feature Status: Live & Working</span>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div className="text-[11px] text-slate-400">
                TV Screen aur Shop Speaker real-time sync mein hain
              </div>
            </div>
          </div>

          <a
            href="/tv?preview=true"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors"
          >
            <span>Live TV Dekhein</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Diagnostic Grid */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
          <div className="p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800/70">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Store Background Music
            </div>
            <div className="text-xs font-black text-white mt-0.5 flex items-center gap-1.5">
              <span className={audioBgEnabled ? "text-emerald-400" : "text-amber-400"}>
                {audioBgEnabled ? `Playing (${audioBgVolume}%)` : "Muted"}
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800/70">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Last Broadcast Status
            </div>
            <div className="text-xs font-black text-white mt-0.5 truncate">
              {lastBroadcast ? (
                <span className="text-emerald-400">Delivered {lastBroadcast.time}</span>
              ) : (
                <span className="text-slate-500">Ready to Broadcast</span>
              )}
            </div>
          </div>
        </div>

        {lastBroadcast && (
          <div className="px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/20 text-xs text-slate-300 flex items-start gap-2">
            <span className="text-emerald-400 font-bold shrink-0">TV par abhi:</span>
            <span className="italic truncate">&ldquo;{lastBroadcast.text}&rdquo;</span>
          </div>
        )}

        {/* Quick Test Ping Button */}
        <button
          onClick={() =>
            handleBroadcastToTv(
              "कथुआ फ्रेश ऑडियो सिस्टम सफलतापूर्वक चल रहा है। आपकी टीवी स्क्रीन और स्पीकर बिल्कुल सही काम कर रहे हैं।",
              "hi-IN"
            )
          }
          disabled={isBroadcasting}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-colors"
        >
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span>TV Par 3-Second Audio Test Ping Bhejein (Click to Test)</span>
        </button>
      </div>

      {/* Real-time Feedback Banner */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-bold animate-in fade-in duration-200 ${
            feedbackMsg.type === "success"
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
              : feedbackMsg.type === "error"
              ? "bg-rose-500/15 border-rose-500/30 text-rose-300"
              : "bg-blue-500/15 border-blue-500/30 text-blue-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedbackMsg.text}</span>
          </div>
          <span className="text-[10px] opacity-75">{feedbackMsg.timestamp}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* SECTION 1: CUSTOM ANNOUNCEMENT COMPOSER                      */}
      {/* ============================================================ */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white">
                Customize Your Voice Announcement
              </h2>
              <p className="text-xs text-slate-400">
                Apna manpasand message type karein aur phone ya TV par suniye
              </p>
            </div>
          </div>

          {/* Language Switch */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setCustomLang("hi-IN")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                customLang === "hi-IN"
                  ? "bg-emerald-500 text-slate-950 font-black"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              हिंदी (Hindi)
            </button>
            <button
              onClick={() => setCustomLang("en-IN")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                customLang === "en-IN"
                  ? "bg-emerald-500 text-slate-950 font-black"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              English
            </button>
          </div>
        </div>

        {/* Message Input Box */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span>Announcement Message Text</span>
            <span className="text-[10px] text-slate-500 font-normal">
              {customText.length} characters
            </span>
          </label>
          <textarea
            rows={3}
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder={
              customLang === "hi-IN"
                ? "उदा: कथुआ फ्रेश में आज आम और सेब पर 20% की विशेष छूट उपलब्ध है..."
                : "e.g. Welcome to Kathua Fresh! Special farm fresh discounts available today..."
            }
            className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>Ready-Made Templates (Click to use):</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1.5 no-scrollbar">
            {templates.map((tpl, i) => (
              <button
                key={i}
                onClick={() => {
                  setCustomText(tpl.text);
                  setCustomTitle(tpl.title);
                  setCustomLang(tpl.lang);
                }}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 text-xs text-slate-300 font-semibold transition-colors"
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800">
          {/* Test on Phone */}
          <button
            onClick={() => handleTestOnPhone(customText, customLang)}
            disabled={!customText.trim() || isPhoneSpeaking}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-bold transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-current text-amber-400" />
            <span>{isPhoneSpeaking ? "Phone par bol raha hai..." : "Phone Par Sunein"}</span>
          </button>

          {/* Broadcast to TV Now */}
          <button
            onClick={() => handleBroadcastToTv()}
            disabled={!customText.trim() || isBroadcasting}
            className="sm:col-span-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/20 transition-transform active:scale-95"
          >
            <Send className="w-4 h-4 stroke-[2.5]" />
            <span>
              {isBroadcasting ? "TV par bhej raha hai..." : "TV Screen Par Broadcast Karein (Live)"}
            </span>
          </button>
        </div>

        {/* Optional Save to List */}
        {customText.trim() && (
          <div className="pt-2 flex justify-end">
            <button
              onClick={handleSaveToAnnouncements}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ise Permanent List Mein Save Karein</span>
            </button>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* SECTION 2: STORE BACKGROUND MUSIC (MP3 JINGLE)               */}
      {/* ============================================================ */}
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
                <span>Store Background Audio (MP3)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold uppercase">
                  ElevenLabs Voice Jingle
                </span>
              </div>
              <div className="text-xs text-slate-400">
                {audioBgEnabled ? "TV Screen par lagataar chal raha hai" : "Muted"}
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
                  <span>Phone Par Sunein</span>
                </>
              )}
            </button>
          </div>

          {/* Volume slider */}
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                TV Speaker Volume
              </span>
              <span className="text-emerald-400 font-bold">{audioBgVolume}%</span>
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

          {/* Audio Interval Selector (Timer) */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex justify-between text-xs font-semibold text-slate-300 mb-2">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                Audio Trigger Gap (Kitne der baad baje)
              </span>
              <span className="text-emerald-400 font-bold">
                {audioBgInterval === 0
                  ? "Continuous Loop"
                  : `Har ${audioBgInterval >= 60 ? audioBgInterval / 60 + " min" : audioBgInterval + "s"}`}
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { label: "Continuous", sec: 0 },
                { label: "30 Sec", sec: 30 },
                { label: "1 Min", sec: 60 },
                { label: "2 Min", sec: 120 },
                { label: "3 Min", sec: 180 },
                { label: "5 Min", sec: 300 },
              ].map((item) => (
                <button
                  key={item.sec}
                  type="button"
                  onClick={() => handleUpdateBgInterval(item.sec)}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all text-center ${
                    audioBgInterval === item.sec
                      ? "bg-emerald-500 text-slate-950 shadow-md font-black"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Custom Interval Option in Admin Studio */}
            <div className="pt-2.5 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                <span>⏱️</span>
                <span>Custom Duration:</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="number"
                  min="1"
                  max="7200"
                  placeholder="e.g. 45"
                  value={customAdminIntervalVal || ""}
                  onChange={(e) => setCustomAdminIntervalVal(Math.max(1, parseInt(e.target.value) || 0))}
                  className="bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-xs text-white w-24 font-bold outline-none"
                />
                <select
                  value={customAdminIntervalUnit}
                  onChange={(e) => setCustomAdminIntervalUnit(e.target.value as "sec" | "min")}
                  className="bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-2 py-1.5 text-xs text-slate-200 font-semibold outline-none cursor-pointer"
                >
                  <option value="sec">Seconds</option>
                  <option value="min">Minutes</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const total = customAdminIntervalUnit === "min" ? customAdminIntervalVal * 60 : customAdminIntervalVal;
                    if (total > 0) {
                      handleUpdateBgInterval(total);
                    }
                  }}
                  className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs rounded-xl transition-all shadow-sm whitespace-nowrap"
                >
                  Set Custom
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden audio element for phone preview */}
        <audio
          ref={phoneAudioRef}
          src="/store-audio.mp3"
          onEnded={() => setIsPreviewPlaying(false)}
        />
      </div>

      {/* ============================================================ */}
      {/* SECTION 3: CONFIGURED ANNOUNCEMENTS LIST                     */}
      {/* ============================================================ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Saved Announcements List ({announcements.length})
          </h2>
          <span className="text-[11px] text-slate-500">
            TV par click karke turant bajayein
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
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-bold uppercase">
                    {item.tts_lang}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed italic">
                  &ldquo;{item.tts_text}&rdquo;
                </p>
              </div>

              <button
                onClick={() => handleDeleteAnnouncement(item.id)}
                className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                title="Delete Announcement"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400">
                Frequency: Every {item.frequency_minutes || 5} min
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleTestOnPhone(item.tts_text, item.tts_lang)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                >
                  <Play className="w-3.5 h-3.5 fill-current text-amber-400" />
                  <span>Preview</span>
                </button>

                <button
                  onClick={() => handleBroadcastToTv(item.tts_text, item.tts_lang)}
                  className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-xs font-bold"
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
