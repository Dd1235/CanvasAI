"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import Link from "next/link";

// --- 1. Custom Hook for Mouse Parallax ---
const useMousePosition = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", updateMousePosition);
    return () => window.removeEventListener("mousemove", updateMousePosition);
  }, []);

  return mousePosition;
};

// --- 2. The Interactive Mascot Component (UPGRADED) ---
const Mascot = ({ isPasswordFocused }: { isPasswordFocused: boolean }) => {
  const { x, y } = useMousePosition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Calculate subtle eye tracking movement
  const eyeX = mounted ? (x / window.innerWidth) * 12 - 6 : 0;
  const eyeY = mounted ? (y / window.innerHeight) * 12 - 6 : 0;

  return (
    <div className="relative w-32 h-32 mx-auto mb-6 flex items-center justify-center">
      {/* Mascot Body */}
      <motion.div
        className="w-24 h-24 rounded-[2rem] shadow-xl flex items-center justify-center relative overflow-hidden bg-white/95 dark:bg-zinc-900/95 border border-white/30 dark:border-white/10 backdrop-blur-md z-10"
        animate={{ y: [0, -4, 0] }} // Subtle breathing/floating
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
      >
        {/* Face Container */}
        <div className="flex flex-col items-center gap-2 relative z-10 mt-2">
          {/* Eyes Container */}
          <div className="flex gap-4">
            {/* Left Eye */}
            <motion.div
              initial={false}
              animate={{
                height: isPasswordFocused ? 4 : 28, // Eye squints closed
                y: isPasswordFocused ? 10 : 0,      // Eye moves down when closed
              }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-5 bg-zinc-800 dark:bg-zinc-200 rounded-full flex items-center justify-center overflow-hidden"
            >
              <motion.div
                className="w-2.5 h-2.5 bg-white dark:bg-zinc-900 rounded-full"
                animate={{ 
                  x: isPasswordFocused ? 0 : eyeX, 
                  y: isPasswordFocused ? 0 : eyeY,
                  opacity: isPasswordFocused ? 0 : 1 // Pupil fades out when closed
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              />
            </motion.div>

            {/* Right Eye */}
            <motion.div
              initial={false}
              animate={{
                height: isPasswordFocused ? 4 : 28,
                y: isPasswordFocused ? 10 : 0,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-5 bg-zinc-800 dark:bg-zinc-200 rounded-full flex items-center justify-center overflow-hidden"
            >
              <motion.div
                className="w-2.5 h-2.5 bg-white dark:bg-zinc-900 rounded-full"
                animate={{ 
                  x: isPasswordFocused ? 0 : eyeX, 
                  y: isPasswordFocused ? 0 : eyeY,
                  opacity: isPasswordFocused ? 0 : 1
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              />
            </motion.div>
          </div>

          {/* Cute Nose/Mouth that reacts */}
          <motion.div 
             animate={{ 
               scaleX: isPasswordFocused ? 0.6 : 1,
               y: isPasswordFocused ? 4 : 0
             }}
             className="w-3 h-1.5 bg-pink-400/80 rounded-full"
          />
        </div>
      </motion.div>

      {/* Hands / Paws 
        Removed AnimatePresence for scalability. These stay in the DOM 
        and use GPU transforms for maximum performance.
      */}

      {/* Left Paw */}
      <motion.div
        initial={false}
        animate={{
          y: isPasswordFocused ? -32 : 15,
          x: isPasswordFocused ? 12 : -10,
          rotate: isPasswordFocused ? 35 : -20,
          opacity: isPasswordFocused ? 1 : 0,
          scale: isPasswordFocused ? 1 : 0.6,
        }}
        transition={{ type: "spring", stiffness: 250, damping: 20 }}
        className="absolute bottom-1 left-1 w-9 h-11 bg-white dark:bg-zinc-800 rounded-full shadow-[0_5px_15px_rgba(0,0,0,0.15)] border border-black/5 dark:border-white/10 z-20 origin-bottom pointer-events-none"
      />

      {/* Right Paw - Added 0.05s delay for organic lifelike movement */}
      <motion.div
        initial={false}
        animate={{
          y: isPasswordFocused ? -32 : 15,
          x: isPasswordFocused ? -12 : 10,
          rotate: isPasswordFocused ? -35 : 20,
          opacity: isPasswordFocused ? 1 : 0,
          scale: isPasswordFocused ? 1 : 0.6,
        }}
        transition={{ type: "spring", stiffness: 250, damping: 20, delay: 0.05 }}
        className="absolute bottom-1 right-1 w-9 h-11 bg-white dark:bg-zinc-800 rounded-full shadow-[0_5px_15px_rgba(0,0,0,0.15)] border border-black/5 dark:border-white/10 z-20 origin-bottom pointer-events-none"
      />
    </div>
  );
};

// --- 3. Main Layout Wrapper ---
export function AnimatedLoginWrapper({ children }: { children: React.ReactNode }) {
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const { x, y } = useMousePosition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const parallaxX = mounted ? (x / window.innerWidth) * 20 : 0;
  const parallaxY = mounted ? (y / window.innerHeight) * 20 : 0;

  const handleFocusCapture = (e: React.FocusEvent) => {
    if ((e.target as HTMLInputElement).type === "password") setIsPasswordFocused(true);
  };

  const handleBlurCapture = (e: React.FocusEvent) => {
    if ((e.target as HTMLInputElement).type === "password") setIsPasswordFocused(false);
  };

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center px-4 py-12 overflow-hidden bg-background">
      
      {/* Animated Parallax Background Blobs */}
      <motion.div
        animate={{ x: parallaxX, y: parallaxY }}
        transition={{ type: "spring", stiffness: 50, damping: 30 }}
        className="absolute inset-0 z-0 overflow-hidden pointer-events-none flex items-center justify-center"
      >
        <div className="absolute w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-primary/10 blur-[100px] mix-blend-multiply dark:mix-blend-screen translate-x-[-30%] translate-y-[-20%] animate-blob" />
        <div className="absolute w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] rounded-full bg-blue-500/10 blur-[100px] mix-blend-multiply dark:mix-blend-screen translate-x-[30%] translate-y-[20%] animate-blob animation-delay-2000" />
      </motion.div>

      {/* Foreground Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
        onFocusCapture={handleFocusCapture}
        onBlurCapture={handleBlurCapture}
      >
        <div className="rounded-[2.5rem] bg-white/50 dark:bg-black/50 backdrop-blur-2xl border border-white/50 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.08)] p-8 sm:p-10">
          
          <div className="flex flex-col items-center text-center mb-8">
            <Link
              href="/"
              className="text-foreground mb-8 inline-flex items-center gap-2 text-xl font-bold tracking-tight hover:opacity-80 transition-opacity"
            >
              <Sparkles className="size-6 text-primary" />
              CanvasAI
            </Link>

            <Mascot isPasswordFocused={isPasswordFocused} />
            
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome Back</h1>
            <p className="text-sm text-muted-foreground mt-2">Sign in to continue to your workspace.</p>
          </div>

          <div className="w-full">
            {children}
          </div>

        </div>
      </motion.div>
    </main>
  );
}