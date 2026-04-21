"use client";

import { IdeaCard } from "@/components/IdeaCard";
import { IdeaCardSkeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  PlusCircle,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import type { IdeaListItem } from "@/lib/types";

export default function CategoryDetailPage() {
  const params = useParams<{ slug: string }>();
  const category = useQuery(api.categories.getBySlug, { slug: params.slug });
  const ideas = useQuery(
    api.ideas.listByCategory,
    category?._id ? { categoryId: category._id } : "skip",
  ) as IdeaListItem[] | undefined;

  if (category === undefined) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="h-8 w-48 bg-muted/40 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <IdeaCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (category === null) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto text-center py-20">
        <div className="text-4xl mb-4">🔍</div>
        <p className="text-lg font-medium mb-2">Theme not found</p>
        <p className="text-sm text-muted-foreground mb-4">
          This theme doesn&apos;t exist or has been removed.
        </p>
        <Link href="/product">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Themes
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <Link
        href="/product"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        All Themes
      </Link>

      <div className="flex flex-col md:flex-row md:items-start gap-5 mb-8">
        {category.imageUrl && (
          <div className="w-full md:w-64 h-40 md:h-36 rounded-lg overflow-hidden bg-muted shrink-0">
            <img
              src={category.imageUrl}
              alt={category.name}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                {category.name}
              </h1>
              {category.description && (
                <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
                  {category.description}
                </p>
              )}
              <Badge variant="secondary" className="mt-2">
                <Sparkles className="h-3 w-3 mr-1" />
                {ideas ? ideas.length : "..."}{" "}
                {ideas?.length === 1 ? "idea" : "ideas"}
              </Badge>
            </div>
            <Link
              href={`/product/ideas/new?categoryId=${category._id}`}
            >
              <Button>
                <PlusCircle className="h-4 w-4 mr-2" />
                New Idea
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {ideas === undefined ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <IdeaCardSkeleton key={i} />
          ))}
        </div>
      ) : ideas.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">💡</div>
          <p className="text-lg font-medium mb-2">No ideas yet in this theme</p>
          <p className="text-sm text-muted-foreground mb-4">
            Be the first to create an idea for {category.name}!
          </p>
          <Link
            href={`/product/ideas/new?categoryId=${category._id}`}
          >
            <Button>
              <PlusCircle className="h-4 w-4 mr-2" />
              Create the First Idea
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ideas.map((idea, i) => (
            <div
              key={idea._id}
              className={`animate-fade-in stagger-${Math.min(i + 1, 9)}`}
            >
              <IdeaCard idea={idea} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
