import { getTranslations } from "next-intl/server";

import { BabyForm } from "@/components/baby/baby-form";

export default async function NewBabyPage() {
  const tBaby = await getTranslations("baby");
  const tProfile = await getTranslations("profile");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{tBaby("add")}</h1>
        <p className="mt-1 text-sm text-muted">{tProfile("privateHint")}</p>
      </header>
      <BabyForm mode="create" />
    </div>
  );
}
