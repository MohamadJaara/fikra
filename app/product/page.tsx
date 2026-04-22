"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import Link from "next/link";
import {
  Lightbulb,
  ArrowRight,
  Sparkles,
  List,
  Users,
  Rocket,
  Zap,
  ArrowDown,
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
      <div className="px-6 md:px-10 pt-8 pb-6 max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-2 animate-reveal-up">
          <div>
            <h1
              className="text-4xl md:text-5xl tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
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

        <div className="grid grid-cols-3 gap-0 mt-6 mb-4 animate-reveal-up stagger-2">
          <div className="flex items-center gap-3 px-4 py-3 border border-foreground/5">
            <div className="w-6 h-6 rounded-full border border-foreground/20 flex items-center justify-center text-[10px] font-mono text-foreground/40">
              1
            </div>
            <span className="text-xs tracking-wide text-foreground/60 uppercase">
              Pick a Theme
            </span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 border border-foreground/5">
            <div className="w-6 h-6 rounded-full border border-foreground/20 flex items-center justify-center text-[10px] font-mono text-foreground/40">
              2
            </div>
            <span className="text-xs tracking-wide text-foreground/60 uppercase">
              Share or Join
            </span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 border border-foreground/5">
            <div className="w-6 h-6 rounded-full border border-foreground/20 flex items-center justify-center text-[10px] font-mono text-foreground/40">
              3
            </div>
            <span className="text-xs tracking-wide text-foreground/60 uppercase">
              Build a Team
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-foreground/30 animate-reveal-up stagger-3">
          <ArrowDown className="h-3 w-3 animate-float" />
          <span className="text-[10px] tracking-[0.2em] uppercase font-mono">
            Scroll to explore
          </span>
        </div>
      </div>

      {categories === undefined ? (
        <div className="space-y-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[45vh] bg-muted/20 animate-pulse"
            />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-32">
          <div className="text-5xl mb-6 animate-float">🏷️</div>
          <p
            className="text-2xl mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            No themes yet
          </p>
          <p className="text-sm text-muted-foreground">
            An admin needs to add themes before ideas can be created.
          </p>
        </div>
      ) : (
        <div>
          {categories.map((cat, i) => {
            const palette = THEME_PALETTES[i % THEME_PALETTES.length];
            const pattern = ORNAMENT_PATTERNS[i % ORNAMENT_PATTERNS.length];
            const isEven = i % 2 === 0;

            return (
              <Link
                key={cat._id}
                href={`/product/categories/${cat.slug}`}
                className={`group block animate-scale-reveal stagger-${Math.min(i + 1, 9)}`}
              >
                <div
                  className={`relative overflow-hidden transition-all duration-700 ease-out ${isEven ? "md:pr-[45%]" : "md:pl-[45%]"}`}
                >
                  {cat.imageUrl ? (
                    <div className="absolute inset-0">
                      <img
                        src={cat.imageUrl}
                        alt={cat.name}
                        className="h-full w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/60 group-hover:bg-black/50 transition-colors duration-700" />
                    </div>
                  ) : (
                    <div
                      className={`absolute inset-0 ${palette.bg} transition-all duration-700 group-hover:brightness-125`}
                      style={{ backgroundImage: pattern }}
                    />
                  )}

                  <div
                    className={`absolute top-1/2 -translate-y-1/2 ${isEven ? "right-0 md:right-[8%]" : "left-0 md:left-[8%]"} hidden md:block`}
                  >
                    <span
                      className="text-[20vw] leading-none text-white/[0.03] block transition-transform duration-700 group-hover:scale-110 group-hover:text-white/[0.06]"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <div
                    className={`relative z-10 flex items-center min-h-[45vh] md:min-h-[50vh] px-8 md:px-16 py-12 ${isEven ? "md:justify-start" : "md:justify-end"}`}
                  >
                    <div
                      className={`max-w-xl ${isEven ? "md:text-left" : "md:text-left"}`}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <span className="font-mono text-[11px] tracking-[0.15em] text-white/30 uppercase">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="h-px w-8 bg-white/10" />
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] font-mono ${cat.imageUrl ? "text-white/50" : palette.text}`}
                        >
                          {cat.ideaCount === 0 ? (
                            <>
                              <Rocket className="h-3 w-3" />
                              Be the first
                            </>
                          ) : (
                            <>
                              <Lightbulb className="h-3 w-3" />
                              {cat.ideaCount}{" "}
                              {cat.ideaCount === 1 ? "idea" : "ideas"}
                            </>
                          )}
                        </span>
                      </div>

                      <h2
                        className="text-3xl md:text-5xl lg:text-6xl text-white mb-3 transition-transform duration-500 group-hover:-translate-y-1"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {cat.name}
                      </h2>

                      <div
                        className={`h-[1px] w-0 group-hover:w-16 transition-all duration-700 ${cat.imageUrl ? "bg-white/30" : palette.accent}`}
                      />

                      {cat.description && (
                        <p className="text-sm md:text-base text-white/50 mt-4 max-w-md leading-relaxed">
                          {cat.description}
                        </p>
                      )}

                      <div className="mt-6 flex items-center gap-2 text-white/40 group-hover:text-white/70 transition-colors duration-500">
                        <span className="text-xs tracking-[0.15em] uppercase font-mono">
                          Explore
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-2" />
                      </div>
                    </div>
                  </div>

                  <div
                    className={`absolute bottom-0 ${isEven ? "right-0 md:right-[8%]" : "left-0 md:left-[8%]"} mb-8`}
                  >
                    <div
                      className={`h-[2px] w-0 group-hover:w-24 transition-all duration-700 ${cat.imageUrl ? "bg-white/20" : palette.accent}`}
                    />
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
