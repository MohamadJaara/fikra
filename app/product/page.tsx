"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import Link from "next/link";
import {
  Lightbulb,
  ArrowRight,
  List,
  Rocket,
} from "lucide-react";

const THEME_PALETTES = [
  { bg: "bg-[#0a0f1a]", accent: "bg-cyan-400", text: "text-cyan-400" },
  { bg: "bg-[#1a0a1f]", accent: "bg-fuchsia-400", text: "text-fuchsia-400" },
  { bg: "bg-[#1a1205]", accent: "bg-amber-400", text: "text-amber-400" },
  { bg: "bg-[#061a12]", accent: "bg-emerald-400", text: "text-emerald-400" },
  { bg: "bg-[#1a0b0b]", accent: "bg-rose-400", text: "text-rose-400" },
  { bg: "bg-[#0e0a1a]", accent: "bg-violet-400", text: "text-violet-400" },
  { bg: "bg-[#0a161a]", accent: "bg-teal-400", text: "text-teal-400" },
  { bg: "bg-[#1a150a]", accent: "bg-yellow-400", text: "text-yellow-400" },
];

const ORNAMENT_PATTERNS = [
  "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.03) 0%, transparent 50%)",
  "radial-gradient(circle at 80% 30%, rgba(255,255,255,0.04) 0%, transparent 40%)",
  "radial-gradient(circle at 50% 80%, rgba(255,255,255,0.03) 0%, transparent 50%)",
  "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.05) 0%, transparent 40%)",
  "radial-gradient(circle at 70% 70%, rgba(255,255,255,0.03) 0%, transparent 45%)",
  "radial-gradient(circle at 10% 90%, rgba(255,255,255,0.04) 0%, transparent 50%)",
  "radial-gradient(circle at 90% 10%, rgba(255,255,255,0.03) 0%, transparent 45%)",
  "radial-gradient(circle at 60% 40%, rgba(255,255,255,0.04) 0%, transparent 50%)",
];

export default function ThemesPage() {
  const categories = useQuery(api.categories.listWithDetails);

  return (
    <div className="min-h-screen">
      <div className="px-6 md:px-10 pt-8 pb-5 max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-2 animate-reveal-up">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Themes
            </h1>
            <div className="h-[2px] w-16 bg-foreground/20 mt-3 animate-line-grow" />
          </div>
          <Link href="/product/ideas">
            <Button
              variant="outline"
              className="gap-2 text-xs tracking-wider uppercase rounded-none"
            >
              <List className="h-3.5 w-3.5" />
              All Ideas
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-6 mt-5 mb-2 animate-reveal-up stagger-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full border border-foreground/15 flex items-center justify-center text-[9px] font-mono text-foreground/40">
              1
            </div>
            <span className="text-[11px] tracking-wide text-foreground/50 uppercase">
              Pick a Theme
            </span>
          </div>
          <div className="h-px flex-1 bg-foreground/5" />
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full border border-foreground/15 flex items-center justify-center text-[9px] font-mono text-foreground/40">
              2
            </div>
            <span className="text-[11px] tracking-wide text-foreground/50 uppercase">
              Share or Join
            </span>
          </div>
          <div className="h-px flex-1 bg-foreground/5" />
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full border border-foreground/15 flex items-center justify-center text-[9px] font-mono text-foreground/40">
              3
            </div>
            <span className="text-[11px] tracking-wide text-foreground/50 uppercase">
              Build a Team
            </span>
          </div>
        </div>
      </div>

      {categories === undefined ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-foreground/5 mx-4 md:mx-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[16/10] bg-muted/20 animate-pulse"
            />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-32">
          <div className="text-5xl mb-6 animate-float">🏷️</div>
          <p className="text-2xl font-bold mb-2">No themes yet</p>
          <p className="text-sm text-muted-foreground">
            An admin needs to add themes before ideas can be created.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-foreground/[0.06] mx-4 md:mx-8">
          {categories.map((cat, i) => {
            const palette = THEME_PALETTES[i % THEME_PALETTES.length];
            const pattern = ORNAMENT_PATTERNS[i % ORNAMENT_PATTERNS.length];

            return (
              <Link
                key={cat._id}
                href={`/product/categories/${cat.slug}`}
                className={`group relative block animate-scale-reveal stagger-${Math.min(i + 1, 9)}`}
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  {cat.imageUrl ? (
                    <>
                      <img
                        src={cat.imageUrl}
                        alt={cat.name}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20 group-hover:from-black/70 group-hover:via-black/30 transition-colors duration-500" />
                    </>
                  ) : (
                    <div
                      className={`absolute inset-0 ${palette.bg} transition-all duration-700 group-hover:brightness-125`}
                      style={{ backgroundImage: pattern }}
                    />
                  )}

                  <div className="absolute top-6 right-6 font-mono text-white/[0.06] text-[8rem] leading-none pointer-events-none select-none transition-all duration-700 group-hover:text-white/[0.1]">
                    {String(i + 1).padStart(2, "0")}
                  </div>

                  <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-10">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="font-mono text-[12px] tracking-[0.2em] text-white/40 uppercase">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="h-px w-8 bg-white/15" />
                      <span
                        className={`inline-flex items-center gap-1.5 text-[12px] font-mono ${cat.imageUrl ? "text-white/60" : palette.text}`}
                      >
                        {cat.ideaCount === 0 ? (
                          <>
                            <Rocket className="h-3.5 w-3.5" />
                            Be the first
                          </>
                        ) : (
                          <>
                            <Lightbulb className="h-3.5 w-3.5" />
                            {cat.ideaCount}{" "}
                            {cat.ideaCount === 1 ? "idea" : "ideas"}
                          </>
                        )}
                      </span>
                    </div>

                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-[1.1] mb-2 transition-transform duration-500 group-hover:-translate-y-1">
                      {cat.name}
                    </h2>

                    <div
                      className={`h-[2px] w-8 group-hover:w-20 transition-all duration-700 ease-out ${cat.imageUrl ? "bg-white/30" : palette.accent}`}
                    />

                    {cat.description && (
                      <p className="text-[15px] md:text-base text-white/60 mt-4 max-w-lg leading-relaxed">
                        {cat.description}
                      </p>
                    )}

                    <div className="mt-5 flex items-center gap-2 text-white/50 group-hover:text-white/80 transition-colors duration-500">
                      <span className="text-[12px] tracking-[0.2em] uppercase font-mono">
                        Explore
                      </span>
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-2" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
