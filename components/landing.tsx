"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  Plus,
  Users,
  Sun,
  Wifi,
  CalendarDays,
  ShieldCheck,
  Clock3,
  Menu,
  X,
} from "lucide-react";
import { Brand, Orb, ArrowButton, AuthModal } from "./ui";
export default function Landing() {
  const [auth, setAuth] = useState(false),
    [menu, setMenu] = useState(false);
  const [authMode,setAuthMode]=useState<'register'|'login'>('register');
  function openSignup(){setAuthMode('register');setAuth(true);}
  return (
    <>
      <header className="site-header">
        <Brand />
        <nav className={menu ? "open" : ""}>
          <a href="#spaces" onClick={() => setMenu(false)}>
            The spaces
          </a>
          <a href="#how-it-works" onClick={() => setMenu(false)}>
            How it works
          </a>
          <a href="#details" onClick={() => setMenu(false)}>
            Good to know
          </a>
        </nav>
        <div className="header-actions">
          <span className="header-note">
            <span className="live-dot" /> Room for possibility
          </span>
          <button className="button dark compact" onClick={() => {setAuthMode('login');setAuth(true);}}>
            Sign in <ArrowUpRight size={14} />
          </button>
          <button
            className="icon-button mobile-menu"
            aria-label="Toggle navigation"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="eyebrow">
            <span className="tiny-star">✳</span> LESS COORDINATING. MORE
            CREATING.
          </div>
          <h1>
            Good work starts
            <br />
            with a little <span>space.</span>
          </h1>
          <p className="hero-subtitle">
            Find your focus. Bring your people.
            <br className="mobile-only" /> Make room for what comes next.
          </p>
          <div className="hero-actions">
            <a href="/workspace" className="text-link">
              Open your workspace <ArrowUpRight size={15} />
            </a>
            <ArrowButton onClick={openSignup}>
              Find your space
            </ArrowButton>
          </div>
          <div className="hero-composition">
            <div className="floating-card schedule-card">
              <div className="mini-label">
                A little room to think <span>↗</span>
              </div>
              <h3>Your next big idea.</h3>
              <div className="mini-calendar">
                {["M", "T", "W", "T", "F"].map((v, i) => (
                  <div key={i}>
                    <span>{v}</span>
                    <b className={i === 2 ? "selected" : ""}>{12 + i}</b>
                  </div>
                ))}
              </div>
              <div className="mini-event">
                <span />
                <div>
                  <b>Creative catch-up</b>
                  <small>10:00 – 11:00 · The Sunroom</small>
                </div>
                <Check size={15} />
              </div>
            </div>
            <div className="floating-photo left-photo">
              <img
                src="/images/studio.jpg"
                alt="Warm, light-filled workspace"
              />
              <span>
                Headspace, found. <Sun size={13} />
              </span>
            </div>
            <Orb />
            <div className="floating-card photo-card">
              <img
                src="/images/boardroom.jpg"
                alt="A calm meeting room with a long shared table"
              />
              <div>
                <span>The Boardroom</span>
                <ArrowUpRight size={16} />
              </div>
              <small>12 seats. Endless possibilities.</small>
            </div>
            <div className="floating-card confirmed-card">
              <div className="check-bubble">
                <Check size={18} />
              </div>
              <div>
                <b>It's yours. See you there.</b>
                <small>Space booked. One less thing to think about.</small>
              </div>
            </div>
            <span className="floating-note">
              Great ideas need room.
              <svg viewBox="0 0 90 40">
                <path d="M4 10 Q40 42 80 12 M68 10 L82 10 L77 25" />
              </svg>
            </span>
          </div>
          <div className="hero-foot">
            <span>THOUGHTFULLY SHARED SPACES</span>
            <a href="#spaces">
              A better place to begin <span>↓</span>
            </a>
            <span>BUILT FOR YOUR PEOPLE</span>
          </div>
        </section>
        <section className="feature-photo" id="how-it-works">
          <img
            src="/images/sunroom.jpg"
            alt="Bright communal workspace surrounded by greenery"
          />
          <div className="photo-grid" />
          <div className="photo-title">
            <span>SPACE TO DO YOUR THING</span>
            <h2>
              Less friction.
              <br />
              More flow.
            </h2>
          </div>
          <div className="glass-note note-one">
            <CalendarDays size={18} />
            <h3>A slot that fits.</h3>
            <p>
              See what's open. Pick your moment. Your calendar just got simpler.
            </p>
          </div>
          <div className="glass-note note-two">
            <ShieldCheck size={18} />
            <h3>Yours means yours.</h3>
            <p>
              One space. One booking. No awkward double-booking conversations.
            </p>
          </div>
          <div className="glass-note note-three">
            <Clock3 size={18} />
            <h3>Plans change.</h3>
            <p>Move your booking. Keep your momentum.</p>
          </div>
        </section>
        <section className="spaces-section" id="spaces">
          <div className="section-heading">
            <div>
              <div className="eyebrow">A PLACE FOR EVERY KIND OF DAY</div>
              <h2>Find your kind of room.</h2>
            </div>
            <p>
              For the big brainstorms.
              <br />
              And the beautifully quiet breakthroughs.
            </p>
          </div>
          <div className="spaces-grid">
            {[
              {
                name: "The Sunroom",
                type: "FOR FRESH PERSPECTIVES",
                image: "sunroom",
                seats: 6,
              },
              {
                name: "The Boardroom",
                type: "FOR THE BIG IDEAS",
                image: "boardroom",
                seats: 12,
              },
              {
                name: "Focus Studio",
                type: "FOR YOUR FLOW STATE",
                image: "studio",
                seats: 2,
              },
            ].map((r, i) => (
              <a href="/workspace" className="space-editorial" key={r.name}>
                <div className="space-image">
                  <img src={"/images/" + r.image + ".jpg"} alt={r.name} />
                  <span className="space-number">0{i + 1}</span>
                  <span className="space-link">
                    <ArrowUpRight size={20} />
                  </span>
                </div>
                <div className="space-meta">
                  <span>{r.type}</span>
                  <span>
                    <Users size={12} /> {r.seats} people
                  </span>
                </div>
                <h3>{r.name}</h3>
              </a>
            ))}
          </div>
          <p className="sample-note">
            A little inspiration for your workspace. Add the rooms your team actually uses.
          </p>
        </section>
        <section className="together-section">
          <div className="together-copy">
            <div className="eyebrow">YOUR TEAM. IN SYNC.</div>
            <h2>
              A shared space.
              <br />A little more
              <br />
              <span>possibility.</span>
            </h2>
            <p>
              From a quiet hour to a team-wide catch-up, give your people a
              place to do their best work.
            </p>
            <ArrowButton onClick={openSignup}>
              Bring your people
            </ArrowButton>
            <div className="together-proof">
              <ShieldCheck size={16} /> Your workspace stays your workspace.
            </div>
          </div>
          <div className="together-art">
            <img
              src="/images/commons.jpg"
              alt="Welcoming shared studio with collaborative seating"
            />
            <div className="floating-card team-card">
              <div className="avatars">
                <span>AD</span>
                <span>MK</span>
                <span>JS</span>
                <span>+1</span>
              </div>
              <b>Same team. Same page.</b>
              <small>Illustrative workspace</small>
            </div>
            <div className="floating-card time-card">
              <span className="live-dot" /> A good time to come together.
              <b>
                10:00 <span>—</span> 11:00
              </b>
              <small>Team catch-up · The Commons</small>
            </div>
            <Orb small />
          </div>
        </section>
        <section className="faq-section" id="details">
          <div>
            <div className="eyebrow">THE LITTLE DETAILS</div>
            <h2>Glad you asked.</h2>
            <p className="muted">Less guessing. More getting started.</p>
          </div>
          <div className="faq-list">
            {[
              [
                "How does booking work?",
                "Create an account, choose a space and pick an available one-hour slot. We hold it for five minutes while you confirm. Your reservation is saved to your workspace.",
              ],
              [
                "Can I bring my team?",
                "Yes. Workspace owners can share an invitation code from Settings. Teammates sign in with their own accounts and join your workspace. Only members can see its spaces and bookings.",
              ],
              [
                "What if my plans change?",
                "Open My bookings to cancel or reschedule a future reservation. If your new time is unavailable, your original booking stays in place.",
              ],
              [
                "How do I add my own spaces?",
                "Create an account to start an empty workspace, then add your rooms with their location, capacity, and amenities. These photos illustrate possible spaces; your workspace contains only the rooms you add.",
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <Plus size={18} />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="closing-banner">
          <img
            src="/images/commons.jpg"
            alt="A beautiful space ready for the next idea"
          />
          <div>
            <span className="eyebrow">YOUR NEXT CHAPTER HAS A PLACE.</span>
            <h2>Make room.</h2>
            <ArrowButton onClick={openSignup}>Get started</ArrowButton>
          </div>
          <span className="banner-side">
            GOOD SPACES.
            <br />
            GREAT POSSIBILITIES.
          </span>
        </section>
      </main>
      <footer>
        <div className="footer-top">
          <Brand />
          <div>
            <a href="#spaces">The spaces</a>
            <a href="/workspace">Open workspace</a>
            <a href="#details">Questions</a>
          </div>
          <a href="#" className="back-top">
            Back to top ↑
          </a>
        </div>
        <div className="footer-bottom">
          <h3>
            A little room.
            <br />A lot of possibility.
          </h3>
          <span>
            © {new Date().getFullYear()} SlotForge. A portfolio project.
            <br />
            Space photography via Unsplash.
          </span>
        </div>
      </footer>
      {auth && (
        <AuthModal
          initialMode={authMode}
          onClose={() => setAuth(false)}
          onSuccess={() => {
            window.location.href = "/workspace";
          }}
        />
      )}
    </>
  );
}
