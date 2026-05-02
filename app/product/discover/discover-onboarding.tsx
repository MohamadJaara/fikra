"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Heart,
  X,
  RotateCcw,
  Sparkles,
  Users,
  Compass,
  MousePointerClick,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "fikra_discover_onboarding_seen";

const steps = [
  {
    icon: Compass,
    title: "Discover Ideas",
    description:
      "Swipe through hackathon ideas and find ones that excite you. The best matches rise to the top.",
    visual: "compass",
  },
  {
    icon: Heart,
    title: "Swipe Right to Like",
    description:
      "Interested in an idea? Swipe right or tap the heart to show your interest.",
    visual: "swipe-right",
  },
  {
    icon: X,
    title: "Swipe Left to Skip",
    description:
      "Not your vibe? Swipe left or tap the X to move on. No hard feelings.",
    visual: "swipe-left",
  },
  {
    icon: MousePointerClick,
    title: "Tap to Explore",
    description:
      "Curious? Tap any card to open the full idea details in a new tab.",
    visual: "tap",
  },
  {
    icon: Sparkles,
    title: "Two Modes",
    description:
      "Browse all ideas or switch to \"Find a Team\" to see ideas that need your specific skills.",
    visual: "modes",
  },
];

export function DiscoverOnboarding() {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "true") return;
    } catch {}
    setVisible(true);
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {}
  }, []);

  const next = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      dismiss();
    }
  }, [currentStep, dismiss]);

  const prev = useCallback(() => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }, [currentStep]);

  if (!visible) return null;

  const step = steps[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === steps.length - 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <motion.div
        layout
        className="relative w-full max-w-md overflow-hidden rounded-3xl border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 z-10 rounded-full p-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative h-56 overflow-hidden bg-gradient-to-br from-stone-100 to-stone-200 dark:from-stone-900 dark:to-stone-800">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.visual}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 flex items-center justify-center"
            >
              {step.visual === "compass" && <CompassVisual />}
              {step.visual === "swipe-right" && <SwipeRightVisual />}
              {step.visual === "swipe-left" && <SwipeLeftVisual />}
              {step.visual === "tap" && <TapVisual />}
              {step.visual === "modes" && <ModesVisual />}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="px-6 pt-6 pb-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <h2 className="text-lg font-semibold tracking-tight">
                  {step.title}
                </h2>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="px-6 pt-4 pb-6 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentStep
                    ? "w-6 bg-primary"
                    : "w-1.5 bg-muted-foreground/25 hover:bg-muted-foreground/40"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button variant="ghost" size="sm" onClick={prev}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={next} className="gap-1.5">
              {isLast ? "Start Swiping" : "Next"}
              {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CompassVisual() {
  return (
    <div className="relative">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="h-28 w-28 rounded-full border-2 border-dashed border-stone-400 dark:border-stone-600"
      />
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
          <Compass className="h-9 w-9 text-white" />
        </div>
      </motion.div>
      {[
        { top: "-12px", left: "50%", delay: 0 },
        { bottom: "-12px", left: "50%", delay: 0.5 },
        { top: "50%", left: "-12px", delay: 1 },
        { top: "50%", right: "-12px", delay: 1.5 },
      ].map((pos, i) => (
        <motion.div
          key={i}
          className="absolute h-3 w-3 rounded-full bg-stone-400 dark:bg-stone-500"
          style={{ top: pos.top, left: pos.left, right: pos.right, bottom: pos.bottom, x: "-50%", y: "-50%" }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.8, 0.4] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: pos.delay,
          }}
        />
      ))}
    </div>
  );
}

function SwipeRightVisual() {
  return (
    <div className="relative flex items-center">
      <div className="h-32 w-48 rounded-2xl border-2 border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 shadow-lg p-3 flex flex-col gap-2">
        <div className="h-2.5 w-3/4 rounded-full bg-stone-200 dark:bg-stone-700" />
        <div className="h-2 w-full rounded-full bg-stone-100 dark:bg-stone-700/60" />
        <div className="h-2 w-5/6 rounded-full bg-stone-100 dark:bg-stone-700/60" />
        <div className="flex gap-1.5 mt-auto">
          <div className="h-4 w-12 rounded-full bg-stone-200 dark:bg-stone-700" />
          <div className="h-4 w-10 rounded-full bg-stone-200 dark:bg-stone-700" />
        </div>
      </div>

      <motion.div
        className="absolute"
        animate={{ x: ["0%", "120%", "0%"] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 shadow-lg shadow-green-500/30">
          <Heart className="h-5 w-5 text-white" fill="white" />
        </div>
      </motion.div>

      <motion.div
        className="absolute right-8 top-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1, 1, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, delay: 0.3 }}
      >
        <div className="rounded-lg bg-green-500/90 px-2.5 py-1 text-white text-xs font-bold flex items-center gap-1">
          <ArrowRight className="h-3 w-3" />
          Interested
        </div>
      </motion.div>
    </div>
  );
}

function SwipeLeftVisual() {
  return (
    <div className="relative flex items-center">
      <div className="h-32 w-48 rounded-2xl border-2 border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 shadow-lg p-3 flex flex-col gap-2">
        <div className="h-2.5 w-3/4 rounded-full bg-stone-200 dark:bg-stone-700" />
        <div className="h-2 w-full rounded-full bg-stone-100 dark:bg-stone-700/60" />
        <div className="h-2 w-5/6 rounded-full bg-stone-100 dark:bg-stone-700/60" />
        <div className="flex gap-1.5 mt-auto">
          <div className="h-4 w-12 rounded-full bg-stone-200 dark:bg-stone-700" />
          <div className="h-4 w-10 rounded-full bg-stone-200 dark:bg-stone-700" />
        </div>
      </div>

      <motion.div
        className="absolute"
        animate={{ x: ["0%", "-120%", "0%"] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        style={{ left: "-20px" }}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 shadow-lg shadow-red-500/30">
          <X className="h-5 w-5 text-white" />
        </div>
      </motion.div>

      <motion.div
        className="absolute left-8 top-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1, 1, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, delay: 0.3 }}
      >
        <div className="rounded-lg bg-red-500/90 px-2.5 py-1 text-white text-xs font-bold flex items-center gap-1">
          Skip
          <ArrowLeft className="h-3 w-3" />
        </div>
      </motion.div>
    </div>
  );
}

function TapVisual() {
  return (
    <div className="relative">
      <div className="h-36 w-52 rounded-2xl border-2 border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 shadow-lg p-4 flex flex-col gap-2">
        <div className="h-3 w-3/4 rounded-full bg-stone-200 dark:bg-stone-700" />
        <div className="h-2 w-full rounded-full bg-stone-100 dark:bg-stone-700/60" />
        <div className="h-2 w-5/6 rounded-full bg-stone-100 dark:bg-stone-700/60" />
        <div className="h-2 w-2/3 rounded-full bg-stone-100 dark:bg-stone-700/60" />
        <div className="flex gap-1.5 mt-auto">
          <div className="h-4 w-12 rounded-full bg-stone-200 dark:bg-stone-700" />
          <div className="h-4 w-10 rounded-full bg-stone-200 dark:bg-stone-700" />
        </div>
      </div>

      <motion.div
        className="absolute"
        style={{ top: "40%", left: "45%" }}
        animate={{
          scale: [1, 0.85, 1],
          opacity: [0.7, 1, 0.7],
        }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="relative">
          <MousePointerClick className="h-8 w-8 text-stone-500 dark:text-stone-400 drop-shadow-md" />
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-stone-400 dark:border-stone-500"
            animate={{ scale: [1, 2], opacity: [0.6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </div>
      </motion.div>
    </div>
  );
}

function ModesVisual() {
  return (
    <div className="flex flex-col items-center gap-4">
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="flex items-center gap-2 rounded-xl border-2 border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/50 px-4 py-2.5 shadow-sm"
      >
        <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
          Browse Ideas
        </span>
      </motion.div>

      <motion.div
        animate={{ y: [0, 4, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        className="flex items-center gap-2 rounded-xl border-2 border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/50 px-4 py-2.5 shadow-sm"
      >
        <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">
          Find a Team
        </span>
      </motion.div>

      <motion.div
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400"
      >
        <RotateCcw className="h-3 w-3" />
        <span>Switch anytime</span>
      </motion.div>
    </div>
  );
}
