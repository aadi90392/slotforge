"use client";
import { useState, useEffect, useCallback, useRef, FormEvent } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Search,
  LayoutDashboard,
  DoorOpen,
  CalendarDays,
  Users,
  Settings,
  Activity,
  LogOut,
  ChevronRight,
  Clock3,
  MapPin,
  Check,
  CheckCircle2,
  X,
  Menu,
  Loader2,
  Copy,
  RefreshCw,
  Sun,
  Wifi,
  Monitor,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import { Brand, Orb, Modal, AuthModal, User, api } from "./ui";
import {
  HOURS,
  today,
  dateAfter,
  timeLabel,
  dayLabel,
  slotTime,
  nextBookingDay,
} from "@/lib/domain";
type Room = {
  id: string;
  name: string;
  kind: string;
  capacity: number;
  image: string;
  location: string;
  amenities: string;
};
type Booking = {
  id: string;
  resource_id: string;
  resource_name: string;
  user_id: string;
  user_name: string;
  image: string;
  title: string;
  day: string;
  hour: number;
  status: string;
  hold_until: number | null;
};
type Person = { id: string; name: string; email: string; role: string };
type Audit = {
  id: number;
  action: string;
  actor_name: string;
  resource_name: string;
  detail: string;
  created_at: number;
};
type Data = {
  rooms: Room[];
  bookings: Booking[];
  people: Person[];
  activity: Audit[];
  role: string;
};
type Ws = { id: string; name: string; role: string };
function emptyData(): Data { return { rooms: [], bookings: [], people: [], activity: [], role: "member" }; }
const navItems = [
  { id: "Overview", icon: LayoutDashboard },
  { id: "Spaces", icon: DoorOpen },
  { id: "My bookings", icon: CalendarDays },
  { id: "Team", icon: Users },
  { id: "Activity", icon: Activity },
  { id: "Settings", icon: Settings },
];
export default function Workspace() {
  const [user, setUser] = useState<User | null>(null),
    [initial, setInitial] = useState(true),
    [auth, setAuth] = useState(false),
    [workspaces, setWorkspaces] = useState<Ws[]>([]),
    [ws, setWs] = useState(""),
    [data, setData] = useState<Data>(emptyData),
    [tab, setTab] = useState("Overview"),
    [query, setQuery] = useState(""),
    [kind, setKind] = useState("All spaces"),
    [date, setDate] = useState(nextBookingDay),
    [mobile, setMobile] = useState(false),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const [room, setRoom] = useState<Room | null>(null),
    [reschedule, setReschedule] = useState<Booking | null>(null),
    [cancel, setCancel] = useState<Booking | null>(null),
    [add, setAdd] = useState(false),
    [editRoom, setEditRoom] = useState<Room | null>(null),
    [workspaceModal, setWorkspaceModal] = useState(false),
    [settings, setSettings] = useState<{
      name: string;
      invite_code: string;
      timezone: string;
    } | null>(null),
    [settingsBusy, setSettingsBusy] = useState(false),
    [bookingFilter, setBookingFilter] = useState("Upcoming");
  const demo = !user;
  const activeWorkspace = useRef(ws);
  activeWorkspace.current = ws;
  const activeUser = useRef(user?.id);
  activeUser.current = user?.id;
  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 4500);
  };
  const loadWorkspaces = useCallback(async () => {
    const r = await api<{ workspaces: Ws[] }>("workspaces");
    setWorkspaces(r.workspaces);
    setWs((old) =>
      r.workspaces.some((w: Ws) => w.id === old)
        ? old
        : r.workspaces[0]?.id || "",
    );
  }, []);
  const refresh = useCallback(async () => {
    if (!user || !ws) return;
    try {
      const r = await api<Data>("dashboard?workspace=" + ws);
      if (activeWorkspace.current === ws && activeUser.current === user.id) {
        setData(r);
        setError("");
      }
    } catch (e) {
      if (activeWorkspace.current === ws && activeUser.current === user.id)
        setError((e as Error).message);
    }
  }, [user, ws]);
  useEffect(() => {
    api<{ user: User | null }>("auth/me")
      .then(async (r) => {
        setUser(r.user);
        if (r.user) await loadWorkspaces();
      })
      .catch((e) => setError(e.message))
      .finally(() => setInitial(false));
  }, [loadWorkspaces]);
  useEffect(() => {
    if (user && ws) {
      setLoading(true);
      refresh().finally(() => setLoading(false));
      const id = setInterval(refresh, 30000);
      return () => clearInterval(id);
    }
  }, [user, ws, refresh]);
  useEffect(() => {
    if (tab === "Settings" && user && ws && data.role === "owner")
      api<{ name: string; invite_code: string; timezone: string }>(
        "settings?workspace=" + ws,
      )
        .then(setSettings)
        .catch((e) => setError(e.message));
  }, [tab, user, ws, data.role]);
  async function signedIn(u: User) {
    setUser(u);
    setAuth(false);
    setData({
      rooms: [],
      bookings: [],
      people: [],
      activity: [],
      role: "member",
    });
    await loadWorkspaces();
    notify("Your workspace is ready. Make yourself at home.");
  }
  function selectTab(t: string) {
    setTab(t);
    setMobile(false);
    setQuery("");
  }
  const active = data.bookings.filter(
    (b) =>
      b.status === "confirmed" ||
      (b.status === "held" && (b.hold_until || 0) > Date.now()),
  );
  const dayBookings = active.filter((b) => b.day === date);
  const myBookings = data.bookings.filter(
    (b) =>
      (demo || b.user_id === user?.id) &&
      (bookingFilter === "All" ||
        (bookingFilter === "Cancelled" && b.status === "cancelled") ||
        (bookingFilter === "Upcoming" &&
          ["held", "confirmed"].includes(b.status) &&
          slotTime(b.day, b.hour) > Date.now())) &&
      `${b.title} ${b.resource_name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const filteredRooms = data.rooms.filter(
    (r) =>
      (kind === "All spaces" || r.kind === kind) &&
      `${r.name} ${r.location}`.toLowerCase().includes(query.toLowerCase()),
  );
  const currentWs = workspaces.find((w) => w.id === ws);
  function book(r: Room) {
    if (demo) {
      setAuth(true);
      return;
    }
    setRoom(r);
    setReschedule(null);
  }
  const selectDate = (
    <label className="date-control">
      <CalendarDays size={16} />
      <input
        aria-label="Selected booking date"
        type="date"
        min={today()}
        max={dateAfter(59)}
        value={date}
        onChange={(e) => setDate(e.target.value || today())}
      />
      <span>IST</span>
    </label>
  );
  if (initial) return <main className="account-gate"><Brand /><p role="status">Loading your account...</p></main>;
  if (!user) return <main className="account-gate"><Brand /><h1>Your space. Your team.</h1><p>Sign in to manage your spaces, invite your team, and book together.</p>{error && <p className="error">{error}</p>}<button className="button dark" onClick={() => setAuth(true)}>Sign in or create an account <ArrowRight size={16} /></button><a href="/">Back to home</a>{auth && <AuthModal initialMode="login" onClose={() => setAuth(false)} onSuccess={signedIn} />}</main>;
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (mobile ? "visible" : "")}>
        <Brand />
        <button
          className="workspace-picker"
          onClick={() => (demo ? setAuth(true) : setWorkspaceModal(true))}
        >
          <span className="workspace-icon">
            {demo ? "S" : currentWs?.name[0] || "S"}
          </span>
          <span>
            <b>{demo ? "The Studio" : currentWs?.name || "Your workspace"}</b>
            <small>
              {demo
                ? "Demo workspace"
                : data.role === "owner"
                  ? "Owner workspace"
                  : "Team workspace"}
            </small>
          </span>
          <ChevronRight size={15} />
        </button>
        <div className="sidebar-caption">WORKSPACE</div>
        <nav>
          {navItems.map(({ id, icon: Icon }) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => selectTab(id)}
            >
              <Icon size={18} />
              {id}
              {id === "My bookings" && (
                <span className="nav-count">
                  {active.filter((b) => demo || b.user_id === user?.id).length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-callout">
            <span>SPACE FOR WHAT'S NEXT</span>
            <p>
              A little room.
              <br />A big possibility.
            </p>
            <a href="/">
              Meet SlotForge <ArrowUpRight size={14} />
            </a>
            <Orb small />
          </div>
          <button
            className="user-panel"
            onClick={() =>
              demo
                ? setAuth(true)
                : api("auth/logout", {})
                    .then(() => {
                      setUser(null);
                      setData(emptyData());
                      setWs("");
                      setWorkspaces([]);
                      setTab("Overview");
                      notify("Signed out.");
                    })
                    .catch((e) => setError(e.message))
            }
          >
            <span className="user-avatar">
              {demo
                ? "↗"
                : user.name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
            </span>
            <span>
              <b>{demo ? "Make it your own" : user.name}</b>
              <small>
                {demo
                  ? "Create your free workspace"
                  : "Sign out of your account"}
              </small>
            </span>
            {!demo && <LogOut size={15} />}
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="sidebar-overlay"
          aria-label="Close menu"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="app-main">
        <header className="app-topbar">
          <div>
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </button>
            <span className="breadcrumb">
              Workspace <ChevronRight size={13} /> <b>{tab}</b>
            </span>
          </div>
          <div>
            {demo ? (
              <span className="demo-tag">Demo preview</span>
            ) : (
              <span className="status-label">
                <span className="live-dot" />{" "}
                {error
                  ? "Refresh needed"
                  : loading
                    ? "Syncing workspace…"
                    : "Synced · refreshes every 30s"}
              </span>
            )}
            <span className="top-avatar">{demo ? "S" : user.name[0]}</span>
          </div>
        </header>
        <main className="dashboard-content">
          {demo && (
            <div className="demo-banner">
              <span>
                <Sun size={16} /> Have a look around. This is a sample
                workspace.
              </span>
              <button onClick={() => setAuth(true)}>
                Create your own <ArrowRight size={15} />
              </button>
            </div>
          )}
          <div className="dashboard-heading">
            <div>
              <div className="eyebrow">
                {tab === "Overview"
                  ? "A LITTLE SPACE. A FRESH START."
                  : "YOUR WORKSPACE, WELL ORGANIZED."}
              </div>
              <h1>
                {tab === "Overview"
                  ? `Hello, ${demo ? "there" : user?.name.split(" ")[0]}.`
                  : tab === "Spaces"
                    ? "Find your focus."
                    : tab === "My bookings"
                      ? "Room in your calendar."
                      : tab === "Team"
                        ? "Better, together."
                        : tab === "Activity"
                          ? "Every little update."
                          : "Make it your own."}
                <span className="heading-dot">✳</span>
              </h1>
              <p>
                {tab === "Overview"
                  ? "A good day starts with a space that feels right."
                  : tab === "Spaces"
                    ? "Somewhere for every kind of good work."
                    : tab === "My bookings"
                      ? "Your plans, all in one place."
                      : tab === "Team"
                        ? "The people who make this space yours."
                        : tab === "Activity"
                          ? "A clear history of your workspace bookings."
                          : "The details that keep your workspace running."}
              </p>
            </div>
            {["Overview", "Spaces"].includes(tab) ? (
              <div className="heading-actions">
                {selectDate}
                {tab === "Spaces" && data.role === "owner" && (
                  <button
                    className="button dark"
                    onClick={() => (demo ? setAuth(true) : setAdd(true))}
                  >
                    <Plus size={16} /> Add space
                  </button>
                )}
              </div>
            ) : (
              <button
                className="button dark"
                onClick={() => {
                  setTab("Spaces");
                }}
              >
                Find a space <ArrowUpRight size={15} />
              </button>
            )}
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button className="text-button" onClick={refresh}>
                Retry
              </button>
            </div>
          )}
          {(initial || loading) && (
            <div className="loading-line">
              <Loader2 className="spin" size={15} /> Bringing your workspace
              together…
            </div>
          )}
          {tab === "Overview" && (
            <>
              <div className="overview-banner">
                <div>
                  <span className="eyebrow">MAKE ROOM FOR WHAT MATTERS</span>
                  <h2>
                    Your next big idea
                    <br />
                    needs a little space.
                  </h2>
                  <button
                    className="button white"
                    onClick={() => setTab("Spaces")}
                  >
                    Explore spaces <ArrowUpRight size={16} />
                  </button>
                </div>
                <img
                  src="/images/sunroom.jpg"
                  alt="A sunlit room ready for your next meeting"
                />
                <span className="banner-sticker">
                  <Sun size={16} /> A brighter kind of workday.
                </span>
              </div>
              <div className="stat-grid">
                {[
                  {
                    icon: DoorOpen,
                    label: "Spaces to make yours",
                    value: data.rooms.length,
                    sub: "Find your perfect setting",
                  },
                  {
                    icon: CalendarDays,
                    label: "Bookings on this day",
                    value: dayBookings.filter((b) => b.status === "confirmed")
                      .length,
                    sub: dayLabel(date) + " · Asia/Kolkata",
                  },
                  {
                    icon: Users,
                    label: "People in your workspace",
                    value: data.people.length,
                    sub: "Good things happen together",
                  },
                ].map(({ icon: Icon, label, value, sub }) => (
                  <div className="stat-card" key={label}>
                    <div>
                      <span>{label}</span>
                      <Icon size={18} />
                    </div>
                    <strong>{String(value).padStart(2, "0")}</strong>
                    <small>{sub}</small>
                  </div>
                ))}
              </div>
              <div className="subheading">
                <div>
                  <h2>A place to begin.</h2>
                  <p>Pick a space. Bring your ideas.</p>
                </div>
                <button className="text-link" onClick={() => setTab("Spaces")}>
                  All spaces <ArrowUpRight size={15} />
                </button>
              </div>
              <div className="room-grid">
                {data.rooms.slice(0, 3).map((r) => (
                  <RoomCard key={r.id} room={r} onBook={() => book(r)} />
                ))}
              </div>
              <div className="subheading">
                <h2>On the calendar.</h2>
                <button
                  className="text-link"
                  onClick={() => setTab("My bookings")}
                >
                  Your bookings <ArrowUpRight size={15} />
                </button>
              </div>
              <div className="booking-list">
                {dayBookings.length ? (
                  dayBookings.map((b) => <BookingRow key={b.id} booking={b} />)
                ) : (
                  <Empty
                    title="A little breathing room."
                    text="No reservations on this day. Find a space and put a good idea on the calendar."
                    action={() => setTab("Spaces")}
                  />
                )}
              </div>
            </>
          )}
          {tab === "Spaces" && (
            <>
              <div className="filter-bar">
                <div className="filter-tabs">
                  {[
                    "All spaces",
                    "Meeting room",
                    "Focus room",
                    "Collaboration",
                  ].map((k) => (
                    <button
                      className={kind === k ? "selected" : ""}
                      onClick={() => setKind(k)}
                      key={k}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <label className="search">
                  <Search size={16} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Find a space…"
                    aria-label="Search spaces"
                  />
                </label>
              </div>
              <div className="room-grid large">
                {filteredRooms.map((r) => (
                  <RoomCard
                    key={r.id}
                    room={r}
                    onBook={() => book(r)}
                    onEdit={data.role === "owner" ? () => setEditRoom(r) : undefined}
                    available={
                      HOURS.filter(
                        (h) =>
                          slotTime(date, h) > Date.now() &&
                          !active.some(
                            (b) =>
                              b.resource_id === r.id &&
                              b.day === date &&
                              b.hour === h,
                          ),
                      ).length
                    }
                  />
                ))}
              </div>
              {!filteredRooms.length && (
                <Empty
                  title="No spaces found."
                  text={data.rooms.length ? "Try another room name or choose a different category." : "Your workspace is ready. The owner can add the first space using Add space above."}
                />
              )}
              <p className="muted small-text">
                All bookings are one-hour slots · Workspace timezone:
                Asia/Kolkata (IST)
              </p>
            </>
          )}
          {tab === "My bookings" && (
            <>
              <div className="filter-bar">
                <div className="filter-tabs">
                  {["Upcoming", "All", "Cancelled"].map((v) => (
                    <button
                      key={v}
                      className={bookingFilter === v ? "selected" : ""}
                      onClick={() => setBookingFilter(v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <label className="search">
                  <Search size={16} />
                  <input
                    aria-label="Search bookings"
                    placeholder="Search your bookings…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </div>
              <div className="booking-list">
                {myBookings.length ? (
                  myBookings.map((b) => (
                    <BookingRow key={b.id} booking={b}>
                      {["confirmed", "held"].includes(b.status) &&
                        slotTime(b.day, b.hour) > Date.now() && (
                          <>
                            {b.status === "held" ? (
                              <button
                                className="button soft compact"
                                onClick={() =>
                                  demo
                                    ? setAuth(true)
                                    : api(`bookings/${b.id}?workspace=${ws}`, {
                                        action: "confirm",
                                      })
                                        .then(() => {
                                          notify("Booking confirmed.");
                                          refresh();
                                        })
                                        .catch((e) => setError(e.message))
                                }
                              >
                                Confirm hold
                              </button>
                            ) : (
                              <button
                                className="button soft compact"
                                onClick={() => {
                                  if (demo) {
                                    setAuth(true);
                                    return;
                                  }
                                  setReschedule(b);
                                  setRoom(
                                    data.rooms.find(
                                      (r) => r.id === b.resource_id,
                                    ) || null,
                                  );
                                }}
                              >
                                Reschedule
                              </button>
                            )}
                            <button
                              className="icon-button"
                              aria-label={"Cancel " + b.title}
                              onClick={() =>
                                demo ? setAuth(true) : setCancel(b)
                              }
                            >
                              <X size={17} />
                            </button>
                          </>
                        )}
                    </BookingRow>
                  ))
                ) : (
                  <Empty
                    title="Nothing on your calendar. Yet."
                    text="Your next productive hour is just a booking away."
                    action={() => setTab("Spaces")}
                  />
                )}
              </div>
            </>
          )}
          {tab === "Team" && (
            <>
              <div className="subheading">
                <h2>
                  {data.people.length}{" "}
                  {data.people.length === 1 ? "person" : "people"}, one shared
                  space.
                </h2>
                {data.role === "owner" && (
                  <button
                    className="button dark"
                    onClick={() => (demo ? setAuth(true) : setTab("Settings"))}
                  >
                    <Plus size={16} /> Invite a teammate
                  </button>
                )}
              </div>
              <div className="people-list">
                {data.people.map((p) => (
                  <div className="person-row" key={p.id}>
                    <span className="user-avatar">
                      {p.name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <div>
                      <b>{p.name}</b>
                      <p>{p.email}</p>
                    </div>
                    <span className="pill">{p.role}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === "Activity" && (
            <div className="activity-list">
              {data.activity.length ? (
                data.activity.map((a) => (
                  <div className="activity-row" key={a.id}>
                    <span className="activity-icon">
                      <Activity size={16} />
                    </span>
                    <div>
                      <b>{a.actor_name || "System"}</b>{" "}
                      {a.action === "created"
                        ? "reserved a space"
                        : a.action === "rescheduled"
                          ? "rescheduled a booking"
                          : `updated a booking to ${a.action}`}
                      <p>
                        {a.resource_name} · {a.detail}
                      </p>
                      <small>
                        {new Date(a.created_at).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                        })}{" "}
                        IST
                      </small>
                    </div>
                  </div>
                ))
              ) : (
                <Empty
                  title="A fresh start."
                  text="Booking changes will appear here as your workspace comes to life."
                />
              )}
            </div>
          )}
          {tab === "Settings" && <PasswordSettings />}
          {tab === "Settings" &&
            (demo ? (
              <Empty
                title="Your space, your settings."
                text="Create an account to name your workspace and invite your team."
                action={() => setAuth(true)}
                actionLabel="Create workspace"
              />
            ) : data.role !== "owner" ? (
              <Empty
                title="Managed by your workspace owner."
                text="Only the owner can rename this workspace or create invitation codes."
              />
            ) : settings ? (
              <div className="settings-grid">
                <section className="settings-card">
                  <h2>The essentials</h2>
                  <p className="muted">A familiar name. A shared place.</p>
                  <form
                    className="form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setSettingsBusy(true);
                      try {
                        await api("settings?workspace=" + ws, {
                          name: settings.name,
                        });
                        await loadWorkspaces();
                        notify("Workspace updated.");
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setSettingsBusy(false);
                      }
                    }}
                  >
                    <label>
                      Workspace name
                      <input
                        value={settings.name}
                        onChange={(e) =>
                          setSettings({ ...settings, name: e.target.value })
                        }
                        minLength={2}
                        maxLength={60}
                        required
                      />
                    </label>
                    <label>
                      Timezone
                      <input value="Asia/Kolkata · IST (UTC+05:30)" readOnly />
                    </label>
                    <p className="fine-print">
                      This release supports fixed one-hour slots, 8 AM–7 PM IST.
                    </p>
                    <button disabled={settingsBusy} className="button dark">
                      Save changes <Check size={16} />
                    </button>
                  </form>
                </section>
                <section className="settings-card">
                  <h2>Better with your people.</h2>
                  <p className="muted">
                    Share this private invitation code with a teammate. They can
                    join from the workspace menu.
                  </p>
                  <div className="invite-code">{settings.invite_code}</div>
                  <div className="button-row">
                    <button
                      className="button soft"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(settings.invite_code)
                          .then(() => notify("Invitation code copied."))
                          .catch(() =>
                            notify("Select and copy the code above."),
                          )
                      }
                    >
                      <Copy size={16} /> Copy code
                    </button>
                    <button
                      className="button soft"
                      onClick={async () => {
                        try {
                          await api("settings?workspace=" + ws, {
                            rotate: true,
                          });
                          setSettings(
                            await api<{
                              name: string;
                              invite_code: string;
                              timezone: string;
                            }>("settings?workspace=" + ws),
                          );
                          notify(
                            "New code generated. The old code no longer works.",
                          );
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      <RefreshCw size={16} /> Rotate
                    </button>
                  </div>
                  <p className="fine-print">
                    Anyone with this code can join as a member. Keep it within
                    your team.
                  </p>
                </section>
              </div>
            ) : (
              <p>Loading settings…</p>
            ))}
          <div className="dashboard-footer">
            <span>slotforge — a little room for good work.</span>
            <span>Thoughtfully shared. Simply booked.</span>
          </div>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {auth && (
        <AuthModal onClose={() => setAuth(false)} onSuccess={signedIn} />
      )}
      {room && (
        <BookingModal
          room={room}
          bookings={active}
          workspace={ws}
          initialDate={date}
          reschedule={reschedule}
          onClose={() => {
            setRoom(null);
            setReschedule(null);
            refresh();
          }}
          onDone={() => {
            setRoom(null);
            setReschedule(null);
            setTab("My bookings");
            refresh();
            notify(
              reschedule
                ? "Your booking has a new time."
                : "It’s yours. Booking confirmed.",
            );
          }}
        />
      )}
      {cancel && (
        <Modal title="Free up this space?" onClose={() => setCancel(null)}>
          <p className="muted">
            Cancel “{cancel.title}” in {cancel.resource_name} on{" "}
            {dayLabel(cancel.day)} at {timeLabel(cancel.hour)}?
          </p>
          <div className="button-row">
            <button className="button soft" onClick={() => setCancel(null)}>
              Keep booking
            </button>
            <button
              className="button dark"
              onClick={async () => {
                try {
                  await api(`bookings/${cancel.id}?workspace=${ws}`, {
                    action: "cancel",
                  });
                  setCancel(null);
                  refresh();
                  notify("Booking cancelled. Space opened up.");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Cancel booking
            </button>
          </div>
        </Modal>
      )}
      {(add || editRoom) && (
        <AddRoom
          room={editRoom || undefined}
          workspace={ws}
          onClose={() => {setAdd(false);setEditRoom(null);}}
          onDone={() => {
            setAdd(false);
            refresh();
            setEditRoom(null);
            notify("Space saved.");
          }}
        />
      )}
      {workspaceModal && (
        <WorkspaceModal
          workspaces={workspaces}
          active={ws}
          onClose={() => setWorkspaceModal(false)}
          onSelect={(id) => {
            setWs(id);
            setWorkspaceModal(false);
            setTab("Overview");
            setData({
              rooms: [],
              bookings: [],
              people: [],
              activity: [],
              role: "member",
            });
          }}
          onCreated={async (id) => {
            await loadWorkspaces();
            setWs(id);
            setWorkspaceModal(false);
            setTab("Overview");
          }}
        />
      )}
    </div>
  );
}
function RoomCard({
  room: r,
  onBook,
  available,
  onEdit,
}: {
  onEdit?: () => void;
  room: Room;
  onBook: () => void;
  available?: number;
}) {
  return (
    <article className="room-card">
      <button
        className="room-photo"
        onClick={onBook}
        aria-label={"Book " + r.name}
      >
        <img src={r.image} alt={r.name} />
        <span className="photo-badge">{r.kind}</span>
        <span className="room-arrow">
          <ArrowUpRight size={19} />
        </span>
      </button>
      <div className="room-body">
        {onEdit && <button className="text-link" onClick={onEdit}>Edit space</button>}
        <div className="room-title">
          <h3>{r.name}</h3>
          <span>
            <Users size={14} /> {r.capacity}
          </span>
        </div>
        <p>
          <MapPin size={13} />
          {r.location}
        </p>
        <div className="amenities">
          {r.amenities
            .split(",")
            .slice(0, 2)
            .map((a, i) => (
              <span key={a}>
                {i === 0 ? <Sun size={12} /> : <Wifi size={12} />} {a}
              </span>
            ))}
        </div>
        <div className="room-bottom">
          <span>
            {available === undefined
              ? "A place for your next idea"
              : available
                ? `${available} slots available`
                : "No slots left on this day"}
          </span>
          <button onClick={onBook}>
            Book space <ArrowUpRight size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}
function Empty({
  title,
  text,
  action,
  actionLabel = "Explore spaces",
}: {
  title: string;
  text: string;
  action?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="empty">
      <CalendarDays size={30} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="button soft" onClick={action}>
          {actionLabel}
          <ArrowUpRight size={15} />
        </button>
      )}
    </div>
  );
}
function BookingRow({
  booking: b,
  children,
}: {
  booking: Booking;
  children?: React.ReactNode;
}) {
  return (
    <article className="booking-row">
      <div className="booking-date">
        <span>
          {new Date(b.day + "T12:00:00+05:30").toLocaleDateString("en-US", {
            month: "short",
          })}
        </span>
        <strong>{Number(b.day.split("-")[2])}</strong>
      </div>
      <img src={b.image} alt="" />
      <div className="booking-info">
        <h3>{b.title}</h3>
        <p>
          {b.resource_name} <span>·</span> {timeLabel(b.hour)} –{" "}
          {timeLabel(b.hour + 1)} IST
        </p>
        <small>{b.user_name}</small>
      </div>
      <span className={"pill " + b.status}>
        {b.status === "held" ? "On hold" : b.status}
      </span>
      <div className="booking-actions">{children}</div>
    </article>
  );
}
function BookingModal({
  room,
  bookings,
  workspace,
  initialDate,
  reschedule,
  onClose,
  onDone,
}: {
  room: Room;
  bookings: Booking[];
  workspace: string;
  initialDate: string;
  reschedule: Booking | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [day, setDay] = useState(reschedule?.day || initialDate),
    [hour, setHour] = useState<number | null>(null),
    [title, setTitle] = useState(reschedule?.title || ""),
    [hold, setHold] = useState<Booking | null>(null),
    [key] = useState(() => crypto.randomUUID()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [remaining, setRemaining] = useState(300);
  useEffect(() => {
    if (!hold) return;
    const tick = () =>
      setRemaining(
        Math.max(0, Math.ceil(((hold.hold_until || 0) - Date.now()) / 1000)),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [hold]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (reschedule) {
        await api(`bookings/${reschedule.id}?workspace=${workspace}`, {
          action: "reschedule",
          day,
          hour,
        });
        onDone();
      } else if (hold) {
        await api(`bookings/${hold.id}?workspace=${workspace}`, {
          action: "confirm",
        });
        onDone();
      } else {
        const r = await api<{ booking: Booking }>(
          "bookings?workspace=" + workspace,
          {
            resourceId: room.id,
            day,
            hour,
            title,
            key,
          },
        );
        setHold(r.booking);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        hold
          ? "A little space, just for you."
          : reschedule
            ? "Make room for a new time."
            : "Make this space yours."
      }
      onClose={onClose}
    >
      <div className="booking-room-preview">
        <img src={room.image} alt={room.name} />
        <div>
          <h3>{room.name}</h3>
          <p>{room.location}</p>
          <span>
            <Users size={14} /> Up to {room.capacity} people
          </span>
        </div>
      </div>
      <form className="form" onSubmit={submit}>
        {hold ? (
          <div className="hold-details">
            <span className="check-bubble">
              <Check size={24} />
            </span>
            <h3>{title}</h3>
            <p>
              {dayLabel(day)} · {timeLabel(hour!)} – {timeLabel(hour! + 1)} IST
            </p>
            <div className="hold-timer">
              <Clock3 size={16} />
              {remaining
                ? `Held for ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`
                : "Your hold has expired"}
            </div>
            <p className="muted">Confirm to add this space to your calendar.</p>
          </div>
        ) : (
          <>
            <label>
              What are you making room for?
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. A fresh perspective"
                minLength={2}
                maxLength={100}
                required
                readOnly={!!reschedule}
              />
            </label>
            <label>
              Pick a day
              <input
                type="date"
                value={day}
                min={today()}
                max={dateAfter(59)}
                onChange={(e) => {
                  setDay(e.target.value);
                  setHour(null);
                }}
                required
              />
            </label>
            <label>
              Find your moment <span className="muted">· One hour · IST</span>
            </label>
            <div className="slot-grid">
              {HOURS.map((h) => {
                const occupied = bookings.some(
                  (b) =>
                    b.resource_id === room.id &&
                    b.day === day &&
                    b.hour === h &&
                    b.id !== reschedule?.id,
                );
                return (
                  <button
                    type="button"
                    className={hour === h ? "selected" : ""}
                    key={h}
                    disabled={occupied || slotTime(day, h) <= Date.now()}
                    onClick={() => setHour(h)}
                  >
                    {timeLabel(h)}
                    {occupied && <small>Reserved</small>}
                  </button>
                );
              })}
            </div>
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button
          disabled={
            busy || (!hold && hour === null) || (!!hold && remaining === 0)
          }
          className="button dark full"
        >
          {busy ? (
            <Loader2 size={17} className="spin" />
          ) : hold ? (
            "Confirm booking"
          ) : reschedule ? (
            "Save new time"
          ) : (
            "Hold this space"
          )}
          <ArrowRight size={16} />
        </button>
        {hold && remaining === 0 && (
          <button type="button" className="text-button" onClick={onClose}>
            Close and choose another slot
          </button>
        )}
        <p className="fine-print">
          <ShieldCheck size={13} />{" "}
          {reschedule
            ? "Your original booking stays safe if the new slot is unavailable."
            : "Your space is held for five minutes before confirmation."}
        </p>
      </form>
    </Modal>
  );
}
function AddRoom({
  room,
  workspace,
  onClose,
  onDone,
}: {
  room?: Room;
  workspace: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal title={room ? "Edit your space." : "Room for something new."} onClose={onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api(
              "resources?workspace=" + workspace,
              {...Object.fromEntries(new FormData(e.currentTarget)), ...(room ? {id:room.id} : {})},
            );
            onDone();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Space name
          <input
            name="name"
            required
            minLength={2}
            maxLength={60}
            defaultValue={room?.name}
            placeholder="The Idea Room"
          />
        </label>
        <label>
          Kind of space
          <select name="kind" defaultValue={room?.kind}>
            <option>Meeting room</option>
            <option>Focus room</option>
            <option>Collaboration</option>
          </select>
        </label>
        <label>
          Capacity
          <input
            name="capacity"
            type="number"
            min={1}
            max={100}
            defaultValue={room?.capacity || 4}
            required
          />
        </label>
        <label>
          Location
          <input
            defaultValue={room?.location}
            name="location"
            required
            maxLength={100}
            placeholder="Second floor · West wing"
          />
        </label>
        <label>Amenities<input defaultValue={room?.amenities} name="amenities" maxLength={300} placeholder="Whiteboard, Wi-Fi, Display screen" /></label>
        <p className="fine-print">Only add spaces your team can actually use. A neutral cover is provided.</p>
        {error && <p className="error">{error}</p>}
        <button disabled={busy} className="button dark">
          {room ? "Save changes" : "Add space"} <Plus size={16} />
        </button>
      </form>
    </Modal>
  );
}
function WorkspaceModal({
  workspaces,
  active,
  onClose,
  onSelect,
  onCreated,
}: {
  workspaces: Ws[];
  active: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCreated: (id: string) => void;
}) {
  const [mode, setMode] = useState("switch"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="Your places to create." onClose={onClose}>
      <div className="filter-tabs">
        <button
          className={mode === "switch" ? "selected" : ""}
          onClick={() => setMode("switch")}
        >
          Switch
        </button>
        <button
          className={mode === "create" ? "selected" : ""}
          onClick={() => setMode("create")}
        >
          Create
        </button>
        <button
          className={mode === "join" ? "selected" : ""}
          onClick={() => setMode("join")}
        >
          Join a team
        </button>
      </div>
      {mode === "switch" ? (
        <div className="workspace-options">
          {workspaces.map((w) => (
            <button key={w.id} onClick={() => onSelect(w.id)}>
              <span>
                <b>{w.name}</b>
                <small>{w.role}</small>
              </span>
              {w.id === active ? <Check size={18} /> : <ArrowRight size={18} />}
            </button>
          ))}
        </div>
      ) : (
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const r = await api<{ id: string }>(
                "workspaces",
                Object.fromEntries(new FormData(e.currentTarget)),
              );
              onCreated(r.id);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {mode === "create" ? "Workspace name" : "Invitation code"}
            <input
              key={mode}
              name={mode === "create" ? "name" : "invite"}
              required
              minLength={2}
              maxLength={mode === "create" ? 60 : 100}
              placeholder={
                mode === "create"
                  ? "Your team’s little corner"
                  : "Paste the code from your teammate"
              }
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button disabled={busy} className="button dark">
            {mode === "create" ? "Create workspace" : "Join workspace"}
            <ArrowRight size={16} />
          </button>
        </form>
      )}
    </Modal>
  );
}

function PasswordSettings() {
  const [busy,setBusy]=useState(false), [message,setMessage]=useState("");
  return <section className="settings-card"><h2>Account security</h2><p className="muted">Changing your password signs out your other sessions.</p><form className="form" onSubmit={async e => {
    e.preventDefault(); const form=e.currentTarget; const fields=new FormData(form); setMessage("");
    if(fields.get("newPassword") !== fields.get("confirmPassword")){setMessage("New passwords do not match.");return;}
    setBusy(true);try {await api("auth/password",Object.fromEntries(fields));form.reset();setMessage("Password changed. Other sessions have been signed out.");}catch(err){setMessage((err as Error).message);}finally{setBusy(false);}
  }}><label>Current password<input type="password" name="currentPassword" autoComplete="current-password" maxLength={128} required /></label><label>New password<input type="password" name="newPassword" autoComplete="new-password" minLength={12} maxLength={128} required /></label><label>Confirm new password<input type="password" name="confirmPassword" autoComplete="new-password" minLength={12} maxLength={128} required /></label>{message && <p role="status">{message}</p>}<button className="button dark" disabled={busy}>Change password</button></form></section>;
}
