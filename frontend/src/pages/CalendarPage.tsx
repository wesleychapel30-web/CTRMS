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

export function CalendarPage() {
  const [monthEvents, setMonthEvents] = useState<InvitationRecord[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<InvitationRecord[]>([]);
  const [next7Days, setNext7Days] = useState<InvitationRecord[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
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
      const eventDate = new Date(event.event_date);
      const key = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, "0")}-${String(eventDate.getDate()).padStart(2, "0")}`;
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

  if (error) {
    return <StatePanel variant="error" title="Calendar unavailable" message={error} />;
  }

  if (isLoading) {
    return <StatePanel variant="loading" title="Loading calendar" message="Preparing monthly events, reminders, and upcoming engagements." />;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
      <section className="surface-panel rounded-xl p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-kicker">Institutional Calendar</p>
            <h2 className="headline-font mt-3 text-4xl font-extrabold tracking-[-0.06em] text-[var(--ink)]">
              Monthly Event View
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              Operational view for invitations, accepted engagements, and upcoming attendance decisions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-md bg-[var(--surface-low)] p-1">
              <button type="button" className="rounded-sm bg-[var(--surface-card)] px-4 py-2 text-xs font-semibold text-[var(--accent)]">
                Month
              </button>
              <button type="button" disabled className="px-4 py-2 text-xs font-semibold text-[var(--muted)] disabled:opacity-70">
                Week
              </button>
              <button type="button" disabled className="px-4 py-2 text-xs font-semibold text-[var(--muted)] disabled:opacity-70">
                Day
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                className="secondary-button rounded-md p-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="metric-strip rounded-md px-5 py-2.5 text-sm font-semibold text-[var(--ink)]">
                {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </div>
              <button
                type="button"
                onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                className="secondary-button rounded-md p-2"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-7 border-b border-[var(--line)] pb-3 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-7 overflow-hidden rounded-xl border border-[var(--line)]">
          {monthCells.map((cell, index) => {
            const isToday =
              cell.day &&
              currentMonth.getFullYear() === new Date().getFullYear() &&
              currentMonth.getMonth() === new Date().getMonth() &&
              cell.day === new Date().getDate();

            return (
              <div
                key={`${cell.day ?? "blank"}-${index}`}
                className={`min-h-[8.2rem] border-b border-r border-[var(--line)] p-3 ${
                  cell.day ? "bg-[var(--surface-card)]" : "bg-[var(--surface-low)]/70"
                }`}
              >
                {cell.day ? (
                  <div className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${isToday ? "bg-[var(--accent)] text-white" : "text-[var(--ink)]"}`}>
                    {cell.day}
                  </div>
                ) : null}

                <div className="mt-3 space-y-2">
                  {cell.events.slice(0, 2).map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setSelected(event)}
                      className={`block w-full truncate rounded-sm px-2 py-1 text-left text-[10px] font-bold uppercase tracking-[0.08em] ${
                        event.status === "declined"
                          ? "bg-[#fe8983]/20 text-[#752121]"
                          : event.status === "accepted" || event.status === "confirmed_attendance"
                            ? "bg-[var(--accent-soft)] text-[var(--accent-dim)]"
                            : "bg-[var(--surface-low)] text-[var(--ink)]"
                      }`}
                    >
                      {event.event_title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <aside className="space-y-6">
        <section className="surface-panel rounded-xl p-6">
          <p className="section-kicker">Upcoming in 7 Days</p>
          <p className="mt-2 text-sm font-semibold text-[var(--ink)]">
            {next7Days.length
              ? `${formatDate(next7Days[0].event_date)} to ${formatDate(next7Days[next7Days.length - 1].event_date)}`
              : "No events scheduled"}
          </p>

          <div className="mt-6 space-y-3">
            {next7Days.length ? (
              next7Days.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => setSelected(event)}
                  className="block w-full rounded-xl bg-[var(--surface-low)] px-4 py-4 text-left"
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

        <section className="surface-panel rounded-xl p-6">
          <p className="section-kicker">Pending Invitations</p>
          <div className="mt-5 space-y-4">
            {pendingInvitations.length ? (
              pendingInvitations.map((event) => (
                <div key={event.id} className="rounded-xl bg-[var(--surface-low)] p-4">
                  <p className="text-sm font-semibold text-[var(--ink)]">{event.event_title}</p>
                  <p className="mt-2 text-xs text-[var(--muted)]">{event.contact_person || event.inviting_organization}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{event.location}</p>
                  <div className="mt-4 flex gap-2">
                    <Link to={`/invitations/${event.id}`} className="primary-button flex-1 rounded-md px-3 py-2 text-center text-xs font-semibold">
                      Review
                    </Link>
                    <button type="button" onClick={() => setSelected(event)} className="secondary-button flex-1 rounded-md px-3 py-2 text-xs font-semibold">
                      Open
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--muted)]">No invitations are waiting for review.</p>
            )}
          </div>

          <Link to="/invitations" className="primary-button mt-8 inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold">
            <Plus className="h-4 w-4" />
            Open Invitations
          </Link>
        </section>
      </aside>

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-sm">
          <div className="h-full w-full max-w-md border-l border-[var(--line)] bg-[var(--surface-card)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="headline-font text-xl font-bold tracking-[-0.04em] text-[var(--ink)]">{selected.event_title}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{selected.inviting_organization}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="secondary-button rounded-md px-3 py-1.5 text-xs font-semibold">
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
              <Link to={`/invitations/${selected.id}`} className="primary-button rounded-md px-4 py-2 text-sm font-semibold">
                Open Details
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
