"use client";

import React, { useState, useEffect } from "react";
import {
  Tag,
  Plus,
  Trash2,
  Pause,
  Play,
  Clock,
  MoreVertical,
  CheckCircle2,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import type { Promotion, PromotionStatus } from "@/lib/signage/types";
import NewOfferModal from "@/components/signage/NewOfferModal";
import EditOfferModal from "@/components/signage/EditOfferModal";

export default function OffersManagePage() {
  const [filter, setFilter] = useState<string>("all");
  const [promotions, setPromotions] = useState<Promotion[]>(() => {
    // Restore from localStorage first so uploaded images survive refresh
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("kathua_signage_promotions");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {}
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Promotion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch promotions from API — always preserve local image and update localStorage with server truth
  const loadPromotions = async () => {
    try {
      const res = await fetch("/api/signage/admin/promotions");
      if (res.ok) {
        const data = await res.json();
        if (data.promotions && data.promotions.length > 0) {
          // Merge with localStorage to guarantee images and newly created offers are NEVER lost on refresh
          let cachedList: Promotion[] = [];
          try {
            const cached = localStorage.getItem("kathua_signage_promotions");
            if (cached) cachedList = JSON.parse(cached);
          } catch {}

          const serverIds = new Set(data.promotions.map((p: Promotion) => p.id));
          // Keep all locally created promotions that haven't been confirmed by the server yet
          const localOnly = cachedList.filter((c) => !serverIds.has(c.id));

          const serverEnriched = data.promotions.map((p: Promotion) => {
            const fromCache = cachedList.find((c) => c.id === p.id);
            const hasRealImage =
              p.media_id &&
              p.media_id !== "/kathua-fresh-logo.jpg" &&
              (p.media_id.startsWith("data:") || p.media_id.startsWith("http") || p.media_id.startsWith("/"));

            if (!hasRealImage) {
              if (fromCache?.media_id && fromCache.media_id !== "/kathua-fresh-logo.jpg") {
                return {
                  ...p,
                  media_id: fromCache.media_id,
                  media: fromCache.media || {
                    id: fromCache.media_id,
                    storage_path: fromCache.media_id,
                    thumb_path: fromCache.media_id,
                  },
                };
              }
            }
            return p;
          });

          const merged = [...localOnly, ...serverEnriched];
          setPromotions(merged);
          try {
            localStorage.setItem("kathua_signage_promotions", JSON.stringify(merged));
          } catch {}

          // Background sync any local-only promotions to server so other devices get them
          if (localOnly.length > 0) {
            localOnly.forEach((lo) => {
              fetch("/api/signage/admin/promotions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: lo.title,
                  price_text: lo.price_text,
                  media_id: lo.media_id,
                  duration_sec: lo.duration_sec,
                  status: lo.status,
                  enabled: lo.enabled,
                }),
              }).catch(() => {});
            });
          }
        }
      }
    } catch {
      // keep fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPromotions();
  }, []);

  const handleToggle = async (promo: Promotion) => {
    const updatedStatus: PromotionStatus =
      promo.status === "paused" ? "live" : "paused";
    const nextList = promotions.map((p) =>
      p.id === promo.id
        ? { ...p, status: updatedStatus, enabled: updatedStatus === "live" }
        : p
    );
    setPromotions(nextList);
    try {
      localStorage.setItem("kathua_signage_promotions", JSON.stringify(nextList));
    } catch {}

    try {
      const syncChannel = new BroadcastChannel("kathua_tv_sync");
      syncChannel.postMessage({ type: "TV_SYNC", timestamp: Date.now() });
      syncChannel.close();
    } catch {}
    try {
      localStorage.setItem("signage_force_refresh", Date.now().toString());
    } catch {}

    try {
      await fetch(`/api/signage/admin/promotions/${promo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: updatedStatus,
          enabled: updatedStatus === "live",
        }),
      });
    } catch {
      // ignore
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    const targetTitle = deleteTarget.title;

    // 1. Instant optimistic UI removal (0ms latency!)
    setPromotions((prev) => {
      const next = prev.filter((p) => p.id !== targetId);
      try {
        localStorage.setItem("kathua_signage_promotions", JSON.stringify(next));
      } catch {}
      return next;
    });
    setDeleteTarget(null);
    setToastMessage(`✓ "${targetTitle}" deleted successfully`);
    setTimeout(() => setToastMessage(null), 3000);

    // 2. Real-time broadcast to TV
    try {
      const syncChannel = new BroadcastChannel("kathua_tv_sync");
      syncChannel.postMessage({ type: "TV_SYNC", timestamp: Date.now() });
      syncChannel.close();
      localStorage.setItem("signage_force_refresh", Date.now().toString());
    } catch {}

    // 3. Network delete in background
    try {
      await fetch(`/api/signage/admin/promotions/${targetId}`, {
        method: "DELETE",
      });
    } catch {
      // ignore
    }
  };

  const filtered = promotions.filter((p) => {
    if (filter === "all") return true;
    return p.status === filter;
  });

  const filterTabs = [
    { label: "All", value: "all" },
    { label: "Live", value: "live" },
    { label: "Draft", value: "draft" },
    { label: "Paused", value: "paused" },
    { label: "Expired", value: "expired" },
  ];

  return (
    <div className="space-y-4">
      {/* Title & Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Manage Offers</h1>
          <p className="text-xs text-slate-400">
            {promotions.length} total offers configured
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition-transform active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Offer</span>
        </button>
      </div>

      {toastMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-2 text-xs text-emerald-400 font-semibold animate-in fade-in shadow-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Filter Chips (PRD 9.3) */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              filter === tab.value
                ? "bg-emerald-500 text-slate-950 font-bold"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Promotions List */}
      <div className="space-y-3">
        {filtered.map((promo) => {
          const thumb =
            (promo.media_id && (promo.media_id.startsWith("/") || promo.media_id.startsWith("http") || promo.media_id.startsWith("data:"))
              ? promo.media_id
              : null) ||
            (promo.media?.thumb_path && !promo.media.thumb_path.includes("photo-1610832958506-aa56368176cf")
              ? promo.media.thumb_path
              : null) ||
            (promo.media?.storage_path && promo.media.storage_path !== "demo"
              ? promo.media.storage_path
              : null) ||
            promo.media?.thumb_path ||
            promo.media_id ||
            "/kathua-fresh-logo.jpg";

          return (
            <div
              key={promo.id}
              className="p-3 rounded-2xl bg-slate-900 border border-slate-800/80 flex items-center gap-3.5 hover:border-slate-700 transition-colors"
            >
              {/* Thumbnail with quick change image trigger */}
              <button
                type="button"
                onClick={() => setEditTarget(promo)}
                className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0 text-left group/thumb"
                title="Tap to change picture or details"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumb}
                  alt={promo.title}
                  className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 sm:flex hidden items-center justify-center transition-opacity">
                  <Pencil className="w-4 h-4 text-white" />
                </div>
              </button>

              {/* Details (clickable to edit) */}
              <button
                type="button"
                onClick={() => setEditTarget(promo)}
                className="flex-1 min-w-0 text-left"
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white truncate hover:text-emerald-400 transition-colors">
                    {promo.title}
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 ${
                      promo.status === "live"
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : promo.status === "draft"
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        : "bg-slate-800 text-slate-400 border border-slate-700"
                    }`}
                  >
                    {promo.status}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  {promo.price_text && (
                    <span className="text-xs font-extrabold text-amber-400">
                      {promo.price_text}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {promo.duration_sec}s
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold underline sm:hidden">
                    Tap to edit
                  </span>
                </div>
              </button>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setEditTarget(promo)}
                  title="Edit offer"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  <Pencil className="w-4 h-4 text-emerald-400" />
                </button>

                <button
                  onClick={() => handleToggle(promo)}
                  title={promo.status === "paused" ? "Resume" : "Pause"}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  {promo.status === "paused" ? (
                    <Play className="w-4 h-4 fill-current text-emerald-400" />
                  ) : (
                    <Pause className="w-4 h-4 text-amber-400" />
                  )}
                </button>

                <button
                  onClick={() => setDeleteTarget(promo)}
                  title="Delete offer"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="p-8 text-center bg-slate-900/50 border border-slate-800/80 rounded-2xl">
            <Tag className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <div className="text-sm font-semibold text-slate-300">
              No offers found
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Add your first offer or adjust the filter above.
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Sheet (PRD US-06) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-2.5 text-red-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>Remove this offer?</span>
            </div>
            <p className="text-xs text-slate-300">
              This will remove <strong>&quot;{deleteTarget.title}&quot;</strong> from
              the TV playlist on next sync. The image file is preserved.
            </p>
            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs font-bold shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Yes, Remove Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Offer Modal */}
      {editTarget && (
        <EditOfferModal
          promo={editTarget}
          isOpen={Boolean(editTarget)}
          onClose={() => setEditTarget(null)}
          onUpdated={() => {
            setEditTarget(null);
            loadPromotions();
          }}
        />
      )}

      {/* New Offer Modal */}
      {showModal && (
        <NewOfferModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            loadPromotions();
          }}
        />
      )}
    </div>
  );
}
