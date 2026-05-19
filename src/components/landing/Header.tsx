"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Show } from "@clerk/nextjs";
import { motion } from "framer-motion";

export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? "bg-obsidian/80 backdrop-blur-xl border-b border-violet-500/10" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative">
            <span className="text-white font-bold text-2xl tracking-tight">
              findr
            </span>
            <div className="absolute -top-0.5 -right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse-glow" />
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <Link href="#platform" className="text-mist/70 hover:text-white text-sm transition-colors">Platform</Link>
          <Link href="#modules" className="text-mist/70 hover:text-white text-sm transition-colors">Modules</Link>
          <Link href="/pricing" className="text-mist/70 hover:text-white text-sm transition-colors">Pricing</Link>
          <Link href="#why" className="text-mist/70 hover:text-white text-sm transition-colors">Why Findr</Link>
        </nav>

        <div className="flex items-center gap-3">
          <Show when="signed-out">
            <Link href="/sign-in" className="hidden md:block text-mist/70 hover:text-white text-sm transition-colors">
              Sign in
            </Link>
            <Link href="/sign-up" className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-red-500 rounded-lg blur-sm opacity-50 group-hover:opacity-100 transition-opacity" />
              <button className="relative bg-violet-500 hover:bg-violet-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                Book a demo
              </button>
            </Link>
          </Show>
          <Show when="signed-in">
            <Link href="/dashboard" className="bg-violet-500 hover:bg-violet-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              Dashboard
            </Link>
          </Show>
        </div>
      </div>
    </motion.header>
  );
}
