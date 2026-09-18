import { AppHeader } from "@/components/layout/header";
import { Sidebar, BottomNav } from "@/components/layout/sidebar";
import { AlarmBanner } from "@/components/alarm/alarm-banner";
import { AlarmMount } from "@/components/layout/alarm-mount";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <AlarmBanner />
      <div className="mx-auto flex w-full max-w-7xl flex-1">
        <Sidebar />
        <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 lg:pb-8 lg:pt-8">
          {children}
        </main>
      </div>
      <BottomNav />
      <AlarmMount />
    </div>
  );
}
