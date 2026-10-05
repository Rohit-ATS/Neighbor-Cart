/* Putting a claimed shift into the calendar someone actually uses.

   There are only two mechanisms worth supporting, and between them they cover
   nearly everyone: a Google Calendar template URL, and an .ics file. Apple
   Calendar, Outlook, Fastmail and Thunderbird all open .ics; Google opens it
   too, but a template URL lands someone on a pre-filled event they can save in
   one click rather than a download they have to find and double-click.

   The hard part is not the formats, it is being exact about time. A volunteer
   shift someone is relying on must not arrive in their calendar an hour out, so
   both paths are built from one real Date and converted to UTC, rather than
   from the sentence shown on the card. */

const pad = (value) => String(value).padStart(2, '0');

/* Both formats want the same basic-format UTC stamp: 20261006T160000Z. */
const stampUtc = (date) => [
  date.getUTCFullYear(),
  pad(date.getUTCMonth() + 1),
  pad(date.getUTCDate()),
  'T',
  pad(date.getUTCHours()),
  pad(date.getUTCMinutes()),
  pad(date.getUTCSeconds()),
  'Z',
].join('');

/**
 * A Google Calendar "add event" link.
 *
 * It opens their compose screen with everything filled in. Nothing is created
 * until the person presses save, which is the right default: this is an offer,
 * not a write into someone's calendar.
 */
export function googleCalendarUrl({ title, start, end, details, location }) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${stampUtc(start)}/${stampUtc(end)}`,
    details: details || '',
    location: location || '',
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/* iCalendar reserves these four characters inside a text value, so each has to
   be escaped or the event silently truncates at the first comma. */
const escapeText = (value) => String(value || '')
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n');

/* RFC 5545 caps a line at 75 octets and continues it with a leading space.
   Long descriptions are the usual reason an .ics is rejected, and the usual
   reason is that nobody folded them. Octets, not characters: an accented
   letter is two bytes and would otherwise push the line over. */
const foldLine = (line) => {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const parts = [];
  let current = '';
  let width = 0;
  for (const character of line) {
    const size = new TextEncoder().encode(character).length;
    // 74 on continuation lines, because the leading space counts toward 75.
    if (width + size > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = '';
      width = 0;
    }
    current += character;
    width += size;
  }
  if (current) parts.push(current);
  return parts.join('\r\n ');
};

/**
 * One event as an .ics document.
 *
 * `uid` should be stable for a given shift so that re-adding it updates the
 * existing entry rather than producing a duplicate.
 */
export function buildIcs({ uid, title, start, end, details, location }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Neighbor Cart//Volunteer Shifts//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeText(uid)}`,
    `DTSTAMP:${stampUtc(new Date())}`,
    `DTSTART:${stampUtc(start)}`,
    `DTEND:${stampUtc(end)}`,
    `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:${escapeText(details)}`,
    `LOCATION:${escapeText(location)}`,
    'STATUS:CONFIRMED',
    /* A shift someone signed up for is worth a reminder; an hour is enough to
       travel and not so early that it is dismissed and forgotten. */
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  // CRLF is required, not stylistic: some clients reject bare newlines.
  return lines.map(foldLine).join('\r\n');
}

/** Hand the .ics to the browser as a download. */
export function downloadIcs(event, filename = 'volunteer-shift.ics') {
  const blob = new Blob([buildIcs(event)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on the next tick: Safari has not finished reading it synchronously.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/* ---- volunteer shifts ----

   A shift stores a day offset and a wall-clock time. Both are resolved against
   the viewer's own clock, which is also the clock their calendar runs on. */

const atTime = (day, hhmm) => {
  const [hours, minutes] = hhmm.split(':').map(Number);
  const when = new Date(day);
  when.setHours(hours, minutes, 0, 0);
  return when;
};

export function shiftTimes(shift) {
  const day = new Date();
  day.setDate(day.getDate() + (shift.inDays ?? 0));
  return { start: atTime(day, shift.startTime), end: atTime(day, shift.endTime) };
}

/* "Tomorrow · 9:00 AM – 12:00 PM". The relative words are worth keeping — they
   are how people actually think about the next few days — but only where they
   are true, so beyond tomorrow it names the day. */
export function shiftWhen(shift) {
  const { start, end } = shiftTimes(shift);
  const time = (date) => date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const relative = { 0: 'Today', 1: 'Tomorrow' }[shift.inDays];
  const day = relative || start.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  return `${day} · ${time(start)} – ${time(end)}`;
}

/** The calendar event for a claimed shift, in the shape both exports want. */
export function shiftEvent(shift) {
  const { start, end } = shiftTimes(shift);
  return {
    uid: `${shift.id}@neighbor-cart`,
    title: `Volunteer: ${shift.title}`,
    start,
    end,
    location: shift.location,
    details: [
      `${shift.orgName} · ${shift.taskType}`,
      shift.skillsNeeded && `What to bring: ${shift.skillsNeeded}`,
      `Counts as ${shift.hoursGranted} hours of volunteer credit.`,
      shift.impactEstimate,
      'Check in with the site lead when you arrive. Booked through Neighbor Cart.',
    ].filter(Boolean).join('\n'),
  };
}
