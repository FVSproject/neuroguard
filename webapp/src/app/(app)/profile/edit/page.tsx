import { getTranslations } from "next-intl/server";

import { BabyForm } from "@/components/baby/baby-form";

export default async function EditBabyPage() {
  const t = await getTranslations("baby");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t("edit")}</h1>
      </header>
      <BabyForm mode="edit" />
    </div>
  );
}
