import {
  db,
  uid,
  digest,
  randomToken,
  passwordHash,
  verifyPassword,
  json,
  assert,
  body,
  currentUser,
  requireUser,
  cookie,
  newSession,
  member,
  rateLimit,
  ApiError,
} from "@/lib/server";
import { createWorkspace } from "@/lib/seed";
import { validSlot, today, slotTime } from "@/lib/domain";
export const dynamic = "force-dynamic";
type Booking = {
  id: string;
  workspace_id: string;
  user_id: string;
  resource_id: string;
  day: string;
  hour: number;
  status: string;
  hold_until: number | null;
  title: string;
};
async function handler(req: Request) {
  try {
    const url = new URL(req.url),
      path = url.pathname.replace(/^\/api\//, "");
    if (req.method !== "GET") {
      const origin = req.headers.get("origin");
      assert(origin === url.origin, "Invalid request origin", 403);
      assert(
        req.headers.get("content-type")?.includes("application/json"),
        "JSON required",
        415,
      );
    }
    if (path === "auth/me") return json({ user: await currentUser(req) });
    if (path === "auth/register" && req.method === "POST") {
      const b = await body(req);
      const email = String(b.email || "")
          .trim()
          .toLowerCase(),
        name = String(b.name || "").trim(),
        password = String(b.password || "");
      assert(
        name.length >= 2 && name.length <= 60,
        "Enter your name (2–60 characters)",
      );
      assert(
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length < 180,
        "Enter a valid email",
      );
      assert(
        password.length >= 12 && password.length <= 128,
        "Use a password with 12–128 characters",
      );
      await rateLimit(req, "register");
      const existing = await db()
        .prepare("SELECT id FROM users WHERE email=?")
        .bind(email)
        .first();
      assert(!existing, "An account with this email already exists", 409);
      const u = { id: uid(), name, email };
      const insertUser = db()
        .prepare(
          "INSERT INTO users(id,name,email,password,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(u.id, name, email, await passwordHash(password), Date.now());
      await createWorkspace(u.id, `${name.split(" ")[0]}'s workspace`, [
        insertUser,
      ]);
      return newSession(req, u);
    }
    if (path === "auth/login" && req.method === "POST") {
      const b = await body(req),
        email = String(b.email || "")
          .trim()
          .toLowerCase(),
        password = String(b.password || "");
      assert(
        email.length <= 180 && password.length <= 128,
        "Invalid credentials",
      );
      await rateLimit(req, "login");
      const u = await db()
        .prepare("SELECT * FROM users WHERE email=?")
        .bind(email)
        .first<{ id: string; name: string; email: string; password: string }>();
      const ok = await verifyPassword(
        password,
        u?.password || "missing:" + "0".repeat(64),
      );
      assert(u && ok, "Email or password is incorrect", 401);
      return newSession(req, { id: u.id, name: u.name, email: u.email });
    }
    if (path === "auth/logout" && req.method === "POST") {
      const token = req.headers
        .get("cookie")
        ?.match(/(?:^|;\s*)sf_session=([^;]+)/)?.[1];
      if (token)
        await db()
          .prepare("DELETE FROM sessions WHERE token=?")
          .bind(await digest(token))
          .run();
      return json({ ok: true }, 200, { "Set-Cookie": cookie(req, "", 0) });
    }
    const user = await requireUser(req);
    if (path === "workspaces") {
      if (req.method === "GET")
        return json({
          workspaces: (
            await db()
              .prepare(
                "SELECT w.id,w.name,w.timezone,m.role FROM workspaces w JOIN members m ON m.workspace_id=w.id WHERE m.user_id=? ORDER BY w.name",
              )
              .bind(user.id)
              .all()
          ).results,
        });
      const b = await body(req);
      if (b.invite) {
        const w = await db()
          .prepare("SELECT id FROM workspaces WHERE invite_code=?")
          .bind(String(b.invite).trim())
          .first<{ id: string }>();
        assert(w, "Invitation code not found", 404);
        await db()
          .prepare(
            "INSERT OR IGNORE INTO members(id,workspace_id,user_id,role) VALUES(?,?,?,?)",
          )
          .bind(uid(), w.id, user.id, "member")
          .run();
        return json({ id: w.id });
      }
      const name = String(b.name || "").trim();
      assert(
        name.length >= 2 && name.length <= 60,
        "Workspace name must be 2–60 characters",
      );
      const count = await db()
        .prepare("SELECT COUNT(*) n FROM workspaces WHERE owner_id=?")
        .bind(user.id)
        .first<{ n: number }>();
      assert((count?.n || 0) < 5, "Up to five workspaces per account");
      return json({ id: await createWorkspace(user.id, name) });
    }
    const workspaceId = url.searchParams.get("workspace") || "";
    const membership = await member(user.id, workspaceId);
    await db()
      .prepare(
        "UPDATE bookings SET status='expired',updated_at=?,updated_by='system' WHERE workspace_id=? AND status='held' AND hold_until<=?",
      )
      .bind(Date.now(), workspaceId, Date.now())
      .run();
    if (path === "dashboard" && req.method === "GET") {
      const [rooms, bookings, people, activity] = await db().batch([
        db()
          .prepare(
            "SELECT * FROM resources WHERE workspace_id=? AND active=1 ORDER BY name",
          )
          .bind(workspaceId),
        db()
          .prepare(
            "SELECT b.*,r.name resource_name,r.image,u.name user_name FROM bookings b JOIN resources r ON r.id=b.resource_id JOIN users u ON u.id=b.user_id WHERE b.workspace_id=? ORDER BY b.day,b.hour LIMIT 1000",
          )
          .bind(workspaceId),
        db()
          .prepare(
            "SELECT u.id,u.name,u.email,m.role FROM members m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=? ORDER BY m.role,u.name",
          )
          .bind(workspaceId),
        db()
          .prepare(
            "SELECT a.*,u.name actor_name,r.name resource_name FROM audits a LEFT JOIN users u ON u.id=a.actor_id LEFT JOIN bookings b ON b.id=a.booking_id LEFT JOIN resources r ON r.id=b.resource_id WHERE a.workspace_id=? ORDER BY a.id DESC LIMIT 30",
          )
          .bind(workspaceId),
      ]);
      return json({
        rooms: rooms.results,
        bookings: bookings.results,
        people: people.results,
        activity: activity.results,
        role: membership.role,
        timezone: membership.timezone,
        today: today(),
      });
    }
    if (path === "settings") {
      assert(
        membership.role === "owner",
        "Only the owner can manage this workspace",
        403,
      );
      if (req.method === "GET") {
        const w = await db()
          .prepare(
            "SELECT name,invite_code,timezone FROM workspaces WHERE id=?",
          )
          .bind(workspaceId)
          .first();
        return json(w);
      }
      const b = await body(req);
      if (b.rotate) {
        await db()
          .prepare("UPDATE workspaces SET invite_code=? WHERE id=?")
          .bind(randomToken(), workspaceId)
          .run();
        return json({ ok: true });
      }
      const name = String(b.name || "").trim();
      assert(
        name.length >= 2 && name.length <= 60,
        "Name must be 2–60 characters",
      );
      await db()
        .prepare("UPDATE workspaces SET name=? WHERE id=?")
        .bind(name, workspaceId)
        .run();
      return json({ ok: true });
    }
    if (path === "resources" && req.method === "POST") {
      assert(membership.role === "owner", "Only the owner can add spaces", 403);
      const b = await body(req);
      const name = String(b.name || "").trim(),
        capacity = Number(b.capacity);
      assert(
        name.length >= 2 && name.length <= 60,
        "Name must be 2–60 characters",
      );
      assert(
        Number.isInteger(capacity) && capacity >= 1 && capacity <= 100,
        "Capacity must be 1–100",
      );
      assert(
        ["Meeting room", "Focus room", "Collaboration"].includes(b.kind),
        "Invalid room type",
      );
      const count = await db()
        .prepare("SELECT COUNT(*) n FROM resources WHERE workspace_id=?")
        .bind(workspaceId)
        .first<{ n: number }>();
      assert((count?.n || 0) < 30, "Up to 30 spaces per workspace");
      await db()
        .prepare(
          "INSERT INTO resources(id,workspace_id,name,kind,capacity,image,location,amenities,active) VALUES(?,?,?,?,?,?,?,?,1)",
        )
        .bind(
          uid(),
          workspaceId,
          name,
          b.kind,
          capacity,
          "/images/studio.jpg",
          String(b.location || "Main floor").slice(0, 100),
          "Fast Wi-Fi,Whiteboard",
        )
        .run();
      return json({ ok: true });
    }
    if (path === "bookings" && req.method === "POST") {
      const b = await body(req),
        resource = String(b.resourceId),
        day = String(b.day),
        hour = Number(b.hour),
        title = String(b.title || "").trim(),
        key = String(b.key || "");
      assert(key.length >= 16 && key.length <= 100, "Invalid request key");
      const existing = await db()
        .prepare(
          "SELECT * FROM bookings WHERE workspace_id=? AND user_id=? AND idempotency_key=?",
        )
        .bind(workspaceId, user.id, key)
        .first<Booking>();
      if (existing) {
        assert(
          existing.resource_id === resource &&
            existing.day === day &&
            existing.hour === hour &&
            existing.title === title,
          "Request key was already used for another booking",
          409,
        );
        return json({ booking: existing });
      }
      assert(
        validSlot(day, hour),
        "Choose a future slot within the next 60 days",
      );
      assert(
        title.length >= 2 && title.length <= 100,
        "Meeting title must be 2–100 characters",
      );
      const r = await db()
        .prepare(
          "SELECT id FROM resources WHERE id=? AND workspace_id=? AND active=1",
        )
        .bind(resource, workspaceId)
        .first();
      assert(r, "Space not found", 404);
      const id = uid(),
        now = Date.now();
      try {
        await db()
          .prepare(
            "INSERT INTO bookings(id,workspace_id,resource_id,user_id,title,day,hour,status,hold_until,idempotency_key,created_at,updated_at,updated_by) VALUES(?,?,?,?,?,?,?,'held',?,?,?,?,?)",
          )
          .bind(
            id,
            workspaceId,
            resource,
            user.id,
            title,
            day,
            hour,
            Math.min(now + 300000, slotTime(day, hour)),
            key,
            now,
            now,
            user.id,
          )
          .run();
      } catch (e) {
        if (String(e).includes("UNIQUE constraint")) {
          const raced = await db()
            .prepare(
              "SELECT * FROM bookings WHERE workspace_id=? AND user_id=? AND idempotency_key=?",
            )
            .bind(workspaceId, user.id, key)
            .first<Booking>();
          if (raced) {
            assert(
              raced.resource_id === resource &&
                raced.day === day &&
                raced.hour === hour &&
                raced.title === title,
              "Request key was already used for another booking",
              409,
            );
            return json({ booking: raced });
          }
        }
        throw e;
      }
      return json(
        {
          booking: await db()
            .prepare("SELECT * FROM bookings WHERE id=?")
            .bind(id)
            .first(),
        },
        201,
      );
    }
    if (path.startsWith("bookings/") && req.method === "POST") {
      const id = path.split("/")[1],
        b = await body(req);
      const booking = await db()
        .prepare("SELECT * FROM bookings WHERE id=? AND workspace_id=?")
        .bind(id, workspaceId)
        .first<Booking>();
      assert(booking, "Booking not found", 404);
      assert(
        booking.user_id === user.id || membership.role === "owner",
        "You can only change your own booking",
        403,
      );
      if (b.action === "confirm") {
        if (booking.status === "confirmed") return json({ ok: true });
        const updated = await db()
          .prepare(
            "UPDATE bookings SET status='confirmed',hold_until=NULL,updated_at=?,updated_by=? WHERE id=? AND status='held' AND hold_until>? RETURNING id",
          )
          .bind(Date.now(), user.id, id, Date.now())
          .first();
        assert(
          updated,
          "Reservation expired. Please choose a slot again.",
          409,
        );
      } else if (b.action === "cancel") {
        assert(
          slotTime(booking.day, booking.hour) > Date.now(),
          "Past bookings cannot be cancelled",
        );
        await db()
          .prepare(
            "UPDATE bookings SET status='cancelled',updated_at=?,updated_by=? WHERE id=? AND status IN ('held','confirmed')",
          )
          .bind(Date.now(), user.id, id)
          .run();
      } else if (b.action === "reschedule") {
        assert(
          booking.status === "confirmed",
          "Only confirmed bookings can be rescheduled",
          409,
        );
        assert(
          slotTime(booking.day, booking.hour) > Date.now(),
          "Past bookings cannot be rescheduled",
        );
        assert(
          validSlot(String(b.day), Number(b.hour)),
          "Choose a future slot within 60 days",
        );
        const result = await db()
          .prepare(
            "UPDATE bookings SET day=?,hour=?,updated_at=?,updated_by=? WHERE id=? AND status='confirmed' RETURNING id",
          )
          .bind(b.day, Number(b.hour), Date.now(), user.id, id)
          .first();
        assert(result, "Booking has changed. Refresh and try again.", 409);
      } else throw new ApiError(400, "Unknown booking action");
      return json({ ok: true });
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    if (e instanceof ApiError) return json({ error: e.message }, e.status);
    const message = String(e);
    if (message.includes("UNIQUE constraint failed: bookings.resource_id"))
      return json(
        {
          error: "Someone just reserved this slot. Please choose another time.",
        },
        409,
      );
    if (message.includes("UNIQUE constraint"))
      return json(
        { error: "This record already exists. Refresh and try again." },
        409,
      );
    console.error("API error", e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}
export const GET = handler;
export const POST = handler;
