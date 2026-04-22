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
} from "lucide-react";

const GRADIENTS = [
  "from-blue-600 to-cyan-500",
  "from-purple-600 to-pink-500",
  "from-amber-600 to-orange-500",
  "from-emerald-600 to-teal-500",
  "from-rose-600 to-red-500",
  "from-indigo-600 to-violet-500",
];

export default function ThemesPage() {
  const categories = useQuery(api.categories.listWithDetails);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              Themes &amp; Problem Domains
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Pick a theme to explore and build ideas around
            </p>
          </div>
          <Link href="/product/ideas">
            <Button variant="outline">
              <List className="h-4 w-4 mr-2" />
              All Ideas
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
          <div className="rounded-full bg-primary/10 p-2 shrink-0">
            <Lightbulb className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">1. Pick a Theme</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose a problem domain that interests you
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
          <div className="rounded-full bg-primary/10 p-2 shrink-0">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">2. Share or Join an Idea</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Create your own idea or browse existing ones
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
          <div className="rounded-full bg-primary/10 p-2 shrink-0">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">3. Build a Team</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Collaborate and bring the idea to life
            </p>
          </div>
        </div>
      </div>

      {categories === undefined ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[3/2] rounded-xl bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-4">🏷️</div>
          <p className="text-lg font-medium mb-2">No themes yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            An admin needs to add themes before ideas can be created.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map((cat, i) => {
            const gradient = GRADIENTS[i % GRADIENTS.length];
            return (
              <Link
                key={cat._id}
                href={`/product/categories/${cat.slug}`}
                className={`animate-fade-in stagger-${Math.min(i + 1, 9)} group relative aspect-[3/2] rounded-xl overflow-hidden block`}
              >
                {cat.imageUrl ? (
                  <img
                    src={cat.imageUrl}
                    alt={cat.name}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${gradient}`}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute inset-0 flex flex-col justify-end p-5">
                  <h2 className="font-semibold text-lg text-white drop-shadow-md">
                    {cat.name}
                  </h2>
                  {cat.description && (
                    <p className="text-sm text-white/80 mt-1 line-clamp-2">
                      {cat.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <span className="inline-flex items-center gap-1 text-xs text-white/70">
                      {cat.ideaCount === 0 ? (
                        <>
                          <Rocket className="h-3 w-3" />
                          Be the first!
                        </>
                      ) : (
                        <>
                          <Lightbulb className="h-3 w-3" />
                          {cat.ideaCount}{" "}
                          {cat.ideaCount === 1 ? "idea" : "ideas"}
                        </>
                      )}
                    </span>
                    <ArrowRight className="h-4 w-4 text-white/60 group-hover:translate-x-1 group-hover:text-white transition-all" />
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
