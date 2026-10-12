"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ApplicationFormSelectContent,
  ApplicationFormSelectItem,
  ApplicationFormSelectTrigger,
} from "@/components/ui/application-form-select";
import {
  Select,
  SelectValue,
} from "@/components/ui/select";

import countryRegionData from "country-region-data/data.json";

type Region = {
  name: string;
  shortCode: string;
};

type CountryRegion = {
  countryName: string;
  countryShortCode: string;
  regions: Region[];
};

const EMPTY_REGION_CODES: string[] = [];

interface RegionSelectProps {
  countryCode: string;
  defaultValue?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  priorityOptions?: string[];
  whitelist?: string[];
  blacklist?: string[];
  onChange?: (region: Region) => void;
  /**
   * Formats the user-facing region label while preserving the canonical
   * short code emitted by the select. When omitted, the source region name
   * is shown unchanged.
   */
  formatRegionName?: (region: Region) => string;
  forceWhiteBackground?: boolean;
}

function filterRegions(
  regions: Region[],
  priorityRegions: string[],
  whitelist: string[],
  blacklist: string[],
): Region[] {
  let filtered = regions;

  if (whitelist.length > 0) {
    filtered = filtered.filter(({ shortCode }) => whitelist.includes(shortCode));
  } else if (blacklist.length > 0) {
    filtered = filtered.filter(({ shortCode }) => !blacklist.includes(shortCode));
  }

  if (priorityRegions.length === 0) return filtered;

  const prioritized: Region[] = [];
  for (const code of priorityRegions) {
    const match = filtered.find((region) => region.shortCode === code);
    if (match) prioritized.push(match);
  }

  const rest = filtered.filter((region) => !priorityRegions.includes(region.shortCode));
  return [...prioritized, ...rest];
}

export function RegionSelect({
  countryCode,
  defaultValue,
  disabled = false,
  placeholder = "Region",
  className,
  priorityOptions = EMPTY_REGION_CODES,
  whitelist = EMPTY_REGION_CODES,
  blacklist = EMPTY_REGION_CODES,
  onChange,
  formatRegionName,
  forceWhiteBackground = false,
}: RegionSelectProps) {
  const [value, setValue] = useState<string>("");

  const regions = useMemo(() => {
    const country = (countryRegionData as CountryRegion[]).find(
      (entry) => entry.countryShortCode === countryCode,
    );

    if (!country) return [];
    return filterRegions(country.regions, priorityOptions, whitelist, blacklist);
  }, [countryCode, priorityOptions, whitelist, blacklist]);

  useEffect(() => {
    if (!defaultValue) {
      setValue("");
      return;
    }

    const match = regions.find(
      (region) =>
        region.shortCode.toLowerCase() === defaultValue.toLowerCase()
        || region.name.toLowerCase() === defaultValue.toLowerCase(),
    );

    setValue(match?.shortCode ?? "");
  }, [defaultValue, regions]);

  return (
    <Select
      value={value}
      onValueChange={(nextValue) => {
        const selectedRegion = regions.find((region) => region.shortCode === nextValue);
        // Radix's native form bridge can emit an empty value while mounting.
        // There is no empty menu item, so only actual catalog selections may
        // replace the displayed value. Prop changes still clear it above.
        if (!selectedRegion) return;
        setValue(nextValue);
        onChange?.(selectedRegion);
      }}
      disabled={disabled}
    >
      <ApplicationFormSelectTrigger
        className={className}
        filled={Boolean(value)}
        forceWhiteBackground={forceWhiteBackground}
      >
        <SelectValue placeholder={placeholder} />
      </ApplicationFormSelectTrigger>
      <ApplicationFormSelectContent>
        {regions.map((region) => (
          <ApplicationFormSelectItem key={region.shortCode} value={region.shortCode}>
            {formatRegionName ? formatRegionName(region) : region.name}
          </ApplicationFormSelectItem>
        ))}
      </ApplicationFormSelectContent>
    </Select>
  );
}
