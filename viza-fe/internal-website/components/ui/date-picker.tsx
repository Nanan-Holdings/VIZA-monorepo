"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  /** Date value as YYYY-MM-DD string */
  value?: string
  /** Callback with YYYY-MM-DD string */
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Parse YYYY-MM-DD string to Date in local time (avoid timezone offset)
  const date = value ? new Date(value + "T00:00:00") : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-12 w-full justify-start rounded-lg border-[#e8e8e8] text-left text-[15px] font-normal shadow-xs hover:bg-transparent focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E]",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarDays className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
          {date ? format(date, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            if (d) {
              onChange(format(d, "yyyy-MM-dd"))
              setOpen(false)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
