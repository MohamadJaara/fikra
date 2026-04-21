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
} from "lucide-react";

export default function ThemesPage() {
  const categories = useQuery(api.categories.listWithDetails);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2 mb-8">
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
          {categories.map((cat, i) => (
            <Link
              key={cat._id}
              href={`/product/categories/${cat.slug}`}
              className={`animate-fade-in stagger-${Math.min(i + 1, 9)}`}
            >
              <Card className="group h-full hover:shadow-md transition-all duration-200 hover:border-primary/30 overflow-hidden">
                {cat.imageUrl && (
                  <div className="h-36 w-full overflow-hidden bg-muted">
                    <img
                      src={cat.imageUrl}
                      alt={cat.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                )}
                <CardContent
                  className={`p-5 ${!cat.imageUrl ? "pt-5" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-base flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-yellow-500 shrink-0" />
                        <span className="truncate">{cat.name}</span>
                      </h2>
                      {cat.description && (
                        <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">
                          {cat.description}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Badge variant="secondary" className="text-xs">
                      {cat.ideaCount} {cat.ideaCount === 1 ? "idea" : "ideas"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
