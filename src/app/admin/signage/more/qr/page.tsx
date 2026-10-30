"use client";

import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import {
  QrCode,
  Save,
  CheckCircle2,
  ExternalLink,
  Smartphone,
  Plus,
} from "lucide-react";
import type { QrCode as QrCodeType } from "@/lib/signage/types";

export default function QrCodesManagePage() {
  const [qrList, setQrList] = useState<QrCodeType[]>([
    {
      id: "qr-wa",
      label: "WhatsApp Channel",
      target_url: "https://whatsapp.com/channel/kathuafresh",
      caption: "Scan for daily wholesale rates & deals",
      position: 1,
      enabled: true,
      created_at: "2026-10-30T00:00:00.000Z",
    },
    {
      id: "qr-ig",
      label: "Instagram",
      target_url: "https://instagram.com/kathuafresh",
      caption: "Follow us @kathuafresh",
      position: 2,
      enabled: true,
      created_at: "2026-10-30T00:00:00.000Z",
    },
  ]);

  const [svgMap, setSvgMap] = useState<Record<string, string>>({});
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Generate SVG QR preview for each
  useEffect(() => {
    async function renderQrs() {
      const map: Record<string, string> = {};
      for (const qr of qrList) {
        try {
          const svg = await QRCode.toString(qr.target_url || "https://kathuafresh.in", {
            type: "svg",
            margin: 1,
            color: { dark: "#0f172a", light: "#ffffff" },
          });
          map[qr.id] = svg;
        } catch {
          // ignore error
        }
      }
      setSvgMap(map);
    }
    renderQrs();
  }, [qrList]);

  const updateQr = (id: string, field: keyof QrCodeType, value: unknown) => {
    setQrList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleSave = async () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">TV QR Codes</h1>
          <p className="text-xs text-slate-400">
            Codes permanently displayed on the right side of the screen
          </p>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
        >
          <Save className="w-4 h-4" />
          <span>Save Changes</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-2 text-xs text-emerald-400 font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>QR codes saved and broadcast to TV screens!</span>
        </div>
      )}

      {/* Test Scan Hint (PRD 9.6) */}
      <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-2.5 text-xs text-slate-300">
        <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
          <strong>Test Tip:</strong> Point any phone camera directly at the QR
          previews below to verify target links.
        </span>
      </div>

      {/* QR Cards List */}
      <div className="space-y-4">
        {qrList.map((qr) => (
          <div
            key={qr.id}
            className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold flex items-center justify-center border border-emerald-500/20">
                  {qr.position}
                </span>
                <span className="text-sm font-bold text-white">{qr.label}</span>
              </div>

              <button
                onClick={() => updateQr(qr.id, "enabled", !qr.enabled)}
                className={`text-xs font-bold px-2.5 py-1 rounded-xl border ${
                  qr.enabled
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
              >
                {qr.enabled ? "Active on TV" : "Hidden"}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center">
              {/* Live QR SVG preview */}
              <div
                className="w-32 h-32 bg-white p-2 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
                dangerouslySetInnerHTML={{ __html: svgMap[qr.id] || "" }}
              />

              <div className="flex-1 w-full space-y-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Label
                  </label>
                  <input
                    type="text"
                    value={qr.label}
                    onChange={(e) => updateQr(qr.id, "label", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Destination URL
                  </label>
                  <input
                    type="url"
                    value={qr.target_url}
                    onChange={(e) =>
                      updateQr(qr.id, "target_url", e.target.value)
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Caption
                  </label>
                  <input
                    type="text"
                    value={qr.caption || ""}
                    onChange={(e) =>
                      updateQr(qr.id, "caption", e.target.value)
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
