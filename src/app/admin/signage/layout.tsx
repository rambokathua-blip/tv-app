"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Tag,
  ListOrdered,
  Mic,
  MoreHorizontal,
  Plus,
  Tv,
} from "lucide-react";
import NewOfferModal from "@/components/signage/NewOfferModal";

export default function AdminSignageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [showNewOffer, setShowNewOffer] = useState(false);

  const navItems = [
    { label: "Home", href: "/admin/signage", icon: Home },
    { label: "Offers", href: "/admin/signage/offers", icon: Tag },
    { label: "Playlist", href: "/admin/signage/playlist", icon: ListOrdered },
    { label: "Voice", href: "/admin/signage/voice", icon: Mic },
    { label: "More", href: "/admin/signage/more", icon: MoreHorizontal },
  ];

  const isHomeOrOffers =
    pathname === "/admin/signage" || pathname === "/admin/signage/offers";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white pb-24">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center font-black text-slate-950 text-base shadow-lg shadow-emerald-500/20">
            KF
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white leading-none">
              Kathua Fresh TV
            </h1>
            <p className="text-xs text-emerald-400 font-medium mt-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Shop Display Manager
            </p>
          </div>
        </div>

        <Link
          href="/tv?preview=true"
          target="_blank"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
        >
          <Tv className="w-3.5 h-3.5 text-emerald-400" />
          <span>TV View</span>
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 sm:p-5">
        {children}
      </main>

      {/* Floating Action Button (+ New Offer) on Home & Offers */}
      {isHomeOrOffers && (
        <button
          onClick={() => setShowNewOffer(true)}
          className="fixed bottom-20 right-5 z-40 flex items-center gap-2 px-5 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-full shadow-xl shadow-emerald-500/30 transition-transform active:scale-95"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span className="text-sm">New Offer</span>
        </button>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 max-w-xl mx-auto">
        <div className="flex items-center justify-around py-2 px-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/admin/signage"
                ? pathname === "/admin/signage"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl transition-all ${
                  isActive
                    ? "text-emerald-400 font-semibold"
                    : "text-slate-400 hover:text-slate-200 font-medium"
                }`}
              >
                <div
                  className={`p-1 rounded-lg transition-colors ${
                    isActive ? "bg-emerald-500/15" : ""
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] mt-0.5 tracking-tight">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* New Offer Modal */}
      {showNewOffer && (
        <NewOfferModal
          isOpen={showNewOffer}
          onClose={() => setShowNewOffer(false)}
          onCreated={() => {
            setShowNewOffer(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
