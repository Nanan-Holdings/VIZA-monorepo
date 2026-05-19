"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  ClipboardList,
  Copy,
  CreditCard,
  FileText,
  Headphones,
  Loader2,
  Mail,
  MessageCircleQuestion,
  Search,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TopicKey = "refund" | "status" | "documents" | "payment" | "account" | "human";

const SUPPORT_EMAIL = "support@viza.com";

const TOPICS: Array<{
  key: TopicKey;
  icon: LucideIcon;
  href?: string;
}> = [
  { key: "refund", icon: Banknote, href: "/client/billing" },
  { key: "status", icon: ClipboardList, href: "/client/status" },
  { key: "documents", icon: FileText, href: "/client/documents" },
  { key: "payment", icon: CreditCard, href: "/client/billing" },
  { key: "account", icon: UserRound, href: "/client/settings" },
  { key: "human", icon: Headphones },
];

const TOPIC_KEYWORDS: Record<TopicKey, string[]> = {
  refund: ["refund", "money", "cancel", "退款", "退费", "取消", "退钱"],
  status: ["status", "progress", "where", "track", "状态", "进度", "到哪", "查询"],
  documents: ["document", "file", "ocr", "passport", "photo", "材料", "文件", "护照", "照片"],
  payment: ["pay", "card", "invoice", "receipt", "账单", "付款", "支付", "收据", "发票"],
  account: ["login", "email", "password", "account", "登录", "邮箱", "密码", "账户", "账号"],
  human: ["human", "agent", "staff", "support", "客服", "人工", "真人"],
};

function inferTopic(input: string): TopicKey {
  const normalized = input.toLowerCase();
  for (const topic of TOPICS) {
    if (TOPIC_KEYWORDS[topic.key].some((keyword) => normalized.includes(keyword))) {
      return topic.key;
    }
  }
  return "human";
}

function buildMailto(topicTitle: string, question: string) {
  const subject = encodeURIComponent(`VIZA support request: ${topicTitle}`);
  const body = encodeURIComponent(
    [
      "Hi VIZA Support,",
      "",
      `Topic: ${topicTitle}`,
      question ? `Question: ${question}` : "Question:",
      "",
      "Please include your account email, application destination, and application reference if available.",
    ].join("\n"),
  );
  return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
}

export function SupportCenterClient() {
  const t = useTranslations("supportCenter");
  const [query, setQuery] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<TopicKey | null>(null);
  const [handoffRequested, setHandoffRequested] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedTopicConfig = TOPICS.find((topic) => topic.key === selectedTopic) ?? null;
  const selectedTopicTitle = selectedTopic ? t(`topics.${selectedTopic}.title`) : "";
  const mailtoHref = buildMailto(selectedTopicTitle || t("human.title"), submittedQuestion);

  const filteredTopics = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return TOPICS;

    return TOPICS.filter((topic) => {
      const title = t(`topics.${topic.key}.title`).toLowerCase();
      const description = t(`topics.${topic.key}.description`).toLowerCase();
      return (
        title.includes(normalizedQuery) ||
        description.includes(normalizedQuery) ||
        TOPIC_KEYWORDS[topic.key].some((keyword) => normalizedQuery.includes(keyword))
      );
    });
  }, [query, t]);

  function selectTopic(topic: TopicKey, question = "") {
    setSelectedTopic(topic);
    setSubmittedQuestion(question);
    setHandoffRequested(topic === "human");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    selectTopic(inferTopic(trimmedQuery), trimmedQuery);
  }

  async function copyEmail() {
    if (!navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(SUPPORT_EMAIL);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 pb-16">
      <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
        <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-center">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-normal text-brand-500">{t("eyebrow")}</p>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-foreground">{t("title")}</h1>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground">{t("subtitle")}</p>
            </div>
          </div>
          <div className="rounded-lg border border-brand-100 bg-brand-50 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand-500">
                <Headphones className="h-5 w-5" />
              </span>
              <div className="space-y-1">
                <p className="font-semibold text-brand-900">{t("humanCard.title")}</p>
                <p className="text-sm leading-6 text-brand-800">{t("humanCard.description")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
            <form className="space-y-3" onSubmit={handleSubmit}>
              <label className="text-sm font-semibold text-foreground" htmlFor="support-question">
                {t("questionLabel")}
              </label>
              <div className="flex min-h-12 items-center gap-2 rounded-lg border border-input bg-background px-3 focus-within:ring-1 focus-within:ring-ring">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  id="support-question"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                  placeholder={t("questionPlaceholder")}
                />
                <button
                  type="submit"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white transition-colors hover:bg-brand-400 disabled:bg-muted"
                  disabled={!query.trim()}
                  aria-label={t("send")}
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("topicsTitle")}</h2>
              <span className="text-xs font-medium text-muted-foreground">{t("topicsHint")}</span>
            </div>
            <div className="space-y-2">
              {filteredTopics.map((topic) => {
                const Icon = topic.icon;
                const active = selectedTopic === topic.key;
                return (
                  <button
                    key={topic.key}
                    type="button"
                    onClick={() => selectTopic(topic.key)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg border bg-white p-4 text-left shadow-sm transition",
                      active
                        ? "border-brand-300 bg-brand-50 text-brand-900"
                        : "border-border text-foreground hover:border-brand-200 hover:bg-brand-50/50",
                    )}
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 space-y-1">
                      <span className="block font-semibold">{t(`topics.${topic.key}.title`)}</span>
                      <span className="block text-sm leading-6 text-muted-foreground">
                        {t(`topics.${topic.key}.description`)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </aside>

        <section className="min-h-[620px] rounded-lg border border-border bg-white shadow-sm">
          <div className="flex h-full flex-col">
            <div className="border-b border-border p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                  <MessageCircleQuestion className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-semibold">{t("botName")}</h2>
                  <p className="text-sm text-muted-foreground">{t("botSubtitle")}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-4 p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                  <Loader2 className="h-4 w-4" />
                </span>
                <div className="max-w-2xl rounded-lg bg-muted px-4 py-3 text-sm leading-6 text-foreground">
                  {t("greeting")}
                </div>
              </div>

              {submittedQuestion && (
                <div className="flex justify-end">
                  <div className="max-w-2xl rounded-lg bg-brand-500 px-4 py-3 text-sm leading-6 text-white">
                    {submittedQuestion}
                  </div>
                </div>
              )}

              {selectedTopic && selectedTopicConfig && (
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <div className="max-w-3xl space-y-4 rounded-lg border border-border bg-white p-4 shadow-sm">
                    <div className="space-y-2">
                      <p className="font-semibold">{t(`topics.${selectedTopic}.answerTitle`)}</p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {t(`topics.${selectedTopic}.answer`)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {selectedTopicConfig.href && (
                        <Button asChild className="bg-brand-500 hover:bg-brand-400">
                          <Link href={selectedTopicConfig.href}>
                            {t(`topics.${selectedTopic}.action`)}
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                      <Button type="button" variant="outline" onClick={() => setHandoffRequested(true)}>
                        <Headphones className="h-4 w-4" />
                        {t("requestHuman")}
                      </Button>
                      <Button asChild variant="outline">
                        <a href={mailtoHref}>
                          <Mail className="h-4 w-4" />
                          {t("emailSupport")}
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {handoffRequested && (
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <div className="max-w-3xl space-y-4 rounded-lg border border-brand-100 bg-brand-50 p-4">
                    <div className="space-y-2">
                      <p className="font-semibold text-brand-900">{t("handoff.title")}</p>
                      <p className="text-sm leading-6 text-brand-800">{t("handoff.description")}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild className="bg-brand-500 hover:bg-brand-400">
                        <a href={mailtoHref}>
                          <Mail className="h-4 w-4" />
                          {SUPPORT_EMAIL}
                        </a>
                      </Button>
                      <Button type="button" variant="outline" onClick={copyEmail}>
                        <Copy className="h-4 w-4" />
                        {copied ? t("copied") : t("copyEmail")}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
