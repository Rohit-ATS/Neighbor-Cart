import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IMPACT_METRICS, USER_ACTIVITY } from '../data/communityData.js';

/* The impact report, read as an operations console rather than a poster.

   Three things it has to do at once: prove the outcome (meals, pounds,
   residents), show the detail behind each number (trend, drop-off, fill rate),
   and let a coordinator watch what people are doing right now — specifically
   where the service is failing them. Every figure here is aggregated and
   anonymized; the footer says so, because a page that monitors behaviour owes
   the reader that sentence.

   Colour does one job per chart. Magnitude bars are a single crimson, so
   length is the only encoding. The three arrival channels are the one
   categorical scale, and its hues were validated for colour-vision deficiency
   rather than chosen by eye. Status is reserved for health, and never travels
   without its label. */

const RANGES = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
];

const SERIES = '#b5222c';       // the one magnitude hue
const SERIES_SOFT = 'rgba(181, 34, 44, .12)';

const nf = new Intl.NumberFormat('en-US');
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

const relativeTime = (ms, now) => {
  const seconds = Math.max(1, Math.round((now - ms) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
};

const hourLabel = (hour) => {
  if (hour === 0) return '12a';
  if (hour === 12) return '12p';
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
};

/* ------------------------------------------------------------------ marks */

/* One series, so no legend: the card's own label names it. The last point
   carries a dot because that is the value the headline number states. */
function Sparkline({ series, rising }) {
  const width = 132;
  const height = 38;
  const pad = 3;
  const low = Math.min(...series);
  const high = Math.max(...series);
  const span = high - low || 1;

  const points = series.map((value, index) => {
    const x = pad + (index / (series.length - 1)) * (width - pad * 2);
    const y = height - pad - ((value - low) / span) * (height - pad * 2);
    return [x, y];
  });

  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${points.at(-1)[0].toFixed(1)} ${height} L${points[0][0].toFixed(1)} ${height} Z`;
  const [lastX, lastY] = points.at(-1);

  return (
    <svg className="ir-spark" viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img"
      aria-label={`Twelve week trend, ${rising ? 'rising' : 'falling'}, from ${nf.format(series[0])} to ${nf.format(series.at(-1))}`}>
      <path d={area} fill={SERIES_SOFT} />
      <path d={line} fill="none" stroke={SERIES} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* A 2px surface ring keeps the dot legible where it sits on the line. */}
      <circle cx={lastX} cy={lastY} r="4" fill={SERIES} stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

function DeltaChip({ value, inverse = false }) {
  const rising = value >= 0;
  const good = inverse ? !rising : rising;
  return (
    <span className={`ir-delta${good ? ' is-good' : ' is-down'}`}>
      <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
        <path d={rising ? 'M6 2.5 10 8H2z' : 'M6 9.5 2 4h8z'} fill="currentColor" />
      </svg>
      {rising ? '+' : '−'}{Math.abs(value).toFixed(1)}%
      <em>vs prior period</em>
    </span>
  );
}

/* Searches by hour. Magnitude, so one hue and a bar per hour; the hovered bar
   is the only one that changes, and the tooltip carries the real number. */
function HourlyChart({ data, scale }) {
  const [hovered, setHovered] = useState(null);
  const peak = Math.max(...data.map((d) => d.searches));
  const evening = data.filter((d) => d.hour >= 17 && d.hour <= 20).reduce((sum, d) => sum + d.searches, 0);
  const total = data.reduce((sum, d) => sum + d.searches, 0);

  return (
    <div className="ir-hours">
      <div className="ir-hours-plot" onMouseLeave={() => setHovered(null)}>
        {data.map((d) => {
          const isPeak = d.searches === peak;
          return (
            <button
              type="button"
              key={d.hour}
              className={`ir-hour-bar${hovered === d.hour ? ' is-hovered' : ''}${isPeak ? ' is-peak' : ''}`}
              style={{ height: `${Math.max(4, (d.searches / peak) * 100)}%` }}
              onMouseEnter={() => setHovered(d.hour)}
              onFocus={() => setHovered(d.hour)}
              onBlur={() => setHovered(null)}
              aria-label={`${hourLabel(d.hour)}: ${nf.format(scale(d.searches))} searches`}
            >
              {hovered === d.hour && (
                <span className="ir-tooltip" role="status">
                  <b>{hourLabel(d.hour)}</b>
                  {nf.format(scale(d.searches))} searches
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="ir-hours-axis" aria-hidden="true">
        <span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>11p</span>
      </div>
      <p className="ir-note">
        <b>{pct(evening, total)}% of searches land between 5pm and 9pm</b> — the window when the
        fewest partner sites are still open. Evening coverage is the clearest gap in the network.
      </p>
    </div>
  );
}

/* The resident journey. Each bar is measured against the first step so the
   shape of the loss is visible; the chip beside it is the step-to-step rate,
   which is the number worth acting on. */
function Funnel({ steps, scale }) {
  const top = steps[0].count;
  return (
    <ol className="ir-funnel">
      {steps.map((step, index) => {
        const previous = index === 0 ? null : steps[index - 1].count;
        const stepRate = previous ? pct(step.count, previous) : 100;
        const lost = previous ? previous - step.count : 0;
        return (
          <li key={step.step} className="ir-funnel-step">
            <div className="ir-funnel-head">
              <span className="ir-funnel-name">{step.step}</span>
              <span className="ir-funnel-count">{nf.format(scale(step.count))}</span>
            </div>
            <div className="ir-funnel-track">
              <div className="ir-funnel-fill" style={{ width: `${(step.count / top) * 100}%` }} />
            </div>
            <div className="ir-funnel-foot">
              <span className="ir-funnel-note">{step.note}</span>
              {previous ? (
                <span className={`ir-funnel-rate${stepRate < 50 ? ' is-low' : ''}`}>
                  {stepRate}% continued · {nf.format(scale(lost))} dropped off
                </span>
              ) : (
                <span className="ir-funnel-rate">Entry point</span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* Three arrival channels — the one categorical scale in the report. Hues are
   fixed per channel, direct-labelled, and separated by a 2px surface gap. */
function ChannelSplit({ channels, scale }) {
  const total = channels.reduce((sum, c) => sum + c.sessions, 0);
  return (
    <div className="ir-channels">
      <div className="ir-channel-bar" role="img" aria-label="Share of sessions by arrival channel">
        {channels.map((channel) => (
          <span
            key={channel.name}
            className="ir-channel-seg"
            style={{ width: `${(channel.sessions / total) * 100}%`, background: channel.hue }}
            title={`${channel.name}: ${nf.format(scale(channel.sessions))} sessions`}
          />
        ))}
      </div>
      <ul className="ir-channel-legend">
        {channels.map((channel) => (
          <li key={channel.name}>
            <i style={{ background: channel.hue }} aria-hidden="true" />
            <b>{channel.name}</b>
            <span>{pct(channel.sessions, total)}% · {compact.format(scale(channel.sessions))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------- page */

export default function ImpactDashboard({ onClose }) {
  const m = IMPACT_METRICS;
  const a = USER_ACTIVITY;

  const [range, setRange] = useState('30d');
  const [sort, setSort] = useState({ key: 'requests', dir: 'desc' });
  const [feedFilter, setFeedFilter] = useState('all');
  const [paused, setPaused] = useState(false);
  const [events, setEvents] = useState([]);
  const [now, setNow] = useState(() => Date.now());
  const seeded = useRef(false);

  const factor = a.windowScale[range];
  const scale = (value) => Math.round(value * factor);

  /* The monitor is seeded with a short history so it is never an empty box,
     then new events arrive while it is open. */
  const makeEvent = () => {
    const template = a.eventTemplates[Math.floor(Math.random() * a.eventTemplates.length)];
    const zip = m.demandByZip[Math.floor(Math.random() * m.demandByZip.length)];
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: template.type,
      status: template.status,
      text: template.text.replace('{zip}', `${zip.city} ${zip.zip}`),
      at: Date.now(),
    };
  };

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const history = Array.from({ length: 7 }, (_, index) => ({
      ...makeEvent(),
      at: Date.now() - (index + 1) * 26000,
    }));
    setEvents(history);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (paused) return undefined;
    const timer = setInterval(() => {
      setEvents((prev) => [makeEvent(), ...prev].slice(0, 40));
    }, 3400);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  /* Relative times go stale silently, so they are re-rendered on their own
     clock rather than only when a new event lands. */
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(tick);
  }, []);

  const headline = [
    { key: 'residentsHelped', value: nf.format(scale(m.residentsHelped)), label: 'Residents connected to food', note: 'No paperwork or ID required at any step' },
    { key: 'poundsRescued', value: `${nf.format(scale(m.poundsRescued))} lbs`, label: 'Surplus food rescued', note: 'Diverted from landfill by partner pickups' },
    { key: 'estimatedMeals', value: nf.format(scale(m.estimatedMeals)), label: 'Meals delivered', note: 'Modelled at the USDA 1.2 lbs per meal standard' },
    { key: 'volunteerHours', value: `${nf.format(scale(m.volunteerHours))} hrs`, label: 'Volunteer hours contributed', note: `${nf.format(scale(m.volunteerShiftsFilled))} shifts filled across the network` },
  ];

  const sortedZips = useMemo(() => {
    const rows = [...m.demandByZip];
    rows.sort((left, right) => {
      const a1 = left[sort.key];
      const b1 = right[sort.key];
      const diff = typeof a1 === 'string' ? a1.localeCompare(b1) : a1 - b1;
      return sort.dir === 'asc' ? diff : -diff;
    });
    return rows;
  }, [m.demandByZip, sort]);

  const maxRequests = Math.max(...m.demandByZip.map((z) => z.requests));

  const visibleEvents = feedFilter === 'all' ? events : events.filter((e) => e.type === feedFilter);
  const attentionCount = events.filter((e) => e.status === 'attention').length;

  const toggleSort = (key) => {
    setSort((prev) => (prev.key === key
      ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
      : { key, dir: key === 'city' ? 'asc' : 'desc' }));
  };

  /* A report people act on is a report they can take with them. */
  const exportCsv = () => {
    const rows = [
      ['Neighbor Cart impact report', `Window: ${range}`, `Generated: ${new Date().toISOString()}`],
      [],
      ['Metric', 'Value'],
      ...headline.map((card) => [card.label, card.value]),
      [],
      ['Journey step', 'People', 'Step conversion %'],
      ...a.funnel.map((step, index) => [
        step.step,
        scale(step.count),
        index === 0 ? 100 : pct(step.count, a.funnel[index - 1].count),
      ]),
      [],
      ['ZIP', 'City', 'Searches', 'Week over week %', 'Unmet rate %', 'Partner sites'],
      ...sortedZips.map((z) => [z.zip, z.city, scale(z.requests), z.trend, z.unmetRate, z.partners]),
      [],
      ['Category', 'Share of demand %', 'Requests', 'Fill rate %'],
      ...m.categoryBreakdown.map((c) => [c.category, c.percent, scale(c.requests), c.fillRate]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `neighbor-cart-impact-${range}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Impact and activity report">
      <div className="impact-modal-card" onClick={(e) => e.stopPropagation()}>

        {/* ---------------------------------------------------------- header */}
        <div className="impact-header">
          <div className="ir-head-copy">
            <span className="np-badge">📊 Transparent impact</span>
            <h2 className="np-title">Food access impact &amp; activity report</h2>
            <p className="np-sub">
              Outcomes, resident journey and live service monitoring across the partner network.
              <span className="ir-updated">
                <i className="ir-live-dot" aria-hidden="true" />
                Updated {new Date(m.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
            </p>
          </div>

          <div className="ir-head-tools">
            <div className="ir-range" role="group" aria-label="Reporting window">
              {RANGES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`ir-range-btn${range === option.id ? ' is-active' : ''}`}
                  aria-pressed={range === option.id}
                  onClick={() => setRange(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button type="button" className="ir-export" onClick={exportCsv}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
            </button>
            <button className="modal-close" onClick={onClose} aria-label="Close impact dashboard">×</button>
          </div>
        </div>

        {/* ------------------------------------------------------- headline */}
        <div className="impact-counters-grid">
          {headline.map((card) => {
            const trend = m.trends[card.key];
            return (
              <div key={card.key} className="ic-card">
                <div className="ic-top">
                  <span className="ic-val">{card.value}</span>
                  <Sparkline series={trend.series} rising={trend.delta >= 0} />
                </div>
                <span className="ic-label">{card.label}</span>
                <DeltaChip value={trend.delta} />
                <span className="ic-note">{card.note}</span>
              </div>
            );
          })}
        </div>

        <div className="ir-body">

          {/* ------------------------------------------------- the journey */}
          <section className="impact-section-panel ir-span-2">
            <div className="ir-panel-head">
              <div>
                <h3>Resident journey</h3>
                <p className="np-desc">Where people go after arriving, and where the service loses them.</p>
              </div>
              <span className="ir-panel-stat">
                <b>{pct(a.funnel.at(-1).count, a.funnel[0].count)}%</b> reach a reserved pickup
              </span>
            </div>
            <Funnel steps={a.funnel} scale={scale} />
            <p className="ir-note">
              The sharpest fall is between opening a location and acting on it — the step where hours,
              transport and eligibility doubts usually decide the outcome.
            </p>
          </section>

          {/* ------------------------------------------- the live monitor */}
          <section className="impact-section-panel ir-span-2 ir-monitor">
            <div className="ir-panel-head">
              <div>
                <h3>
                  <i className="ir-live-dot" aria-hidden="true" />
                  Live activity monitor
                </h3>
                <p className="np-desc">
                  Anonymized resident actions as they happen. {attentionCount > 0 && (
                    <b className="ir-attention-count">{attentionCount} need attention</b>
                  )}
                </p>
              </div>
              <button
                type="button"
                className={`ir-pause${paused ? ' is-paused' : ''}`}
                onClick={() => setPaused((value) => !value)}
                aria-pressed={paused}
              >
                {paused ? '▶ Resume stream' : '❚❚ Pause stream'}
              </button>
            </div>

            <div className="ir-feed-filters" role="group" aria-label="Filter activity by type">
              <button
                type="button"
                className={`ir-chip${feedFilter === 'all' ? ' is-active' : ''}`}
                onClick={() => setFeedFilter('all')}
              >
                All activity
              </button>
              {a.eventTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  className={`ir-chip${feedFilter === type.id ? ' is-active' : ''}`}
                  onClick={() => setFeedFilter(type.id)}
                >
                  <i style={{ background: type.hue }} aria-hidden="true" />
                  {type.label}
                </button>
              ))}
            </div>

            <ul className="ir-feed" aria-live="polite" aria-relevant="additions">
              {visibleEvents.length === 0 && (
                <li className="ir-feed-empty">No activity of this type in the current stream.</li>
              )}
              {visibleEvents.slice(0, 9).map((event) => {
                const type = a.eventTypes.find((t) => t.id === event.type);
                return (
                  <li key={event.id} className={`ir-feed-row is-${event.status}`}>
                    <i className="ir-feed-dot" style={{ background: type?.hue }} aria-hidden="true" />
                    <span className="ir-feed-text">{event.text}</span>
                    <span className={`ir-feed-status is-${event.status}`}>
                      {event.status === 'attention' ? '⚠ Needs attention' : '✓ Served'}
                    </span>
                    <time className="ir-feed-time">{relativeTime(event.at, now)}</time>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* ----------------------------------------------- when they come */}
          <section className="impact-section-panel">
            <div className="ir-panel-head">
              <div>
                <h3>When people search</h3>
                <p className="np-desc">Searches by hour of day, in the resident’s own time zone.</p>
              </div>
            </div>
            <HourlyChart data={a.hourly} scale={scale} />
          </section>

          {/* -------------------------------------------- how they arrive */}
          <section className="impact-section-panel">
            <div className="ir-panel-head">
              <div>
                <h3>How people arrive</h3>
                <p className="np-desc">Share of sessions by the route taken to a location.</p>
              </div>
            </div>
            <ChannelSplit channels={a.channels} scale={scale} />

            <div className="ir-mini-grid">
              <div><b>{nf.format(scale(a.totals.sessions))}</b><span>Sessions</span></div>
              <div><b>{Math.floor(a.totals.avgSessionSeconds / 60)}m {a.totals.avgSessionSeconds % 60}s</b><span>Median session</span></div>
              <div><b>{a.totals.returningShare}%</b><span>Returning residents</span></div>
            </div>
          </section>

          {/* ------------------------------------------------ demand by ZIP */}
          <section className="impact-section-panel ir-span-2">
            <div className="ir-panel-head">
              <div>
                <h3>Community demand by ZIP code</h3>
                <p className="np-desc">
                  Sortable. <b>Unmet</b> is the share of searches that ended without anyone opening a location —
                  the clearest signal of where coverage is thin.
                </p>
              </div>
            </div>

            <div className="ir-table-wrap">
              <table className="ir-table">
                <thead>
                  <tr>
                    {[
                      { key: 'zip', label: 'ZIP', align: 'left' },
                      { key: 'city', label: 'City', align: 'left' },
                      { key: 'requests', label: 'Searches', align: 'right' },
                      { key: 'trend', label: 'Week over week', align: 'right' },
                      { key: 'unmetRate', label: 'Unmet', align: 'right' },
                      { key: 'partners', label: 'Partner sites', align: 'right' },
                    ].map((column) => (
                      <th
                        key={column.key}
                        className={`is-${column.align}${sort.key === column.key ? ' is-sorted' : ''}`}
                        aria-sort={sort.key === column.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      >
                        <button type="button" onClick={() => toggleSort(column.key)}>
                          {column.label}
                          <i aria-hidden="true">{sort.key === column.key ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</i>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedZips.map((zip) => (
                    <tr key={zip.zip}>
                      <td className="ir-zip-code">{zip.zip}</td>
                      <td>
                        <span className="ir-zip-city">{zip.city}</span>
                        <span className="ir-zip-bar" aria-hidden="true">
                          <i style={{ width: `${(zip.requests / maxRequests) * 100}%` }} />
                        </span>
                      </td>
                      <td className="is-right ir-num">{nf.format(scale(zip.requests))}</td>
                      <td className="is-right">
                        <span className={`ir-trend${zip.trend >= 0 ? ' is-up' : ' is-down'}`}>
                          {zip.trend >= 0 ? '▲' : '▼'} {Math.abs(zip.trend).toFixed(1)}%
                        </span>
                      </td>
                      <td className="is-right">
                        <span className={`ir-unmet${zip.unmetRate >= 25 ? ' is-critical' : zip.unmetRate >= 15 ? ' is-warn' : ' is-ok'}`}>
                          {zip.unmetRate}%
                        </span>
                      </td>
                      <td className="is-right ir-num">{zip.partners}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ------------------------------------------------- categories */}
          <section className="impact-section-panel">
            <div className="ir-panel-head">
              <div>
                <h3>Most requested categories</h3>
                <p className="np-desc">Demand against how often that request was actually filled.</p>
              </div>
            </div>

            <div className="category-metric-list">
              {m.categoryBreakdown.map((cat) => (
                <div key={cat.category} className="cat-metric-item">
                  <div className="cmi-top">
                    <span className="cmi-name">{cat.category}</span>
                    <span className="cmi-pct">{cat.percent}% · {nf.format(scale(cat.requests))} requests</span>
                  </div>
                  <div className="ir-bar-track">
                    <div className="ir-bar-fill" style={{ width: `${(cat.percent / 38) * 100}%` }} />
                  </div>
                  <span className={`ir-fill-rate${cat.fillRate < 60 ? ' is-critical' : cat.fillRate < 80 ? ' is-warn' : ' is-ok'}`}>
                    {cat.fillRate < 60 ? '⚠ ' : cat.fillRate < 80 ? '• ' : '✓ '}
                    {cat.fillRate}% of these requests found stock
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ---------------------------------------------- service health */}
          <section className="impact-section-panel">
            <div className="ir-panel-head">
              <div>
                <h3>Service health</h3>
                <p className="np-desc">Each measure against the threshold the network holds itself to.</p>
              </div>
            </div>

            <ul className="ir-health">
              {a.health.map((item) => (
                <li key={item.label} className={`ir-health-row is-${item.status}`}>
                  <span className="ir-health-mark" aria-hidden="true">{item.status === 'good' ? '✓' : '⚠'}</span>
                  <span className="ir-health-copy">
                    <b>{item.label}</b>
                    <span>{item.target}</span>
                  </span>
                  <span className="ir-health-val">{item.value}</span>
                  <span className="ir-health-state">{item.status === 'good' ? 'On target' : 'Off target'}</span>
                </li>
              ))}
            </ul>

            <div className="performance-stat-box">
              <div className="psb-item">
                <span className="psb-val">{m.organizationsPartnered}</span>
                <span className="psb-label">Partner pantries &amp; food banks</span>
              </div>
              <div className="psb-item">
                <span className="psb-val">{m.avgResponseSeconds}s</span>
                <span className="psb-label">Request to recommendation</span>
              </div>
              <div className="psb-item">
                <span className="psb-val">{nf.format(scale(m.successfulReferrals))}</span>
                <span className="psb-label">Completed partner referrals</span>
              </div>
            </div>
          </section>
        </div>

        {/* ---------------------------------------------------------- footer */}
        <footer className="ir-foot">
          <p>
            <b>How this is measured.</b> Meals are modelled from rescued weight at the USDA standard of
            1.2 lbs per meal. Searches, journeys and referrals are counted server-side from anonymous
            session identifiers that expire with the session.
          </p>
          <p>
            <b>What is not collected.</b> No names, accounts, device identifiers or precise locations.
            Activity is aggregated to ZIP level before it reaches this report, and nothing here can be
            traced back to a person. Figures shown are demonstration data for the {RANGES.find((r) => r.id === range).label} window.
          </p>
        </footer>
      </div>
    </div>
  );
}
