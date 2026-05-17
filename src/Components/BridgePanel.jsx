const formatSignedDeg = (value) => {
  const rounded = Math.round(value);
  if (rounded > 0) return `+${rounded}°`;
  if (rounded < 0) return `${rounded}°`;
  return "0°";
};

const normalizeSignedDelta = (fromDeg, toDeg) => {
  let delta = ((toDeg - fromDeg + 540) % 360) - 180;
  if (Object.is(delta, -0)) delta = 0;
  return delta;
};

function DataCell({ label, value, tone = "normal" }) {
  const toneColor =
    tone === "good"
      ? "#86efac"
      : tone === "warn"
        ? "#fde68a"
        : tone === "bad"
          ? "#fca5a5"
          : "#f5f5f4";

  return (
    <div
      style={{
        minWidth: 0,
        border: "1px solid rgba(245,245,244,0.10)",
        borderRadius: "4px",
        background: "rgba(41,37,36,0.62)",
        padding: "6px 8px",
      }}
    >
      <div
        style={{
          fontSize: "9px",
          color: "#d6d3d1",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          lineHeight: 1,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: "5px",
          fontSize: "16px",
          fontWeight: 800,
          color: tone === "good" ? toneColor : "#fde68a",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ModuleLight({ label, state = "ok" }) {
  const palette = {
    ok: { bg: "rgba(34,197,94,0.20)", border: "rgba(134,239,172,0.38)", dot: "#86efac", text: "#bbf7d0" },
    warn: { bg: "rgba(253,230,138,0.16)", border: "rgba(253,230,138,0.34)", dot: "#fde68a", text: "#fde68a" },
    off: { bg: "rgba(68,64,60,0.36)", border: "rgba(168,162,158,0.18)", dot: "#78716c", text: "#a8a29e" },
    bad: { bg: "rgba(239,68,68,0.16)", border: "rgba(252,165,165,0.34)", dot: "#fca5a5", text: "#fecaca" },
  };
  const colors = palette[state] ?? palette.off;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        border: `1px solid ${colors.border}`,
        borderRadius: "4px",
        background: colors.bg,
        padding: "7px 9px",
        minWidth: 0,
      }}
    >
      <span
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: colors.dot,
          boxShadow: `0 0 6px ${colors.dot}`,
          flex: "0 0 auto",
        }}
      />
      <span
        style={{
          fontSize: "10px",
          color: colors.text,
          fontWeight: 800,
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}

export default function BridgePanel({
  ship,
  speedKn,
  asdicContact,
  grafton,
  bearingLabel,
  orderedCourseDeg,
  courseKeepingEnabled,
  environment,
  controls,
}) {
  const orderedCourseLabel = Number.isFinite(orderedCourseDeg)
    ? bearingLabel(orderedCourseDeg)
    : "—";
  const courseDeltaDeg = Number.isFinite(orderedCourseDeg)
    ? normalizeSignedDelta(ship.headingDeg, orderedCourseDeg)
    : 0;
  const courseDeltaAbs = Math.abs(courseDeltaDeg);
  const displayHeadingDeg =
    Number.isFinite(orderedCourseDeg) && courseDeltaAbs <= 2
      ? orderedCourseDeg
      : ship.headingDeg;
  const orderedCourseActive =
    courseKeepingEnabled &&
    Number.isFinite(orderedCourseDeg) &&
    courseDeltaAbs > 1;
  const windDriftDeg = Math.round(((environment?.windDirDeg ?? 0) - ship.headingDeg + 540) % 360 - 180);
  const driftLabel = `${formatSignedDeg(windDriftDeg)} / ${environment?.windKn ?? 0} kn`;
  const contactLabel = asdicContact.detected
    ? `${asdicContact.quality} · ${bearingLabel(asdicContact.bearingDeg)} · ${(asdicContact.distanceM * 1.09361).toFixed(0)} yd`
    : "NO CONTACT";

  return (
    <div
      style={{
        width: "100%",
        boxSizing: "border-box",
        padding: "2px 12px 20px",
        background: "transparent",
        border: "none",
        borderRadius: 0,
        boxShadow: "none",
        overflow: "hidden",
        fontFamily: "ui-monospace, monospace",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateRows: "1fr",
          gap: "0px",
          alignItems: "start",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "0px",
            minHeight: 0,
            alignItems: "start",
          }}
        >
          <div
            style={{
              gridTemplateColumns: "minmax(84px, 0.85fr) minmax(84px, 0.85fr) minmax(92px, 0.95fr) minmax(126px, 1.25fr) minmax(78px, 0.78fr) minmax(78px, 0.78fr) minmax(150px, 1.45fr)",
              display: "grid",
              gap: "6px",
              alignItems: "stretch",
            }}
          >
            <DataCell label="HDG" value={bearingLabel(displayHeadingDeg)} />
            <DataCell label="Speed" value={`${speedKn.toFixed(1)} kn`} />
            <DataCell
              label="ORD HDG"
              value={orderedCourseActive ? orderedCourseLabel : "—"}
              tone={orderedCourseActive ? "good" : "normal"}
            />
            <DataCell
              label="Delta"
              value={courseDeltaAbs <= 2 ? "ON COURSE" : formatSignedDeg(courseDeltaDeg)}
              tone={courseDeltaAbs <= 2 ? "good" : Math.abs(courseDeltaDeg) > 8 ? "warn" : "normal"}
            />
            <DataCell label="Roll" value={`${ship.rollDeg.toFixed(1)}°`} tone={Math.abs(ship.rollDeg) > 8 ? "warn" : "normal"} />
            <DataCell label="Pitch" value={`${ship.pitchDeg.toFixed(1)}°`} tone={Math.abs(ship.pitchDeg) > 5 ? "warn" : "normal"} />
            <DataCell label="Wind drift" value={driftLabel} />
          </div>
        </div>
      </div>
    </div>
  );
}