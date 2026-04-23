import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StatePanel } from "../components/FeedbackStates";
import { StatusBadge } from "../components/StatusBadge";
import { fetchInvitationCalendarMonth, fetchInvitations, fetchUpcomingInvitations } from "../lib/api";
import { formatDate, formatDateTime } from "../lib/format";
import type { InvitationRecord } from "../types";

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Unable to load calendar";
}

function getDateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateKey(dateKey: string | null, fallback: Date) {
  if (!dateKey) {
    return fallback;
  }
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function CalendarPage() {
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [monthEvents, setMonthEvents] = useState<InvitationRecord[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<InvitationRecord[]>([]);
  const [next7Days, setNext7Days] = useState<InvitationRecord[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<InvitationRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    setIsLoading(true);

    const upcomingParams = new URLSearchParams();
    upcomingParams.set("event_date_from", new Date().toISOString());
    upcomingParams.set("ordering", "event_date");

    Promise.all([
      fetchInvitationCalendarMonth(year, month),
      fetchInvitations(upcomingParams),
      fetchUpcomingInvitations()
    ])
      .then(([calendarEvents, allUpcoming, sevenDayEvents]) => {
        setMonthEvents(calendarEvents);
        setUpcomingEvents(allUpcoming.results ?? []);
        setNext7Days(sevenDayEvents ?? []);
        const today = new Date();
        const todayKey =
          currentMonth.getFullYear() === today.getFullYear() && currentMonth.getMonth() === today.getMonth()
            ? getDateKey(today)
            : null;
        setSelectedDateKey((current) => current ?? todayKey ?? (calendarEvents[0] ? getDateKey(calendarEvents[0].event_date) : getDateKey(currentMonth)));
        setError(null);
      })
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setIsLoading(false));
  }, [currentMonth]);

  const monthCells = useMemo(() => {
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const leading = (firstDay.getDay() + 6) % 7;
    const cells: Array<{ day: number | null; dateKey: string | null; events: InvitationRecord[] }> = [];
    const eventsByDate = new Map<string, InvitationRecord[]>();

    monthEvents.forEach((event) => {
      const key = getDateKey(event.event_date);
      const existing = eventsByDate.get(key) ?? [];
      existing.push(event);
      eventsByDate.set(key, existing);
    });

    for (let index = 0; index < leading; index += 1) {
      cells.push({ day: null, dateKey: null, events: [] });
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const dateKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({ day, dateKey, events: eventsByDate.get(dateKey) ?? [] });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ day: null, dateKey: null, events: [] });
    }

    return cells;
  }, [currentMonth, monthEvents]);

  const pendingInvitations = upcomingEvents.filter((item) => item.status === "pending_review").slice(0, 1);
  const selectedDate = useMemo(() => parseDateKey(selectedDateKey, currentMonth), [currentMonth, selectedDateKey]);
  const selectedDayEvents = useMemo(
    () => (selectedDateKey ? monthEvents.filter((event) => getDateKey(event.event_date) === selectedDateKey) : []),
    [monthEvents, selectedDateKey]
  );
  const weekDays = useMemo(() => {
    const date = new Date(selectedDate);
    const mondayOffset = (date.getDay() + 6) % 7;
    const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - mondayOffset);
    return Array.from({ length: 7 }, (_, index) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index));
  }, [selectedDate]);
  const selectedDayLabel = useMemo(() => {
    if (!selectedDateKey) {
      return null;
    }
    const [year, month, day] = selectedDateKey.split("-").map(Number);
    return formatDate(new Date(year, month - 1, day).toISOString());
  }, [selectedDateKey]);
  const monthKey = `${currentMonth.getFullYear()}-${currentMonth.getMonth()}`;

  if (error) {
    return <StatePanel variant="error" title="Calendar unavailable" message={error} />;
  }

  if (isLoading) {
    return <StatePanel variant="loading" title="Loading calendar" message="Loading events and reminders." />;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="surface-panel rounded-xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="headline-font text-2xl font-extrabold tracking-[-0.05em] text-[var(--ink)]">
              Events
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md bg-[var(--surface-low)] p-1">
              <button
                type="button"
                onClick={() => setViewMode("month")}
                className={`interactive-press rounded-sm px-3 py-1.5 text-xs font-semibold ${
                  viewMode === "month" ? "bg-[var(--surface-card)] text-[var(--accent)]" : "text-[var(--muted)]"
                }`}
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={`interactive-press rounded-sm px-3 py-1.5 text-xs font-semibold ${
                  viewMode === "week" ? "bg-[var(--surface-card)] text-[var(--accent)]" : "text-[var(--muted)]"
                }`}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => setViewMode("day")}
                className={`interactive-press rounded-sm px-3 py-1.5 text-xs font-semibold ${
                  viewMode === "day" ? "bg-[var(--surface-card)] text-[var(--accent)]" : "text-[var(--muted)]"
                }`}
              >
                Day
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                className="secondary-button interactive-press rounded-md p-1.5"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="metric-strip page-enter min-w-32 rounded-md px-3.5 py-2 text-center text-sm font-semibold text-[var(--ink)]" key={monthKey}>
                {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </div>
              <button
                type="button"
                onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                className="secondary-button interactive-press rounded-md p-1.5"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {viewMode === "month" ? (
          <>
            <div className="mt-5 grid grid-cols-7 border-b border-[var(--line)] pb-2 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            <div key={monthKey} className="page-enter mt-3 grid grid-cols-7 overflow-hidden rounded-xl border border-[var(--line)]">
              {monthCells.map((cell, index) => {
                const isToday =
                  cell.day &&
                  currentMonth.getFullYear() === new Date().getFullYear() &&
                  currentMonth.getMonth() === new Date().getMonth() &&
                  cell.day === new Date().getDate();
                const isSelected = Boolean(cell.dateKey && selectedDateKey === cell.dateKey);

                return (
                  <div
                    key={`${cell.day ?? "blank"}-${index}`}
                    onClick={() => {
                      if (cell.dateKey) {
                        setSelectedDateKey(cell.dateKey);
                      }
                    }}
                    className={`calendar-cell min-h-[4.75rem] border-b border-r border-[var(--line)] p-2 md:min-h-[5.4rem] ${
                      cell.day ? "bg-[var(--surface-card)]" : "bg-[var(--surface-low)]/70"
                    } ${isSelected ? "calendar-cell-active" : ""} ${cell.day ? "cursor-pointer" : ""} ${
                      cell.dateKey ? "page-enter" : ""
                    }`}
                  >
                    {cell.day ? (
                      <div className={`inline-flex min-w-6 justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold ${isToday ? "bg-[var(--accent)] text-white" : "text-[var(--ink)]"}`}>
                        {cell.day}
                      </div>
                    ) : null}

                    <div className="mt-2 space-y-1">
                      {cell.events.length ? (
                        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                          {cell.events.length} event{cell.events.length === 1 ? "" : "s"}
                        </p>
                      ) : null}
                      {cell.events.slice(0, 1).map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          onClick={(eventClick) => {
                            eventClick.stopPropagation();
                            setSelectedDateKey(cell.dateKey);
                            setSelected(event);
                          }}
                          className={`interactive-lift interactive-press block w-full truncate rounded-sm px-1.5 py-0.5 text-left text-[9px] font-bold uppercase tracking-[0.06em] transition-colors ${
                            event.status === "declined"
                              ? "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
                              : event.status === "accepted" || event.status === "confirmed_attendance"
                                ? "bg-[var(--status-accent-bg)] text-[var(--status-accent-text)]"
                                : "bg-[var(--surface-low)] text-[var(--ink)]"
                          }`}
                        >
                          {event.event_title}
                        </button>
                      ))}
                      {cell.events.length > 1 ? (
                        <button
                          type="button"
                          onClick={(eventClick) => {
                            eventClick.stopPropagation();
                            setSelectedDateKey(cell.dateKey);
                          }}
                          className="text-[9px] font-semibold text-[var(--accent)]"
                        >
                          +{cell.events.length - 1} more
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}

        {viewMode === "week" ? (
          <div className="page-enter mt-5 grid gap-3 md:grid-cols-7">
            {weekDays.map((day) => {
              const dateKey = getDateKey(day);
              const dayEvents = monthEvents.filter((event) => getDateKey(event.event_date) === dateKey);
              const isSelected = selectedDateKey === dateKey;
              return (
                <div
                  key={dateKey}
                  onClick={() => setSelectedDateKey(dateKey)}
                  className={`rounded-xl border border-[var(--line)] p-3 ${isSelected ? "calendar-cell-active" : "bg-[var(--surface-card)]"} cursor-pointer`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                    {day.toLocaleDateString("en-US", { weekday: "short" })}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--ink)]">
                    {day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                  <div className="mt-3 space-y-2">
                    {dayEvents.length ? (
                      dayEvents.map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          onClick={(eventClick) => {
                            eventClick.stopPropagation();
                            setSelectedDateKey(dateKey);
                            setSelected(event);
                          }}
                          className="interactive-lift interactive-press block w-full rounded-md bg-[var(--surface-low)] px-2.5 py-2 text-left text-xs font-semibold text-[var(--ink)]"
                        >
                          <span className="block truncate">{event.event_title}</span>
                          <span className="mt-1 block text-[10px] font-medium text-[var(--muted)]">{formatDateTime(event.event_date)}</span>
                        </button>
                      ))
                    ) : (
                      <p className="text-xs text-[var(--muted)]">No scheduled events.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {viewMode === "day" ? (
          <div className="page-enter mt-5 rounded-xl border border-[var(--line)] bg-[var(--surface-card)] p-4">
            <p className="section-kicker">Day Schedule</p>
            <h3 className="headline-font mt-2 text-xl font-bold tracking-[-0.04em] text-[var(--ink)]">
              {selectedDayLabel ?? formatDate(selectedDate.toISOString())}
            </h3>
            <div className="mt-4 space-y-2">
              {selectedDayEvents.length ? (
                selectedDayEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelected(event)}
                    className="interactive-lift interactive-press block w-full rounded-xl bg-[var(--surface-low)] px-3 py-3 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--ink)]">{event.event_title}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{formatDateTime(event.event_date)}</p>
                      </div>
                      <StatusBadge status={event.status_display} />
                    </div>
                    <p className="mt-2 text-xs text-[var(--muted)]">{event.location}</p>
                  </button>
                ))
              ) : (
                <p className="text-sm text-[var(--muted)]">No scheduled invitations for the selected day.</p>
              )}
            </div>
          </div>
        ) : null}
      </section>

      <aside className="space-y-4">
        <section className="surface-panel interactive-lift rounded-xl p-4">
          <p className="section-kicker">Selected Day</p>
          <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{selectedDayLabel ?? "Choose a day"}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {selectedDayEvents.length
              ? `${selectedDayEvents.length} scheduled event${selectedDayEvents.length === 1 ? "" : "s"}`
              : "No scheduled invitations for this date."}
          </p>

          <div className="mt-4 space-y-2">
            {selectedDayEvents.length ? (
              selectedDayEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => setSelected(event)}
                  className="interactive-lift interactive-press block w-full rounded-lg bg-[var(--surface-low)] px-3 py-3 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--ink)]">{event.event_title}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{formatDateTime(event.event_date)}</p>
                    </div>
                    <StatusBadge status={event.status_display} />
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted)]">{event.location}</p>
                </button>
              ))
            ) : (
              <div className="rounded-lg bg-[var(--surface-low)] px-3 py-3 text-sm text-[var(--muted)]">
                Select another date or move to a different month to explore scheduled invitations.
              </div>
            )}
          </div>
        </section>

        <section className="surface-panel rounded-xl p-4">
          <p className="section-kicker">Upcoming in 7 Days</p>
          <p className="mt-2 text-sm font-semibold text-[var(--ink)]">
            {next7Days.length
              ? `${formatDate(next7Days[0].event_date)} to ${formatDate(next7Days[next7Days.length - 1].event_date)}`
              : "No events scheduled"}
          </p>

          <div className="mt-4 space-y-2">
            {next7Days.length ? (
              next7Days.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => setSelected(event)}
                  className="interactive-lift interactive-press block w-full rounded-lg bg-[var(--surface-low)] px-3 py-3 text-left"
                >
                  <p className="text-sm font-semibold text-[var(--ink)]">{event.event_title}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{formatDateTime(event.event_date)}</p>
                  <p className="mt-2 text-xs text-[var(--muted)]">{event.location}</p>
                </button>
              ))
            ) : (
              <p className="text-sm text-[var(--muted)]">No events scheduled for the next seven days.</p>
            )}
          </div>
        </section>

        <section className="surface-panel rounded-xl p-4">
          <p className="section-kicker">Pending Invitations</p>
          <div className="mt-4 space-y-3">
            {pendingInvitations.length ? (
              pendingInvitations.map((event) => (
                <div key={event.id} className="interactive-lift rounded-lg bg-[var(--surface-low)] p-3">
                  <p className="text-sm font-semibold text-[var(--ink)]">{event.event_title}</p>
                  <p className="mt-2 text-xs text-[var(--muted)]">{event.contact_person || event.inviting_organization}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{event.location}</p>
                  <div className="mt-4 flex gap-2">
                    <Link to={`/invitations/${event.id}`} className="primary-button interactive-press flex-1 rounded-md px-3 py-2 text-center text-xs font-semibold">
                      Review
                    </Link>
                    <button type="button" onClick={() => setSelected(event)} className="secondary-button interactive-press flex-1 rounded-md px-3 py-2 text-xs font-semibold">
                      Open
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--muted)]">No invitations are waiting for review.</p>
            )}
          </div>

          <Link to="/invitations" className="primary-button interactive-press mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold">
            <Plus className="h-4 w-4" />
            Open Invitations
          </Link>
        </section>
      </aside>

      {selected ? (
        <div className="backdrop-enter fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-sm">
          <div className="drawer-enter h-full w-full max-w-md border-l border-[var(--line)] bg-[var(--surface-card)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="headline-font text-xl font-bold tracking-[-0.04em] text-[var(--ink)]">{selected.event_title}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{selected.inviting_organization}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="secondary-button interactive-press rounded-md px-3 py-1.5 text-xs font-semibold">
                Close
              </button>
            </div>
            <div className="mt-5 grid gap-2 text-sm">
              <div className="rounded-lg bg-[var(--surface-low)] px-3 py-2"><strong>Date:</strong> {formatDateTime(selected.event_date)}</div>
              <div className="rounded-lg bg-[var(--surface-low)] px-3 py-2"><strong>Day:</strong> {formatDate(selected.event_date)}</div>
              <div className="rounded-lg bg-[var(--surface-low)] px-3 py-2"><strong>Location:</strong> {selected.location}</div>
              <div className="rounded-lg bg-[var(--surface-low)] px-3 py-2">
                <strong>Status:</strong> <span className="ml-2"><StatusBadge status={selected.status_display} /></span>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to={`/invitations/${selected.id}`} className="primary-button interactive-press rounded-md px-4 py-2 text-sm font-semibold">
                Open Details
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
