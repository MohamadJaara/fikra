"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import Link from "next/link";
import {
  Lightbulb,
  ArrowRight,
  PlusCircle,
  Sparkles,
  List,
  Users,
  Rocket,
  Zap,
} from "lucide-react";

const GRADIENTS = [
  "from-blue-500/20 to-cyan-500/20",
  "from-purple-500/20 to-pink-500/20",
  "from-amber-500/20 to-orange-500/20",
  "from-emerald-500/20 to-teal-500/20",
  "from-rose-500/20 to-red-500/20",
  "from-indigo-500/20 to-violet-500/20",
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-56 rounded-xl bg-muted/40 animate-pulse"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map((cat, i) => {
            const gradient = GRADIENTS[i % GRADIENTS.length];
            return (
              <Link
                key={cat._id}
                href={`/product/categories/${cat.slug}`}
                className={`animate-fade-in stagger-${Math.min(i + 1, 9)}`}
              >
                <Card className="group h-full hover:shadow-md transition-all duration-200 hover:border-primary/30 overflow-hidden">
                  <div className="h-36 w-full overflow-hidden bg-muted relative">
                    {cat.imageUrl ? (
                      <img
                        src={cat.imageUrl}
                        alt={cat.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div
                        className={`h-full w-full bg-gradient-to-br ${gradient} flex items-center justify-center`}
                      >
                        <Lightbulb className="h-10 w-10 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h2 className="font-semibold text-base truncate">
                          {cat.name}
                        </h2>
                        {cat.description ? (
                          <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">
                            {cat.description}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground/60 mt-1.5 italic">
                            No description yet
                          </p>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      {cat.ideaCount === 0 ? (
                        <Badge
                          variant="outline"
                          className="text-xs text-primary border-primary/30"
                        >
                          <Rocket className="h-3 w-3 mr-1" />
                          Be the first!
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          {cat.ideaCount}{" "}
                          {cat.ideaCount === 1 ? "idea" : "ideas"}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
