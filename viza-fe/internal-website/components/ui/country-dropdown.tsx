"use client";
import React, { useCallback, useState, forwardRef, useEffect } from "react";

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

import { cn } from "@/lib/utils";

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
}

const filteredCountries: Country[] = countries.all.filter(
  (country: Country) =>
    country.emoji && country.status !== "deleted" && country.ioc !== "PRK"
);

const CountryDropdownComponent = (
  {
    onChange,
    defaultValue,
    disabled = false,
    placeholder = "Select a country",
    className,
  }: CountryDropdownProps,
  ref: React.ForwardedRef<HTMLButtonElement>
) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Country | null>(null);

  useEffect(() => {
    if (!defaultValue) {
      if (selected) setSelected(null);
      return;
    }
    if (defaultValue !== selected?.alpha3 && defaultValue !== selected?.name) {
      const match = filteredCountries.find(
        (c) =>
          c.alpha3 === defaultValue ||
          c.alpha2 === defaultValue ||
          c.name.toLowerCase() === defaultValue.toLowerCase()
      );
      setSelected(match ?? null);
    }
  }, [defaultValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = useCallback(
    (country: Country) => {
      setSelected(country);
      onChange?.(country);
      setOpen(false);
    },
    [onChange]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        ref={ref}
        className={cn(
          "flex h-12 w-full items-center justify-between whitespace-nowrap rounded-lg border border-[#e8e8e8] bg-transparent px-3 py-2 text-[15px] ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E] disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 hover:bg-secondary/80",
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
              {selected.name}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Globe className="h-4 w-4 shrink-0" />
            {placeholder}
          </div>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent
        collisionPadding={10}
        side="bottom"
        className="min-w-[--radix-popper-anchor-width] p-0"
      >
        <Command className="w-full">
          <CommandInput placeholder="Search country..." />
          <CommandList className="max-h-[200px] sm:max-h-[270px]">
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {filteredCountries
                .filter((x) => x.name)
                .map((option, key: number) => (
                  <CommandItem
                    className="flex items-center w-full gap-2 [&_svg]:size-auto"
                    key={key}
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
                        {option.name}
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
