"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-16">
      <div className="text-center max-w-lg animate-fade-in">
        <div className="text-6xl mb-6 animate-float">💡</div>
        <h1 className="text-5xl font-bold tracking-tight mb-3 bg-gradient-to-r from-yellow-500 via-orange-500 to-amber-500 bg-clip-text text-transparent">
          Fikra
        </h1>
        <p className="text-xl text-muted-foreground mb-2">
          Hackathon Idea Board
        </p>
        <p className="text-muted-foreground mb-8">
          Add ideas, browse what others are building, express interest, join
          teams, and collaborate.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/product">
            <Button
              size="lg"
              className="transition-transform hover:scale-105 active:scale-95"
            >
              Get Started
            </Button>
          </Link>
          <Link href="/signin">
            <Button
              variant="outline"
              size="lg"
              className="transition-transform hover:scale-105 active:scale-95"
            >
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
