import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ReactNode } from "react";

export default function SplashPageLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col">
        <header className="sticky top-0 z-10 flex h-16 border-b bg-background/80 px-4 backdrop-blur md:px-6">
          <nav className="container hidden w-full justify-between gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
            <Link href="/">
              <h1 className="text-base font-semibold flex items-center gap-2">
                <span className="text-yellow-500">💡</span>{" "}
                <span className="bg-gradient-to-r from-yellow-600 via-orange-500 to-amber-500 bg-clip-text text-transparent">
                  Fikra
                </span>
              </h1>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/product">
                <Button className="transition-transform hover:scale-105 active:scale-95">
                  Get Started
                </Button>
              </Link>
            </div>
          </nav>
        </header>
        <main className="flex grow flex-col relative">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 bg-yellow-500/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-orange-500/5 rounded-full blur-3xl" />
          </div>
          {children}
        </main>
        <footer className="border-t">
          <div className="container py-4 text-sm leading-loose text-muted-foreground">
            Fikra — Hackathon Idea Board.
          </div>
        </footer>
      </div>
  );
}
