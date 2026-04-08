"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, getDay } from "date-fns"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface SelectedDate {
  date: string // YYYY-MM-DD format
  timePeriod: 'morning' | 'evening' | 'custom'
}

interface ExistingSlot {
  date: string
  startTime: string
  endTime: string
  id?: string
}

interface CalendarDatePickerProps {
  selectedDates: SelectedDate[]
  onSelectedDatesChange: (dates: SelectedDate[]) => void
  useCustomTimes?: boolean
  existingSlots?: ExistingSlot[]
  selectedExistingSlots?: string[]
  onSelectedExistingSlotsChange?: (slotIds: string[]) => void
}

export function CalendarDatePicker({
  selectedDates,
  onSelectedDatesChange,
  useCustomTimes = false,
  existingSlots = [],
  selectedExistingSlots = [],
  onSelectedExistingSlotsChange,
}: CalendarDatePickerProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date())
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragPeriod, setDragPeriod] = React.useState<'morning' | 'evening' | 'custom' | null>(null)
  const [dragAction, setDragAction] = React.useState<'select' | 'deselect'>('select')
  const pendingDatesRef = React.useRef<SelectedDate[]>([])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Add leading empty cells for days before month starts
  const firstDayOfWeek = getDay(monthStart)
  const leadingEmptyCells = Array(firstDayOfWeek).fill(null)

  const allCells = [...leadingEmptyCells, ...days]
  const weeks = Array.from({ length: Math.ceil(allCells.length / 7) }, (_, i) =>
    allCells.slice(i * 7, (i + 1) * 7)
  )

  const isDateSelected = (date: Date, period: 'morning' | 'evening' | 'custom') => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return selectedDates.some(d => d.date === dateStr && d.timePeriod === period)
  }

  const hasExistingAvailability = (date: Date, period: 'morning' | 'evening') => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return existingSlots.some(slot => {
      if (slot.date !== dateStr) return false
      const startHour = parseInt(slot.startTime.split(':')[0], 10)
      if (period === 'morning') {
        return startHour >= 9 && startHour < 12
      } else {
        return startHour >= 13 && startHour < 18
      }
    })
  }

  const isExistingSlotSelectedForDeletion = (date: Date, period: 'morning' | 'evening') => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return existingSlots.some(slot => {
      if (slot.date !== dateStr || !slot.id) return false
      const startHour = parseInt(slot.startTime.split(':')[0], 10)
      const isCorrectPeriod = period === 'morning' 
        ? (startHour >= 9 && startHour < 12)
        : (startHour >= 13 && startHour < 18)
      return isCorrectPeriod && selectedExistingSlots.includes(slot.id)
    })
  }

  const handleExistingSlotClick = (date: Date, period: 'morning' | 'evening') => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const slot = existingSlots.find(s => {
      if (s.date !== dateStr || !s.id) return false
      const startHour = parseInt(s.startTime.split(':')[0], 10)
      return period === 'morning'
        ? (startHour >= 9 && startHour < 12)
        : (startHour >= 13 && startHour < 18)
    })

    if (slot && slot.id && onSelectedExistingSlotsChange) {
      if (selectedExistingSlots.includes(slot.id)) {
        onSelectedExistingSlotsChange(selectedExistingSlots.filter(id => id !== slot.id))
      } else {
        onSelectedExistingSlotsChange([...selectedExistingSlots, slot.id])
      }
    }
  }

  const handleDragStart = (date: Date, timePeriod: 'morning' | 'evening' | 'custom') => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const isSelected = isDateSelected(date, timePeriod)

    setIsDragging(true)
    setDragPeriod(timePeriod)
    setDragAction(isSelected ? 'deselect' : 'select')

    // Initialize pending dates
    if (isSelected) {
      // Deselecting - remove from current selection
      pendingDatesRef.current = selectedDates.filter(
        d => !(d.date === dateStr && d.timePeriod === timePeriod)
      )
    } else {
      // Selecting - add to current selection
      pendingDatesRef.current = [...selectedDates, { date: dateStr, timePeriod }]
    }

    onSelectedDatesChange(pendingDatesRef.current)
  }

  const handleDragEnter = (date: Date, timePeriod: 'morning' | 'evening' | 'custom') => {
    if (!isDragging || dragPeriod !== timePeriod) return

    const dateStr = format(date, 'yyyy-MM-dd')
    const alreadyInPending = pendingDatesRef.current.some(
      d => d.date === dateStr && d.timePeriod === timePeriod
    )

    if (dragAction === 'select' && !alreadyInPending) {
      pendingDatesRef.current = [...pendingDatesRef.current, { date: dateStr, timePeriod }]
      onSelectedDatesChange(pendingDatesRef.current)
    } else if (dragAction === 'deselect' && alreadyInPending) {
      pendingDatesRef.current = pendingDatesRef.current.filter(
        d => !(d.date === dateStr && d.timePeriod === timePeriod)
      )
      onSelectedDatesChange(pendingDatesRef.current)
    }
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    setDragPeriod(null)
  }

  // Global mouse up listener to end drag
  React.useEffect(() => {
    const handleMouseUp = () => {
      if (isDragging) {
        handleDragEnd()
      }
    }

    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [isDragging])

  const goToPreviousMonth = () => {
    setCurrentMonth(addMonths(currentMonth, -1))
  }

  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  const canGoToPreviousMonth = currentMonth > new Date()

  return (
    <div className="space-y-4">
      {/* Calendar Container */}
      <div className="border border-gray-200 rounded-lg p-4 bg-white select-none">
        {/* Month Header */}
        <div className="flex items-center justify-center gap-4 relative mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousMonth}
            disabled={!canGoToPreviousMonth}
            className="absolute left-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="text-lg font-semibold min-w-40 text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextMonth}
            className="absolute right-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Calendar Grid */}
        <div className="space-y-2">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Date Cells */}
        <div className="grid grid-cols-7 gap-1">
          {weeks.map((week, weekIdx) =>
            week.map((day, dayIdx) => {
              if (!day) {
                return <div key={`empty-${weekIdx}-${dayIdx}`} className="aspect-square" />
              }

              const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
              const isCurrentMonth = isSameMonth(day, currentMonth)
              const dateStr = format(day, 'yyyy-MM-dd')

              return (
                <div
                  key={dateStr}
                  className={cn(
                    'aspect-square flex flex-col items-center justify-center gap-1 p-1 rounded-lg border',
                    isCurrentMonth ? 'bg-white' : 'bg-gray-50',
                    isToday ? 'border-blue-400 border-2' : 'border-gray-200'
                  )}
                >
                  {/* Date Number */}
                  <span className={cn(
                    'text-sm font-semibold',
                    isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                  )}>
                    {format(day, 'd')}
                  </span>

                  {/* Time Period Buttons */}
                  {isCurrentMonth && (
                    <div className={cn(
                      "flex flex-col w-full",
                      useCustomTimes ? "flex-1" : "gap-0.5"
                    )}>
                      {useCustomTimes ? (
                        // Single unified button for custom times - fills height
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            handleDragStart(day, 'custom')
                          }}
                          onMouseEnter={() => handleDragEnter(day, 'custom')}
                          className={cn(
                            'flex-1 px-1 text-xs font-medium rounded transition-colors min-h-[28px]',
                            isDateSelected(day, 'custom')
                              ? 'bg-brand-500 text-white'
                              : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                          )}
                        >
                          Select
                        </button>
                      ) : (
                        <>
                          {/* Morning Button - on top */}
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              if (hasExistingAvailability(day, 'morning')) {
                                handleExistingSlotClick(day, 'morning')
                              } else {
                                handleDragStart(day, 'morning')
                              }
                            }}
                            onMouseEnter={() => {
                              if (!hasExistingAvailability(day, 'morning')) {
                                handleDragEnter(day, 'morning')
                              }
                            }}
                            className={cn(
                              'flex-1 px-0.5 py-0.5 text-xs font-medium rounded transition-colors relative',
                              isDateSelected(day, 'morning')
                                ? 'bg-brand-500 text-white'
                                : isExistingSlotSelectedForDeletion(day, 'morning')
                                ? 'bg-red-500 text-white hover:bg-red-600 border-2 border-red-700'
                                : hasExistingAvailability(day, 'morning')
                                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300 cursor-pointer'
                                : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                            )}
                            title={isExistingSlotSelectedForDeletion(day, 'morning') ? "Click to deselect for deletion" : hasExistingAvailability(day, 'morning') ? "Click to select for deletion" : "Morning: 9am-12pm"}
                          >
                            AM
                          </button>

                          {/* Evening Button - on bottom */}
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              if (hasExistingAvailability(day, 'evening')) {
                                handleExistingSlotClick(day, 'evening')
                              } else {
                                handleDragStart(day, 'evening')
                              }
                            }}
                            onMouseEnter={() => {
                              if (!hasExistingAvailability(day, 'evening')) {
                                handleDragEnter(day, 'evening')
                              }
                            }}
                            className={cn(
                              'flex-1 px-0.5 py-0.5 text-xs font-medium rounded transition-colors relative',
                              isDateSelected(day, 'evening')
                                ? 'bg-brand-500 text-white'
                                : isExistingSlotSelectedForDeletion(day, 'evening')
                                ? 'bg-red-500 text-white hover:bg-red-600 border-2 border-red-700'
                                : hasExistingAvailability(day, 'evening')
                                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300 cursor-pointer'
                                : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                            )}
                            title={isExistingSlotSelectedForDeletion(day, 'evening') ? "Click to deselect for deletion" : hasExistingAvailability(day, 'evening') ? "Click to select for deletion" : "Evening: 1pm-6pm"}
                          >
                            PM
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
        </div>
      </div>

      {/* Legend */}
      {!useCustomTimes && (
        <div className="text-sm text-gray-600 space-y-1">
          <div>
            <span className="font-medium">AM:</span> 9:00 AM - 12:00 PM &nbsp;&nbsp; <span className="font-medium">PM:</span> 1:00 PM - 6:00 PM
          </div>
          <div className="flex gap-3 mt-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-brand-500"></div>
              <span className="text-xs">Selected to add</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-100 border border-blue-300"></div>
              <span className="text-xs">Already scheduled</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500"></div>
              <span className="text-xs">Selected to delete</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
