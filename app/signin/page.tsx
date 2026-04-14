"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast, Toaster } from "sonner";

export default function SignInPage() {
  const [step, setStep] = useState<"signIn" | "linkSent">("signIn");

  return (
    <div className="flex min-h-screen w-full container my-auto mx-auto">
      <div className="max-w-[384px] mx-auto flex flex-col my-auto gap-4 pb-8 animate-fade-in">
        {step === "signIn" ? (
          <>
            <div className="text-center mb-2">
              <h1 className="text-3xl font-bold mb-1 bg-gradient-to-r from-yellow-500 via-orange-500 to-amber-500 bg-clip-text text-transparent">
                Fikra
              </h1>
              <p className="text-muted-foreground text-sm">
                Hackathon Idea Board
              </p>
            </div>
            <h2 className="font-semibold text-xl tracking-tight text-center">
              Sign in to continue
            </h2>
            <p className="text-sm text-muted-foreground text-center">
              Sign in with your authorized email address.
            </p>
            <SignInWithMagicLink handleLinkSent={() => setStep("linkSent")} />
          </>
        ) : (
          <>
            <h2 className="font-semibold text-2xl tracking-tight">
              Check your email
            </h2>
            <p className="text-sm text-muted-foreground">
              A sign-in link has been sent to your email address.
            </p>
            <Button
              className="p-0 self-start"
              variant="link"
              onClick={() => setStep("signIn")}
            >
              Back to sign in
            </Button>
          </>
        )}
      </div>
      <Toaster />
    </div>
  );
}

function SignInWithMagicLink({
  handleLinkSent,
}: {
  handleLinkSent: () => void;
}) {
  const { signIn } = useAuthActions();
  return (
    <form
      className="flex flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        formData.set("redirectTo", "/product");
        signIn("resend", formData)
          .then(handleLinkSent)
          .catch((error) => {
            console.error(error);
            toast.error(
              error instanceof Error
                ? error.message
                : "Could not send sign-in link",
            );
          });
      }}
    >
      <label htmlFor="email" className="text-sm mb-1.5">
        Email
      </label>
      <Input
        name="email"
        id="email"
        type="email"
        className="mb-3"
        autoComplete="email"
        placeholder="you@company.com"
      />
      <Button type="submit" className="w-full">
        Send sign-in link
      </Button>
    </form>
  );
}
