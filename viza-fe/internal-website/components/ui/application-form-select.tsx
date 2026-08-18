"use client";

import * as React from "react";
import { Check, CaretUpDown as ChevronsUpDown, MagnifyingGlass as Search } from "@phosphor-icons/react";
import { CircleFlag } from "react-circle-flags";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ApplicationSelectOption = {
  value: string;
  text: string;
  searchText?: string;
  flagCountryCode?: string;
};

type ApplicationSearchableMultiSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: ReadonlyArray<ApplicationSelectOption>;
  placeholder: string;
  disabled?: boolean;
  sideLocale?: "zh" | "en";
  className?: string;
  exclusiveOption?: string;
  forceWhiteBackground?: boolean;
};

type ApplicationFormSelectTriggerProps = React.ComponentPropsWithoutRef<typeof SelectTrigger> & {
  filled?: boolean;
  forceWhiteBackground?: boolean;
};

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const ApplicationFormSelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectTrigger>,
  ApplicationFormSelectTriggerProps
>(({ className, filled = false, forceWhiteBackground = false, ...props }, ref) => (
  <SelectTrigger
    ref={ref}
    className={cn("application-form-control", className)}
    data-filled={filled ? "true" : "false"}
    data-force-white={forceWhiteBackground ? "true" : "false"}
    {...props}
  />
));
ApplicationFormSelectTrigger.displayName = "ApplicationFormSelectTrigger";

const ApplicationFormSelectContent = React.forwardRef<
  React.ElementRef<typeof SelectContent>,
  React.ComponentPropsWithoutRef<typeof SelectContent>
>(({ className, ...props }, ref) => (
  <SelectContent
    ref={ref}
    className={cn(
      "rounded-[var(--application-control-radius)] shadow-none",
      className,
    )}
    {...props}
  />
));
ApplicationFormSelectContent.displayName = "ApplicationFormSelectContent";

const ApplicationFormSelectItem = React.forwardRef<
  React.ElementRef<typeof SelectItem>,
  React.ComponentPropsWithoutRef<typeof SelectItem>
>(({ className, ...props }, ref) => (
  <SelectItem
    ref={ref}
    className={cn(
      "rounded-[calc(var(--application-control-radius)-0.25rem)]",
      className,
    )}
    {...props}
  />
));
ApplicationFormSelectItem.displayName = "ApplicationFormSelectItem";

const ApplicationFormDropdownTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<"button"> & { filled?: boolean; forceWhiteBackground?: boolean }
>(({ className, type = "button", filled = false, forceWhiteBackground = false, ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cn(
      "application-form-control flex w-full items-center justify-between px-3 text-left text-[15px] focus:outline-none",
      className,
    )}
    data-filled={filled ? "true" : "false"}
    data-force-white={forceWhiteBackground ? "true" : "false"}
    {...props}
  />
));
ApplicationFormDropdownTrigger.displayName = "ApplicationFormDropdownTrigger";

function ApplicationSearchableSelect({
  value,
  onValueChange,
  options,
  placeholder,
  disabled = false,
  sideLocale = "en",
  className,
  onSearchQuery,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
  searching = false,
  loadingText,
  searchPlaceholder,
  emptyText,
  leadingIcon,
  forceWhiteBackground = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: ReadonlyArray<ApplicationSelectOption>;
  placeholder: string;
  disabled?: boolean;
  sideLocale?: "zh" | "en";
  className?: string;
  onSearchQuery?: (query: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  searching?: boolean;
  loadingText?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  leadingIcon?: React.ReactNode;
  forceWhiteBackground?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [pendingQuery, setPendingQuery] = React.useState(false);
  const onSearchQueryRef = React.useRef(onSearchQuery);
  const selectedMatches = options.filter((option) => option.value === value);
  const selected = selectedMatches[0];
  const selectedFlagCountryCodes = new Set(
    selectedMatches.map((option) => option.flagCountryCode).filter(Boolean),
  );
  const selectedIsAmbiguous = selectedMatches.length > 1 && selectedFlagCountryCodes.size > 1;
  const hasFlagOptions = options.some((option) => Boolean(option.flagCountryCode));
  const normalizedQuery = normalizeSearchText(query);
  const matchedOptions = React.useMemo(() => {
    if (!normalizedQuery) return options;
    return options
      .filter((option) => normalizeSearchText(`${option.text} ${option.value} ${option.searchText ?? ""}`).includes(normalizedQuery))
      .sort((left, right) => {
        const rank = (option: ApplicationSelectOption) => {
          const normalizedValue = normalizeSearchText(option.value);
          const normalizedText = normalizeSearchText(option.text);
          if (normalizedValue === normalizedQuery || normalizedValue.replace(/^\+/, "") === normalizedQuery) return 0;
          if (normalizedText.startsWith(normalizedQuery)) return 1;
          if (normalizedText.includes(`(${normalizedQuery})`) || normalizedText.includes(`(+${normalizedQuery})`)) return 2;
          return 3;
        };
        return rank(left) - rank(right);
      });
  }, [normalizedQuery, options]);
  const resolvedSearchPlaceholder = searchPlaceholder
    ?? (sideLocale === "zh" ? "搜索中文、英文或官方选项..." : "Search Chinese, English, or official option...");
  const resolvedEmptyText = emptyText
    ?? (sideLocale === "zh" ? "没有匹配选项" : "No matching options");

  React.useEffect(() => {
    onSearchQueryRef.current = onSearchQuery;
  }, [onSearchQuery]);

  React.useEffect(() => {
    if (!open || !onSearchQueryRef.current) {
      setPendingQuery(false);
      return;
    }
    const timer = window.setTimeout(() => {
      onSearchQueryRef.current?.(query);
      setPendingQuery(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open, query]);

  return (
    <Popover
      modal={false}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setQuery("");
          onSearchQueryRef.current?.("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <ApplicationFormDropdownTrigger
          disabled={disabled}
          filled={Boolean(selected)}
          forceWhiteBackground={forceWhiteBackground}
          className={cn(className, disabled && "cursor-not-allowed opacity-70")}
        >
          <span className="flex min-w-0 items-center gap-2">
            {leadingIcon ? <span className="shrink-0 text-gray-400">{leadingIcon}</span> : null}
            <ApplicationOptionFlag countryCode={selectedIsAmbiguous ? undefined : selected?.flagCountryCode} />
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selectedIsAmbiguous ? value : selected?.text || placeholder}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
        </ApplicationFormDropdownTrigger>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={24}
        className="w-[--radix-popover-trigger-width] overflow-hidden rounded-[var(--application-control-radius)] p-0 shadow-none"
        style={{ maxHeight: "min(300px, calc(100vh - 180px))" }}
      >
        <div className="border-b p-2">
          <div className="application-form-control flex h-10 min-h-0 items-center gap-2 px-3">
            <Search className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (onSearchQueryRef.current) setPendingQuery(true);
              }}
              placeholder={resolvedSearchPlaceholder}
              className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-gray-400"
              autoFocus
            />
          </div>
        </div>
        <div
          className="overscroll-auto overflow-y-auto p-1"
          style={{ maxHeight: "min(220px, calc(100vh - 270px))" }}
          onScroll={(event) => {
            if (!onLoadMore || !hasMore || searching || loadingMore || pendingQuery) return;
            const target = event.currentTarget;
            if (target.scrollHeight - target.scrollTop - target.clientHeight <= 48) onLoadMore();
          }}
        >
          {(searching || pendingQuery) && matchedOptions.length === 0 ? (
            <div className="px-3 py-3 text-[14px] text-gray-500">{loadingText ?? (sideLocale === "zh" ? "正在加载官方选项..." : "Loading official options...")}</div>
          ) : matchedOptions.length === 0 ? (
            <div className="px-3 py-3 text-[14px] text-gray-500">{resolvedEmptyText}</div>
          ) : (
            <>
              {matchedOptions.map((option, index) => (
                <button
                  key={`${option.value}-${option.text}-${index}`}
                  type="button"
                  className={cn("flex min-h-10 w-full items-center gap-2 rounded-[calc(var(--application-control-radius)-0.25rem)] px-3 py-2 text-left text-[14px] hover:bg-gray-100", value === option.value && "bg-gray-100")}
                  onClick={() => {
                    onValueChange(option.value);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check className={cn("h-4 w-4 shrink-0 text-[#03346E]", value === option.value ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                  <ApplicationOptionFlag
                    countryCode={option.flagCountryCode}
                    reserveSpace={hasFlagOptions}
                  />
                  <span className="min-w-0 break-words">{option.text}</span>
                </button>
              ))}
              {loadingMore ? <div className="px-3 py-3 text-center text-[13px] text-gray-500">{sideLocale === "zh" ? "正在加载更多官网航班..." : "Loading more official flights..."}</div> : null}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function parseMultiSelectValue(value: string): string[] {
  return value.split(",").map((part) => part.trim()).filter(Boolean);
}

function ApplicationOptionFlag({
  countryCode,
  reserveSpace = false,
}: {
  countryCode?: string;
  reserveSpace?: boolean;
}) {
  if (!countryCode) {
    return reserveSpace ? <span className="h-5 w-5 shrink-0" aria-hidden="true" /> : null;
  }

  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full">
      <CircleFlag
        countryCode={countryCode.toLowerCase()}
        height={20}
        width={20}
        alt=""
        aria-hidden="true"
      />
    </span>
  );
}

function ApplicationSearchableMultiSelect({
  value,
  onValueChange,
  options,
  placeholder,
  disabled = false,
  sideLocale = "en",
  className,
  exclusiveOption,
  forceWhiteBackground = false,
}: ApplicationSearchableMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const selectedValues = React.useMemo(() => parseMultiSelectValue(value), [value]);
  const selectedSet = React.useMemo(
    () => new Set(selectedValues.map((item) => item.toLowerCase())),
    [selectedValues],
  );
  const selectedOptions = options.filter((option) => selectedSet.has(option.value.toLowerCase()));
  const normalizedQuery = normalizeSearchText(query);
  const matchedOptions = React.useMemo(() => {
    if (!normalizedQuery) return options;
    return options.filter((option) =>
      normalizeSearchText(`${option.text} ${option.value} ${option.searchText ?? ""}`).includes(normalizedQuery),
    );
  }, [normalizedQuery, options]);
  const searchPlaceholder = sideLocale === "zh"
    ? "搜索中文、英文或官方选项..."
    : "Search Chinese, English, or official option...";
  const emptyText = sideLocale === "zh" ? "没有匹配选项" : "No matching options";
  const hasFlagOptions = options.some((option) => Boolean(option.flagCountryCode));

  const toggleValue = (nextValue: string) => {
    const normalized = nextValue.toLowerCase();
    const normalizedExclusiveOption = exclusiveOption?.toLowerCase();
    let nextValues: string[];

    if (selectedSet.has(normalized)) {
      nextValues = selectedValues.filter((item) => item.toLowerCase() !== normalized);
    } else if (normalizedExclusiveOption && normalized === normalizedExclusiveOption) {
      nextValues = [nextValue];
    } else {
      nextValues = [
        ...selectedValues.filter((item) => item.toLowerCase() !== normalizedExclusiveOption),
        nextValue,
      ];
    }

    onValueChange(nextValues.join(","));
  };

  return (
    <Popover
      modal={false}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <ApplicationFormDropdownTrigger
          disabled={disabled}
          filled={selectedOptions.length > 0}
          forceWhiteBackground={forceWhiteBackground}
          className={cn(
            "min-h-12 h-auto py-2",
            className,
            disabled && "cursor-not-allowed opacity-70",
          )}
        >
          {selectedOptions.length > 0 ? (
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              {selectedOptions.slice(0, 2).map((option) => (
                <span key={option.value} className="inline-flex min-w-0 items-center gap-1.5">
                  <ApplicationOptionFlag countryCode={option.flagCountryCode} />
                  <span className="truncate">{option.text}</span>
                </span>
              ))}
              {selectedOptions.length > 2 ? (
                <span className="shrink-0">+{selectedOptions.length - 2}</span>
              ) : null}
            </span>
          ) : (
            <span className="line-clamp-2 text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
        </ApplicationFormDropdownTrigger>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={24}
        className="w-[--radix-popover-trigger-width] overflow-hidden rounded-[var(--application-control-radius)] p-0 shadow-none"
        style={{ maxHeight: "min(320px, calc(100vh - 180px))" }}
      >
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 min-w-0 flex-1 border-0 bg-transparent py-3 text-[14px] outline-none placeholder:text-gray-400"
            autoFocus
          />
        </div>
        {selectedOptions.length > 0 ? (
          <div className="flex flex-wrap gap-1 border-b px-3 py-2">
            {selectedOptions.slice(0, 6).map((option) => (
              <button
                type="button"
                key={option.value}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2 py-1 text-xs text-brand-500"
                onClick={() => toggleValue(option.value)}
              >
                <ApplicationOptionFlag countryCode={option.flagCountryCode} />
                {option.text}
              </button>
            ))}
          </div>
        ) : null}
        <div
          className="overscroll-auto overflow-y-auto p-1"
          style={{ maxHeight: "min(200px, calc(100vh - 280px))" }}
        >
          {matchedOptions.length === 0 ? (
            <div className="px-3 py-3 text-[14px] text-gray-500">{emptyText}</div>
          ) : (
            matchedOptions.map((option, index) => {
              const checked = selectedSet.has(option.value.toLowerCase());
              return (
                <button
                  key={`${option.value}-${option.text}-${index}`}
                  type="button"
                  className={cn(
                    "flex min-h-10 w-full items-center gap-2 rounded-[calc(var(--application-control-radius)-0.25rem)] px-3 py-2 text-left text-[14px] hover:bg-gray-100",
                    checked && "bg-gray-100",
                  )}
                  onClick={() => toggleValue(option.value)}
                >
                  <Check
                    className={cn("h-4 w-4 shrink-0 text-brand-500", checked ? "opacity-100" : "opacity-0")}
                    aria-hidden="true"
                  />
                  <ApplicationOptionFlag
                    countryCode={option.flagCountryCode}
                    reserveSpace={hasFlagOptions}
                  />
                  <span className="min-w-0 break-words">{option.text}</span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export {
  ApplicationFormDropdownTrigger,
  ApplicationFormSelectContent,
  ApplicationFormSelectItem,
  ApplicationFormSelectTrigger,
  ApplicationSearchableMultiSelect,
  ApplicationSearchableSelect,
  type ApplicationFormSelectTriggerProps,
  type ApplicationSearchableMultiSelectProps,
  type ApplicationSelectOption,
};
