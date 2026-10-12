"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  MagnifyingGlass,
  NotePencil,
  Pencil,
  Trash,
  X,
} from "@phosphor-icons/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type TravelSessionHistoryItem = {
  id: string;
  title: string;
  updatedAt: string;
  searchText: string;
};

type TravelSessionHistoryProps = {
  sessions: TravelSessionHistoryItem[];
  activeSessionId: string;
  disabled: boolean;
  loading?: boolean;
  onNewSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onDeleteSession: (sessionId: string) => void;
};

export function TravelSessionHistory({
  sessions,
  activeSessionId,
  disabled,
  loading = false,
  onNewSession,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
}: TravelSessionHistoryProps) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const actionsDisabled = disabled || loading;
  const activeTitle = sessions.find(
    (session) => session.id === activeSessionId
  )?.title;
  const deletingSession = sessions.find((session) => session.id === deleteId);
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }),
    [locale]
  );
  const visibleSessions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(locale);
    return sessions
      .filter(
        (session) =>
          !query ||
          `${session.title}\n${session.searchText}`
            .toLocaleLowerCase(locale)
            .includes(query)
      )
      .slice()
      .sort(
        (a, b) =>
          (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0)
      );
  }, [sessions, search, locale]);

  const changeOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    setSearch("");
    setEditingId(null);
    setDeleteId(null);
  };
  const newSession = () => {
    if (actionsDisabled) return;
    onNewSession();
    changeOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={changeOpen}>
      <div
        className="flex min-h-14 shrink-0 items-center gap-2 border-b px-3 py-1 sm:pl-10 sm:pr-4 md:pl-12 md:pr-6"
        data-testid="travel-session-toolbar"
      >
        <SheetTrigger asChild>
          <Button
            className="h-11 shrink-0 gap-2 px-2"
            variant="ghost"
            data-testid="travel-session-toggle"
            aria-label={t("searchChats")}
          >
            <MagnifyingGlass className="h-4 w-4" />
            <span>{t("searchChats")}</span>
          </Button>
        </SheetTrigger>
        <p
          className="min-w-0 flex-1 truncate text-sm text-muted-foreground"
          title={activeTitle}
        >
          {activeTitle || t("sessionUntitled")}
        </p>
        <Button
          className="h-11 w-11 shrink-0"
          variant="ghost"
          size="icon"
          disabled={actionsDisabled}
          onClick={newSession}
          aria-label={t("sessionNew")}
          title={t("sessionNew")}
          data-testid="travel-new-session-button"
        >
          <NotePencil className="h-5 w-5" />
        </Button>
      </div>
      <SheetContent
        side="left"
        className="flex w-[calc(100%-1rem)] max-w-sm flex-col gap-4 p-4 [&>button.absolute]:hidden"
        data-testid="travel-chat-session-sidebar"
      >
        <SheetHeader className="pr-12 text-left">
          <SheetTitle>{t("sessionHistory")}</SheetTitle>
          <SheetDescription>{t("travelAI")}</SheetDescription>
          <div className="absolute right-2 top-2">
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                aria-label={t("sessionClose")}
                data-testid="travel-session-close-button"
              >
                <X className="h-5 w-5" />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>
        <label className="space-y-2 text-sm font-medium">
          <span>{t("searchChats")}</span>
          <Input
            type="search"
            className="h-11 text-base"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
            data-testid="travel-session-search"
          />
        </label>
        <Button
          className="min-h-11 justify-start gap-2"
          variant="outline"
          disabled={actionsDisabled}
          onClick={newSession}
        >
          <NotePencil className="h-5 w-5" />
          {t("sessionNew")}
        </Button>
        <p className="text-sm font-medium text-muted-foreground">
          {t("sessionRecent")}
        </p>
        <div
          className="ay-scrollbar-visible min-h-0 flex-1 space-y-2 overflow-y-auto"
          aria-busy={loading}
        >
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : visibleSessions.length === 0 ? (
            <Empty className="border-0 p-4" role="status">
              <EmptyHeader>
                <EmptyTitle className="text-sm font-normal text-muted-foreground">
                  {t(sessions.length ? "noResults" : "noConversations")}
                </EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            visibleSessions.map((session) => {
              const title = session.title || t("sessionUntitled");
              const active = session.id === activeSessionId;
              const date = new Date(session.updatedAt);
              return (
                <div
                  key={session.id}
                  className={`rounded-lg p-2 ${active ? "bg-brand-50 text-brand-600" : "text-foreground"}`}
                  data-testid="travel-session-item"
                >
                  {editingId === session.id ? (
                    <form
                      className="space-y-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (actionsDisabled || !draftTitle.trim()) return;
                        onRenameSession(session.id, draftTitle.trim());
                        setEditingId(null);
                      }}
                    >
                      <Input
                        autoFocus
                        aria-label={t("sessionTitleInput")}
                        className="h-11 text-base"
                        value={draftTitle}
                        maxLength={80}
                        disabled={actionsDisabled}
                        data-testid="travel-session-rename-input"
                        onChange={(event) => setDraftTitle(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            event.preventDefault();
                            event.stopPropagation();
                            setEditingId(null);
                          }
                        }}
                      />
                      <div className="flex gap-2">
                        <Button
                          className="min-h-11"
                          type="submit"
                          disabled={actionsDisabled || !draftTitle.trim()}
                          data-testid="travel-session-save-rename"
                        >
                          {t("sessionSave")}
                        </Button>
                        <Button
                          className="min-h-11"
                          type="button"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          data-testid="travel-session-cancel-rename"
                        >
                          {t("sessionCancel")}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="min-h-11 min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                        aria-pressed={active}
                        disabled={actionsDisabled}
                        onClick={() => {
                          onSelectSession(session.id);
                          changeOpen(false);
                        }}
                      >
                        <span className="block truncate text-sm font-medium">
                          {title}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {Number.isNaN(date.getTime())
                            ? ""
                            : dateFormatter.format(date)}
                        </span>
                      </button>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          className="h-11 w-11"
                          variant="ghost"
                          size="icon"
                          aria-label={t("sessionRename", { title })}
                          disabled={actionsDisabled}
                          data-testid="travel-session-rename-button"
                          onClick={() => {
                            setEditingId(session.id);
                            setDraftTitle(title);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          className="h-11 w-11 text-destructive hover:text-destructive"
                          variant="ghost"
                          size="icon"
                          aria-label={t("sessionDelete", { title })}
                          disabled={actionsDisabled}
                          data-testid="travel-session-delete-button"
                          onClick={() => setDeleteId(session.id)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        <AlertDialog
          open={Boolean(deletingSession)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setDeleteId(null);
          }}
        >
          <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>{t("sessionDeleteConfirm")}</AlertDialogTitle>
              <AlertDialogDescription>
                {deletingSession?.title}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                className="min-h-11"
                aria-label={t("sessionCancelDelete")}
              >
                {t("sessionCancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                className={buttonVariants({
                  variant: "destructive",
                  className: "min-h-11",
                })}
                disabled={actionsDisabled}
                aria-label={t("sessionConfirmDelete", {
                  title: deletingSession?.title || t("sessionUntitled"),
                })}
                onClick={() => {
                  if (!actionsDisabled && deletingSession)
                    onDeleteSession(deletingSession.id);
                }}
              >
                <Trash className="mr-2 h-4 w-4" />
                {t("sessionDeleteConfirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
