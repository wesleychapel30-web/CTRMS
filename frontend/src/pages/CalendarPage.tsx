import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { fetchInvitationCalendarMonth, fetchInvitations, fetchUpcomingInvitations } from "../lib/api";
import { formatDate, formatDateTime } from "../lib/format";
import type { InvitationRecord } from "../types";

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

  useEffect(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;

    const upcomingParams = new URLSearchParams();
    upcomingParams.set("event_date_from", new Date().toISOString());
    upcomingParams.set("ordering", "event_date");

    Promise.all([
      fetchInvitationCalendarMonth(year, month),
      fetchInvitations(upcomingParams),
      fetchUpcomingInvitations(),
    ])
      .then(([calendarEvents, allUpcoming, sevenDayEvents]) => {
        setMonthEvents(calendarEvents);
        setUpcomingEvents(allUpcoming.results ?? []);
        setNext7Days(sevenDayEvents ?? []);
        setError(null);
      })
      .catch((reason) => setError(reason.message));
  }, [currentMonth]);

  const monthCells = useMemo(() => {
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const leading = firstDay.getDay();
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

  if (error) {
    return <SectionCard title="Calendar">{error}</SectionCard>;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <SectionCard
        title="Monthly Calendar"
        subtitle="Monthly invitation schedule."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-slate-700"
            >
              Previous
            </button>
            <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-slate-700"
            >
              Next
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-7 gap-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-7 gap-3">
          {monthCells.map((cell, index) => (
            <div
              key={`${cell.day ?? "blank"}-${index}`}
              className={`min-h-24 rounded-lg border p-3 ${cell.day && cell.events.length ? "border-blue-300 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-950/30" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"}`}
            >
              {cell.day ? <div className="text-sm font-semibold text-slate-900 dark:text-white">{cell.day}</div> : null}
              {cell.events.slice(0, 2).map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => setSelected(event)}
                  className="mt-2 block w-full rounded-md bg-slate-900 px-2 py-1 text-left text-[11px] font-medium text-white dark:bg-cyan-500 dark:text-slate-900"
                >
                  {event.event_title}
                </button>
              ))}
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="space-y-6">
        <SectionCard title="Upcoming Events">
          <div className="space-y-3">
            {upcomingEvents.slice(0, 8).map((event) => (
              <div key={event.id} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{event.event_title}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{formatDateTime(event.event_date)} · {event.location}</p>
                  </div>
                  <StatusBadge status={event.status_display} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => setSelected(event)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-cyan-500 dark:text-slate-900">
                    Details
                  </button>
                  <Link to={`/invitations/${event.id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-slate-700">
                    Open Invitation
                  </Link>
                </div>
              </div>
            ))}
            {!upcomingEvents.length ? <p className="text-sm text-slate-500">No upcoming events found.</p> : null}
          </div>
        </SectionCard>

        <SectionCard title="Next 7 Days">
          <div className="space-y-2">
            {next7Days.map((event) => (
              <button key={event.id} type="button" onClick={() => setSelected(event)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left dark:border-slate-800 dark:bg-slate-900">
                <span>
                  <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{event.event_title}</span>
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{formatDateTime(event.event_date)}</span>
                </span>
                <StatusBadge status={event.status_display} />
              </button>
            ))}
            {!next7Days.length ? <p className="text-sm text-slate-500">No events scheduled in the next 7 days.</p> : null}
          </div>
        </SectionCard>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-sm">
          <div className="h-full w-full max-w-md border-l border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{selected.event_title}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{selected.inviting_organization}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold dark:border-slate-700">
                Close
              </button>
            </div>
            <div className="mt-5 grid gap-2 text-sm">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900"><strong>Date:</strong> {formatDateTime(selected.event_date)}</div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900"><strong>Day:</strong> {formatDate(selected.event_date)}</div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900"><strong>Location:</strong> {selected.location}</div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900"><strong>Status:</strong> {selected.status_display}</div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to={`/invitations/${selected.id}`} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-cyan-500 dark:text-slate-900">
                Open Details
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
