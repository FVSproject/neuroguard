"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

import { LogoMark } from "./logo";
import { LanguageToggle } from "./language-toggle";
import { BabyPill } from "@/components/baby/baby-pill";
import { ConnectionChip } from "@/components/layout/connection-chip";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-border/60 bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-3 sm:px-5">
        <div className="flex items-center gap-4">
          <Link href="/live" className="flex items-center gap-2">
            <LogoMark className="h-8 w-8" />
            <span className="hidden text-base font-semibold tracking-tight sm:inline">
              NeuroGuard
            </span>
          </Link>
          <ConnectionChip />
        </div>
        <div className="flex items-center gap-2">
          <BabyPill />
          <LanguageToggle />
          {/* Clerk's built-in avatar dropdown — includes "Sign out".
              Post-sign-out redirect is set on <ClerkProvider> globally. */}
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-8 w-8 ring-1 ring-border",
              },
            }}
          />
        </div>
      </div>
    </header>
  );
}
