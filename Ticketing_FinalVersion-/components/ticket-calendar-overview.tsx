"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Users,
  Flag,
  Hash,
  type LucideIcon,
} from "lucide-react";

/* ==== Jalali calendar setup ==== */
import dayjs from "dayjs";
import jalaliday from "jalaliday";
dayjs.extend(jalaliday);
dayjs.calendar("jalali");
dayjs.locale("fa");

interface TicketCalendarOverviewProps {
  tickets: any[];
}

type CalendarDay = {
  date: dayjs.Dayjs; // Jalali-aware
  isCurrentMonth: boolean;
  tickets: any[];
};

type StatusBucket = "answered" | "working" | "notResponded";

const weekDays = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
];

// Persian (Jalali) formatters
const monthFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  month: "long",
  year: "numeric",
});
const fullDateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});
const dateTimeFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const dateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const statusMeta: Record<
  StatusBucket,
  { label: string; description: string; counterClass: string }
> = {
  answered: {
    label: "تیکت‌های پاسخ‌داده‌شده",
    description: "تیکت‌هایی که با موفقیت پاسخ یا بسته شده‌اند",
    counterClass: "bg-emerald-500/15 text-emerald-600",
  },
  working: {
    label: "تیکت‌های در حال پیگیری",
    description: "تیکت‌هایی که تکنسین در حال کار روی آن‌هاست",
    counterClass: "bg-amber-500/15 text-amber-600",
  },
  notResponded: {
    label: "تیکت‌های بی‌پاسخ",
    description: "تیکت‌هایی که هنوز پاسخی دریافت نکرده‌اند",
    counterClass: "bg-rose-500/15 text-rose-600",
  },
};

const statusLabels: Record<string, string> = {
  open: "باز",
  "in-progress": "در حال انجام",
  resolved: "حل شده",
  closed: "بسته",
};

const statusColors: Record<string, string> = {
  open: "bg-rose-100 text-rose-700 border border-rose-200",
  "in-progress": "bg-amber-100 text-amber-700 border border-amber-200",
  resolved: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  closed: "bg-slate-100 text-slate-700 border border-slate-200",
};

const statusCountText: Record<StatusBucket, string> = {
  answered: "تیکت‌های پاسخ داده شده",
  working: "تیکت‌های در حال پیگیری",
  notResponded: "تیکت‌های بی‌پاسخ",
};

const formatDateValue = (
  value?: string | Date | null,
  formatter = dateTimeFormatter
) => {
  if (!value) return "--";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return formatter.format(date); // Persian calendar formatting
};

const getComparableTime = (value?: string | Date | null) => {
  if (!value) return 0;
  const d = value instanceof Date ? dayjs(value) : dayjs(value);
  return d.isValid() ? d.valueOf() : 0;
};

// Persian digits (stabilizes RTL wrapping)
const toFaDigits = (n: number | string) =>
  String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

// Build BiDi-safe RTL badge text (adds RLM around the colon)
const buildRtlBadgeText = (label: string, count: number) =>
  `${label} \u200F:\u200F ${toFaDigits(count)}`;

// --- Use Jalali year/month/day to generate keys like 1404-07-23 (ASCII digits) ---
const formatKeyJalali = (d: dayjs.Dayjs) =>
  `${d.calendar("jalali").year()}-${String(
    d.calendar("jalali").month() + 1
  ).padStart(2, "0")}-${String(d.calendar("jalali").date()).padStart(2, "0")}`;

/** RTL-aware row: puts value area (badge) to the far right in RTL */
const InfoRow = ({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
}) => (
  <div
    className="flex items-center justify-between gap-3 rtl:flex-row-reverse"
    dir="rtl"
  >
    <span className="flex items-center gap-2 text-sm font-iran text-muted-foreground">
      <Icon className="h-4 w-4 text-primary" />
      {label}
    </span>
    <div className="flex items-center gap-2 text-sm font-iran text-foreground">
      {value}
    </div>
  </div>
);

const getTicketDate = (ticket: any): dayjs.Dayjs | null => {
  const source = ticket?.updatedAt || ticket?.createdAt;
  if (!source) return null;
  const d = dayjs(source);
  return d.isValid() ? d : null;
};

const getStatusBucket = (status: string): StatusBucket => {
  if (status === "in-progress") return "working";
  if (status === "open") return "notResponded";
  return "answered";
};

export function TicketCalendarOverview({
  tickets,
}: TicketCalendarOverviewProps) {
  // Current Jalali month, first day
  const [currentMonth, setCurrentMonth] = useState(() =>
    dayjs().calendar("jalali").startOf("month")
  );
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // ----- sample data (kept as before; dates are Gregorian but we place them on the Jalali grid) -----
  const sampleTickets = useMemo(() => {
    const now = dayjs();
    const gYear = now.year();
    const gMonth = now.month();

    const createSampleTicket = ({
      id,
      day,
      status,
      technician,
      title,
      hour,
      minute,
      priority,
      category,
      clientName,
      clientEmail,
      clientPhone,
      department,
      description,
    }: {
      id: string;
      day: number;
      status: string;
      technician?: string;
      title: string;
      hour: number;
      minute: number;
      priority: string;
      category: string;
      clientName: string;
      clientEmail: string;
      clientPhone: string;
      department: string;
      description: string;
    }) => {
      const created = dayjs(
        new Date(gYear, gMonth, day, Math.max(7, hour - 2), minute)
      );
      const updated =
        status === "open"
          ? created
          : dayjs(new Date(gYear, gMonth, day, hour, minute));
      return {
        id,
        title,
        status,
        priority,
        category,
        clientName,
        clientEmail,
        clientPhone,
        department,
        description,
        assignedTechnicianName: technician || null,
        createdAt: created.toISOString(),
        updatedAt: updated.toISOString(),
      };
    };

    return [
      createSampleTicket({
        id: "TK-401",
        day: 1,
        status: "resolved",
        technician: "علی احمدی",
        title: "رفع قطعی اینترنت شعبه مرکزی",
        hour: 9,
        minute: 45,
        priority: "high",
        category: "network",
        clientName: "مهدی شریفی",
        clientEmail: "m.sharifi@company.com",
        clientPhone: "09121234560",
        department: "شعبه مرکزی",
        description:
          "اینترنت شعبه مرکزی از شب گذشته قطع بوده و نیاز به بررسی فوری داشت.",
      }),
      createSampleTicket({
        id: "TK-402",
        day: 2,
        status: "in-progress",
        technician: "سارا محمدی",
        title: "نصب نرم‌افزار مالی جدید",
        hour: 11,
        minute: 15,
        priority: "medium",
        category: "software",
        clientName: "زهرا قنبری",
        clientEmail: "z.ghanbari@company.com",
        clientPhone: "09127894561",
        department: "مالی",
        description:
          "واحد مالی نیاز به نصب و راه‌اندازی نسخه جدید نرم‌افزار حسابداری دارد.",
      }),
      createSampleTicket({
        id: "TK-403",
        day: 2,
        status: "open",
        technician: "حسن رضایی",
        title: "ایجاد دسترسی VPN اضطراری",
        hour: 15,
        minute: 30,
        priority: "urgent",
        category: "security",
        clientName: "محمدرضا سلطانی",
        clientEmail: "m.soltani@company.com",
        clientPhone: "09129873412",
        department: "مدیریت بحران",
        description:
          "درخواست ایجاد دسترسی اضطراری به VPN برای تیم پشتیبان خارج از ساعات اداری.",
      }),
      createSampleTicket({
        id: "TK-404",
        day: 4,
        status: "in-progress",
        technician: "فاطمه کریمی",
        title: "عیب‌یابی سیستم تلفنی",
        hour: 10,
        minute: 0,
        priority: "high",
        category: "telephony",
        clientName: "پژمان کاوه",
        clientEmail: "p.kaveh@company.com",
        clientPhone: "09127651234",
        department: "پشتیبانی",
        description:
          "داخلی‌های سازمان به صورت تصادفی قطع می‌شوند و مکالمات نیمه‌تمام می‌ماند.",
      }),
      createSampleTicket({
        id: "TK-405",
        day: 5,
        status: "resolved",
        technician: "محمد نوری",
        title: "به‌روزرسانی سرور ایمیل",
        hour: 16,
        minute: 20,
        priority: "medium",
        category: "email",
        clientName: "سهیلا رنجبر",
        clientEmail: "s.ranjbar@company.com",
        clientPhone: "09121231234",
        department: "زیرساخت",
        description:
          "سرور ایمیل سازمان نیازمند نصب به‌روزرسانی امنیتی آخرین نسخه بود.",
      }),
      createSampleTicket({
        id: "TK-406",
        day: 5,
        status: "open",
        technician: undefined,
        title: "ثبت درخواست تجهیزات جدید",
        hour: 13,
        minute: 5,
        priority: "medium",
        category: "hardware",
        clientName: "رضا نیک‌بین",
        clientEmail: "r.nikbin@company.com",
        clientPhone: "09123331234",
        department: "انبار",
        description:
          "درخواست خرید و تجهیز سه دستگاه لپ‌تاپ برای نیروهای تازه‌وارد.",
      }),
      createSampleTicket({
        id: "TK-407",
        day: 8,
        status: "resolved",
        technician: "سارا محمدی",
        title: "حل مشکل ورود کاربران",
        hour: 9,
        minute: 10,
        priority: "high",
        category: "access",
        clientName: "الهام عباسی",
        clientEmail: "e.abbasi@company.com",
        clientPhone: "09124561234",
        department: "منابع انسانی",
        description:
          "کاربران سامانه حضور و غیاب قادر به ورود نبودند و نیاز به رفع فوری داشت.",
      }),
      createSampleTicket({
        id: "TK-408",
        day: 9,
        status: "in-progress",
        technician: "محمد نوری",
        title: "بررسی تاخیر شبکه داخلی",
        hour: 12,
        minute: 40,
        priority: "medium",
        category: "network",
        clientName: "کیوان ساعی",
        clientEmail: "k.saei@company.com",
        clientPhone: "09125443321",
        department: "عملیات",
        description:
          "گزارش تاخیر بالا در شبکه داخلی بین ساختمان مرکزی و انبار ارسال شده است.",
      }),
      createSampleTicket({
        id: "TK-409",
        day: 11,
        status: "open",
        technician: "علی احمدی",
        title: "خرابی دستگاه پرینتر طبقه سوم",
        hour: 14,
        minute: 55,
        priority: "low",
        category: "hardware",
        clientName: "نگار حسینی",
        clientEmail: "n.hosseini@company.com",
        clientPhone: "09121237890",
        department: "اداری",
        description:
          "پرینتر طبقه سوم کاغذ را چروک می‌کند و به طور کامل چاپ انجام نمی‌شود.",
      }),
      createSampleTicket({
        id: "TK-410",
        day: 12,
        status: "resolved",
        technician: "فاطمه کریمی",
        title: "پیکربندی سیستم پشتیبان‌گیری",
        hour: 10,
        minute: 25,
        priority: "high",
        category: "infrastructure",
        clientName: "شهرزاد پاکدل",
        clientEmail: "sh.pakdel@company.com",
        clientPhone: "09124567891",
        department: "فناوری اطلاعات",
        description:
          "سامانه پشتیبان‌گیری مرکزی نیازمند پیکربندی مجدد برای سرورهای جدید بود.",
      }),
      createSampleTicket({
        id: "TK-411",
        day: 14,
        status: "closed",
        technician: "سارا محمدی",
        title: "پیگیری تیکت VIP مدیریت",
        hour: 17,
        minute: 45,
        priority: "urgent",
        category: "support",
        clientName: "هیئت‌مدیره",
        clientEmail: "board@company.com",
        clientPhone: "021-88990000",
        department: "مدیریت",
        description:
          "درخواست پیگیری ویژه مدیریت ارشد برای گزارش وضعیت سامانه‌های کلیدی.",
      }),
      createSampleTicket({
        id: "TK-412",
        day: 15,
        status: "in-progress",
        technician: "حسن رضایی",
        title: "بازنگری سیاست‌های امنیتی",
        hour: 11,
        minute: 5,
        priority: "high",
        category: "security",
        clientName: "ندا کرمی",
        clientEmail: "n.karami@company.com",
        clientPhone: "09124445566",
        department: "امنیت اطلاعات",
        description:
          "پروژه بازنگری سیاست‌های امنیتی دسترسی کاربران در حال انجام است.",
      }),
      createSampleTicket({
        id: "TK-413",
        day: 17,
        status: "open",
        technician: undefined,
        title: "درخواست ایجاد حساب کاربری جدید",
        hour: 8,
        minute: 35,
        priority: "low",
        category: "access",
        clientName: "مهسا رضوی",
        clientEmail: "m.razavi@company.com",
        clientPhone: "09123334455",
        department: "منابع انسانی",
        description:
          "کارمند جدید واحد منابع انسانی نیاز به ایجاد حساب کاربری کامل دارد.",
      }),
      createSampleTicket({
        id: "TK-414",
        day: 18,
        status: "resolved",
        technician: "محمد نوری",
        title: "رفع اشکال تبادل فایل بین واحدها",
        hour: 16,
        minute: 55,
        priority: "medium",
        category: "network",
        clientName: "بهرام ساعاتی",
        clientEmail: "b.saati@company.com",
        clientPhone: "09123335544",
        department: "عملیات",
        description:
          "تبادل فایل بین واحدها به دلیل محدودیت پهنای باند با مشکل مواجه شده بود.",
      }),
      createSampleTicket({
        id: "TK-415",
        day: 21,
        status: "in-progress",
        technician: "علی احمدی",
        title: "پایش شبکه وایرلس شعبه غرب",
        hour: 9,
        minute: 25,
        priority: "medium",
        category: "network",
        clientName: "شعبه غرب",
        clientEmail: "west.branch@company.com",
        clientPhone: "021-44770000",
        department: "شعبات",
        description:
          "شبکه وایرلس شعبه غرب با قطعی‌های مکرر روبه‌روست و نیازمند پایش است.",
      }),
      createSampleTicket({
        id: "TK-416",
        day: 22,
        status: "resolved",
        technician: "فاطمه کریمی",
        title: "نصب دستگاه‌های مانیتورینگ",
        hour: 13,
        minute: 50,
        priority: "high",
        category: "infrastructure",
        clientName: "مرکز عملیات",
        clientEmail: "noc@company.com",
        clientPhone: "021-88880000",
        department: "مرکز عملیات",
        description:
          "دستگاه‌های مانیتورینگ جدید در اتاق NOC نیاز به نصب و راه‌اندازی داشتند.",
      }),
      createSampleTicket({
        id: "TK-417",
        day: 25,
        status: "open",
        technician: "سارا محمدی",
        title: "گزارش خطای سیستم حضور و غیاب",
        hour: 10,
        minute: 40,
        priority: "medium",
        category: "operations",
        clientName: "واحد اداری",
        clientEmail: "office@company.com",
        clientPhone: "021-88776655",
        department: "اداری",
        description:
          "سامانه حضور و غیاب خطای ثبت ورود برخی کارمندان را نمایش می‌دهد.",
      }),
      createSampleTicket({
        id: "TK-418",
        day: 27,
        status: "resolved",
        technician: "محمد نوری",
        title: "بهینه‌سازی پایگاه‌داده CRM",
        hour: 15,
        minute: 30,
        priority: "high",
        category: "software",
        clientName: "تیم فروش",
        clientEmail: "sales@company.com",
        clientPhone: "021-88770011",
        department: "فروش",
        description:
          "پایگاه‌داده CRM کند شده بود و نیاز به بهینه‌سازی شاخص‌ها داشت.",
      }),
      createSampleTicket({
        id: "TK-419",
        day: 28,
        status: "closed",
        technician: "حسن رضایی",
        title: "پروژه انتقال دیتاسنتر",
        hour: 17,
        minute: 10,
        priority: "urgent",
        category: "infrastructure",
        clientName: "مدیریت فناوری",
        clientEmail: "it.management@company.com",
        clientPhone: "021-88334455",
        department: "فناوری",
        description:
          "پروژه انتقال دیتاسنتر به محل جدید با موفقیت به پایان رسید و بسته شد.",
      }),
    ];
  }, []);

  const [showSampleData, setShowSampleData] = useState(
    () => tickets.length === 0
  );

  useEffect(() => {
    if (tickets.length === 0) setShowSampleData(true);
  }, [tickets.length]);

  const activeTickets = useMemo(
    () => (showSampleData ? sampleTickets : tickets),
    [showSampleData, sampleTickets, tickets]
  );

  // Group by Jalali date key
  const groupedTickets = useMemo(() => {
    const map = new Map<string, any[]>();
    activeTickets.forEach((ticket) => {
      const d = getTicketDate(ticket);
      if (!d) return;
      const key = formatKeyJalali(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ticket);
    });
    return map;
  }, [activeTickets]);

  // Build Jalali month grid
  const calendarDays = useMemo<CalendarDay[]>(() => {
    const days: CalendarDay[] = [];
    const start = currentMonth; // first day of current Jalali month
    const startOffset = (start.day() + 1) % 7; // make Saturday index 0
    const daysInMonth = start.daysInMonth();

    // previous month spill
    for (let i = startOffset; i > 0; i--) {
      const date = start.subtract(i, "day");
      days.push({
        date,
        isCurrentMonth: false,
        tickets: groupedTickets.get(formatKeyJalali(date)) ?? [],
      });
    }

    // current month days
    for (let d = 0; d < daysInMonth; d++) {
      const date = start.add(d, "day");
      days.push({
        date,
        isCurrentMonth: true,
        tickets: groupedTickets.get(formatKeyJalali(date)) ?? [],
      });
    }

    // next month spill to fill last week
    const remaining = days.length % 7 === 0 ? 0 : 7 - (days.length % 7);
    for (let i = 1; i <= remaining; i++) {
      const date = start.add(daysInMonth - 1 + i, "day");
      days.push({
        date,
        isCurrentMonth: false,
        tickets: groupedTickets.get(formatKeyJalali(date)) ?? [],
      });
    }

    return days;
  }, [currentMonth, groupedTickets]);

  // Monthly summary (within current Jalali month)
  const monthSummary = useMemo(() => {
    const summary: Record<StatusBucket, number> = {
      answered: 0,
      working: 0,
      notResponded: 0,
    };
    activeTickets.forEach((ticket) => {
      const d = getTicketDate(ticket);
      if (!d) return;
      const sameJYear =
        d.calendar("jalali").year() === currentMonth.calendar("jalali").year();
      const sameJMonth =
        d.calendar("jalali").month() ===
        currentMonth.calendar("jalali").month();
      if (!sameJYear || !sameJMonth) return;
      const bucket = getStatusBucket(ticket.status);
      summary[bucket] += 1;
    });
    return summary;
  }, [activeTickets, currentMonth]);

  // Selected day (by Jalali key)
  const selectedDay = useMemo(() => {
    if (!selectedDateKey) return null;
    const [jy, jm, jd] = selectedDateKey.split("-").map((n) => parseInt(n, 10));
    if (!jy || !jm || !jd) return null;
    const date = dayjs()
      .calendar("jalali")
      .year(jy)
      .month(jm - 1)
      .date(jd);
    const ticketsForDay = groupedTickets.get(selectedDateKey) ?? [];
    const sortedTickets = [...ticketsForDay].sort(
      (a, b) =>
        getComparableTime(b.updatedAt || b.createdAt) -
        getComparableTime(a.updatedAt || a.createdAt)
    );
    return { date, tickets: sortedTickets };
  }, [groupedTickets, selectedDateKey]);

  useEffect(() => {
    setSelectedDateKey(null);
    setDialogOpen(false);
  }, [currentMonth]);

  useEffect(() => {
    setSelectedDateKey(null);
    setDialogOpen(false);
  }, [showSampleData]);

  const handleDayClick = (day: CalendarDay) => {
    if (!day.isCurrentMonth || day.tickets.length === 0) return;
    setSelectedDateKey(formatKeyJalali(day.date));
    setDialogOpen(true);
  };

  const goToPreviousMonth = () =>
    setCurrentMonth((prev) => prev.subtract(1, "month").startOf("month"));
  const goToNextMonth = () =>
    setCurrentMonth((prev) => prev.add(1, "month").startOf("month"));

  const todayKey = formatKeyJalali(dayjs());

  return (
    <>
      <Card className="border border-primary/20 bg-gradient-to-br from-background via-background to-primary/5">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div className="text-right">
                <CardTitle className="text-lg font-iran">
                  تقویم برنامه‌ریزی تیکت‌ها
                </CardTitle>
                <CardDescription className="font-iran">
                  بررسی توزیع روزانه‌ی تیکت‌ها و وضعیت رسیدگی تکنسین‌ها
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant={showSampleData ? "default" : "outline"}
                size="sm"
                onClick={() => setShowSampleData((prev) => !prev)}
                className="gap-1 rounded-full font-iran"
                disabled={showSampleData && tickets.length === 0}
                aria-pressed={showSampleData}
              >
                <Sparkles className="h-4 w-4" />
                {showSampleData
                  ? "نمایش داده‌های واقعی"
                  : "مشاهده داده‌های نمونه"}
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToNextMonth}
                  className="rounded-full"
                  aria-label="ماه بعد"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <div className="rounded-full bg-primary/10 px-4 py-1 text-sm font-iran text-primary">
                  {monthFormatter.format(currentMonth.toDate())}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToPreviousMonth}
                  className="rounded-full"
                  aria-label="ماه قبل"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            {(Object.keys(statusMeta) as StatusBucket[]).map((key) => (
              <div
                key={key}
                className="flex flex-col items-end gap-2 rounded-xl border bg-background/60 px-4 py-3 text-right"
                dir="rtl"
              >
                {/* Month summary badge: RTL-wrapped to the right */}
                <span
                  dir="rtl"
                  className={cn(
                    "self-end inline-flex justify-end text-right rounded-full px-3 py-1 text-sm font-iran",
                    "max-w-full break-words",
                    statusMeta[key].counterClass
                  )}
                  style={{ unicodeBidi: "plaintext" }}
                >
                  {buildRtlBadgeText(statusCountText[key], monthSummary[key])}
                </span>
                <p className="text-xs font-iran text-muted-foreground">
                  {statusMeta[key].description}
                </p>
              </div>
            ))}
          </div>

          {showSampleData && (
            <div className="flex items-start gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/10 px-4 py-3 text-primary">
              <Sparkles className="mt-1 h-4 w-4 shrink-0" />
              <div className="space-y-1 text-right">
                <p className="text-sm font-semibold">
                  داده‌های نمونه فعال هستند
                </p>
                <p className="text-xs text-primary/80">
                  برای مشاهده رفتار تقویم، مجموعه‌ای از تیکت‌های فرضی این ماه
                  نمایش داده شده‌اند.
                </p>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-7 gap-2 text-xs text-muted-foreground">
            {weekDays.map((day) => (
              <div
                key={day}
                className="rounded-lg bg-muted/40 py-2 text-center font-iran"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day) => {
              const key = formatKeyJalali(day.date);
              const statusCounts: Record<StatusBucket, number> = {
                answered: 0,
                working: 0,
                notResponded: 0,
              };

              day.tickets.forEach((ticket) => {
                const bucket = getStatusBucket(ticket.status);
                statusCounts[bucket] += 1;
              });

              const isToday = key === todayKey;

              return (
                <button
                  key={`${key}-${day.isCurrentMonth ? "current" : "other"}`}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    "relative flex min-h-[120px] flex-col rounded-2xl border p-3 text-right transition-all",
                    "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm",
                    day.isCurrentMonth
                      ? "bg-background"
                      : "bg-muted/50 text-muted-foreground",
                    day.tickets.length > 0
                      ? "cursor-pointer"
                      : "cursor-default opacity-70",
                    isToday && "border-primary/60 shadow-inner"
                  )}
                  disabled={!day.isCurrentMonth || day.tickets.length === 0}
                >
                  <div className="flex items-center justify-between text-xs font-medium font-iran">
                    <span>{day.date.calendar("jalali").date()}</span>
                    {isToday && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                        امروز
                      </span>
                    )}
                  </div>

                  {/* Right-anchored status counters inside each day cell (RTL + BiDi safe) */}
                  <div
                    className="absolute right-3 top-1/2 flex -translate-y-1/2 transform flex-col items-end gap-1 text-right"
                    dir="rtl"
                  >
                    {(Object.keys(statusMeta) as StatusBucket[]).map(
                      (bucket) => {
                        const count = statusCounts[bucket];
                        if (count === 0) return null;

                        const displayText = buildRtlBadgeText(
                          statusCountText[bucket],
                          count
                        );

                        return (
                          <span
                            key={bucket}
                            dir="rtl"
                            className={cn(
                              "self-end inline-flex justify-end text-right rounded-full px-2 py-1 text-[11px] font-iran",
                              "max-w-[92%] break-words", // wrap within the cell, keep right edge
                              statusMeta[bucket].counterClass
                            )}
                            style={{ unicodeBidi: "plaintext" }}
                          >
                            {displayText}
                          </span>
                        );
                      }
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen && Boolean(selectedDay)}
        onOpenChange={setDialogOpen}
      >
        {selectedDay && (
          <DialogContent className="max-w-3xl space-y-4 font-iran" dir="rtl">
            <DialogHeader className="space-y-2 text-right">
              <DialogTitle className="font-iran text-xl">
                تیکت‌های {fullDateFormatter.format(selectedDay.date.toDate())}
              </DialogTitle>
              <DialogDescription className="font-iran text-muted-foreground">
                در این روز {selectedDay.tickets.length} تیکت به‌روزرسانی شده
                است.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {(Object.keys(statusMeta) as StatusBucket[]).map((bucket) => {
                const count = selectedDay.tickets.filter(
                  (ticket) => getStatusBucket(ticket.status) === bucket
                ).length;
                if (count === 0) return null;
                return (
                  <div
                    key={bucket}
                    className="flex flex-col items-end gap-2 rounded-xl border bg-muted/40 px-4 py-3 text-sm text-right"
                    dir="rtl"
                  >
                    <span
                      dir="rtl"
                      className={cn(
                        "self-end inline-flex justify-end text-right rounded-full px-3 py-1 text-sm font-iran",
                        "max-w-full break-words",
                        statusMeta[bucket].counterClass
                      )}
                      style={{ unicodeBidi: "plaintext" }}
                    >
                      {buildRtlBadgeText(statusCountText[bucket], count)}
                    </span>
                  </div>
                );
              })}
            </div>

            <Separator />

            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4">
                {selectedDay.tickets.map((ticket: any) => {
                  const createdDisplay = formatDateValue(
                    ticket.createdAt,
                    dateFormatter
                  );
                  const statusLabel =
                    statusLabels[ticket.status] ?? ticket.status;
                  const statusClass =
                    statusColors[ticket.status] ??
                    "bg-slate-100 text-slate-700 border";
                  const technicianName =
                    ticket.assignedTechnicianName || "Unassigned";

                  return (
                    <div
                      key={ticket.id}
                      className="space-y-3 rounded-2xl border bg-muted/40 p-4 shadow-sm"
                    >
                      <InfoRow
                        icon={Hash}
                        label="Ticket ID"
                        value={
                          <span className="text-sm font-iran text-foreground">
                            {ticket.id}
                          </span>
                        }
                      />
                      <InfoRow
                        icon={Users}
                        label="Technician"
                        value={
                          <span className="text-sm font-iran text-foreground">
                            {technicianName}
                          </span>
                        }
                      />
                      <InfoRow
                        icon={CalendarDays}
                        label="Date Submitted"
                        value={
                          <span className="text-sm font-iran text-foreground">
                            {createdDisplay}
                          </span>
                        }
                      />
                      {/* Status badge at far right (RTL) */}
                      <InfoRow
                        icon={Flag}
                        label="Status"
                        value={
                          <Badge className={cn("font-iran", statusClass)}>
                            {statusLabel}
                          </Badge>
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
