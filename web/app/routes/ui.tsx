import { Bell, BriefcaseBusiness, Building2, Clock, Eye, Heart, MapPin, Plus, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "~/shared/i18n/i18n";

import { GirihPattern } from "~/shared/brand/GirihPattern";
import { Logo, LogoMark } from "~/shared/brand/Logo";
import { useLocale } from "~/shared/i18n/hooks";
import { relativeTime, salary } from "~/shared/lib/format";
import {
  Avatar, Badge, Button, Checkbox, Chip, DialogContent, DialogRoot, DialogTrigger, EmptyState, Field, IconButton,
  Input, MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuTrigger, RadioGroup, Select, SheetContent, Skeleton,
  Spinner, Switch, Tabs, Textarea, toast, Tooltip,
} from "~/shared/ui";

export function meta() {
  return [{ title: "Design system · Job Vacancy" }, { name: "robots", content: "noindex" }];
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-10">
      <h2 className="mb-6 font-display text-xl font-semibold tracking-[-0.02em]">{title}</h2>
      {children}
    </section>
  );
}

const swatches = [
  ["paper", "Qog'oz fon"], ["surface", "Yuza"], ["sunken", "Botiq"], ["ink", "Siyoh"], ["ink-2", "Ikkilamchi"],
  ["ink-3", "Uchlamchi"], ["line", "Chiziq"], ["lapis", "Lojuvard"], ["lapis-soft", "Lojuvard yumshoq"],
  ["firuza", "Firuza"], ["firuza-soft", "Firuza yumshoq"], ["zafaron", "Za'faron"], ["anor", "Anor"],
] as const;

/** Prototype of the vacancy list row (phase 7 builds the real one). */
function VacancyRow({ featured, title, company, verified, region, format, exp, min, max, skills, when }: {
  featured?: boolean; title: string; company: string; verified?: boolean; region: string; format: string; exp: string;
  min: number | null; max: number | null; skills: string[]; when: string;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  return (
    <a href="#" className="group relative flex gap-4 px-4 py-5 transition-colors hover:bg-sunken/60 sm:px-5">
      {featured && <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-zafaron" aria-hidden="true" />}
      <Avatar name={company} square size="md" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <h3 className="text-[1.0625rem] font-semibold leading-snug text-ink group-hover:text-lapis-ink">{title}</h3>
          <p className="num shrink-0 font-display text-[1.0625rem] font-semibold tracking-[-0.02em] text-firuza-ink">
            {salary({ min, max, currency: "UZS" }, t, locale)}
          </p>
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-2">
          {company}
          {verified && <Badge tone="firuza" className="h-5 px-1.5">{t("common.verified")}</Badge>}
          {featured && <Badge tone="zafaron" className="h-5 px-1.5">{t("common.featured")}</Badge>}
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-3">
          <li className="flex items-center gap-1.5"><MapPin className="size-4" />{region}</li>
          <li className="flex items-center gap-1.5"><Building2 className="size-4" />{format}</li>
          <li className="flex items-center gap-1.5"><BriefcaseBusiness className="size-4" />{exp}</li>
          <li className="flex items-center gap-1.5"><Clock className="size-4" />{when}</li>
        </ul>
        {skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {skills.map((s) => <Badge key={s} tone="outline">{s}</Badge>)}
          </div>
        )}
      </div>
    </a>
  );
}

export default function UI() {
  const { t } = useTranslation();
  const [chips, setChips] = useState<string[]>(["remote"]);
  const [tab, setTab] = useState("all");
  const [sw, setSw] = useState(true);
  const [cb, setCb] = useState(false);
  const [radio, setRadio] = useState("full_time");
  const [loading, setLoading] = useState(false);
  const ago = (h: number) => relativeTime(new Date(Date.now() - h * 3_600_000), t);

  return (
    <div className="container-page py-12">
      <div className="relative isolate mb-4 overflow-hidden rounded-sheet border border-line bg-surface px-6 py-12 md:px-10">
        <GirihPattern className="-z-10" focus="ellipse 50% 80% at 90% 40%" />
        <Logo />
        <h1 className="mt-6 max-w-[18ch] font-display text-3xl font-semibold tracking-[-0.035em] md:text-4xl">Job Vacancy dizayn tizimi</h1>
        <p className="mt-3 max-w-xl text-ink-2">Ranglar Samarqand koshinlaridan: lojuvard, firuza, za'faron va anor. Sarlavhalar Unbounded, matn Onest.</p>
      </div>

      <Section title="Ranglar">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {swatches.map(([k, name]) => (
            <div key={k}>
              <div className="h-16 rounded-control border border-line" style={{ background: `var(--${k})` }} />
              <p className="mt-2 text-sm font-medium">{name}</p>
              <p className="text-xs text-ink-3">--{k}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografiya">
        <div className="space-y-4">
          <p className="font-display text-5xl font-semibold tracking-[-0.04em]">Ish · Иш · Работа</p>
          <p className="font-display text-3xl font-semibold tracking-[-0.03em]">Ўқитувчи, ҳамшира, қурувчи, ғаллакор</p>
          <p className="font-display text-xl font-semibold tracking-[-0.02em]">Oʻqituvchi va gʻaznachi — 15–25 mln soʻm</p>
          <p className="max-w-[65ch] text-base text-ink-2">
            Matn shrifti Onest: o'qishga qulay, kirill va lotinda bir xil ohangda. Qator uzunligi 65–75 belgidan
            oshmaydi, shunda uzun vakansiya tavsiflari ham charchatmaydi. Raqamlar jadvaldagidek tekis: 1 250 000.
          </p>
          <p className="text-sm text-ink-3">Kichik matn: 14px, meta ma'lumotlar va izohlar uchun.</p>
        </div>
      </Section>

      <Section title="Tugmalar">
        <div className="flex flex-wrap items-center gap-3">
          <Button icon={<Search className="size-4" />}>{t("search.submit")}</Button>
          <Button variant="secondary">{t("common.cancel")}</Button>
          <Button variant="soft" icon={<Plus className="size-4" />}>{t("nav.postVacancy")}</Button>
          <Button variant="ghost">{t("common.showAll")}</Button>
          <Button variant="danger" icon={<Trash2 className="size-4" />}>{t("common.delete")}</Button>
          <Button loading={loading} onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1500); }}>{t("common.apply")}</Button>
          <Button disabled>{t("common.save")}</Button>
          <Button size="sm" variant="secondary">sm</Button>
          <Button size="lg">lg</Button>
          <Tooltip content={t("common.save")}>
            <IconButton label={t("common.save")} variant="secondary"><Heart className="size-5" /></IconButton>
          </Tooltip>
        </div>
      </Section>

      <Section title="Maydonlar">
        <div className="grid max-w-3xl gap-5 md:grid-cols-2">
          <Field label={t("form.email")}><Input type="email" placeholder="ism@misol.uz" /></Field>
          <Field label={t("search.what")} hint="Masalan: kassir, Go, Uzum"><Input leading={<Search className="size-4.5" />} placeholder={t("search.what")} /></Field>
          <Field label={t("form.password")} error="Kamida 8 belgi, bitta harf va bitta raqam."><Input type="password" defaultValue="123" /></Field>
          <Field label={t("search.where")}>
            <Select placeholder={t("search.anywhere")} options={[{ value: "1", label: "Toshkent shahri" }, { value: "2", label: "Samarqand viloyati" }, { value: "3", label: "Farg'ona viloyati" }]} />
          </Field>
          <Field label="Qo'shimcha xat" optional={t("common.optional")} className="md:col-span-2">
            <Textarea placeholder="Nega aynan siz?" />
          </Field>
          <div className="flex flex-col gap-4 rounded-panel border border-line bg-surface p-5 md:col-span-2 md:flex-row md:gap-10">
            <div className="flex-1">
              <Switch checked={sw} onCheckedChange={setSw} label="Email bildirishnomalari" description="Arizangiz holati o'zgarsa xabar beramiz" />
            </div>
            <Checkbox checked={cb} onCheckedChange={setCb} label="Faqat maosh ko'rsatilganlar" />
            <RadioGroup value={radio} onValueChange={setRadio} options={[
              { value: "full_time", label: t("enums.employment_type.full_time") },
              { value: "part_time", label: t("enums.employment_type.part_time") },
            ]} />
          </div>
        </div>
      </Section>

      <Section title="Chiplar va belgilar">
        <div className="flex flex-wrap gap-2">
          {(["office", "remote", "hybrid"] as const).map((v) => (
            <Chip key={v} selected={chips.includes(v)} onClick={() => setChips((c) => c.includes(v) ? c.filter((x) => x !== v) : [...c, v])}>
              {t(`enums.work_format.${v}`)}
            </Chip>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Badge>Neytral</Badge><Badge tone="lapis">{t("enums.application_status.interview")}</Badge>
          <Badge tone="firuza">{t("common.verified")}</Badge><Badge tone="zafaron">{t("common.soon")}</Badge>
          <Badge tone="anor">{t("enums.application_status.rejected")}</Badge><Badge tone="outline">PostgreSQL</Badge>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Avatar name="Dilnoza Karimova" size="lg" /><Avatar name="Jasur Toshmatov" /><Avatar name="Uzum Market" square size="lg" />
          <Avatar name="Najot Ta'lim" square /><Avatar name="Aziza" size="sm" /><LogoMark className="size-10" />
        </div>
      </Section>

      <Section title="Vakansiya qatori (prototip)">
        <div className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface">
          <VacancyRow featured title="Senior Go dasturchi" company="Uzum Market" verified region="Toshkent shahri" format={t("enums.work_format.hybrid")} exp={t("enums.experience.3_6")} min={25_000_000} max={40_000_000} skills={["Go", "PostgreSQL", "Kubernetes"]} when={ago(2)} />
          <VacancyRow title="Kassir (smenali)" company="Korzinka" verified region="Samarqand viloyati" format={t("enums.work_format.office")} exp={t("enums.experience.none")} min={4_500_000} max={null} skills={[]} when={ago(26)} />
          <VacancyRow title="Бухгалтер (1С)" company="Artel Electronics" region="Toshkent viloyati" format={t("enums.work_format.office")} exp={t("enums.experience.1_3")} min={null} max={null} skills={["1C", "Microsoft Excel"]} when={ago(80)} />
        </div>
      </Section>

      <Section title="Tablar, menyu, dialoglar, toast">
        <Tabs value={tab} onValueChange={setTab} tabs={[
          { value: "all", label: "Hammasi", count: 128 },
          { value: "sent", label: t("enums.application_status.sent"), count: 42 },
          { value: "interview", label: t("enums.application_status.interview"), count: 7 },
          { value: "hired", label: t("enums.application_status.hired"), count: 2 },
        ]} />
        <div className="mt-6 flex flex-wrap gap-3">
          <DialogRoot>
            <DialogTrigger asChild><Button variant="secondary">Dialog</Button></DialogTrigger>
            <DialogContent title="Arizani qaytarib olasizmi?" description="Ish beruvchi arizangizni boshqa ko'rmaydi." closeLabel={t("common.close")}
              footer={<><Button variant="ghost">{t("common.cancel")}</Button><Button variant="danger">Qaytarib olish</Button></>} />
          </DialogRoot>
          <DialogRoot>
            <DialogTrigger asChild><Button variant="secondary" icon={<SlidersHorizontal className="size-4" />}>{t("common.filters")}</Button></DialogTrigger>
            <SheetContent title={t("common.filters")} closeLabel={t("common.close")}
              footer={<><Button variant="secondary" className="flex-1">{t("common.clear")}</Button><Button className="flex-1">{t("common.done")}</Button></>}>
              <div className="flex flex-wrap gap-2">
                {(["full_time", "part_time", "project", "internship", "volunteer"] as const).map((v) => <Chip key={v}>{t(`enums.employment_type.${v}`)}</Chip>)}
              </div>
            </SheetContent>
          </DialogRoot>
          <MenuRoot>
            <MenuTrigger asChild><Button variant="secondary">Menyu</Button></MenuTrigger>
            <MenuContent align="start">
              <MenuItem icon={<Eye className="size-4" />}>{t("common.open")}</MenuItem>
              <MenuItem icon={<Bell className="size-4" />}>Obuna bo'lish</MenuItem>
              <MenuSeparator />
              <MenuItem icon={<Trash2 className="size-4" />} className="text-anor-ink">{t("common.delete")}</MenuItem>
            </MenuContent>
          </MenuRoot>
          <Button variant="soft" onClick={() => toast({ tone: "success", title: "Ariza yuborildi", body: "Uzum Market javobini shu yerda ko'rasiz." })}>Toast</Button>
          <Button variant="soft" onClick={() => toast({ tone: "error", title: t("errors.network") })}>Xato toast</Button>
        </div>
      </Section>

      <Section title="Yuklanish va bo'sh holat">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3 rounded-panel border border-line bg-surface p-5">
            <div className="flex gap-4"><Skeleton className="size-10 rounded-[28%]" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/3" /></div></div>
            <Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-5/6" />
            <div className="flex items-center gap-2 pt-2 text-sm text-ink-3"><Spinner className="size-4" />{t("common.loading")}</div>
          </div>
          <div className="rounded-panel border border-line bg-surface">
            <EmptyState icon={<Search className="size-6" />} title={t("empty.vacanciesTitle")} body={t("empty.vacanciesBody")} action={<Button variant="soft" icon={<Bell className="size-4" />}>Qidiruvni saqlash</Button>} />
          </div>
        </div>
      </Section>
    </div>
  );
}
