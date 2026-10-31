"use client";

import React from "react";
import Link from "next/link";
import {
  QrCode,
  Tv,
  Palette,
  Eye,
  Sliders,
  ChevronRight,
  ShieldCheck,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

interface MenuItem {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  external?: boolean;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export default function SignageMoreMenuPage() {
  const menuSections: MenuSection[] = [
    {
      title: "Display & Connectivity",
      items: [
        {
          title: "TV Devices & Pairing",
          description: "Pair new Smart TV, check online status, storage, and signal",
          href: "/admin/signage/more/devices",
          icon: Tv,
          badge: "1 Active",
        },
        {
          title: "QR Codes & Links",
          description: "Manage WhatsApp Channel, Instagram, and custom TV scan codes",
          href: "/admin/signage/more/qr",
          icon: QrCode,
          badge: "2 Live",
        },
        {
          title: "Live TV Fullscreen Preview",
          description: "View the exact 1920x1080 player layout in new tab",
          href: "/tv",
          icon: Eye,
          external: true,
        },
        {
          title: "Download Android TV App (APK)",
          description: "Download the standalone APK installer for Xiaomi MiTV or Android devices",
          href: "/KathuaFreshTV.apk",
          icon: Tv,
          badge: "APK v1.0.0",
          external: true,
        },
      ],
    },
    {
      title: "Store & Brand Configuration",
      items: [
        {
          title: "Branding & Layout Settings",
          description: "Store website, bottom ticker text, tagline, layout theme",
          href: "/admin/signage/more/settings",
          icon: Palette,
        },
      ],
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-white">More Settings</h1>
        <p className="text-xs text-slate-400">
          Advanced controls for Kathua Fresh TV displays
        </p>
      </div>

      <div className="space-y-4">
        {menuSections.map((section) => (
          <div key={section.title} className="space-y-2">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
              {section.title}
            </h2>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden divide-y divide-slate-800/80">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    target={item.external ? "_blank" : undefined}
                    className="p-4 flex items-center justify-between hover:bg-slate-800/60 transition-colors group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          <span>{item.title}</span>
                          {item.badge && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Safety & Isolation Note */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-400 leading-relaxed">
          <strong>Isolated System:</strong> All signage data runs on independent{" "}
          <code className="text-emerald-400">signage_*</code> tables and does not
          touch live e-commerce shop tables or customer orders.
        </div>
      </div>
    </div>
  );
}
