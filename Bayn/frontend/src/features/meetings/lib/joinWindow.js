// The video room opens 5 minutes before the meeting starts and closes when it
// ends. Daily.co enforces the same window server-side via the room's `nbf`
// property (see JOIN_WINDOW in the backend meetings service) — this is only so
// the UI can disable the button and say when it opens.
const JOIN_WINDOW_MS = 5 * 60 * 1000;

export function joinOpensAt(meeting) {
  return new Date(meeting.start_time).getTime() - JOIN_WINDOW_MS;
}

// A meeting is over once the host has explicitly ended it (ended_at set) or its
// scheduled end time has passed — whichever comes first.
export function isEnded(meeting, now = Date.now()) {
  if (meeting.ended_at) return true;
  return now >= new Date(meeting.end_time).getTime();
}

export function canJoin(meeting, now = Date.now()) {
  return now >= joinOpensAt(meeting) && !isEnded(meeting, now);
}

// Whole minutes left until the room opens, rounded up so a partial minute reads
// as "1" rather than "0" while the button is still disabled.
export function minutesUntilOpen(meeting, now = Date.now()) {
  return Math.max(0, Math.ceil((joinOpensAt(meeting) - now) / 60000));
}
