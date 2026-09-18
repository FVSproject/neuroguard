import { getTranslations } from "next-intl/server";

import { BabyForm } from "@/components/baby/baby-form";

export default async function NewBabyPage() {
  const t = await getTranslations("baby");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t("add")}</h1>
        <p className="mt-1 text-sm text-muted">
          Everything you enter here stays on this device only — nothing is sent to a server.
        </p>
      </header>
      <BabyForm mode="create" />
    </div>
  );
}
