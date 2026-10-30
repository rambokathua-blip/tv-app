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
  const [promotions, setPromotions] = useState<Promotion[]>([
    {
      id: "demo-onion",
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
    {
      id: "demo-apple",
      title: "Kashmiri Royal Apples",
      price_text: "₹120 / kg",
      duration_sec: 10,
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
    {
      id: "demo-tomato",
      title: "Desi Hybrid Tomato",
      price_text: "₹25 / kg",
      duration_sec: 10,
      status: "draft",
      enabled: true,
      created_at: "2026-10-30T00:00:00.000Z",
      updated_at: "2026-10-30T00:00:00.000Z",
      media: {
        id: "m-3",
        kind: "image",
        storage_path: "demo",
        mime: "image/jpeg",
        bytes: 450000,
        sha256: "ghi",
        created_at: "2026-10-30T00:00:00.000Z",
        thumb_path:
          "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?q=80&w=400&auto=format&fit=crop",
      },
    },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Promotion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null);

  // Fetch promotions from API
  const loadPromotions = async () => {
    try {
      const res = await fetch("/api/signage/admin/promotions");
      if (res.ok) {
        const data = await res.json();
        if (data.promotions && data.promotions.length > 0) {
          setPromotions(data.promotions);
        }
      }
    } catch {
      // keep fallback
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
    try {
      await fetch(`/api/signage/admin/promotions/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setPromotions((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
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
            promo.media?.thumb_path ||
            promo.media?.storage_path ||
            "https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=400&auto=format&fit=crop";

          return (
            <div
              key={promo.id}
              className="p-3 rounded-2xl bg-slate-900 border border-slate-800/80 flex items-center gap-3.5 hover:border-slate-700 transition-colors"
            >
              {/* Thumbnail */}
              <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumb}
                  alt={promo.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white truncate">
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
                </div>
              </div>

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
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
              >
                Yes, Remove
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
