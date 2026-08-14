"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  isToday,
} from "date-fns";
import * as React from "react";

import { cn } from "@/lib/utils";
import { isMultiDayEvent } from "@/lib/event-utils";
import { useHorizontalScroll } from "@/hooks/use-horizontal-scroll";
import { useEventDrag } from "@/hooks/use-event-drag";
import { useEventResize } from "@/hooks/use-event-resize";
import { useAllDayResize } from "@/hooks/use-all-day-resize";
import type { WeekDay } from "@/types/calendar";
import type { WeekViewProps } from "./week-view-types";
import { WeekViewAllDayRow } from "./week-view-all-day-row";
import { CalendarDayHeaders } from "./calendar-day-headers";
import { WeekViewGrid } from "./week-view-grid";
import { WeekViewTimeAxis } from "./week-view-time-axis";
import { WeekViewTimeIndicator } from "./week-view-time-indicator";
import { CalendarPopoverBoundaryProvider } from "./calendar-popover-context";
import {
  BUFFER_DAYS_BY_VIEW,
  BUFFER_STEP_BY_VIEW,
  MIN_DAY_COLUMN_WIDTH,
  MIN_HOUR_HEIGHT,
  MIN_MOBILE_DAY_COLUMN_WIDTH,
  MOBILE_BREAKPOINT_PX,
  TIME_AXIS_WIDTH,
  VISIBLE_DAYS_BY_VIEW,
  generateBufferedDays,
  generateHours,
  generateWeekDays,
} from "./week-view-utils";

/**
 * Main Week View calendar component
 * Displays a week grid with time slots and supports horizontal scroll navigation
 */
export function WeekView({
  view = "week",
  currentDate = new Date(),
  events = [],
  onEventClick,
  selectedEventId,
  onBackgroundClick,
  onDateChange,
  onVisibleDaysChange,
  onEventChange,
  onEventDelete,
  onEventDuplicate,
  onCellDoubleClick,
  isSidebarOpen,
  onDockToSidebar,
  onClosePopover,
  onPrevWeek,
  onNextWeek,
  highlightedDate,
  generic,
  locale,
  className,
}: WeekViewProps) {
  const VISIBLE_DAYS = VISIBLE_DAYS_BY_VIEW[view];
  const BUFFER_DAYS = BUFFER_DAYS_BY_VIEW[view];
  const BUFFER_STEP = BUFFER_STEP_BY_VIEW[view];
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const dayColumnsScrollRef = React.useRef<HTMLDivElement>(null);
  const allDayScrollRef = React.useRef<HTMLDivElement>(null);
  const allDayScrollContentRef = React.useRef<HTMLDivElement>(null);

  // Visible days starting from currentDate
  const baseDays = React.useMemo(
    () => generateWeekDays(currentDate, VISIBLE_DAYS, locale),
    [currentDate, VISIBLE_DAYS, locale],
  );

  const days: WeekDay[] = baseDays.map((day) => ({
    ...day,
    isToday: isToday(day.date),
  }));

  const hours = React.useMemo(() => generateHours(locale), [locale]);

  const allDayEvents = React.useMemo(
    () => events.filter((e) => e.isAllDay || isMultiDayEvent(e)),
    [events],
  );

  const timedEvents = React.useMemo(
    () => events.filter((e) => !e.isAllDay && !isMultiDayEvent(e)),
    [events],
  );

  // Compute day column width and dynamic hour height from container
  const [dayColumnWidth, setDayColumnWidth] = React.useState(0);
  const [hourHeight, setHourHeight] = React.useState(MIN_HOUR_HEIGHT);
  const [containerWidth, setContainerWidth] = React.useState(0);
  const [contextMenuOpen, setContextMenuOpen] = React.useState(false);
  const [isAllDayResizing, setIsAllDayResizing] = React.useState(false);

  React.useEffect(() => {
    const updateDimensions = () => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const availableWidth = container.clientWidth - TIME_AXIS_WIDTH;
      const isMobile = container.clientWidth < MOBILE_BREAKPOINT_PX;
      const minColumnWidth = isMobile
        ? MIN_MOBILE_DAY_COLUMN_WIDTH
        : MIN_DAY_COLUMN_WIDTH;
      setContainerWidth(availableWidth);
      setDayColumnWidth(
        Math.max(minColumnWidth, availableWidth / VISIBLE_DAYS),
      );
      setHourHeight(Math.max(MIN_HOUR_HEIGHT, container.clientHeight / 24));
    };

    updateDimensions();

    const observer = new ResizeObserver(updateDimensions);
    if (scrollContainerRef.current) {
      observer.observe(scrollContainerRef.current);
    }
    return () => observer.disconnect();
  }, [VISIBLE_DAYS]);

  /**
   * On phones the grid starts at 12 AM, leaving the user far above the real
   * blocks. Scroll once to "now" (or to the first event of the day) so the
   * calendar opens at a useful position. Re-applies if the hour height
   * changes after the first paint (e.g. the resize observer measured later).
   */
  const autoScrolledHourHeightRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`).matches)
      return;
    if (autoScrolledHourHeightRef.current === hourHeight) return;

    const container = scrollContainerRef.current;
    if (!container || hourHeight <= 0) return;
    autoScrolledHourHeightRef.current = hourHeight;

    let targetMinutes: number;
    if (timedEvents.length > 0) {
      const firstStart = timedEvents.reduce((earliest, event) =>
        event.start.getTime() < earliest.start.getTime() ? event : earliest,
      ).start;
      targetMinutes = Math.max(0, firstStart.getHours() * 60 - 60);
    } else {
      const now = new Date();
      targetMinutes = Math.max(0, now.getHours() * 60 - 90);
    }

    const maxScroll = container.scrollHeight - container.clientHeight;
    container.scrollTop = Math.min(
      (targetMinutes / 60) * hourHeight,
      Math.max(0, maxScroll),
    );
  }, [hourHeight, timedEvents]);

  // Track whether navigation was initiated by scroll (to avoid double-animation)
  const scrollNavigatedRef = React.useRef(false);
  const prevDateRef = React.useRef(currentDate);

  const handleNavigate = React.useCallback(
    (daysDelta: number) => {
      scrollNavigatedRef.current = true;
      onDateChange?.(addDays(currentDate, daysDelta));
    },
    [currentDate, onDateChange],
  );

  const handleDragNavigate = React.useCallback(
    (daysDelta: number) => {
      onDateChange?.(addDays(currentDate, daysDelta));
    },
    [currentDate, onDateChange],
  );

  const visibleDayDates = React.useMemo(() => days.map((d) => d.date), [days]);

  const { resizeState, handleResizePointerDown } = useEventResize({
    hourHeight,
    scrollContainerRef,
    events: timedEvents,
    days: visibleDayDates,
    dayColumnWidth,
    timeAxisWidth: TIME_AXIS_WIDTH,
    onEventChange,
    onEventClick,
    onResizeNavigate: handleDragNavigate,
  });

  const { dragState, handleEventPointerDown } = useEventDrag({
    hourHeight,
    scrollContainerRef,
    events: timedEvents,
    days: visibleDayDates,
    dayColumnWidth,
    timeAxisWidth: TIME_AXIS_WIDTH,
    onEventChange,
    onEventClick,
    onDragNavigate: handleDragNavigate,
  });

  const { scrollOffset, slideOffset, isAnimating, triggerSlideAnimation } =
    useHorizontalScroll({
      containerRef: scrollContainerRef,
      dayColumnWidth,
      onNavigate: handleNavigate,
      disabled:
        dragState?.isDragging ||
        resizeState?.isResizing ||
        isAllDayResizing ||
        contextMenuOpen,
    });

  // Compute how many days the scroll has shifted from center
  const scrollDaysDelta =
    dayColumnWidth > 0 ? Math.round(-scrollOffset / dayColumnWidth) : 0;

  // Report visible days to parent in real-time as scroll crosses day boundaries
  React.useEffect(() => {
    const start = addDays(currentDate, scrollDaysDelta);
    const end = addDays(start, VISIBLE_DAYS - 1);
    onVisibleDaysChange?.(eachDayOfInterval({ start, end }));
  }, [currentDate, scrollDaysDelta, onVisibleDaysChange, VISIBLE_DAYS]);

  // Dynamic buffer: extends in BUFFER_STEP chunks based on scroll distance
  const extraScrollDays =
    dayColumnWidth > 0 && BUFFER_STEP > 0
      ? Math.ceil(Math.abs(scrollOffset) / dayColumnWidth / BUFFER_STEP) *
        BUFFER_STEP
      : 0;
  const dynamicBuffer = BUFFER_DAYS + extraScrollDays;
  const totalDays = dynamicBuffer + VISIBLE_DAYS + dynamicBuffer;

  // Extended buffered days for scroll (grows dynamically with scroll distance)
  const bufferedBaseDays = React.useMemo(
    () => generateBufferedDays(currentDate, dynamicBuffer, VISIBLE_DAYS, locale),
    [currentDate, dynamicBuffer, VISIBLE_DAYS, locale],
  );

  const bufferedDays: WeekDay[] = bufferedBaseDays.map((day) => ({
    ...day,
    isToday: isToday(day.date),
  }));

  const bufferedDayDates = React.useMemo(
    () => bufferedBaseDays.map((d) => d.date),
    [bufferedBaseDays],
  );

  const { allDayResizeState, handleAllDayResizePointerDown } = useAllDayResize({
    days: bufferedDayDates,
    dayColumnWidth,
    allDayContainerRef: allDayScrollContentRef,
    events: allDayEvents,
    onEventChange,
    onEventClick,
  });

  React.useEffect(() => {
    setIsAllDayResizing(allDayResizeState?.isResizing ?? false);
  }, [allDayResizeState?.isResizing]);

  // Trigger slide animation when currentDate changes externally (not from scroll)
  React.useEffect(() => {
    if (scrollNavigatedRef.current) {
      scrollNavigatedRef.current = false;
      prevDateRef.current = currentDate;
      return;
    }

    const prevDate = prevDateRef.current;
    const daysDiff = differenceInCalendarDays(currentDate, prevDate);
    prevDateRef.current = currentDate;

    if (daysDiff === 0) return;

    triggerSlideAnimation(daysDiff);
  }, [currentDate, triggerSlideAnimation]);

  // The base translateX centers on the visible days (skip dynamicBuffer columns)
  const baseTranslateX = -(dynamicBuffer * dayColumnWidth);
  const transformX = baseTranslateX + scrollOffset + slideOffset;

  // When the min column width is enforced (narrow screens) the content is
  // wider than the container and can be scrolled horizontally; otherwise the
  // width stays proportional so the calendar fills the viewport exactly.
  const useFixedWidth = dayColumnWidth * VISIBLE_DAYS > containerWidth;
  const scrollStyle: React.CSSProperties = {
    width: useFixedWidth
      ? `${dayColumnWidth * totalDays}px`
      : `${(totalDays / VISIBLE_DAYS) * 100}%`,
    transform: `translateX(${transformX}px)`,
    transition: isAnimating ? `transform ${200}ms ease-out` : "none",
  };

  // Ref for the popover collision boundary (constrains popovers within the calendar area)
  const calendarBoundaryRef = React.useRef<HTMLDivElement>(null);
  // Ref for the header (weekday columns + all-day row) to measure its height for popover top inset
  const calendarHeaderRef = React.useRef<HTMLDivElement>(null);

  return (
    <CalendarPopoverBoundaryProvider
      boundaryRef={calendarBoundaryRef}
      headerRef={calendarHeaderRef}
      view={view}
    >
      <div
        ref={calendarBoundaryRef}
        className={cn("flex h-full flex-col", className)}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest("[data-radix-popper-content-wrapper]")) return;
          onBackgroundClick?.();
        }}
      >
        {/* Header - day columns and all-day row with synchronized scroll */}
        <div className="flex-shrink-0">
          <div
            ref={(el) => {
              (
                dayColumnsScrollRef as React.MutableRefObject<HTMLDivElement | null>
              ).current = el;
              (
                calendarHeaderRef as React.MutableRefObject<HTMLDivElement | null>
              ).current = el;
            }}
            className="overflow-hidden"
          >
            <div className="flex bg-background">
              {/* Timezone label - rendered outside scroll container */}
              <div className="text-muted-foreground flex w-16 flex-shrink-0 items-center justify-end pr-2 text-xxs">
                {new Date()
                  .toLocaleTimeString("en-US", { timeZoneName: "short" })
                  .match(/\s([A-Z]{2,5})$/)?.[1] ?? ""}
              </div>
              <div className="flex-1 overflow-hidden">
                <div style={scrollStyle}>
                  <CalendarDayHeaders
                    days={bufferedDays}
                    standalone
                    highlightedDate={highlightedDate}
                    hideDayNumber={generic}
                    hideDayName={generic && view === "day"}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="overflow-hidden" ref={allDayScrollRef}>
            <WeekViewAllDayRow
              days={bufferedDays}
              allDayEvents={allDayEvents}
              onEventClick={onEventClick}
              selectedEventId={selectedEventId}
              scrollStyle={scrollStyle}
              allDayResizeState={allDayResizeState ?? undefined}
              onAllDayResizeMouseDown={handleAllDayResizePointerDown}
              onEventChange={onEventChange}
              onEventDelete={onEventDelete}
              onEventDuplicate={onEventDuplicate}
              onContextMenuOpenChange={setContextMenuOpen}
              allDayScrollContentRef={allDayScrollContentRef}
              isSidebarOpen={isSidebarOpen}
              onDockToSidebar={onDockToSidebar}
              onClosePopover={onClosePopover}
              onPrevWeek={onPrevWeek}
              onNextWeek={onNextWeek}
              visibleStartIndex={dynamicBuffer}
              visibleCount={VISIBLE_DAYS}
              dayColumnWidth={dayColumnWidth}
              highlightedDate={highlightedDate}
            />
          </div>
        </div>

        {/* Scrollable grid area \u2014 also serves as the collision boundary for popovers */}
        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-auto scrollbar-hide"
        >
          <div
            className="relative flex"
            style={{ height: hours.length * hourHeight }}
          >
            <WeekViewTimeAxis hours={hours} hourHeight={hourHeight} />
            <div className="relative flex-1 overflow-hidden">
              <div style={scrollStyle}>
                <WeekViewGrid
                  days={bufferedDays}
                  hours={hours}
                  hourHeight={hourHeight}
                  events={timedEvents}
                  onEventClick={onEventClick}
                  selectedEventId={selectedEventId}
                  dragState={dragState ?? undefined}
                  onEventDragMouseDown={handleEventPointerDown}
                  resizeState={resizeState ?? undefined}
                  onEventResizeMouseDown={handleResizePointerDown}
                  onEventChange={onEventChange}
                  onEventDelete={onEventDelete}
                  onEventDuplicate={onEventDuplicate}
                  onCellDoubleClick={onCellDoubleClick}
                  onContextMenuOpenChange={setContextMenuOpen}
                  isSidebarOpen={isSidebarOpen}
                  onDockToSidebar={onDockToSidebar}
                  onClosePopover={onClosePopover}
                  onPrevWeek={onPrevWeek}
                  onNextWeek={onNextWeek}
                  highlightedDate={highlightedDate}
                />
              </div>
            </div>
            {!generic && (
              <WeekViewTimeIndicator
                days={days}
                hourHeight={hourHeight}
                scrollDays={bufferedDays}
                scrollStyle={scrollStyle}
                behindSelection={!!selectedEventId}
              />
            )}
          </div>
        </div>
      </div>
    </CalendarPopoverBoundaryProvider>
  );
}
