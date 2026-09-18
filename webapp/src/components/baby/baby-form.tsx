"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Camera, Trash2, Plus, Save } from "lucide-react";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBabyStore } from "@/stores/baby-store";

// Turn `"" / null / undefined / NaN` into undefined so an empty number
// input doesn't fail validation. `z.preprocess` runs on both input and
// output so `z.input === z.output` — that's what keeps react-hook-form's
// generic inference happy.
const optNumber = z.preprocess(
  (v) => {
    if (v === "" || v === null || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  },
  z.number().min(0).optional(),
);

const schema = z.object({
  name: z.string().min(1),
  dob: z.string().optional().or(z.literal("")),
  weightKg: optNumber,
  heightCm: optNumber,
  gender: z.enum(["male", "female", "other"]).optional(),
  notes: z.string().max(2000).optional().or(z.literal("")),
  photoDataUrl: z.string().optional(),

  parentName:  z.string().optional().or(z.literal("")),
  parentPhone: z.string().optional().or(z.literal("")),
  parentEmail: z.string().email().optional().or(z.literal("")),
  parentRelation: z.string().optional().or(z.literal("")),

  contacts: z
    .array(
      z.object({
        name:     z.string().min(1),
        phone:    z.string().min(3),
        relation: z.string().optional().or(z.literal("")),
      }),
    )
    .max(6),
});

type FormValues = z.infer<typeof schema>;

const MAX_AVATAR_BYTES = 300 * 1024;

function initials(name: string) {
  return (name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("")) || "?";
}

export function BabyForm({ mode }: { mode: "create" | "edit" }) {
  const t = useTranslations();
  const router = useRouter();
  const createBaby = useBabyStore((s) => s.createBaby);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const form = useForm<FormValues>({
    // Cast — zod's `preprocess` on the number fields makes `z.input` diverge
    // from `z.output`, and the resolver's inferred generic doesn't match what
    // useForm wants. Runtime behaviour is fine.
    resolver: zodResolver(schema) as unknown as Resolver<FormValues>,
    defaultValues: {
      name: "",
      dob: "",
      gender: undefined,
      notes: "",
      photoDataUrl: undefined,
      parentName: "",
      parentPhone: "",
      parentEmail: "",
      parentRelation: "",
      contacts: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "contacts" });
  const photoDataUrl = form.watch("photoDataUrl");
  const name = form.watch("name");

  async function onPhotoPick(file: File) {
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error(`Photo too large — keep it under ${Math.round(MAX_AVATAR_BYTES / 1024)} KB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => form.setValue("photoDataUrl", reader.result as string);
    reader.readAsDataURL(file);
  }

  async function onSubmit(v: FormValues) {
    setBusy(true);
    try {
      if (mode === "create") {
        await createBaby({
          baby: {
            name: v.name,
            dob:     v.dob || undefined,
            weightKg: Number.isFinite(v.weightKg) ? (v.weightKg as number) : undefined,
            heightCm: Number.isFinite(v.heightCm) ? (v.heightCm as number) : undefined,
            gender: v.gender,
            notes:  v.notes || undefined,
            photoDataUrl: v.photoDataUrl,
          },
          parent: v.parentName
            ? {
                name: v.parentName,
                phone: v.parentPhone || undefined,
                email: v.parentEmail || undefined,
                relation: v.parentRelation || undefined,
              }
            : undefined,
          contacts: v.contacts.map((c) => ({
            name: c.name,
            phone: c.phone,
            relation: c.relation || undefined,
          })),
        });
        toast.success(`${v.name} created`);
        router.push("/live");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* --- Photo + Personal ---------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle>{t("baby.profile.personal")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="size-20">
                {photoDataUrl ? <AvatarImage src={photoDataUrl} alt="" /> : null}
                <AvatarFallback className="bg-brand-soft text-lg font-semibold text-brand">
                  {initials(name || "?")}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onPhotoPick(f);
                  }}
                />
                <Button type="button" size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
                  <Camera className="size-4" aria-hidden />
                  {t("baby.profile.photo")}
                </Button>
                <p className="text-xs text-muted">{t("baby.profile.photoHint")}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("baby.profile.name")}</FormLabel>
                    <FormControl><Input {...field} autoFocus /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dob"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("baby.profile.dob")}</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="weightKg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("baby.profile.weight")} (kg)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="heightCm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("baby.profile.height")} (cm)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("baby.profile.gender")}</FormLabel>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(v) => field.onChange(v || undefined)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="male">{t("baby.profile.genderMale")}</SelectItem>
                        <SelectItem value="female">{t("baby.profile.genderFemale")}</SelectItem>
                        <SelectItem value="other">{t("baby.profile.genderOther")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("baby.profile.notes")}</FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      rows={3}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* --- Parent -------------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle>{t("baby.profile.parent")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="parentName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("baby.profile.parentName")}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parentRelation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("baby.profile.parentRelation")}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parentPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("baby.profile.parentPhone")}</FormLabel>
                  <FormControl><Input type="tel" inputMode="tel" {...field} /></FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parentEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("baby.profile.parentEmail")}</FormLabel>
                  <FormControl><Input type="email" inputMode="email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* --- Emergency contacts -------------------------------------- */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("baby.profile.emergency")}</CardTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => append({ name: "", phone: "", relation: "" })}
              disabled={fields.length >= 6}
            >
              <Plus className="size-4" aria-hidden />
              {t("baby.profile.addContact")}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.length === 0 ? (
              <FormDescription>—</FormDescription>
            ) : (
              fields.map((f, i) => (
                <div key={f.id} className="grid gap-3 rounded-lg border border-border bg-surface-2 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <FormField
                    control={form.control}
                    name={`contacts.${i}.name`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">{t("baby.profile.contactName")}</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`contacts.${i}.phone`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">{t("baby.profile.contactPhone")}</FormLabel>
                        <FormControl><Input type="tel" inputMode="tel" {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`contacts.${i}.relation`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">{t("baby.profile.contactRelation")}</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-6 self-start text-danger"
                    onClick={() => remove(i)}
                    aria-label="Remove"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Separator />

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => router.back()} disabled={busy}>
            {t("form.cancel")}
          </Button>
          <Button type="submit" disabled={busy} className="gap-2">
            <Save className="size-4" aria-hidden />
            {t("form.save")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
