import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Locked-In Minimal (Mobile-First)
 * Focus:
 * - Daily Schedule (timed tasks)
 * - Daily Minimums (bare minimum checklist)
 *
 * Offline-first via localStorage.
 */

const LS_KEY = "locked_in_minimal_v1";

const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);

function pad2(n) {
  const s = String(n);
  return s.length === 1 ? "0" + s : s;
}

function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function safeParse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function timeStrToMin(t) {
  // "HH:MM" -> minutes
  if (!t || !t.includes(":")) return 0;
  const [h, m] = t.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return clamp(h, 0, 23) * 60 + clamp(m, 0, 59);
}

function minToTimeStr(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function humanDuration(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function defaultState() {
  const tk = todayKey();
  return {
    version: 1,
    dayKey: tk,
    // Minimums: the “even if everything goes bad” checklist
    minimums: [
      { id: uid(), text: "Gym / training", done: false },
      { id: uid(), text: "Creatine + supplements", done: false },
      { id: uid(), text: "Protein target (roughly)", done: false },
      { id: uid(), text: "10 min cleanup (room/phone)", done: false },
    ],
    // Schedule: timed tasks
    schedule: [
      { id: uid(), text: "School focus block", startMin: 16 * 60, durationMin: 60, done: false },
      { id: uid(), text: "Training", startMin: 17 * 60 + 30, durationMin: 60, done: false },
    ],
    // Settings
    settings: {
      theme: "dark", // dark | light
      defaultDurationMin: 30,
      startTimeSnapMin: 5,
      haptics: true,
    },
  };
}

function useVibrate(enabled) {
  return (ms = 10) => {
    if (!enabled) return;
    if (navigator.vibrate) navigator.vibrate(ms);
  };
}

function Card({ title, right, children, style }) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.06)",
        padding: 14,
        boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
        ...style,
      }}
    >
      {(title || right) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 14, opacity: 0.92, fontWeight: 900 }}>{title}</div>
          <div>{right}</div>
        </div>
      )}
      {children}
    </div>
  );
}

function SmallButton({ children, onClick, style, disabled }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        borderRadius: 12,
        padding: "8px 10px",
        fontWeight: 900,
        fontSize: 13,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.10)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        userSelect: "none",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Button({ children, onClick, variant = "primary", style, disabled }) {
  const variants = {
    primary: { background: "rgba(255,255,255,0.14)" },
    good: { background: "rgba(80,255,160,0.18)", border: "1px solid rgba(80,255,160,0.22)" },
    danger: { background: "rgba(255,80,80,0.18)", border: "1px solid rgba(255,80,80,0.22)" },
    ghost: { background: "transparent" },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        width: "100%",
        borderRadius: 14,
        padding: "12px 14px",
        fontWeight: 950,
        fontSize: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        userSelect: "none",
        ...variants[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function TextInput({ value, onChange, placeholder, style }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        borderRadius: 14,
        padding: "12px 12px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(0,0,0,0.16)",
        color: "inherit",
        outline: "none",
        fontSize: 14,
        ...style,
      }}
    />
  );
}

function CheckboxRow({ checked, onToggle, left, right, highlight }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 10px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.10)",
        background: checked ? "rgba(80,255,160,0.10)" : highlight ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.10)",
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: 34,
          height: 34,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.12)",
          background: checked ? "rgba(80,255,160,0.18)" : "transparent",
          color: "inherit",
          cursor: "pointer",
          fontWeight: 950,
          flex: "0 0 auto",
        }}
        aria-label="toggle"
      >
        {checked ? "✓" : ""}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>{left}</div>
      <div style={{ flex: "0 0 auto" }}>{right}</div>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState(() => {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? safeParse(raw, defaultState()) : defaultState();
  });

  // Daily rollover: if you open on a new day, reset done flags (but keep your list)
  useEffect(() => {
    const tk = todayKey();
    if (state.dayKey !== tk) {
      setState((s) => ({
        ...s,
        dayKey: tk,
        minimums: s.minimums.map((x) => ({ ...x, done: false })),
        schedule: s.schedule.map((x) => ({ ...x, done: false })),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }, [state]);

  const isDark = state.settings.theme === "dark";
  const vibrate = useVibrate(state.settings.haptics);

  const bg = isDark
    ? "radial-gradient(1200px 800px at 20% 0%, rgba(120,90,255,0.20), transparent 60%), radial-gradient(900px 600px at 100% 40%, rgba(50,220,160,0.16), transparent 65%), #07070a"
    : "radial-gradient(1200px 800px at 20% 0%, rgba(120,90,255,0.12), transparent 60%), radial-gradient(900px 600px at 100% 40%, rgba(50,220,160,0.10), transparent 65%), #f7f7fb";

  const fg = isDark ? "rgba(255,255,255,0.92)" : "rgba(10,10,16,0.92)";
  const sub = isDark ? "rgba(255,255,255,0.70)" : "rgba(10,10,16,0.60)";
  const hairline = isDark ? "rgba(255,255,255,0.10)" : "rgba(10,10,16,0.10)";

  const phoneStyle = {
    width: "100%",
    maxWidth: 460,
    margin: "0 auto",
    minHeight: "100dvh",
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 14,
    paddingBottom: 20,
    boxSizing: "border-box",
    color: fg,
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
  };

  const minsDone = useMemo(() => state.minimums.filter((x) => x.done).length, [state.minimums]);
  const schedDone = useMemo(() => state.schedule.filter((x) => x.done).length, [state.schedule]);

  const scheduleSorted = useMemo(() => {
    const arr = [...state.schedule];
    arr.sort((a, b) => a.startMin - b.startMin);
    return arr;
  }, [state.schedule]);

  // Suggest “next” item: first undone scheduled task (sorted by time), otherwise first undone minimum
  const nextUp = useMemo(() => {
    const s = scheduleSorted.find((x) => !x.done);
    if (s) return { type: "schedule", item: s };
    const m = state.minimums.find((x) => !x.done);
    if (m) return { type: "minimum", item: m };
    return null;
  }, [scheduleSorted, state.minimums]);

  // Add Schedule UI state
  const [taskText, setTaskText] = useState("");
  const [taskTime, setTaskTime] = useState(minToTimeStr(new Date().getHours() * 60 + new Date().getMinutes()));
  const [taskDur, setTaskDur] = useState(state.settings.defaultDurationMin);

  // Add Minimum UI state
  const [minText, setMinText] = useState("");

  // Refs for speed
  const scheduleInputRef = useRef(null);
  const minimumInputRef = useRef(null);

  function toggleMinimum(id) {
    setState((s) => ({
      ...s,
      minimums: s.minimums.map((x) => (x.id === id ? { ...x, done: !x.done } : x)),
    }));
    vibrate(10);
  }

  function toggleSchedule(id) {
    setState((s) => ({
      ...s,
      schedule: s.schedule.map((x) => (x.id === id ? { ...x, done: !x.done } : x)),
    }));
    vibrate(10);
  }

  function deleteMinimum(id) {
    setState((s) => ({ ...s, minimums: s.minimums.filter((x) => x.id !== id) }));
    vibrate(8);
  }

  function deleteSchedule(id) {
    setState((s) => ({ ...s, schedule: s.schedule.filter((x) => x.id !== id) }));
    vibrate(8);
  }

  function addMinimum() {
    const t = minText.trim();
    if (!t) return;
    setState((s) => ({
      ...s,
      minimums: [{ id: uid(), text: t, done: false }, ...s.minimums],
    }));
    setMinText("");
    vibrate(10);
    // keep focus
    setTimeout(() => minimumInputRef.current?.focus(), 0);
  }

  function addSchedule() {
    const t = taskText.trim();
    if (!t) return;

    const startMin = timeStrToMin(taskTime);
    const durationMin = clamp(Number(taskDur) || state.settings.defaultDurationMin, 5, 240);

    setState((s) => ({
      ...s,
      schedule: [...s.schedule, { id: uid(), text: t, startMin, durationMin, done: false }],
    }));
    setTaskText("");
    vibrate(10);
    setTimeout(() => scheduleInputRef.current?.focus(), 0);
  }

  function resetToday() {
    if (!confirm("Reset today’s checkmarks? (Keeps your tasks)")) return;
    setState((s) => ({
      ...s,
      minimums: s.minimums.map((x) => ({ ...x, done: false })),
      schedule: s.schedule.map((x) => ({ ...x, done: false })),
    }));
  }

  function nukeAll() {
    if (!confirm("Reset everything? This wipes your saved tasks.")) return;
    const fresh = defaultState();
    setState(fresh);
    localStorage.setItem(LS_KEY, JSON.stringify(fresh));
  }

  // Quick edit time/duration (simple inline controls)
  function bumpTime(id, deltaMin) {
    setState((s) => ({
      ...s,
      schedule: s.schedule.map((x) =>
        x.id === id ? { ...x, startMin: clamp(x.startMin + deltaMin, 0, 23 * 60 + 59) } : x
      ),
    }));
    vibrate(6);
  }

  function bumpDur(id, deltaMin) {
    setState((s) => ({
      ...s,
      schedule: s.schedule.map((x) =>
        x.id === id ? { ...x, durationMin: clamp(x.durationMin + deltaMin, 5, 240) } : x
      ),
    }));
    vibrate(6);
  }

  return (
    <div style={{ minHeight: "100dvh", background: bg }}>
      <div style={phoneStyle}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 20, fontWeight: 950, letterSpacing: -0.3 }}>Locked In</div>
            <div style={{ fontSize: 12, color: sub }}>
              {state.dayKey} • Minimums {minsDone}/{state.minimums.length} • Schedule {schedDone}/{state.schedule.length}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <SmallButton onClick={resetToday}>Reset</SmallButton>
            <SmallButton
              onClick={() =>
                setState((s) => ({
                  ...s,
                  settings: { ...s.settings, theme: s.settings.theme === "dark" ? "light" : "dark" },
                }))
              }
            >
              {isDark ? "☾" : "☀"}
            </SmallButton>
          </div>
        </div>

        {/* Next Up */}
        <Card
          title="Next up"
          right={<span style={{ fontSize: 12, color: sub, fontWeight: 900 }}>{nextUp ? "Do one thing." : "Done."}</span>}
          style={{ border: `1px solid ${hairline}` }}
        >
          {!nextUp ? (
            <div style={{ fontSize: 14, color: sub }}>You cleared today. Don’t add more. Recover, sleep, repeat.</div>
          ) : nextUp.type === "schedule" ? (
            <CheckboxRow
              checked={nextUp.item.done}
              onToggle={() => toggleSchedule(nextUp.item.id)}
              highlight
              left={
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontSize: 12, color: sub }}>
                    {minToTimeStr(nextUp.item.startMin)} • {humanDuration(nextUp.item.durationMin)}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 950 }}>{nextUp.item.text}</div>
                </div>
              }
              right={<SmallButton onClick={() => toggleSchedule(nextUp.item.id)}>{nextUp.item.done ? "Done" : "Mark"}</SmallButton>}
            />
          ) : (
            <CheckboxRow
              checked={nextUp.item.done}
              onToggle={() => toggleMinimum(nextUp.item.id)}
              highlight
              left={<div style={{ fontSize: 16, fontWeight: 950 }}>{nextUp.item.text}</div>}
              right={<SmallButton onClick={() => toggleMinimum(nextUp.item.id)}>{nextUp.item.done ? "Done" : "Mark"}</SmallButton>}
            />
          )}
        </Card>

        {/* Minimums */}
        <div style={{ height: 12 }} />
        <Card
          title="Daily Minimums"
          right={<span style={{ fontSize: 12, color: sub, fontWeight: 900 }}>Non-negotiable</span>}
          style={{ border: `1px solid ${hairline}` }}
        >
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <TextInput
              value={minText}
              onChange={setMinText}
              placeholder="Add a minimum (ex: take creatine)"
              style={{ flex: 1 }}
              ref={minimumInputRef}
              onKeyDown={(e) => {
                if (e.key === "Enter") addMinimum();
              }}
            />
            <SmallButton onClick={addMinimum} style={{ padding: "12px 12px" }}>
              Add
            </SmallButton>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {state.minimums.map((m) => (
              <CheckboxRow
                key={m.id}
                checked={m.done}
                onToggle={() => toggleMinimum(m.id)}
                left={<div style={{ fontSize: 14, fontWeight: 950, opacity: m.done ? 0.65 : 1 }}>{m.text}</div>}
                right={
                  <div style={{ display: "flex", gap: 8 }}>
                    <SmallButton onClick={() => toggleMinimum(m.id)}>{m.done ? "✓" : "Do"}</SmallButton>
                    <SmallButton onClick={() => deleteMinimum(m.id)}>✕</SmallButton>
                  </div>
                }
              />
            ))}
          </div>

          <div style={{ fontSize: 12, color: sub, marginTop: 10 }}>
            If your day collapses, these still happen. That’s how you stay consistent.
          </div>
        </Card>

        {/* Schedule */}
        <div style={{ height: 12 }} />
        <Card title="Daily Schedule" right={<span style={{ fontSize: 12, color: sub, fontWeight: 900 }}>Timed tasks</span>} style={{ border: `1px solid ${hairline}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 8, marginBottom: 8 }}>
            <TextInput
              value={taskText}
              onChange={setTaskText}
              placeholder="Add a scheduled task (ex: homework)"
              style={{ gridColumn: "1 / span 2" }}
              ref={scheduleInputRef}
              onKeyDown={(e) => {
                if (e.key === "Enter") addSchedule();
              }}
            />
            <TextInput value={taskTime} onChange={setTaskTime} placeholder="HH:MM" />
            <TextInput value={String(taskDur)} onChange={(v) => setTaskDur(v)} placeholder="mins" />
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <Button variant="good" onClick={addSchedule}>
              Add to schedule
            </Button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {scheduleSorted.map((s) => (
              <CheckboxRow
                key={s.id}
                checked={s.done}
                onToggle={() => toggleSchedule(s.id)}
                left={
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ fontSize: 12, color: sub }}>
                      {minToTimeStr(s.startMin)} • {humanDuration(s.durationMin)}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 950, opacity: s.done ? 0.65 : 1 }}>{s.text}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                      <SmallButton onClick={() => bumpTime(s.id, -5)} style={{ background: "rgba(255,255,255,0.06)" }}>-5m</SmallButton>
                      <SmallButton onClick={() => bumpTime(s.id, +5)} style={{ background: "rgba(255,255,255,0.06)" }}>+5m</SmallButton>
                      <SmallButton onClick={() => bumpDur(s.id, -5)} style={{ background: "rgba(255,255,255,0.06)" }}>Dur -</SmallButton>
                      <SmallButton onClick={() => bumpDur(s.id, +5)} style={{ background: "rgba(255,255,255,0.06)" }}>Dur +</SmallButton>
                    </div>
                  </div>
                }
                right={
                  <div style={{ display: "flex", gap: 8 }}>
                    <SmallButton onClick={() => toggleSchedule(s.id)}>{s.done ? "✓" : "Do"}</SmallButton>
                    <SmallButton onClick={() => deleteSchedule(s.id)}>✕</SmallButton>
                  </div>
                }
              />
            ))}
          </div>

          <div style={{ fontSize: 12, color: sub, marginTop: 10 }}>
            Keep the schedule realistic. If you plan 12 things you won’t do, you stop trusting yourself.
          </div>
        </Card>

        {/* Settings / Danger */}
        <div style={{ height: 12 }} />
        <Card title="Settings" style={{ border: `1px solid ${hairline}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 950 }}>Default duration</div>
                <div style={{ fontSize: 12, color: sub }}>Used when you type nothing or keep it simple</div>
              </div>
              <div style={{ width: 130 }}>
                <input
                  type="range"
                  min={10}
                  max={120}
                  step={5}
                  value={state.settings.defaultDurationMin}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      settings: { ...s.settings, defaultDurationMin: Number(e.target.value) },
                    }))
                  }
                  style={{ width: "100%" }}
                />
                <div style={{ fontSize: 12, color: sub, textAlign: "right" }}>{state.settings.defaultDurationMin}m</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <SmallButton
                onClick={() => setState((s) => ({ ...s, settings: { ...s.settings, haptics: !s.settings.haptics } }))}
                style={{ flex: 1 }}
              >
                Haptics: {state.settings.haptics ? "On" : "Off"}
              </SmallButton>
              <SmallButton onClick={nukeAll} style={{ flex: 1, background: "rgba(255,80,80,0.14)" }}>
                Reset all data
              </SmallButton>
            </div>
          </div>
        </Card>

        <div style={{ height: 16 }} />
        <div style={{ fontSize: 12, color: sub, textAlign: "center", paddingBottom: "env(safe-area-inset-bottom)" }}>
          Minimal on purpose. The point is doing, not managing the app.
        </div>
      </div>
    </div>
  );
}
