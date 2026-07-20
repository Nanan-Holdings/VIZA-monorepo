"use client";
import React, { useCallback, useState, forwardRef, useEffect, useMemo } from "react";
import { useLocale } from "next-intl";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { cn, matchesSearchText } from "@/lib/utils";

import { ChevronDown, CheckIcon, Globe } from "lucide-react";
import { CircleFlag } from "react-circle-flags";

import { countries } from "country-data-list";

export type Country = {
  alpha2: string;
  alpha3: string;
  countryCallingCodes: string[];
  currencies: string[];
  emoji?: string;
  ioc: string;
  languages: string[];
  name: string;
  status: string;
};

interface CountryDropdownProps {
  onChange?: (country: Country) => void;
  defaultValue?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  displayLocale?: string;
  allowedCountryCodes?: readonly string[];
}

const filteredCountries: Country[] = countries.all.filter(
  (country: Country) =>
    country.emoji && country.status !== "deleted" && country.ioc !== "PRK"
);

function getLocalizedName(alpha2: string, locale: string): string {
  try {
    const displayNames = new Intl.DisplayNames([locale], { type: "region" });
    return displayNames.of(alpha2.toUpperCase()) ?? "";
  } catch {
    return "";
  }
}

const CountryDropdownComponent = (
  {
    onChange,
    defaultValue,
    disabled = false,
    placeholder = "Select a country",
    className,
    displayLocale,
    allowedCountryCodes,
  }: CountryDropdownProps,
  ref: React.ForwardedRef<HTMLButtonElement>
) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Country | null>(null);
  const locale = useLocale();
  const resolvedLocale = displayLocale ?? locale;
  const availableCountries = useMemo(() => {
    if (!allowedCountryCodes?.length) return filteredCountries;
    const allowed = new Set(allowedCountryCodes.map((code) => code.toUpperCase()));
    return filteredCountries.filter((country) => allowed.has(country.alpha2.toUpperCase()));
  }, [allowedCountryCodes]);

  const localizedMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of availableCountries) {
      const localized = getLocalizedName(c.alpha2, resolvedLocale);
      if (localized) map.set(c.alpha2, localized);
    }
    return map;
  }, [availableCountries, resolvedLocale]);

  const chineseNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of availableCountries) {
      const localized = getLocalizedName(c.alpha2, "zh");
      if (localized) map.set(c.alpha2, localized);
    }
    return map;
  }, [availableCountries]);

  useEffect(() => {
    if (!defaultValue) {
      if (selected) setSelected(null);
      return;
    }
    if (defaultValue !== selected?.alpha3 && defaultValue !== selected?.name) {
      const match = availableCountries.find(
        (c) =>
          c.alpha3 === defaultValue ||
          c.alpha2 === defaultValue ||
          c.name.toLowerCase() === defaultValue.toLowerCase() ||
          (localizedMap.get(c.alpha2) ?? "").toLowerCase() === defaultValue.toLowerCase()
      );
      setSelected(match ?? null);
    }
  }, [availableCountries, defaultValue, localizedMap]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = useCallback(
    (country: Country) => {
      setSelected(country);
      onChange?.(country);
      setOpen(false);
    },
    [onChange]
  );

  const getDisplayName = (country: Country) => {
    const localized = localizedMap.get(country.alpha2);
    if (resolvedLocale.startsWith("zh")) {
      return localized || country.name;
    }
    return country.name;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        ref={ref}
        className={cn(
          "flex h-12 w-full items-center justify-between rounded-lg border border-[#e8e8e8] bg-transparent px-3 text-[15px] font-normal shadow-xs hover:bg-transparent focus:outline-none focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        disabled={disabled}
      >
        {selected ? (
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="inline-flex items-center justify-center w-5 h-5 shrink-0 overflow-hidden rounded-full">
              <CircleFlag
                countryCode={selected.alpha2.toLowerCase()}
                height={20}
              />
            </div>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">
              {getDisplayName(selected)}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Globe className="h-4 w-4 shrink-0 text-gray-400" />
            {placeholder}
          </div>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
      </PopoverTrigger>
      <PopoverContent
        collisionPadding={10}
        side="bottom"
        className="min-w-[--radix-popper-anchor-width] p-0"
      >
        <Command
          className="w-full"
          filter={(value, search, keywords) => {
            return matchesSearchText(search, [value, ...(keywords ?? [])]) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={resolvedLocale === "zh" ? "搜索国家..." : "Search country..."} />
          <CommandList className="max-h-[200px] sm:max-h-[270px]">
            <CommandEmpty>{resolvedLocale === "zh" ? "未找到国家" : "No country found."}</CommandEmpty>
            <CommandGroup>
              {availableCountries
                .filter((x) => x.name)
                .map((option, key: number) => (
                  <CommandItem
                    className="flex items-center w-full gap-2 [&_svg]:size-auto"
                    key={key}
                    value={option.alpha2}
                    keywords={[
                      option.name,
                      localizedMap.get(option.alpha2) ?? "",
                      chineseNameMap.get(option.alpha2) ?? "",
                      option.alpha3,
                    ]}
                    onSelect={() => handleSelect(option)}
                  >
                    <div className="flex flex-grow items-center space-x-2 overflow-hidden">
                      <div className="inline-flex items-center justify-center w-5 h-5 shrink-0 overflow-hidden rounded-full">
                        <CircleFlag
                          countryCode={option.alpha2.toLowerCase()}
                          height={20}
                        />
                      </div>
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                        {getDisplayName(option)}
                      </span>
                    </div>
                    <CheckIcon
                      className={cn(
                        "ml-auto !h-4 !w-4 shrink-0",
                        selected?.alpha3 === option.alpha3
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

CountryDropdownComponent.displayName = "CountryDropdown";

export const CountryDropdown = forwardRef(CountryDropdownComponent);
