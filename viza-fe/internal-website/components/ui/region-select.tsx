"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// @ts-expect-error - package ships UMD data without typed default export
import countryRegionData from "country-region-data/dist/data-umd";

type Region = {
  name: string;
  shortCode: string;
};

type CountryRegion = {
  countryName: string;
  countryShortCode: string;
  regions: Region[];
};

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
  priorityOptions = [],
  whitelist = [],
  blacklist = [],
  onChange,
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
        setValue(nextValue);
        const selectedRegion = regions.find((region) => region.shortCode === nextValue);
        if (selectedRegion) onChange?.(selectedRegion);
      }}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {regions.map(({ name, shortCode }) => (
          <SelectItem key={shortCode} value={shortCode}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}