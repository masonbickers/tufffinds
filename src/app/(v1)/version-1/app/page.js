import Link from "next/link";

const nodes = [
  {
    id: "app",
    title: "App Start",
    subtitle: "Splash / auth check",
    type: "entry",
    x: 50,
    y: 4,
  },
  {
    id: "auth",
    title: "Auth",
    subtitle: "Login / register",
    type: "system",
    x: 33,
    y: 17,
  },
  {
    id: "tabs",
    title: "Main Tabs",
    subtitle: "Signed-in user lands here",
    type: "system",
    x: 50,
    y: 17,
  },
  {
    id: "summary",
    title: "Summary",
    subtitle: "What matters today?",
    type: "tab",
    x: 12,
    y: 34,
    bullets: ["Today’s training", "Readiness", "Recent activity", "Fuel summary"],
  },
  {
    id: "train",
    title: "Train",
    subtitle: "What am I doing?",
    type: "tab",
    x: 32,
    y: 34,
    bullets: ["Active plan", "Week strip", "Planned sessions", "Needs review"],
  },
  {
    id: "chat",
    title: "Chat",
    subtitle: "What should I do next?",
    type: "tab",
    x: 50,
    y: 34,
    bullets: ["Coach guidance", "Plan edits", "Recovery advice", "Fuel advice"],
  },
  {
    id: "fuel",
    title: "Fuel",
    subtitle: "Am I fuelling properly?",
    type: "tab",
    x: 68,
    y: 34,
    bullets: ["Meals", "Macros", "Water", "Weight", "Micros"],
  },
  {
    id: "you",
    title: "You",
    subtitle: "Who am I?",
    type: "tab",
    x: 88,
    y: 34,
    bullets: ["Profile", "Stats", "Goals", "Integrations", "Settings"],
  },
  {
    id: "session",
    title: "Session Detail",
    subtitle: "One planned workout",
    type: "page",
    x: 25,
    y: 56,
    bullets: ["Workout goal", "Targets", "Linked activity", "Actions"],
  },
  {
    id: "plan",
    title: "Plan Overview",
    subtitle: "Full active plan",
    type: "page",
    x: 40,
    y: 56,
    bullets: ["Weeks", "Sessions", "Plan status", "Edit plan"],
  },
  {
    id: "create",
    title: "Create Plan",
    subtitle: "Generate new plan",
    type: "page",
    x: 55,
    y: 56,
    bullets: ["Goal", "Availability", "Fitness", "Preview"],
  },
  {
    id: "history",
    title: "History",
    subtitle: "What did I do?",
    type: "page",
    x: 72,
    y: 56,
    bullets: ["Completed sessions", "Manual logs", "Garmin", "Strava"],
  },
  {
    id: "progress",
    title: "Progress",
    subtitle: "Am I improving?",
    type: "page",
    x: 88,
    y: 56,
    bullets: ["Running", "Strength", "Recovery", "Adherence"],
  },
  {
    id: "live",
    title: "Live Run",
    subtitle: "Record session",
    type: "action",
    x: 16,
    y: 77,
    bullets: ["GPS", "Pace", "Time", "Finish"],
  },
  {
    id: "strength",
    title: "Strength Logger",
    subtitle: "Log gym work",
    type: "action",
    x: 31,
    y: 77,
    bullets: ["Exercises", "Sets", "Reps", "Weight"],
  },
  {
    id: "link",
    title: "Link Activity",
    subtitle: "Garmin / Strava review",
    type: "action",
    x: 47,
    y: 77,
    bullets: ["Confirm match", "Review manually", "Ignore"],
  },
  {
    id: "complete",
    title: "Complete Session",
    subtitle: "Save result",
    type: "result",
    x: 63,
    y: 77,
    bullets: ["Summary", "RPE", "Notes", "Return to Train"],
  },
  {
    id: "integrations",
    title: "Integrations",
    subtitle: "Garmin / Strava",
    type: "page",
    x: 82,
    y: 77,
    bullets: ["Connect", "Sync", "Last import", "Reconnect"],
  },
];

const lines = [
  ["app", "auth"],
  ["app", "tabs"],
  ["auth", "tabs"],
  ["tabs", "summary"],
  ["tabs", "train"],
  ["tabs", "chat"],
  ["tabs", "fuel"],
  ["tabs", "you"],
  ["summary", "session"],
  ["summary", "history"],
  ["summary", "fuel"],
  ["summary", "progress"],
  ["train", "session"],
  ["train", "plan"],
  ["train", "create"],
  ["train", "history"],
  ["chat", "session"],
  ["chat", "progress"],
  ["chat", "fuel"],
  ["fuel", "history"],
  ["you", "integrations"],
  ["you", "plan"],
  ["session", "live"],
  ["session", "strength"],
  ["session", "link"],
  ["session", "complete"],
  ["live", "complete"],
  ["strength", "complete"],
  ["link", "train"],
  ["complete", "train"],
  ["history", "progress"],
  ["integrations", "train"],
];

const flowRows = [
  {
    title: "Complete planned session",
    steps: ["Summary / Train", "Session Detail", "Live Run / Strength Logger", "Complete Session", "Train", "Progress updates"],
  },
  {
    title: "Garmin or Strava activity imported",
    steps: ["Import", "Train Dashboard", "Needs Review", "Link Activity", "Session Completed", "Progress updates"],
  },
  {
    title: "Create new plan",
    steps: ["Train", "Create Plan", "Plan Preview", "Save Plan", "Train Dashboard"],
  },
  {
    title: "Manage integrations",
    steps: ["You", "Integrations", "Garmin / Strava", "Connect or Sync", "Train receives activities"],
  },
];

export default function AppFlowPage() {
  return (
    <main className="min-h-screen overflow-x-auto bg-[#f4f4f2] text-[#111]">
      <div className="min-w-[1800px] p-8">
        <header className="mb-8 flex items-start justify-between rounded-[2rem] border border-black/10 bg-white p-6 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-lime-700">
              Train-R Product Map
            </p>
            <h1 className="mt-3 text-5xl font-black tracking-tight">
              Full App Page Flow
            </h1>
            <p className="mt-3 max-w-3xl text-base text-zinc-600">
              This shows how every main section connects: where users enter, where
              they go next, and where each action returns.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-full border border-black/10 bg-black px-5 py-3 text-sm font-semibold text-white"
          >
            Back home
          </Link>
        </header>

        <section className="relative h-[1100px] rounded-[2rem] border border-black/10 bg-[linear-gradient(to_right,rgba(0,0,0,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.055)_1px,transparent_1px)] bg-[size:48px_48px] p-8 shadow-sm">
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            <defs>
              <marker
                id="arrow"
                markerWidth="10"
                markerHeight="10"
                refX="7"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L0,6 L8,3 z" fill="#93c5fd" />
              </marker>
            </defs>

            {lines.map(([from, to], index) => {
              const a = nodes.find((node) => node.id === from);
              const b = nodes.find((node) => node.id === to);

              if (!a || !b) return null;

              const x1 = `${a.x}%`;
              const y1 = `${a.y + 5}%`;
              const x2 = `${b.x}%`;
              const y2 = `${b.y}%`;

              const midY = `${(a.y + b.y) / 2}%`;

              return (
                <path
                  key={`${from}-${to}-${index}`}
                  d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                  fill="none"
                  stroke="#93c5fd"
                  strokeWidth="2"
                  strokeOpacity="0.7"
                  markerEnd="url(#arrow)"
                />
              );
            })}
          </svg>

          {nodes.map((node) => (
            <FlowNode key={node.id} node={node} />
          ))}
        </section>

        <section className="mt-8 grid grid-cols-4 gap-4">
          {flowRows.map((row) => (
            <div
              key={row.title}
              className="rounded-[2rem] border border-black/10 bg-white p-5 shadow-sm"
            >
              <h2 className="text-lg font-black">{row.title}</h2>
              <div className="mt-4 space-y-2">
                {row.steps.map((step, index) => (
                  <div key={`${row.title}-${step}`} className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-lime-300 text-xs font-black">
                      {index + 1}
                    </span>
                    <span className="rounded-xl bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-700">
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="mt-8 rounded-[2rem] border border-black/10 bg-black p-6 text-white">
          <h2 className="text-2xl font-black">Core rule</h2>
          <div className="mt-5 grid grid-cols-4 gap-3">
            {[
              ["Summary", "What matters today?"],
              ["Train", "What am I doing?"],
              ["Session", "What is this workout?"],
              ["History", "What did I do?"],
              ["Progress", "Am I improving?"],
              ["Fuel", "Am I fuelling properly?"],
              ["Chat", "What should I do next?"],
              ["You", "Who am I and what is connected?"],
            ].map(([title, text]) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <p className="font-black text-lime-300">{title}</p>
                <p className="mt-1 text-sm text-zinc-300">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function FlowNode({ node }) {
  const typeStyles = {
    entry: "bg-black text-white border-black",
    system: "bg-white text-black border-black/10",
    tab: "bg-[#10140A] text-white border-lime-300/50",
    page: "bg-white text-black border-black/10",
    action: "bg-[#EEF2FF] text-black border-blue-200",
    result: "bg-lime-300 text-black border-lime-400",
  };

  return (
    <div
      className={`absolute w-[220px] -translate-x-1/2 rounded-[1.5rem] border p-4 shadow-lg ${
        typeStyles[node.type] || typeStyles.page
      }`}
      style={{
        left: `${node.x}%`,
        top: `${node.y}%`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black leading-tight">{node.title}</h3>
          <p className="mt-1 text-xs font-semibold opacity-70">{node.subtitle}</p>
        </div>
        <span className="mt-1 h-3 w-3 rounded-full bg-lime-300 shadow-[0_0_18px_rgba(217,255,43,0.8)]" />
      </div>

      {node.bullets?.length ? (
        <ul className="mt-4 space-y-1.5 text-xs font-medium opacity-80">
          {node.bullets.map((bullet) => (
            <li key={bullet}>• {bullet}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}