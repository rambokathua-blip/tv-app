"use client";

import React, { useState, useEffect } from "react";
import {
  ListOrdered,
  ArrowUp,
  ArrowDown,
  Clock,
  CheckCircle2,
  Send,
  Eye,
  GripVertical,
  Plus,
  Trash2,
  Sparkles,
} from "lucide-react";
import type { PlaylistItem, Promotion } from "@/lib/signage/types";

export default function PlaylistPage() {
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [availablePromos, setAvailablePromos] = useState<Promotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Load promotions and playlist items
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        // 1. Fetch live promotions
        const promoRes = await fetch("/api/signage/admin/promotions");
        let allPromos: Promotion[] = [];
        if (promoRes.ok) {
          const promoData = await promoRes.json();
          allPromos = promoData.promotions || [];
        }

        // Also check localStorage
        try {
          const cached = localStorage.getItem("kathua_signage_promotions");
          if (cached) {
            const list = JSON.parse(cached);
            if (Array.isArray(list)) {
              const knownIds = new Set(allPromos.map((p) => p.id));
              const missing = list.filter((p: Promotion) => !knownIds.has(p.id));
              allPromos = [...missing, ...allPromos];
            }
          }
        } catch {}

        setAvailablePromos(allPromos);

        // 2. Fetch playlist
        const plRes = await fetch("/api/signage/admin/playlist");
        let plItems: PlaylistItem[] = [];
        if (plRes.ok) {
          const data = await plRes.json();
          if (data.items && data.items.length > 0) {
            plItems = data.items;
          }
        }

        // If playlist is empty, auto-generate from active promotions
        if (plItems.length === 0 && allPromos.length > 0) {
          plItems = allPromos.map((promo, idx) => ({
            id: "pl-" + promo.id,
            playlist_id: "default",
            promotion_id: promo.id,
            position: idx + 1,
            duration_override_sec: promo.duration_sec || 8,
            enabled: promo.enabled !== false,
            promotion: promo,
          }));
        }

        setItems(plItems);
      } catch (err) {
        console.error("Failed to load playlist:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  // Calculate total loop duration
  const totalSeconds = items
    .filter((i) => i.enabled)
    .reduce((acc, curr) => {
      const duration =
        curr.duration_override_sec || curr.promotion?.duration_sec || 8;
      return acc + duration;
    }, 0);

  const loopMinutes = Math.floor(totalSeconds / 60);
  const loopSeconds = totalSeconds % 60;
  const loopTimeDisplay =
    loopMinutes > 0
      ? `${loopMinutes} min ${loopSeconds} s`
      : `${loopSeconds} seconds`;

  // Move item up / down
  const moveItem = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === items.length - 1)
    )
      return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    const updated = newItems.map((item, idx) => ({
      ...item,
      position: idx + 1,
    }));
    setItems(updated);
    setHasUnpublishedChanges(true);

    fetch("/api/signage/admin/playlist/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: updated.map((it) => ({ id: it.id, position: it.position })),
      }),
    }).catch(console.error);
  };

  // Toggle item active / skip
  const toggleItem = (index: number) => {
    const updated = [...items];
    updated[index].enabled = !updated[index].enabled;
    setItems(updated);
    setHasUnpublishedChanges(true);
  };

  // Change duration
  const changeDuration = (index: number, sec: number) => {
    const updated = [...items];
    updated[index].duration_override_sec = sec;
    setItems(updated);
    setHasUnpublishedChanges(true);
  };

  // Remove from playlist
  const removeItem = (id: string) => {
    const next = items
      .filter((i) => i.id !== id)
      .map((it, idx) => ({ ...it, position: idx + 1 }));
    setItems(next);
    setHasUnpublishedChanges(true);
  };

  // Add offer into playlist
  const addOfferToPlaylist = (promo: Promotion) => {
    const newItem: PlaylistItem = {
      id: "pl-" + promo.id + "-" + Date.now(),
      playlist_id: "default",
      promotion_id: promo.id,
      position: items.length + 1,
      duration_override_sec: promo.duration_sec || 8,
      enabled: true,
      promotion: promo,
    };
    setItems((prev) => [...prev, newItem]);
    setHasUnpublishedChanges(true);
    setShowAddModal(false);
  };

  // Publish playlist changes
  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await fetch("/api/signage/admin/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: "Updated playlist order, timings & active slides",
        }),
      });

      // Broadcast instant TV sync
      try {
        const syncChannel = new BroadcastChannel("kathua_tv_sync");
        syncChannel.postMessage({ type: "TV_SYNC", timestamp: Date.now() });
        syncChannel.close();
        localStorage.setItem("signage_force_refresh", Date.now().toString());
      } catch {}

      setHasUnpublishedChanges(false);
      setPublishSuccess(true);
      setTimeout(() => setPublishSuccess(false), 3000);
    } catch {
      // ignore
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-10">
      {/* Header & Loop summary */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">TV Slideshow Playlist</h1>
          <p className="text-xs text-slate-400">
            Total loop cycle:{" "}
            <strong className="text-emerald-400 font-bold">{loopTimeDisplay}</strong> • {items.filter(i => i.enabled).length} active slides
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold rounded-xl border border-slate-700 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Slide</span>
          </button>

          {hasUnpublishedChanges && (
            <button
              onClick={handlePublish}
              disabled={isPublishing}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 animate-pulse"
            >
              <Send className="w-4 h-4" />
              <span>{isPublishing ? "Publishing..." : "Publish to TV"}</span>
            </button>
          )}
        </div>
      </div>

      {publishSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-2 text-xs text-emerald-400 font-semibold animate-in fade-in shadow-md">
          <CheckCircle2 className="w-4 h-4" />
          <span>✓ TV Playlist updated and broadcast live to Shop TV 1!</span>
        </div>
      )}

      {/* Playlist Items List */}
      <div className="space-y-2.5">
        {items.length === 0 ? (
          <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-3xl">
            <ListOrdered className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-300">No slides in playlist yet</p>
            <p className="text-xs text-slate-500 mt-1 mb-4">Add your promotional offers to the rotation</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-emerald-500 text-slate-950 text-xs font-bold rounded-xl inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Slide</span>
            </button>
          </div>
        ) : (
          items.map((item, index) => {
            const promo = item.promotion;
            const thumb =
              (promo?.media?.thumb_path && !promo.media.thumb_path.includes("photo-1610832958506-aa56368176cf")
                ? promo.media.thumb_path
                : null) ||
              (promo?.media?.storage_path && promo.media.storage_path !== "demo"
                ? promo.media.storage_path
                : null) ||
              (promo?.media_id && (promo.media_id.startsWith("/") || promo.media_id.startsWith("http") || promo.media_id.startsWith("data:"))
                ? promo.media_id
                : null) ||
              promo?.media?.thumb_path ||
              promo?.media_id ||
              "/kathua-fresh-logo.jpg";
            const duration =
              item.duration_override_sec || promo?.duration_sec || 8;

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl bg-slate-900 border transition-all flex flex-col sm:flex-row items-start sm:items-center gap-3 ${
                  item.enabled
                    ? "border-slate-800 hover:border-slate-700"
                    : "border-slate-800/40 opacity-40 bg-slate-950"
                }`}
              >
                {/* Position Badge & Grip */}
                <div className="flex items-center gap-2 text-slate-500 shrink-0">
                  <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 text-xs font-black flex items-center justify-center border border-slate-700">
                    {index + 1}
                  </span>
                </div>

                {/* Thumbnail */}
                <div className="w-16 h-12 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0 relative shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumb}
                    alt={promo?.title || "Slide"}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate">
                    {promo?.title || "Untitled Offer"}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {promo?.price_text && (
                      <span className="text-xs font-black text-amber-300">
                        {promo.price_text}
                      </span>
                    )}
                    <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {duration}s on TV
                    </span>
                  </div>
                </div>

                {/* Duration Changer & Controls */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                  {/* Duration selector */}
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[10px]">
                    {[6, 8, 10, 15].map((sec) => (
                      <button
                        key={sec}
                        onClick={() => changeDuration(index, sec)}
                        className={`px-2 py-1 rounded-lg font-bold transition-all ${
                          duration === sec
                            ? "bg-emerald-500 text-slate-950 shadow-sm"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>

                  {/* Order Up / Down */}
                  <div className="flex items-center gap-1">
                    <button
                      disabled={index === 0}
                      onClick={() => moveItem(index, "up")}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-20 text-slate-300"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      disabled={index === items.length - 1}
                      onClick={() => moveItem(index, "down")}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-20 text-slate-300"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Toggle Active / Skip */}
                  <button
                    onClick={() => toggleItem(index)}
                    className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-all ${
                      item.enabled
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                  >
                    {item.enabled ? "Active" : "Skip"}
                  </button>

                  {/* Delete from playlist */}
                  <button
                    onClick={() => removeItem(item.id)}
                    title="Remove from playlist"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Offer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                <span>Add Offer to TV Playlist</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {availablePromos.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  No offers available. Create an offer in Offers first!
                </p>
              ) : (
                availablePromos.map((promo) => {
                  const isAlreadyIn = items.some((i) => i.promotion_id === promo.id);
                  const thumb =
                    promo.media?.thumb_path ||
                    promo.media?.storage_path ||
                    promo.media_id ||
                    "/kathua-fresh-logo.jpg";

                  return (
                    <div
                      key={promo.id}
                      className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={thumb}
                          alt={promo.title}
                          className="w-12 h-10 rounded-xl object-cover border border-slate-800 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">
                            {promo.title}
                          </div>
                          {promo.price_text && (
                            <div className="text-[11px] font-black text-amber-300">
                              {promo.price_text}
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => addOfferToPlaylist(promo)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                          isAlreadyIn
                            ? "bg-slate-800 text-slate-400 hover:bg-slate-700"
                            : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md"
                        }`}
                      >
                        {isAlreadyIn ? "+ Add Again" : "+ Add to TV"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
