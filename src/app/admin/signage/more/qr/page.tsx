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
  Trash2,
  RotateCcw,
} from "lucide-react";
import type { QrCode as QrCodeType } from "@/lib/signage/types";

export default function QrCodesManagePage() {
  const [qrList, setQrList] = useState<QrCodeType[]>([
    {
      id: "qr-wa",
      label: "WhatsApp Channel",
      target_url: "https://whatsapp.com/channel/0029Vb6WRPz2UPBI3hSeQE1B",
      caption: "Join for daily wholesale rates & deals",
      position: 1,
      enabled: true,
      created_at: new Date().toISOString(),
    },
    {
      id: "qr-ig",
      label: "Instagram",
      target_url: "https://www.instagram.com/kathua_fresh/",
      caption: "Follow @kathua_fresh for daily offers",
      position: 2,
      enabled: true,
      created_at: new Date().toISOString(),
    },
  ]);

  const [svgMap, setSvgMap] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // New QR form
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newCaption, setNewCaption] = useState("");

  // Load live QR codes from API
  useEffect(() => {
    async function loadQrs() {
      try {
        const res = await fetch("/api/signage/admin/qr");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setQrList(data);
          }
        }
      } catch {
        // fallback to initial state
      }
    }
    loadQrs();
  }, []);

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

  const persistQrList = async (list: QrCodeType[]) => {
    setIsSaving(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("kathua_tv_qrs", JSON.stringify(list));
        localStorage.setItem("signage_force_refresh", Date.now().toString());
      }
      await fetch("/api/signage/admin/qr", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(list),
      });

      // Broadcast instant sync to live TV
      try {
        const syncChannel = new BroadcastChannel("kathua_tv_sync");
        syncChannel.postMessage({ type: "TV_SYNC", timestamp: Date.now() });
        syncChannel.close();
      } catch {}

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteQr = async (id: string) => {
    if (qrList.length <= 1) {
      alert("At least 1 QR code is recommended for TV display.");
      return;
    }
    const updated = qrList.filter((item) => item.id !== id);
    setQrList(updated);
    await persistQrList(updated);
  };

  const handleAddQr = async () => {
    if (!newLabel.trim() || !newUrl.trim()) return;
    const newQr: QrCodeType = {
      id: "qr-" + Date.now(),
      label: newLabel.trim(),
      target_url: newUrl.trim(),
      caption: newCaption.trim() || undefined,
      position: qrList.length + 1,
      enabled: true,
      created_at: new Date().toISOString(),
    };
    const updated = [...qrList, newQr];
    setQrList(updated);
    setNewLabel("");
    setNewUrl("");
    setNewCaption("");
    setShowAddModal(false);
    await persistQrList(updated);
  };

  const handleSave = async () => {
    await persistQrList(qrList);
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">TV QR Codes</h1>
          <p className="text-xs text-slate-400">
            QR codes displayed on the right side of the screen
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold rounded-xl border border-slate-700 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add QR</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? "Saving..." : "Save Changes"}</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-2 text-xs text-emerald-400 font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>✓ QR codes saved and broadcast live to TV screens!</span>
        </div>
      )}

      {/* Test Scan Hint */}
      <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-2.5 text-xs text-slate-300">
        <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
          <strong>Live Preview:</strong> Point any phone camera directly at the QR previews below to test your links.
        </span>
      </div>

      {/* QR Cards List */}
      <div className="space-y-4">
        {qrList.map((qr, index) => (
          <div
            key={qr.id}
            className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 relative shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold flex items-center justify-center border border-emerald-500/20">
                  {index + 1}
                </span>
                <span className="text-sm font-bold text-white">{qr.label}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQr(qr.id, "enabled", !qr.enabled)}
                  className={`text-xs font-bold px-2.5 py-1 rounded-xl border transition-all ${
                    qr.enabled
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}
                >
                  {qr.enabled ? "Active on TV" : "Hidden"}
                </button>
                <button
                  onClick={() => deleteQr(qr.id)}
                  title="Delete QR code"
                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center">
              {/* Live QR SVG preview */}
              <div
                className="w-28 h-28 bg-white p-2 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
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
                    Destination URL (Scan link)
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
                    Caption (Under QR Code on TV)
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

      {/* Modal: Add New QR Code */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                <span>Add New TV QR Code</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            {/* Quick Templates */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Quick Preset:
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setNewLabel("Google Reviews");
                    setNewUrl("https://g.page/r/kathuafresh/review");
                    setNewCaption("Rate us on Google Maps ★★★★★");
                  }}
                  className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-left"
                >
                  ⭐ Google Reviews
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewLabel("Pay via UPI");
                    setNewUrl("upi://pay?pa=kathuafresh@upi&pn=KathuaFresh");
                    setNewCaption("Scan to pay directly via GPay / PhonePe");
                  }}
                  className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-left"
                >
                  💳 UPI Payment
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewLabel("Order Online");
                    setNewUrl("https://www.kathuafresh.in");
                    setNewCaption("Visit our website to order home delivery");
                  }}
                  className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-left"
                >
                  🌐 Store Website
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewLabel("WhatsApp Deals");
                    setNewUrl("https://wa.me/919999999999");
                    setNewCaption("Message us for wholesale orders");
                  }}
                  className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-left"
                >
                  💬 WhatsApp Support
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Label *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Google Reviews"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Destination URL *
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 text-xs font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Caption (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Scan to review our store"
                  value={newCaption}
                  onChange={(e) => setNewCaption(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newLabel.trim() || !newUrl.trim()}
                onClick={handleAddQr}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 text-xs font-bold"
              >
                Add QR Code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
