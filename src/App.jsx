import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

/**
 * LevelUp Mobile (Self-Only)
 * - Mobile-first single-page app
 * - Offline-first (localStorage)
 * - Optional Supabase sync
 *
 * Ethical stickiness:
 * - Low friction defaults
 * - Gentle streak system (no shame)
 * - “Next action” focus mode
 * - Weekly reset + review
 */

// -----------------------------
// Utilities
// -----------------------------
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);

function pad2(n) {
  const s = String(n);
  return s.length === 1 ? "0" + s : s;
}
function yyyyMmDd(d = new Date()) {
  const yr = d.getFullYear();
  const mo = pad2(d.getMonth() + 1);
  const da = pad2(d.getDate());
  return `${yr}-${mo}-${da}`;
}
function parseDateKey(key) {
  // key: YYYY-MM-DD
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function startOfWeek(date = new Date()) {
  // Monday-start week
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function minutesToHuman(m) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h <= 0) return `${mm}m`;
  if (mm === 0) return `${h}h`;
  return `${h}h ${mm}m`;
}
function safeJsonParse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}
function deepClone(x) {
  return JSON.parse(JSON.stringify(x));
}
function isTodayKey(key) {
  return key === yyyyMmDd(new Date());
}

// -----------------------------
// Local storage layer
// -----------------------------
const LS_KEY = "levelup_mobile_v1";

function loadState() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return null;
  return safeJsonParse(raw, null);
}

function saveState(state) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

// -----------------------------
// Supabase (optional)
// -----------------------------
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_ANON ? createClient(SUPABASE_URL, SUPABASE_ANON) : null;

/**
 * Recommended tables (optional):
 *
 * 1) profiles
 *  - id uuid primary key references auth.users(id)
 *  - created_at timestamptz default now()
 *
 * 2) blobs (simple KV to store whole app state per user)
 *  - id uuid primary key default gen_random_uuid()
 *  - user_id uuid references auth.users(id)
 *  - updated_at timestamptz default now()
 *  - payload jsonb not null
 *
 * Enable RLS:
 *  - blobs: user_id = auth.uid()
 *
 * You can also do normalized tables later. This is fastest to ship.
 */

// -----------------------------
// Default content
// -----------------------------
const QUOTES = [
  // David Goggins (paraphrased style; keep short)
  { id: "q1", author: "David Goggins", tag: "Goggins", text: "You don’t find confidence. You earn it through work you didn’t feel like doing." },
  { id: "q2", author: "David Goggins", tag: "Goggins", text: "When your mind says you’re done, you’re not." },
  { id: "q3", author: "David Goggins", tag: "Goggins", text: "Callus your mind the way you callus your hands." },

  // Alex Hormozi (business/discipline tone)
  { id: "q4", author: "Alex Hormozi", tag: "Hormozi", text: "Do the boring work. Reps create results." },
  { id: "q5", author: "Alex Hormozi", tag: "Hormozi", text: "Consistency beats intensity you can’t repeat." },
  { id: "q6", author: "Alex Hormozi", tag: "Hormozi", text: "Your feelings are data, not directives." },

  // Andrew Tate / Tristan Tate (keep it non-hate, non-violent; “discipline” only)
  { id: "q7", author: "Andrew Tate", tag: "Tate", text: "Discipline is choosing what you want most over what you want now." },
  { id: "q8", author: "Tristan Tate", tag: "Tate", text: "If you can keep promises to yourself, everything changes." },

  // Jesus (short)
  { id: "q9", author: "Jesus", tag: "Jesus", text: "Let your ‘Yes’ be ‘Yes,’ and your ‘No,’ ‘No.’" },
  { id: "q10", author: "Jesus", tag: "Jesus", text: "Do not worry about tomorrow; tomorrow will worry about itself." },
  { id: "q11", author: "Jesus", tag: "Jesus", text: "Where your treasure is, there your heart will be also." },
];

const DEFAULT_HABITS = [
  { id: uid(), name: "Workout / Train", icon: "🥊", targetPerWeek: 4, points: 15, color: "blue" },
  { id: uid(), name: "School Work (Focused)", icon: "📚", targetPerWeek: 5, points: 10, color: "green" },
  { id: uid(), name: "No junk scrolling (cap)", icon: "🧠", targetPerWeek: 6, points: 10, color: "purple" },
  { id: uid(), name: "Sleep on time", icon: "😴", targetPerWeek: 6, points: 10, color: "indigo" },
  { id: uid(), name: "Hydration", icon: "💧", targetPerWeek: 7, points: 5, color: "cyan" },
];

const DEFAULT_GOALS = [
  {
    id: uid(),
    title: "Build muscle (lean bulk)",
    why: "Strength + confidence + boxing performance",
    metricLabel: "Gym sessions",
    metricGoal: 16,
    metricCurrent: 0,
    milestones: [
      { id: uid(), text: "Hit 4 sessions this week", done: false },
      { id: uid(), text: "Track protein 5 days", done: false },
      { id: uid(), text: "Add 5 lbs to main lift", done: false },
    ],
  },
  {
    id: uid(),
    title: "Stay consistent with school",
    why: "Freedom later is built now",
    metricLabel: "Focused blocks",
    metricGoal: 20,
    metricCurrent: 0,
    milestones: [
      { id: uid(), text: "No missing assignments this week", done: false },
      { id: uid(), text: "2 hours deep work on weekdays", done: false },
    ],
  },
];

function makeDefaultState() {
  const today = yyyyMmDd(new Date());
  const weekStart = yyyyMmDd(startOfWeek(new Date()));

  return {
    meta: {
      version: 1,
      createdAt: new Date().toISOString(),
      lastOpenAt: new Date().toISOString(),
      weekStartKey: weekStart,
    },
    user: {
      displayName: "Samuel",
      theme: "dark", // dark | light
      reduceMotion: false,
    },
    navigation: { tab: "home" }, // home | plan | habits | goals | motivation | journal | settings
    gamification: {
      xp: 0,
      level: 1,
      pointsThisWeek: 0,
      pointsToday: 0,
      lastScoreDayKey: today,
      lastScoreWeekKey: weekStart,
      badges: [],
    },
    plan: {
      dayKey: today,
      top3: [
        { id: uid(), text: "Train (boxing or lifting)", done: false, priority: 1 },
        { id: uid(), text: "Finish 1 important school task", done: false, priority: 2 },
        { id: uid(), text: "15 min cleanup: room + phone", done: false, priority: 3 },
      ],
      timeBlocks: [
        { id: uid(), label: "Deep Work", startMin: 16 * 60, durationMin: 60, task: "School / App / Business", done: false },
        { id: uid(), label: "Train", startMin: 17 * 60 + 30, durationMin: 60, task: "Boxing / Lift", done: false },
      ],
      brainDump: [],
      nextAction: { mode: false, itemId: null }, // focus mode
    },
    habits: {
      items: DEFAULT_HABITS,
      checksByDay: {
        // dayKey: { habitId: true/false }
      },
      streaks: {
        // habitId: { current: 0, best: 0, lastDoneKey: "YYYY-MM-DD" }
      },
    },
    goals: {
      items: DEFAULT_GOALS,
    },
    motivation: {
      filters: { Goggins: true, Hormozi: true, Tate: true, Jesus: true },
      favorites: [],
      lastShownId: null,
    },
    journal: {
      entriesByDay: {
        // dayKey: { wins: "", lessons: "", gratitude: "", planTomorrow: "", mood: 3 }
      },
      prompts: [
        "What did you do today that your future self will respect?",
        "What was the hardest moment today and how did you respond?",
        "What are you avoiding that you need to handle?",
      ],
    },
    sync: {
      enabled: false,
      status: "offline", // offline | ready | syncing | error
      lastSyncAt: null,
      lastError: null,
    },
  };
}

// -----------------------------
// Scoring + leveling
// -----------------------------
function levelFromXp(xp) {
  // simple curve
  // level 1 at 0, level increases when xp passes thresholds
  let level = 1;
  let need = 100;
  let remaining = xp;
  while (remaining >= need) {
    remaining -= need;
    level += 1;
    need = Math.floor(need * 1.15);
    if (level > 99) break;
  }
  return level;
}

function xpToNextLevel(xp) {
  let level = 1;
  let need = 100;
  let remaining = xp;
  while (remaining >= need) {
    remaining -= need;
    level += 1;
    need = Math.floor(need * 1.15);
    if (level > 99) break;
  }
  return { level, intoLevel: remaining, need };
}

// -----------------------------
// Gentle streak logic
// -----------------------------
function updateStreak(streak, dayKey) {
  // streak: {current, best, lastDoneKey}
  // gentle rule:
  // - if done today: if lastDoneKey is yesterday => +1, if today => unchanged, else reset to 1
  // - doesn’t punish missed days beyond reset (no negative)
  const today = parseDateKey(dayKey);
  const last = streak?.lastDoneKey ? parseDateKey(streak.lastDoneKey) : null;
  const newStreak = streak ? { ...streak } : { current: 0, best: 0, lastDoneKey: null };

  if (!last) {
    newStreak.current = 1;
  } else {
    const diffDays = Math.floor((today - last) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      // same day
      return newStreak;
    }
    if (diffDays === 1) {
      newStreak.current = (newStreak.current || 0) + 1;
    } else {
      newStreak.current = 1;
    }
  }

  newStreak.best = Math.max(newStreak.best || 0, newStreak.current);
  newStreak.lastDoneKey = dayKey;
  return newStreak;
}

// -----------------------------
// UI helpers
// -----------------------------
function useHaptics() {
  return (ms = 10) => {
    // no actual haptics on web; use small vibration if supported
    if (navigator.vibrate) navigator.vibrate(ms);
  };
}

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function IconPill({ children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 14, opacity: 0.9, fontWeight: 700 }}>{title}</div>
          <div>{right}</div>
        </div>
      )}
      {children}
    </div>
  );
}

function Button({ children, onClick, variant = "primary", disabled, style }) {
  const base = {
    width: "100%",
    borderRadius: 14,
    padding: "12px 14px",
    fontWeight: 800,
    fontSize: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    userSelect: "none",
  };
  const variants = {
    primary: { background: "rgba(255,255,255,0.15)" },
    ghost: { background: "transparent" },
    danger: { background: "rgba(255,80,80,0.20)", border: "1px solid rgba(255,80,80,0.25)" },
    good: { background: "rgba(80,255,160,0.18)", border: "1px solid rgba(80,255,160,0.22)" },
  };
  return (
    <button onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

function SmallButton({ children, onClick, variant = "ghost", style }) {
  const base = {
    borderRadius: 12,
    padding: "8px 10px",
    fontWeight: 800,
    fontSize: 13,
    border: "1px solid rgba(255,255,255,0.12)",
    background: variant === "ghost" ? "transparent" : "rgba(255,255,255,0.12)",
    cursor: "pointer",
    userSelect: "none",
  };
  return (
    <button onClick={onClick} style={{ ...base, ...style }}>
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
        background: "rgba(0,0,0,0.12)",
        color: "inherit",
        outline: "none",
        fontSize: 14,
        ...style,
      }}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 4, style }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: "100%",
        borderRadius: 14,
        padding: "12px 12px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(0,0,0,0.12)",
        color: "inherit",
        outline: "none",
        fontSize: 14,
        resize: "vertical",
        ...style,
      }}
    />
  );
}

// -----------------------------
// Main App
// -----------------------------
export default function App() {
  const vibrate = useHaptics();

  const [state, setState] = useState(() => {
    const loaded = loadState();
    return loaded || makeDefaultState();
  });

  // keep in sync with localStorage
  useEffect(() => {
    saveState(state);
  }, [state]);

  // update last open & handle week rollover
  useEffect(() => {
    setState((s) => {
      const ns = deepClone(s);
      ns.meta.lastOpenAt = new Date().toISOString();

      const today = new Date();
      const todayKey = yyyyMmDd(today);
      const weekStartKey = yyyyMmDd(startOfWeek(today));

      // daily rollover: reset pointsToday if lastScoreDayKey != todayKey
      if (ns.gamification.lastScoreDayKey !== todayKey) {
        ns.gamification.pointsToday = 0;
        ns.gamification.lastScoreDayKey = todayKey;
      }

      // weekly rollover
      if (ns.gamification.lastScoreWeekKey !== weekStartKey) {
        ns.gamification.pointsThisWeek = 0;
        ns.gamification.lastScoreWeekKey = weekStartKey;
        ns.meta.weekStartKey = weekStartKey;
      }

      // keep plan dayKey current if you open a new day
      if (ns.plan.dayKey !== todayKey) {
        ns.plan.dayKey = todayKey;
        // Keep top3 but mark undone for the new day (gentle fresh start)
        ns.plan.top3 = ns.plan.top3.map((t) => ({ ...t, done: false }));
        ns.plan.timeBlocks = ns.plan.timeBlocks.map((b) => ({ ...b, done: false }));
        ns.plan.nextAction = { mode: false, itemId: null };
      }

      return ns;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // theme
  const isDark = state.user.theme === "dark";

  const tab = state.navigation.tab;

  const xpInfo = useMemo(() => xpToNextLevel(state.gamification.xp), [state.gamification.xp]);
  const level = useMemo(() => levelFromXp(state.gamification.xp), [state.gamification.xp]);

  // computed stats
  const todayKey = yyyyMmDd(new Date());
  const weekStartKey = state.meta.weekStartKey;
  const weekStartDate = parseDateKey(weekStartKey);
  const weekKeys = useMemo(() => Array.from({ length: 7 }, (_, i) => yyyyMmDd(addDays(weekStartDate, i))), [weekStartKey]);

  const habitCompletionToday = useMemo(() => {
    const day = state.habits.checksByDay[todayKey] || {};
    const total = state.habits.items.length || 1;
    const done = state.habits.items.reduce((acc, h) => acc + (day[h.id] ? 1 : 0), 0);
    return { done, total, pct: Math.round((done / total) * 100) };
  }, [state.habits.checksByDay, state.habits.items, todayKey]);

  function setTab(next) {
    setState((s) => ({ ...s, navigation: { ...s.navigation, tab: next } }));
    vibrate(8);
  }

  function award(points, reason = "") {
    // convert points -> xp
    const xpGain = Math.round(points * 2.5);
    setState((s) => {
      const ns = deepClone(s);
      ns.gamification.pointsToday += points;
      ns.gamification.pointsThisWeek += points;
      ns.gamification.xp += xpGain;
      ns.gamification.level = levelFromXp(ns.gamification.xp);
      // badges can be added later
      return ns;
    });
    if (reason) console.log("Award:", points, reason);
  }

  function spend(points) {
    setState((s) => {
      const ns = deepClone(s);
      ns.gamification.pointsToday = Math.max(0, ns.gamification.pointsToday - points);
      ns.gamification.pointsThisWeek = Math.max(0, ns.gamification.pointsThisWeek - points);
      return ns;
    });
  }

  // -----------------------------
  // Habits actions
  // -----------------------------
  function toggleHabitCheck(dayKey, habitId) {
    setState((s) => {
      const ns = deepClone(s);
      const day = ns.habits.checksByDay[dayKey] || {};
      const was = !!day[habitId];
      day[habitId] = !was;
      ns.habits.checksByDay[dayKey] = day;

      const habit = ns.habits.items.find((h) => h.id === habitId);
      const pts = habit?.points ?? 5;

      if (!was) {
        // done now
        ns.habits.streaks[habitId] = updateStreak(ns.habits.streaks[habitId], dayKey);

        // only award points if marking today (avoid farming old days)
        if (dayKey === todayKey) {
          ns.gamification.pointsToday += pts;
          ns.gamification.pointsThisWeek += pts;
          ns.gamification.xp += Math.round(pts * 2.5);
          ns.gamification.level = levelFromXp(ns.gamification.xp);
        }
      } else {
        // unchecking: remove points if today
        if (dayKey === todayKey) {
          ns.gamification.pointsToday = Math.max(0, ns.gamification.pointsToday - pts);
          ns.gamification.pointsThisWeek = Math.max(0, ns.gamification.pointsThisWeek - pts);
          ns.gamification.xp = Math.max(0, ns.gamification.xp - Math.round(pts * 2.5));
          ns.gamification.level = levelFromXp(ns.gamification.xp);
        }
      }
      return ns;
    });
    vibrate(10);
  }

  function addHabit(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setState((s) => {
      const ns = deepClone(s);
      ns.habits.items.unshift({
        id: uid(),
        name: trimmed,
        icon: "✅",
        targetPerWeek: 5,
        points: 10,
        color: "gray",
      });
      return ns;
    });
  }

  function deleteHabit(habitId) {
    setState((s) => {
      const ns = deepClone(s);
      ns.habits.items = ns.habits.items.filter((h) => h.id !== habitId);
      delete ns.habits.streaks[habitId];
      // keep old checks but they won’t show; optional cleanup:
      Object.keys(ns.habits.checksByDay).forEach((dk) => {
        if (ns.habits.checksByDay[dk]) delete ns.habits.checksByDay[dk][habitId];
      });
      return ns;
    });
  }

  // -----------------------------
  // Plan actions
  // -----------------------------
  function toggleTop3(id) {
    setState((s) => {
      const ns = deepClone(s);
      const item = ns.plan.top3.find((t) => t.id === id);
      if (!item) return s;
      const was = item.done;
      item.done = !item.done;
      // reward only when turning on
      if (!was && item.done) {
        ns.gamification.pointsToday += 12;
        ns.gamification.pointsThisWeek += 12;
        ns.gamification.xp += Math.round(12 * 2.5);
        ns.gamification.level = levelFromXp(ns.gamification.xp);
      }
      return ns;
    });
    vibrate(10);
  }

  function addTop3(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setState((s) => {
      const ns = deepClone(s);
      ns.plan.top3.push({ id: uid(), text: trimmed, done: false, priority: ns.plan.top3.length + 1 });
      return ns;
    });
  }

  function deleteTop3(id) {
    setState((s) => {
      const ns = deepClone(s);
      ns.plan.top3 = ns.plan.top3.filter((t) => t.id !== id);
      return ns;
    });
  }

  function toggleBlock(id) {
    setState((s) => {
      const ns = deepClone(s);
      const b = ns.plan.timeBlocks.find((x) => x.id === id);
      if (!b) return s;
      const was = b.done;
      b.done = !b.done;
      if (!was && b.done) {
        const pts = clamp(Math.round(b.durationMin / 6), 8, 25);
        ns.gamification.pointsToday += pts;
        ns.gamification.pointsThisWeek += pts;
        ns.gamification.xp += Math.round(pts * 2.5);
        ns.gamification.level = levelFromXp(ns.gamification.xp);
      }
      return ns;
    });
    vibrate(10);
  }

  function addBlock(label, startMin, durationMin, task) {
    setState((s) => {
      const ns = deepClone(s);
      ns.plan.timeBlocks.push({ id: uid(), label, startMin, durationMin, task, done: false });
      ns.plan.timeBlocks.sort((a, b) => a.startMin - b.startMin);
      return ns;
    });
  }

  function deleteBlock(id) {
    setState((s) => {
      const ns = deepClone(s);
      ns.plan.timeBlocks = ns.plan.timeBlocks.filter((b) => b.id !== id);
      return ns;
    });
  }

  function setNextAction(itemId) {
    setState((s) => {
      const ns = deepClone(s);
      ns.plan.nextAction.mode = true;
      ns.plan.nextAction.itemId = itemId;
      return ns;
    });
    vibrate(12);
  }

  function exitNextAction() {
    setState((s) => {
      const ns = deepClone(s);
      ns.plan.nextAction.mode = false;
      ns.plan.nextAction.itemId = null;
      return ns;
    });
  }

  // -----------------------------
  // Goals actions
  // -----------------------------
  function addGoal(title) {
    const trimmed = title.trim();
    if (!trimmed) return;
    setState((s) => {
      const ns = deepClone(s);
      ns.goals.items.unshift({
        id: uid(),
        title: trimmed,
        why: "",
        metricLabel: "Progress",
        metricGoal: 10,
        metricCurrent: 0,
        milestones: [],
      });
      return ns;
    });
  }

  function updateGoal(goalId, patch) {
    setState((s) => {
      const ns = deepClone(s);
      const g = ns.goals.items.find((x) => x.id === goalId);
      if (!g) return s;
      Object.assign(g, patch);
      return ns;
    });
  }

  function deleteGoal(goalId) {
    setState((s) => {
      const ns = deepClone(s);
      ns.goals.items = ns.goals.items.filter((g) => g.id !== goalId);
      return ns;
    });
  }

  function addMilestone(goalId, text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setState((s) => {
      const ns = deepClone(s);
      const g = ns.goals.items.find((x) => x.id === goalId);
      if (!g) return s;
      g.milestones.push({ id: uid(), text: trimmed, done: false });
      return ns;
    });
  }

  function toggleMilestone(goalId, milestoneId) {
    setState((s) => {
      const ns = deepClone(s);
      const g = ns.goals.items.find((x) => x.id === goalId);
      if (!g) return s;
      const m = g.milestones.find((x) => x.id === milestoneId);
      if (!m) return s;
      const was = m.done;
      m.done = !m.done;
      if (!was && m.done) {
        ns.gamification.pointsToday += 8;
        ns.gamification.pointsThisWeek += 8;
        ns.gamification.xp += Math.round(8 * 2.5);
        ns.gamification.level = levelFromXp(ns.gamification.xp);
      }
      return ns;
    });
    vibrate(10);
  }

  // -----------------------------
  // Motivation actions
  // -----------------------------
  const filteredQuotes = useMemo(() => {
    const f = state.motivation.filters;
    return QUOTES.filter((q) => f[q.tag]);
  }, [state.motivation.filters]);

  function randomQuote() {
    const list = filteredQuotes.length ? filteredQuotes : QUOTES;
    if (!list.length) return null;

    // avoid repeating last
    const lastId = state.motivation.lastShownId;
    let tries = 0;
    let q = list[Math.floor(Math.random() * list.length)];
    while (q.id === lastId && tries < 8 && list.length > 1) {
      q = list[Math.floor(Math.random() * list.length)];
      tries++;
    }
    return q;
  }

  const [quote, setQuote] = useState(() => randomQuote());

  useEffect(() => {
    // update quote if filters changed
    setQuote(randomQuote());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.motivation.filters]);

  function nextQuote() {
    const q = randomQuote();
    if (!q) return;
    setQuote(q);
    setState((s) => ({ ...s, motivation: { ...s.motivation, lastShownId: q.id } }));
    vibrate(8);
  }

  function toggleFavoriteQuote(quoteId) {
    setState((s) => {
      const ns = deepClone(s);
      const favs = new Set(ns.motivation.favorites);
      if (favs.has(quoteId)) favs.delete(quoteId);
      else favs.add(quoteId);
      ns.motivation.favorites = Array.from(favs);
      return ns;
    });
    vibrate(8);
  }

  // -----------------------------
  // Journal actions
  // -----------------------------
  const journalEntry = state.journal.entriesByDay[todayKey] || { wins: "", lessons: "", gratitude: "", planTomorrow: "", mood: 3 };

  function updateJournal(dayKey, patch) {
    setState((s) => {
      const ns = deepClone(s);
      ns.journal.entriesByDay[dayKey] = { ...(ns.journal.entriesByDay[dayKey] || { wins: "", lessons: "", gratitude: "", planTomorrow: "", mood: 3 }), ...patch };
      return ns;
    });
  }

  // -----------------------------
  // Sync actions (optional)
  // -----------------------------
  async function signInAnon() {
    if (!supabase) {
      alert("Supabase env vars not set. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }
    setState((s) => ({ ...s, sync: { ...s.sync, status: "syncing", lastError: null } }));
    try {
      // Anonymous sign-in is supported if enabled in Supabase Auth settings.
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;

      setState((s) => ({
        ...s,
        sync: { ...s.sync, enabled: true, status: "ready", lastSyncAt: new Date().toISOString(), lastError: null },
      }));

      // push after sign-in
      await pushStateToSupabase();
    } catch (e) {
      setState((s) => ({ ...s, sync: { ...s.sync, status: "error", lastError: String(e?.message || e) } }));
      alert("Supabase sign-in failed: " + (e?.message || e));
    }
  }

  async function pushStateToSupabase() {
    if (!supabase) return;
    setState((s) => ({ ...s, sync: { ...s.sync, status: "syncing", lastError: null } }));
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userData?.user;
      if (!user) throw new Error("Not signed in.");

      // Upsert single blob per user
      const payload = state;
      const { error } = await supabase
        .from("blobs")
        .upsert({ user_id: user.id, payload, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;

      setState((s) => ({ ...s, sync: { ...s.sync, status: "ready", lastSyncAt: new Date().toISOString(), lastError: null } }));
    } catch (e) {
      setState((s) => ({ ...s, sync: { ...s.sync, status: "error", lastError: String(e?.message || e) } }));
      alert("Sync failed: " + (e?.message || e));
    }
  }

  async function pullStateFromSupabase() {
    if (!supabase) return;
    setState((s) => ({ ...s, sync: { ...s.sync, status: "syncing", lastError: null } }));
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userData?.user;
      if (!user) throw new Error("Not signed in.");

      const { data, error } = await supabase.from("blobs").select("payload").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      if (!data?.payload) throw new Error("No backup found yet.");

      // Basic safety: keep newer local if local opened more recently
      const incoming = data.payload;
      const localOpen = new Date(state.meta.lastOpenAt).getTime();
      const remoteOpen = new Date(incoming.meta?.lastOpenAt || 0).getTime();
      const useRemote = remoteOpen >= localOpen;

      setState(() => (useRemote ? incoming : state));
      setState((s) => ({ ...s, sync: { ...s.sync, status: "ready", lastSyncAt: new Date().toISOString(), lastError: null } }));
    } catch (e) {
      setState((s) => ({ ...s, sync: { ...s.sync, status: "error", lastError: String(e?.message || e) } }));
      alert("Pull failed: " + (e?.message || e));
    }
  }

  // -----------------------------
  // UI: styles
  // -----------------------------
  const bg = isDark ? "radial-gradient(1200px 800px at 20% 0%, rgba(120,90,255,0.20), transparent 60%), radial-gradient(900px 600px at 100% 40%, rgba(50,220,160,0.16), transparent 65%), #07070a"
                    : "radial-gradient(1200px 800px at 20% 0%, rgba(120,90,255,0.12), transparent 60%), radial-gradient(900px 600px at 100% 40%, rgba(50,220,160,0.10), transparent 65%), #f7f7fb";
  const fg = isDark ? "rgba(255,255,255,0.92)" : "rgba(10,10,16,0.92)";
  const sub = isDark ? "rgba(255,255,255,0.70)" : "rgba(10,10,16,0.60)";
  const hairline = isDark ? "rgba(255,255,255,0.10)" : "rgba(10,10,16,0.10)";

  // Mobile-only guard: keep a narrow phone frame even on desktop
  const outerStyle = {
    minHeight: "100dvh",
    background: bg,
    color: fg,
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
  };
  const phoneStyle = {
    width: "100%",
    maxWidth: 460,
    margin: "0 auto",
    minHeight: "100dvh",
    paddingBottom: 84,
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 14,
    boxSizing: "border-box",
  };

  // -----------------------------
  // Header (top)
  // -----------------------------
  const Header = () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.3 }}>LevelUp</div>
        <div style={{ fontSize: 12, color: sub }}>
          {todayKey} • Level {level} • {xpInfo.intoLevel}/{xpInfo.need} XP
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <IconPill>
          <span style={{ opacity: 0.85 }}>🔥</span>
          <span style={{ fontWeight: 900 }}>{habitCompletionToday.pct}%</span>
          <span style={{ color: sub }}>today</span>
        </IconPill>
        <IconPill>
          <span style={{ opacity: 0.85 }}>⭐</span>
          <span style={{ fontWeight: 900 }}>{state.gamification.pointsToday}</span>
          <span style={{ color: sub }}>pts</span>
        </IconPill>
      </div>
    </div>
  );

  // -----------------------------
  // Bottom Nav
  // -----------------------------
  const NavItem = ({ id, label, icon }) => {
    const active = tab === id;
    return (
      <button
        onClick={() => setTab(id)}
        style={{
          flex: 1,
          border: "none",
          background: "transparent",
          padding: "10px 6px",
          color: active ? fg : sub,
          cursor: "pointer",
          fontWeight: 900,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 18, lineHeight: "18px", marginBottom: 4, opacity: active ? 1 : 0.8 }}>{icon}</div>
        {label}
      </button>
    );
  };

  const BottomNav = () => (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: "env(safe-area-inset-bottom)",
        backdropFilter: "blur(10px)",
        background: isDark ? "rgba(10,10,14,0.72)" : "rgba(250,250,255,0.78)",
        borderTop: `1px solid ${hairline}`,
      }}
    >
      <div style={{ display: "flex", maxWidth: 460, margin: "0 auto" }}>
        <NavItem id="home" label="Home" icon="🏠" />
        <NavItem id="plan" label="Plan" icon="🗓️" />
        <NavItem id="habits" label="Habits" icon="✅" />
        <NavItem id="goals" label="Goals" icon="🎯" />
        <NavItem id="motivation" label="Motivate" icon="⚡" />
        <NavItem id="journal" label="Journal" icon="📝" />
        <NavItem id="settings" label="Settings" icon="⚙️" />
      </div>
    </div>
  );

  // -----------------------------
  // Views
  // -----------------------------

  function HomeView() {
    const top3Done = state.plan.top3.filter((t) => t.done).length;
    const blocksDone = state.plan.timeBlocks.filter((b) => b.done).length;

    const weekHabitTotal = state.habits.items.length * 7 || 1;
    const weekHabitDone = weekKeys.reduce((acc, dk) => {
      const day = state.habits.checksByDay[dk] || {};
      return acc + state.habits.items.reduce((a, h) => a + (day[h.id] ? 1 : 0), 0);
    }, 0);

    const weekPct = Math.round((weekHabitDone / weekHabitTotal) * 100);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card
          title="Today’s Focus"
          right={
            <SmallButton
              onClick={() => setTab("plan")}
              style={{ fontWeight: 900 }}
            >
              Open plan →
            </SmallButton>
          }
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <IconPill>
              <span>✅</span>
              <span style={{ fontWeight: 900 }}>{top3Done}/{state.plan.top3.length}</span>
              <span style={{ color: sub }}>Top 3</span>
            </IconPill>
            <IconPill>
              <span>⏱️</span>
              <span style={{ fontWeight: 900 }}>{blocksDone}/{state.plan.timeBlocks.length}</span>
              <span style={{ color: sub }}>Blocks</span>
            </IconPill>
            <IconPill>
              <span>📈</span>
              <span style={{ fontWeight: 900 }}>{weekPct}%</span>
              <span style={{ color: sub }}>Week</span>
            </IconPill>
          </div>

          <div style={{ fontSize: 13, color: sub, marginBottom: 8 }}>
            Rule: one good decision beats ten perfect plans.
          </div>

          <Button variant="good" onClick={() => {
            // quick “next action”: pick first undone top3 or first undone block
            const t = state.plan.top3.find((x) => !x.done);
            if (t) return setNextAction(t.id);
            const b = state.plan.timeBlocks.find((x) => !x.done);
            if (b) return setNextAction(b.id);
            alert("You’re done. Lock it in with a quick journal entry.");
          }}>
            Start “Do this next”
          </Button>
        </Card>

        <Card title="Quick Motivation" right={<SmallButton onClick={nextQuote}>New ⚡</SmallButton>}>
          <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.25, marginBottom: 10 }}>
            “{quote?.text || "Pick a filter and pull a quote."}”
          </div>
          <div style={{ color: sub, fontSize: 13, marginBottom: 10 }}>
            — {quote?.author || "Unknown"} • <span style={{ opacity: 0.8 }}>{quote?.tag || ""}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <SmallButton onClick={() => toggleFavoriteQuote(quote?.id)} style={{ flex: 1 }}>
              {quote && state.motivation.favorites.includes(quote.id) ? "★ Favorited" : "☆ Favorite"}
            </SmallButton>
            <SmallButton onClick={() => setTab("motivation")} style={{ flex: 1 }}>
              Motivation Center →
            </SmallButton>
          </div>
        </Card>

        <Card title="Nightly Reset">
          <div style={{ fontSize: 13, color: sub, marginBottom: 10 }}>
            Keep it short. The goal is consistency, not novels.
          </div>
          <Button onClick={() => setTab("journal")}>Open journal</Button>
        </Card>
      </div>
    );
  }

  function PlanView() {
    const [newTop, setNewTop] = useState("");
    const [dump, setDump] = useState("");

    const [blockLabel, setBlockLabel] = useState("Deep Work");
    const [blockTask, setBlockTask] = useState("School / App / Business");
    const [blockStart, setBlockStart] = useState("16:00");
    const [blockDur, setBlockDur] = useState(60);

    const focusMode = state.plan.nextAction.mode;
    const focusId = state.plan.nextAction.itemId;

    const focusItemTop = state.plan.top3.find((t) => t.id === focusId);
    const focusItemBlock = state.plan.timeBlocks.find((b) => b.id === focusId);

    function parseTimeStr(t) {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {focusMode && (
          <Card
            title="Do this next"
            right={<SmallButton onClick={exitNextAction}>Exit</SmallButton>}
            style={{ border: "1px solid rgba(80,255,160,0.25)", background: "rgba(80,255,160,0.08)" }}
          >
            <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 10, lineHeight: 1.2 }}>
              {focusItemTop ? focusItemTop.text : focusItemBlock ? `${focusItemBlock.label}: ${focusItemBlock.task}` : "Pick a task."}
            </div>
            <div style={{ color: sub, fontSize: 13, marginBottom: 12 }}>
              Rule: single-task until a clear stopping point. Phone down.
            </div>
            {focusItemTop && (
              <Button variant="good" onClick={() => toggleTop3(focusItemTop.id)}>
                {focusItemTop.done ? "Marked done ✅" : "Mark done ✅"}
              </Button>
            )}
            {focusItemBlock && (
              <Button variant="good" onClick={() => toggleBlock(focusItemBlock.id)}>
                {focusItemBlock.done ? "Marked done ✅" : "Mark done ✅"}
              </Button>
            )}
          </Card>
        )}

        <Card title="Top 3 (Today)">
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {state.plan.top3
              .slice()
              .sort((a, b) => a.priority - b.priority)
              .map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "10px 10px",
                    borderRadius: 14,
                    border: `1px solid ${hairline}`,
                    background: t.done ? "rgba(80,255,160,0.10)" : "rgba(0,0,0,0.10)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                    <button
                      onClick={() => toggleTop3(t.id)}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 12,
                        border: `1px solid ${hairline}`,
                        background: t.done ? "rgba(80,255,160,0.18)" : "transparent",
                        color: "inherit",
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                    >
                      {t.done ? "✓" : t.priority}
                    </button>
                    <div style={{ fontSize: 14, fontWeight: 900, opacity: t.done ? 0.65 : 1 }}>
                      {t.text}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <SmallButton onClick={() => setNextAction(t.id)}>Next</SmallButton>
                    <SmallButton onClick={() => deleteTop3(t.id)}>✕</SmallButton>
                  </div>
                </div>
              ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <TextInput value={newTop} onChange={setNewTop} placeholder="Add a new priority…" />
            <SmallButton
              onClick={() => {
                addTop3(newTop);
                setNewTop("");
              }}
              style={{ padding: "12px 12px" }}
            >
              Add
            </SmallButton>
          </div>
          <div style={{ fontSize: 12, color: sub, marginTop: 8 }}>
            Completing a Top 3 gives points because it’s the highest leverage thing you can do.
          </div>
        </Card>

        <Card title="Time Blocks">
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {state.plan.timeBlocks.map((b) => (
              <div
                key={b.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "10px 10px",
                  borderRadius: 14,
                  border: `1px solid ${hairline}`,
                  background: b.done ? "rgba(80,255,160,0.10)" : "rgba(0,0,0,0.10)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
                  <div style={{ fontSize: 12, color: sub }}>
                    {pad2(Math.floor(b.startMin / 60))}:{pad2(b.startMin % 60)} • {minutesToHuman(b.durationMin)} • {b.label}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 900, opacity: b.done ? 0.65 : 1 }}>{b.task}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <SmallButton onClick={() => setNextAction(b.id)}>Next</SmallButton>
                  <SmallButton onClick={() => toggleBlock(b.id)}>{b.done ? "✓" : "Done"}</SmallButton>
                  <SmallButton onClick={() => deleteBlock(b.id)}>✕</SmallButton>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <TextInput value={blockLabel} onChange={setBlockLabel} placeholder="Label" />
            <TextInput value={blockStart} onChange={setBlockStart} placeholder="Start (HH:MM)" />
          </div>
          <TextInput value={blockTask} onChange={setBlockTask} placeholder="Task" style={{ marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <input
                type="range"
                min={15}
                max={180}
                step={15}
                value={blockDur}
                onChange={(e) => setBlockDur(Number(e.target.value))}
                style={{ width: "100%" }}
              />
              <div style={{ fontSize: 12, color: sub, marginTop: 4 }}>Duration: {minutesToHuman(blockDur)}</div>
            </div>
            <SmallButton
              onClick={() => {
                const startMin = clamp(parseTimeStr(blockStart), 0, 24 * 60 - 1);
                addBlock(blockLabel, startMin, blockDur, blockTask);
              }}
              style={{ padding: "12px 12px" }}
            >
              Add
            </SmallButton>
          </div>
        </Card>

        <Card title="Brain Dump (get it out of your head)">
          <TextArea value={dump} onChange={setDump} placeholder="Dump everything here. Then you pick ONE next action." rows={4} />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <SmallButton
              onClick={() => {
                const text = dump.trim();
                if (!text) return;
                setState((s) => {
                  const ns = deepClone(s);
                  ns.plan.brainDump.unshift({ id: uid(), text, createdAt: new Date().toISOString() });
                  return ns;
                });
                setDump("");
              }}
              style={{ flex: 1 }}
            >
              Save
            </SmallButton>
            <SmallButton
              onClick={() => {
                setState((s) => ({ ...s, plan: { ...s.plan, brainDump: [] } }));
              }}
              style={{ flex: 1 }}
            >
              Clear
            </SmallButton>
          </div>

          {state.plan.brainDump.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {state.plan.brainDump.slice(0, 6).map((x) => (
                <div key={x.id} style={{ padding: 10, borderRadius: 14, border: `1px solid ${hairline}`, background: "rgba(0,0,0,0.10)" }}>
                  <div style={{ fontSize: 13, color: sub, marginBottom: 4 }}>{new Date(x.createdAt).toLocaleString()}</div>
                  <div style={{ fontSize: 14, fontWeight: 850 }}>{x.text}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  function HabitsView() {
    const [newHabit, setNewHabit] = useState("");
    const [dayIndex, setDayIndex] = useState(weekKeys.indexOf(todayKey));
    const activeDayKey = weekKeys[clamp(dayIndex, 0, 6)];

    const checks = state.habits.checksByDay[activeDayKey] || {};

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card
          title="This Week"
          right={
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <SmallButton onClick={() => setDayIndex((x) => clamp(x - 1, 0, 6))}>←</SmallButton>
              <div style={{ fontSize: 12, color: sub, fontWeight: 900 }}>
                {activeDayKey === todayKey ? "Today" : activeDayKey}
              </div>
              <SmallButton onClick={() => setDayIndex((x) => clamp(x + 1, 0, 6))}>→</SmallButton>
            </div>
          }
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
            {weekKeys.map((dk) => {
              const day = state.habits.checksByDay[dk] || {};
              const done = state.habits.items.reduce((acc, h) => acc + (day[h.id] ? 1 : 0), 0);
              return (
                <button
                  key={dk}
                  onClick={() => setDayIndex(weekKeys.indexOf(dk))}
                  style={{
                    border: `1px solid ${hairline}`,
                    background: dk === activeDayKey ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
                    color: "inherit",
                    borderRadius: 12,
                    padding: "10px 6px",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{dk.slice(5)}</div>
                  <div style={{ fontSize: 12, color: sub }}>{done}/{state.habits.items.length}</div>
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 12, color: sub, marginTop: 10 }}>
            Tip: You can view past days, but points only count for today (so you can’t “farm”).
          </div>
        </Card>

        <Card title="Habits">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {state.habits.items.map((h) => {
              const done = !!checks[h.id];
              const st = state.habits.streaks[h.id] || { current: 0, best: 0, lastDoneKey: null };
              return (
                <div
                  key={h.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: 10,
                    borderRadius: 14,
                    border: `1px solid ${hairline}`,
                    background: done ? "rgba(80,255,160,0.10)" : "rgba(0,0,0,0.08)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                    <div style={{ fontSize: 22 }}>{h.icon}</div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <div style={{ fontSize: 14, fontWeight: 950 }}>{h.name}</div>
                      <div style={{ fontSize: 12, color: sub }}>
                        +{h.points} pts • Streak {st.current} (best {st.best})
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <SmallButton onClick={() => toggleHabitCheck(activeDayKey, h.id)}>{done ? "✓" : "Do"}</SmallButton>
                    <SmallButton onClick={() => deleteHabit(h.id)}>✕</SmallButton>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <TextInput value={newHabit} onChange={setNewHabit} placeholder="Add a habit…" />
            <SmallButton
              onClick={() => {
                addHabit(newHabit);
                setNewHabit("");
              }}
              style={{ padding: "12px 12px" }}
            >
              Add
            </SmallButton>
          </div>
        </Card>

        <Card title="Weekly Target (simple)">
          <div style={{ fontSize: 13, color: sub, marginBottom: 8 }}>
            You don’t need perfection. Aim for a strong average.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {state.habits.items.map((h) => {
              const doneCount = weekKeys.reduce((acc, dk) => {
                const day = state.habits.checksByDay[dk] || {};
                return acc + (day[h.id] ? 1 : 0);
              }, 0);
              const pct = Math.round((doneCount / 7) * 100);
              const hit = doneCount >= (h.targetPerWeek || 0);
              return (
                <IconPill key={h.id}>
                  <span>{h.icon}</span>
                  <span style={{ fontWeight: 900 }}>{doneCount}/7</span>
                  <span style={{ color: hit ? "rgba(80,255,160,0.95)" : sub }}>{pct}%</span>
                </IconPill>
              );
            })}
          </div>
        </Card>
      </div>
    );
  }

  function GoalsView() {
    const [newGoal, setNewGoal] = useState("");

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card title="Goals">
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <TextInput value={newGoal} onChange={setNewGoal} placeholder="Add a goal…" />
            <SmallButton
              onClick={() => {
                addGoal(newGoal);
                setNewGoal("");
              }}
              style={{ padding: "12px 12px" }}
            >
              Add
            </SmallButton>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {state.goals.items.map((g) => {
              const pct = g.metricGoal ? Math.round((g.metricCurrent / g.metricGoal) * 100) : 0;
              const doneMilestones = g.milestones.filter((m) => m.done).length;
              const [msText, setMsText] = useState("");

              return (
                <div key={g.id} style={{ padding: 12, borderRadius: 16, border: `1px solid ${hairline}`, background: "rgba(0,0,0,0.08)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 950, marginBottom: 4 }}>{g.title}</div>
                      <div style={{ fontSize: 12, color: sub, marginBottom: 10 }}>{g.why || "Add a why. Your why is the fuel."}</div>
                    </div>
                    <SmallButton onClick={() => deleteGoal(g.id)}>✕</SmallButton>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                    <TextInput value={g.metricLabel} onChange={(v) => updateGoal(g.id, { metricLabel: v })} placeholder="Metric label" />
                    <TextInput
                      value={String(g.metricGoal)}
                      onChange={(v) => updateGoal(g.id, { metricGoal: clamp(Number(v || 0), 0, 99999) })}
                      placeholder="Goal #"
                    />
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                    <SmallButton onClick={() => updateGoal(g.id, { metricCurrent: clamp(g.metricCurrent - 1, 0, 99999) })} style={{ width: 56 }}>
                      -1
                    </SmallButton>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: sub, marginBottom: 4 }}>
                        {g.metricLabel}: <span style={{ fontWeight: 950, color: fg }}>{g.metricCurrent}</span> / {g.metricGoal} • {pct}%
                      </div>
                      <div style={{ height: 10, borderRadius: 999, border: `1px solid ${hairline}`, overflow: "hidden" }}>
                        <div style={{ width: `${clamp(pct, 0, 100)}%`, height: "100%", background: "rgba(255,255,255,0.25)" }} />
                      </div>
                    </div>
                    <SmallButton
                      onClick={() => {
                        updateGoal(g.id, { metricCurrent: clamp(g.metricCurrent + 1, 0, 99999) });
                        award(6, "Goal progress");
                      }}
                      style={{ width: 56 }}
                    >
                      +1
                    </SmallButton>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <TextArea value={g.why} onChange={(v) => updateGoal(g.id, { why: v })} placeholder="Why does this matter?" rows={2} />
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 950, marginBottom: 8 }}>
                    Milestones <span style={{ color: sub, fontWeight: 800 }}>({doneMilestones}/{g.milestones.length})</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                    {g.milestones.map((m) => (
                      <div key={m.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button
                          onClick={() => toggleMilestone(g.id, m.id)}
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 12,
                            border: `1px solid ${hairline}`,
                            background: m.done ? "rgba(80,255,160,0.18)" : "transparent",
                            color: "inherit",
                            cursor: "pointer",
                            fontWeight: 900,
                          }}
                        >
                          {m.done ? "✓" : "•"}
                        </button>
                        <div style={{ flex: 1, fontSize: 14, fontWeight: 900, opacity: m.done ? 0.6 : 1 }}>{m.text}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <TextInput value={msText} onChange={setMsText} placeholder="Add a milestone…" />
                    <SmallButton
                      onClick={() => {
                        addMilestone(g.id, msText);
                        setMsText("");
                      }}
                      style={{ padding: "12px 12px" }}
                    >
                      Add
                    </SmallButton>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    );
  }

  function MotivationView() {
    const f = state.motivation.filters;
    const favSet = new Set(state.motivation.favorites);

    const shownFavorites = QUOTES.filter((q) => favSet.has(q.id));

    function toggleFilter(tag) {
      setState((s) => ({
        ...s,
        motivation: {
          ...s.motivation,
          filters: { ...s.motivation.filters, [tag]: !s.motivation.filters[tag] },
        },
      }));
      vibrate(6);
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card title="Quote Engine" right={<SmallButton onClick={nextQuote}>New ⚡</SmallButton>}>
          <div style={{ fontSize: 18, fontWeight: 950, lineHeight: 1.2, marginBottom: 10 }}>
            “{quote?.text}”
          </div>
          <div style={{ fontSize: 13, color: sub, marginBottom: 10 }}>
            — {quote?.author} • {quote?.tag}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <SmallButton onClick={() => toggleFavoriteQuote(quote?.id)} style={{ flex: 1 }}>
              {quote && favSet.has(quote.id) ? "★ Favorited" : "☆ Favorite"}
            </SmallButton>
            <SmallButton
              onClick={() => {
                navigator.clipboard?.writeText(`"${quote?.text}" — ${quote?.author}`);
                vibrate(8);
              }}
              style={{ flex: 1 }}
            >
              Copy
            </SmallButton>
          </div>
        </Card>

        <Card title="Filters">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {Object.keys(f).map((tag) => (
              <button
                key={tag}
                onClick={() => toggleFilter(tag)}
                style={{
                  borderRadius: 14,
                  padding: "12px 12px",
                  border: `1px solid ${hairline}`,
                  background: f[tag] ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
                  color: "inherit",
                  cursor: "pointer",
                  fontWeight: 950,
                }}
              >
                {f[tag] ? "✓ " : ""}{tag}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: sub, marginTop: 10 }}>
            Keep this simple: pick 1–2 sources when you need a specific “mode.”
          </div>
        </Card>

        <Card title="Favorites">
          {shownFavorites.length === 0 ? (
            <div style={{ fontSize: 13, color: sub }}>No favorites yet. Favorite the ones that hit.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {shownFavorites.map((q) => (
                <div key={q.id} style={{ padding: 12, borderRadius: 14, border: `1px solid ${hairline}`, background: "rgba(0,0,0,0.08)" }}>
                  <div style={{ fontSize: 14, fontWeight: 950, marginBottom: 6 }}>“{q.text}”</div>
                  <div style={{ fontSize: 12, color: sub, display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span>— {q.author} • {q.tag}</span>
                    <button
                      onClick={() => toggleFavoriteQuote(q.id)}
                      style={{ border: "none", background: "transparent", color: sub, cursor: "pointer", fontWeight: 900 }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  function JournalView() {
    const [wins, setWins] = useState(journalEntry.wins);
    const [lessons, setLessons] = useState(journalEntry.lessons);
    const [gratitude, setGratitude] = useState(journalEntry.gratitude);
    const [planTomorrow, setPlanTomorrow] = useState(journalEntry.planTomorrow);
    const [mood, setMood] = useState(journalEntry.mood ?? 3);

    useEffect(() => {
      // refresh local inputs if day changes
      const e = state.journal.entriesByDay[todayKey] || { wins: "", lessons: "", gratitude: "", planTomorrow: "", mood: 3 };
      setWins(e.wins);
      setLessons(e.lessons);
      setGratitude(e.gratitude);
      setPlanTomorrow(e.planTomorrow);
      setMood(e.mood ?? 3);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [todayKey]);

    const prompt = useMemo(() => {
      const ps = state.journal.prompts || [];
      if (!ps.length) return "";
      return ps[(new Date().getDate()) % ps.length];
    }, [state.journal.prompts, todayKey]);

    function saveNow() {
      updateJournal(todayKey, { wins, lessons, gratitude, planTomorrow, mood });
      vibrate(10);
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card title="Tonight’s Check-In" right={<SmallButton onClick={saveNow}>Save</SmallButton>}>
          <div style={{ fontSize: 13, color: sub, marginBottom: 10 }}>
            Prompt: <span style={{ color: fg, fontWeight: 900 }}>{prompt}</span>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: sub, fontWeight: 900 }}>Mood</div>
            <input
              type="range"
              min={1}
              max={5}
              value={mood}
              onChange={(e) => setMood(Number(e.target.value))}
              style={{ width: "100%" }}
            />
            <div style={{ fontSize: 12, fontWeight: 950 }}>{mood}/5</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <TextArea value={wins} onChange={setWins} placeholder="Wins (small counts)" rows={3} />
            <TextArea value={lessons} onChange={setLessons} placeholder="Lessons / mistakes (no shame, just data)" rows={3} />
            <TextArea value={gratitude} onChange={setGratitude} placeholder="Gratitude (1–3 things)" rows={2} />
            <TextArea value={planTomorrow} onChange={setPlanTomorrow} placeholder="Tomorrow: what’s the first move?" rows={2} />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <SmallButton
              onClick={() => {
                saveNow();
                // small reward for journaling, once per day
                setState((s) => {
                  const ns = deepClone(s);
                  // naive guard: if entry existed before and had content, don't double award too hard
                  const prev = ns.journal.entriesByDay[todayKey] || {};
                  const prevLen = (prev.wins || "").length + (prev.lessons || "").length + (prev.gratitude || "").length + (prev.planTomorrow || "").length;
                  const nowLen = wins.length + lessons.length + gratitude.length + planTomorrow.length;
                  if (nowLen >= 20 && prevLen < 20) {
                    ns.gamification.pointsToday += 10;
                    ns.gamification.pointsThisWeek += 10;
                    ns.gamification.xp += Math.round(10 * 2.5);
                    ns.gamification.level = levelFromXp(ns.gamification.xp);
                  }
                  return ns;
                });
              }}
              style={{ flex: 1 }}
            >
              Save + Reward
            </SmallButton>
            <SmallButton
              onClick={() => {
                setWins("");
                setLessons("");
                setGratitude("");
                setPlanTomorrow("");
                setMood(3);
                updateJournal(todayKey, { wins: "", lessons: "", gratitude: "", planTomorrow: "", mood: 3 });
              }}
              style={{ flex: 1 }}
            >
              Clear
            </SmallButton>
          </div>
        </Card>

        <Card title="Past Entries (last 7 days)">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {weekKeys
              .slice()
              .reverse()
              .map((dk) => {
                const e = state.journal.entriesByDay[dk];
                if (!e) return null;
                const snippet = (e.wins || e.lessons || e.gratitude || "").slice(0, 120);
                return (
                  <div key={dk} style={{ padding: 12, borderRadius: 14, border: `1px solid ${hairline}`, background: "rgba(0,0,0,0.08)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <div style={{ fontSize: 13, fontWeight: 950 }}>{dk}</div>
                      <div style={{ fontSize: 12, color: sub }}>Mood {e.mood ?? 3}/5</div>
                    </div>
                    <div style={{ fontSize: 13, color: sub, marginTop: 6 }}>
                      {snippet || "(empty)"}
                      {snippet.length >= 120 ? "…" : ""}
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>
      </div>
    );
  }

  function SettingsView() {
    const [name, setName] = useState(state.user.displayName || "Samuel");

    function resetAll() {
      if (!confirm("Reset everything? This clears local data.")) return;
      const fresh = makeDefaultState();
      setState(fresh);
      saveState(fresh);
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card title="Profile">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <TextInput value={name} onChange={setName} placeholder="Display name" />
            <SmallButton
              onClick={() => setState((s) => ({ ...s, user: { ...s.user, displayName: name.trim() || "Samuel" } }))}
              style={{ width: "100%" }}
            >
              Save name
            </SmallButton>
          </div>
        </Card>

        <Card title="Theme">
          <div style={{ display: "flex", gap: 8 }}>
            <SmallButton
              onClick={() => setState((s) => ({ ...s, user: { ...s.user, theme: "dark" } }))}
              style={{ flex: 1, background: state.user.theme === "dark" ? "rgba(255,255,255,0.12)" : "transparent" }}
            >
              Dark
            </SmallButton>
            <SmallButton
              onClick={() => setState((s) => ({ ...s, user: { ...s.user, theme: "light" } }))}
              style={{ flex: 1, background: state.user.theme === "light" ? "rgba(255,255,255,0.12)" : "transparent" }}
            >
              Light
            </SmallButton>
          </div>
        </Card>

        <Card title="Backup & Sync (optional)">
          {!supabase && (
            <div style={{ fontSize: 13, color: sub, marginBottom: 10 }}>
              Supabase not configured. Add env vars to enable sync:
              <div style={{ marginTop: 6, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, color: fg }}>
                VITE_SUPABASE_URL<br />
                VITE_SUPABASE_ANON_KEY
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Button onClick={signInAnon} disabled={!supabase}>
              Enable sync (anonymous sign-in)
            </Button>
            <Button onClick={pushStateToSupabase} disabled={!supabase || !state.sync.enabled} variant="primary">
              Push backup to Supabase
            </Button>
            <Button onClick={pullStateFromSupabase} disabled={!supabase || !state.sync.enabled} variant="primary">
              Pull backup from Supabase
            </Button>
          </div>

          <div style={{ fontSize: 12, color: sub, marginTop: 10 }}>
            Status: <span style={{ color: fg, fontWeight: 900 }}>{state.sync.status}</span>
            {state.sync.lastSyncAt ? ` • Last sync ${new Date(state.sync.lastSyncAt).toLocaleString()}` : ""}
            {state.sync.lastError ? <div style={{ marginTop: 6, color: "rgba(255,120,120,0.95)" }}>Error: {state.sync.lastError}</div> : null}
          </div>
        </Card>

        <Card title="Data">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Button
              onClick={() => {
                const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "levelup_backup.json";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export JSON
            </Button>
            <Button
              variant="danger"
              onClick={resetAll}
            >
              Reset everything
            </Button>
          </div>
          <div style={{ fontSize: 12, color: sub, marginTop: 10 }}>
            Export is your safety net. Reset is for “fresh start” moments.
          </div>
        </Card>
      </div>
    );
  }

  // -----------------------------
  // Router
  // -----------------------------
  function renderTab() {
    if (tab === "home") return <HomeView />;
    if (tab === "plan") return <PlanView />;
    if (tab === "habits") return <HabitsView />;
    if (tab === "goals") return <GoalsView />;
    if (tab === "motivation") return <MotivationView />;
    if (tab === "journal") return <JournalView />;
    if (tab === "settings") return <SettingsView />;
    return <HomeView />;
  }

  // -----------------------------
  // “Mobile-only” overlay if very wide
  // -----------------------------
  const [tooWide, setTooWide] = useState(false);
  useEffect(() => {
    const onResize = () => setTooWide(window.innerWidth > 760);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div style={outerStyle}>
      <div style={phoneStyle}>
        <Header />
        {renderTab()}
      </div>

      <BottomNav />

      {tooWide && (
        <div
          style={{
            position: "fixed",
            top: 12,
            left: 12,
            right: 12,
            maxWidth: 460,
            margin: "0 auto",
            borderRadius: 16,
            padding: 12,
            border: `1px solid ${hairline}`,
            background: isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.65)",
            backdropFilter: "blur(10px)",
            color: fg,
            fontSize: 12,
          }}
        >
          This app is designed for mobile. On desktop, it’s locked to a phone layout.
        </div>
      )}
    </div>
  );
}
