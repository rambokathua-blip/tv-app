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
} from "lucide-react";
import type { PlaylistItem } from "@/lib/signage/types";

export default function PlaylistPage() {
  const [items, setItems] = useState<PlaylistItem[]>([
    {
      id: "pl-1",
      playlist_id: "default",
      promotion_id: "p-1",
      position: 1,
      duration_override_sec: null,
      enabled: true,
      promotion: {
        id: "p-1",
        title: "Fresh Nashik Onion",
        price_text: "₹38 / kg",
        duration_sec: 10,
        status: "live",
        enabled: true,
        created_at: "2026-10-30T00:00:00.000Z",
        updated_at: "2026-10-30T00:00:00.000Z",
        media: {
          id: "m-1",
          kind: "image",
          storage_path: "demo",
          mime: "image/jpeg",
          bytes: 400000,
          sha256: "abc",
          created_at: "2026-10-30T00:00:00.000Z",
          thumb_path:
            "https://images.unsplash.com/photo-1508747703725-719777637510?q=80&w=400&auto=format&fit=crop",
        },
      },
    },
    {
      id: "pl-2",
      playlist_id: "default",
      promotion_id: "p-2",
      position: 2,
      duration_override_sec: null,
      enabled: true,
      promotion: {
        id: "p-2",
        title: "Kashmiri Royal Apples",
        price_text: "₹120 / kg",
        duration_sec: 12,
        status: "live",
        enabled: true,
        created_at: "2026-10-30T00:00:00.000Z",
        updated_at: "2026-10-30T00:00:00.000Z",
        media: {
          id: "m-2",
          kind: "image",
          storage_path: "demo",
          mime: "image/jpeg",
          bytes: 500000,
          sha256: "def",
          created_at: "2026-10-30T00:00:00.000Z",
          thumb_path:
            "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?q=80&w=400&auto=format&fit=crop",
        },
      },
    },
  ]);

  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);

  // Load playlist items
  useEffect(() => {
    async function loadPlaylist() {
      try {
        const res = await fetch("/api/signage/admin/playlist");
        if (res.ok) {
          const data = await res.json();
          if (data.items && data.items.length > 0) {
            setItems(data.items);
          }
        }
      } catch {
        // use fallback
      }
    }
    loadPlaylist();
  }, []);

  // Calculate total loop duration
  const totalSeconds = items
    .filter((i) => i.enabled)
    .reduce((acc, curr) => {
      const duration =
        curr.duration_override_sec || curr.promotion?.duration_sec || 10;
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

    // re-assign positions
    const updated = newItems.map((item, idx) => ({
      ...item,
      position: idx + 1,
    }));
    setItems(updated);
    setHasUnpublishedChanges(true);

    // Call reorder API in background
    fetch("/api/signage/admin/playlist/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: updated.map((it) => ({ id: it.id, position: it.position })),
      }),
    }).catch(console.error);
  };

  const toggleItem = (index: number) => {
    const updated = [...items];
    updated[index].enabled = !updated[index].enabled;
    setItems(updated);
    setHasUnpublishedChanges(true);
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const res = await fetch("/api/signage/admin/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: "Updated playlist order and timings",
        }),
      });
      if (res.ok) {
        setHasUnpublishedChanges(false);
        setPublishSuccess(true);
        setTimeout(() => setPublishSuccess(false), 3000);
      }
    } catch {
      // ignore
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Loop summary */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">TV Playlist</h1>
          <p className="text-xs text-slate-400">
            Total loop time:{" "}
            <strong className="text-emerald-400">{loopTimeDisplay}</strong>
          </p>
        </div>

        {hasUnpublishedChanges && (
          <button
            onClick={handlePublish}
            disabled={isPublishing}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 animate-pulse"
          >
            <Send className="w-4 h-4" />
            <span>{isPublishing ? "Publishing..." : "Publish Changes"}</span>
          </button>
        )}
      </div>

      {publishSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-2 text-xs text-emerald-400 font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>Playlist published to Shop TV 1 successfully!</span>
        </div>
      )}

      {/* Playlist Items List */}
      <div className="space-y-2.5">
        {items.map((item, index) => {
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
            item.duration_override_sec || promo?.duration_sec || 10;

          return (
            <div
              key={item.id}
              className={`p-3 rounded-2xl bg-slate-900 border transition-colors flex items-center gap-3 ${
                item.enabled
                  ? "border-slate-800 hover:border-slate-700"
                  : "border-slate-800/40 opacity-50"
              }`}
            >
              {/* Position Badge & Grip */}
              <div className="flex items-center gap-1.5 text-slate-500">
                <GripVertical className="w-4 h-4" />
                <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center">
                  {index + 1}
                </span>
              </div>

              {/* Thumbnail */}
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0">
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
                <div className="flex items-center gap-2 mt-1">
                  {promo?.price_text && (
                    <span className="text-xs font-black text-amber-400">
                      {promo.price_text}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {duration}s
                  </span>
                </div>
              </div>

              {/* Order buttons & Toggle */}
              <div className="flex items-center gap-1">
                <button
                  disabled={index === 0}
                  onClick={() => moveItem(index, "up")}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  disabled={index === items.length - 1}
                  onClick={() => moveItem(index, "down")}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleItem(index)}
                  className={`ml-1 text-[11px] font-bold px-2 py-1 rounded-lg border ${
                    item.enabled
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}
                >
                  {item.enabled ? "Active" : "Skip"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
