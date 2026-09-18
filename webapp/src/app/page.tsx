import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Bluetooth, BabyIcon, ArrowRight, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/layout/logo";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { PacifierIcon } from "@/components/icons/pacifier";
import { WristbandIcon } from "@/components/icons/wristband";

export default async function LandingPage() {
  const t = await getTranslations();

  return (
    <>
      {/* --- top bar --- */}
      <header className="w-full border-b border-border/60 bg-surface/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark className="h-9 w-9" />
            <span className="text-lg font-semibold tracking-tight">
              {t("app.name")}
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <LanguageToggle />
          </div>
        </div>
      </header>

      {/* --- hero --- */}
      <main className="relative flex-1">
        {/* soft ambient gradient blobs */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -top-32 -end-16 h-96 w-96 rounded-full bg-brand-soft opacity-70 blur-3xl" />
          <div className="absolute top-1/3 -start-20 h-80 w-80 rounded-full bg-accent-soft opacity-60 blur-3xl" />
        </div>

        <section className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:py-24">
          <div className="flex flex-col justify-center gap-6">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand pulse-soft" />
              {t("app.tagline")}
            </div>

            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              {t("landing.title")}
            </h1>

            <p className="max-w-xl text-lg text-muted">
              {t("landing.subtitle")}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 gap-2 rounded-full px-6 text-base">
                <Link href="/profile/new">
                  <BabyIcon className="size-5" aria-hidden />
                  {t("landing.createBaby")}
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 gap-2 rounded-full px-6 text-base"
              >
                <Link href="/live">
                  <Bluetooth className="size-5" aria-hidden />
                  {t("landing.connect")}
                  <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                </Link>
              </Button>
            </div>

            <p className="mt-2 flex items-start gap-2 text-sm text-muted">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{t("landing.browserWarning")}</span>
            </p>
          </div>

          {/* --- component preview: two floating cards --- */}
          <div className="relative min-h-[24rem]">
            <div className="absolute end-0 top-4 w-64 -rotate-3 rounded-2xl border border-border bg-surface p-5 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="grid size-12 place-items-center rounded-xl bg-brand-soft text-brand">
                  <PacifierIcon className="size-7" />
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted">
                    Pacifier hub
                  </div>
                  <div className="text-sm font-semibold">
                    XIAO ESP32-S3
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-1.5 text-xs text-muted">
                <div>· FSR — sucking pressure</div>
                <div>· Mic — breath sounds + apnea</div>
                <div>· ENS160 + AHT21 — air quality</div>
              </div>
            </div>

            <div className="absolute start-0 bottom-4 w-64 rotate-2 rounded-2xl border border-border bg-surface p-5 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="grid size-12 place-items-center rounded-xl bg-accent-soft text-accent-strong">
                  <WristbandIcon className="size-7" />
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted">
                    Foot bracelet
                  </div>
                  <div className="text-sm font-semibold">
                    XIAO nRF52840
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-1.5 text-xs text-muted">
                <div>· MAX30102 — heart rate + SpO₂</div>
                <div>· HRV — SDNN, RMSSD, pNN50</div>
                <div>· MPU-6050 — motion + posture</div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
