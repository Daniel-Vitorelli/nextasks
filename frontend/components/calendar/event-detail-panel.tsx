"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Clock, Copy, MoreHorizontal, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import type { CalendarEvent, EventConfirmation } from "@/types/calendar";
import {
  CONFIRMATION_OPTIONS,
  EVENT_COLORS,
} from "@/lib/calendar/event-constants";
import { colorSwatchClass } from "./calendar-event-color";
import { formatTimeDisplay, formatDuration } from "./calendar-event-time";
import { useEventDetailForm } from "@/hooks/use-event-detail-form";

interface EventDetailPanelProps {
  event: CalendarEvent;
  onEventChange?: (event: CalendarEvent) => void;
  onEventDelete?: (event: CalendarEvent) => void;
  onEventDuplicate?: (event: CalendarEvent) => void;
  /** Extra action buttons rendered in the header row (after the "..." menu). */
  headerActions?: React.ReactNode;
}

export function EventDetailPanel({
  event,
  onEventChange,
  onEventDelete,
  onEventDuplicate,
  headerActions,
}: EventDetailPanelProps) {
  const t = useTranslations("dashboard.routines.calendar");
  const currentColor = event.color ?? "green";

  const {
    register,
    errors,
    showError,
    handleFieldFocus,
    handleFieldBlur,
    handleFieldKeyDown,
    handleAllDayToggle,
  } = useEventDetailForm(event, onEventChange);

  return (
    <div className="flex flex-col gap-3 py-3">
      {/* Title */}
      <div className="flex min-w-0 flex-col gap-1">
        <Input
          type="text"
          {...register("title")}
          onFocus={(e) => handleFieldFocus(e, "title")}
          onBlur={() => handleFieldBlur("title")}
          onKeyDown={(e) => handleFieldKeyDown(e, "title")}
          placeholder={t("title")}
          aria-label={t("title")}
          aria-invalid={showError("title")}
          className="h-auto min-w-0 rounded-sm border border-transparent bg-transparent px-2 py-1.5 text-xs shadow-none outline-none hover:border-[#373737] focus-visible:border-[#242424] focus-visible:bg-[#242424] focus-visible:ring-0 dark:bg-transparent"
        />
        {showError("title") && (
          <FieldError className="px-2 text-xs">
            {errors.title?.message}
          </FieldError>
        )}
      </div>

      {/* Description */}
      <div className="flex min-w-0 flex-col gap-1">
        <Input
          type="text"
          {...register("description")}
          onFocus={(e) => handleFieldFocus(e, "description")}
          onBlur={() => handleFieldBlur("description")}
          onKeyDown={(e) => handleFieldKeyDown(e, "description")}
          placeholder={t("description")}
          aria-label={t("description")}
          className="h-auto min-w-0 rounded-sm border border-transparent bg-transparent px-2 py-1.5 text-xs shadow-none outline-none text-[#C7C5C1] dark:text-[#595959] hover:border-[#373737] focus-visible:border-[#242424] focus-visible:bg-[#242424] focus-visible:ring-0 dark:bg-transparent"
        />
      </div>

      {/* Divider */}
      <div className="border-border border-t" />

      {/* Time — muted and non-interactive for all-day events */}
      {(event.start.getHours() !== 0 ||
        event.start.getMinutes() !== 0 ||
        event.end.getHours() !== 0 ||
        event.end.getMinutes() !== 0) && (
        <div className="flex flex-col gap-1">
          <div className="flex min-w-0 items-center gap-1 px-2 text-xs">
            {/* Start time group — Clock icon + input in one bordered container */}
            <div
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-sm border border-transparent px-2 py-1.5",
                event.isAllDay
                  ? "cursor-default"
                  : "cursor-text hover:border-[#373737] has-[:focus]:border-[#242424] has-[:focus]:bg-[#242424]",
              )}
              onClick={
                event.isAllDay
                  ? undefined
                  : (e) => e.currentTarget.querySelector("input")?.focus()
              }
            >
              <Clock className="size-4 shrink-0 text-[#C7C5C1] dark:text-[#595959]" />
              <Input
                type="text"
                {...register("startTime")}
                onFocus={(e) => handleFieldFocus(e, "startTime")}
                onBlur={() => handleFieldBlur("startTime")}
                onKeyDown={(e) => handleFieldKeyDown(e, "startTime")}
                readOnly={event.isAllDay}
                tabIndex={event.isAllDay ? -1 : undefined}
                aria-label={t("startTime")}
                aria-invalid={showError("startTime")}
                className={cn(
                  "h-auto w-[8ch] rounded-none border-none bg-transparent p-0 text-xs font-medium shadow-none focus-visible:ring-0 md:text-xs dark:bg-transparent",
                  event.isAllDay
                    ? "pointer-events-none text-[#C7C5C1] dark:text-[#595959]"
                    : "text-foreground",
                )}
              />
            </div>
            {/* End time group — arrow + end input + duration in one bordered container */}
            <div
              className={cn(
                "flex min-w-0 flex-1 items-center rounded-sm border border-transparent px-2 py-1.5",
                event.isAllDay
                  ? "cursor-default"
                  : "cursor-text hover:border-[#373737] has-[:focus]:border-[#242424] has-[:focus]:bg-[#242424]",
              )}
              onClick={
                event.isAllDay
                  ? undefined
                  : (e) => e.currentTarget.querySelector("input")?.focus()
              }
            >
              <span className="mr-2 shrink-0 text-base leading-4 text-[#C7C5C1] dark:text-[#595959]">
                →
              </span>
              <Input
                type="text"
                {...register("endTime")}
                onFocus={(e) => handleFieldFocus(e, "endTime")}
                onBlur={() => handleFieldBlur("endTime")}
                onKeyDown={(e) => handleFieldKeyDown(e, "endTime")}
                readOnly={event.isAllDay}
                tabIndex={event.isAllDay ? -1 : undefined}
                aria-label={t("endTime")}
                aria-invalid={showError("endTime")}
                className={cn(
                  "h-auto w-[10ch] min-w-0 rounded-none border-none bg-transparent p-0 text-xs font-medium shadow-none focus-visible:ring-0 md:text-xs dark:bg-transparent",
                  event.isAllDay
                    ? "pointer-events-none text-[#C7C5C1] dark:text-[#595959]"
                    : "text-foreground",
                )}
              />
              <span className="shrink-0 text-[#C7C5C1] dark:text-[#595959]">
                {formatDuration(event.start, event.end)}
              </span>
            </div>
          </div>
          {showError("startTime") && (
            <FieldError className="px-2 text-xs">
              {errors.startTime?.message}
            </FieldError>
          )}
          {showError("endTime") && (
            <FieldError className="px-2 text-xs">
              {errors.endTime?.message}
            </FieldError>
          )}
        </div>
      )}

      {/* Color */}
      <div className="flex items-center gap-3 px-4">
        <span className="text-xs text-[#C7C5C1] dark:text-[#595959]">
          {t("color")}
        </span>
        <div className="flex items-center gap-1.5">
          {EVENT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={cn(
                "relative flex size-3.5 items-center justify-center rounded-xs",
                colorSwatchClass[color],
                color === currentColor && "ring-ring ring-2 ring-offset-2",
              )}
              onClick={() => onEventChange?.({ ...event, color })}
              aria-label={color}
            />
          ))}
        </div>
      </div>

      <div
        className="flex cursor-pointer items-center gap-3 px-4"
        onClick={() => handleAllDayToggle(!(event.isAllDay ?? false))}
      >
        <Switch
          size="xs"
          checked={event.isAllDay ?? false}
          onCheckedChange={handleAllDayToggle}
          onClick={(e) => e.stopPropagation()}
          className="data-[state=unchecked]:!bg-[#C7C5C1] dark:data-[state=unchecked]:!bg-[#595959] data-[state=checked]:!bg-[#3A85D3]"
        />
        <span className="text-foreground text-xs">{t("allDay")}</span>
      </div>

      {/* Confirmation mode */}
      <div className="flex flex-col gap-1.5 px-4">
        <span className="text-xs text-[#C7C5C1] dark:text-[#595959]">
          {t("confirmation")}
        </span>
        <RadioGroup
          value={event.confirmation ?? "none"}
          onValueChange={(value) =>
            onEventChange?.({
              ...event,
              confirmation: value as EventConfirmation,
            })
          }
          aria-label={t("confirmation")}
          className="grid gap-0.5"
        >
          {CONFIRMATION_OPTIONS.map((confirmation) => (
            <ConfirmationOption
              key={confirmation}
              value={confirmation}
              label={t(`confirmationOption_${confirmation}`)}
            />
          ))}
        </RadioGroup>
      </div>

      {/* Divider */}
      <div className="border-border border-t" />

      {/* Actions */}
      <div className="flex items-center justify-between px-4">
        <span className="text-muted-foreground text-xs">
          {formatTimeDisplay(event.start)}
        </span>
        <div className="flex items-center gap-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 border border-transparent hover:border-[#242424] hover:bg-[#242424] text-[#C7C5C1] dark:text-[#595959]"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side="left"
              className="min-w-[180px] bg-[#252525] border-[#303030]"
            >
              <DropdownMenuItem
                className="text-xs text-white focus:!bg-[#303030] focus:!text-white"
                onSelect={() => onEventDuplicate?.(event)}
              >
                <Copy className="size-3.5" />
                {t("duplicate")}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#303030]" />
              <DropdownMenuItem
                className="text-xs text-[#E56458] focus:!bg-[#DE5551] focus:!text-white focus:[&>svg]:!text-white"
                onSelect={() => onEventDelete?.(event)}
              >
                <Trash2 className="size-3.5 text-[#E56458]" />
                {t("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {headerActions}
        </div>
      </div>
    </div>
  );
}

function ConfirmationOption({
  value,
  label,
}: {
  value: EventConfirmation;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1 transition-colors hover:bg-[#ECECEC] dark:hover:bg-[#2B2B2B]">
      <RadioGroupItem value={value} id={`confirmation-${value}`} />
      <span className="text-xs text-[#C7C5C1] dark:text-[#595959]">
        {label}
      </span>
    </label>
  );
}