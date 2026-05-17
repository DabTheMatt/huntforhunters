const TELEGRAPH_ORDERS = [
  { label: "FULL", side: "astern" },
  { label: "HALF", side: "astern" },
  { label: "SLOW", side: "astern" },
  { label: "DEAD\nSLOW", side: "astern" },
  { label: "STOP", side: "stop" },
  { label: "DEAD\nSLOW", side: "ahead" },
  { label: "SLOW", side: "ahead" },
  { label: "HALF", side: "ahead" },
  { label: "FULL", side: "ahead" },
];

const START_ANGLE_DEG = 240;
const END_ANGLE_DEG = 120;
const ARC_DEG = 240;

const orderAngleDeg = (index, total) =>
  START_ANGLE_DEG + (ARC_DEG * index) / Math.max(total - 1, 1);

const normalizeAngleDeg = (angle) => ((angle % 360) + 360) % 360;

const normalizeIndex = (value, total) =>
  Math.max(0, Math.min(total - 1, Number.isFinite(value) ? value : 0));

const orderReply = (order) => {
  if (!order) return "— ANSWERED";
  if (order.side === "stop") return "STOP — ANSWERED";
  return `${order.label.replace("\n", " ")} ${order.side.toUpperCase()} — ANSWERED`;
};

const polar = (angleDeg, radius) => {
  const angleRad = (normalizeAngleDeg(angleDeg) * Math.PI) / 180;
  return {
    x: Math.sin(angleRad) * radius,
    y: -Math.cos(angleRad) * radius,
  };
};

export default function EngineTelegraphPanel({ controls, setControls, telegraph }) {
  const total = telegraph?.length || TELEGRAPH_ORDERS.length;
  const activeIndex = normalizeIndex(controls.telegraphIndex ?? 0, total);
  const activeAngle = orderAngleDeg(activeIndex, TELEGRAPH_ORDERS.length);
  const activeReply = orderReply(TELEGRAPH_ORDERS[activeIndex]);

  return (
    <div
      style={{
        width: "168px",
        height: "168px",
        margin: "12px auto 0",
        position: "relative",
        fontFamily: "ui-monospace, monospace",
        userSelect: "none",
      }}
    >

      <div
        style={{
          left: "6px",
          top: "12px",
          width: "156px",
          height: "156px",
          borderRadius: "50%",
          border: "2px solid rgba(253,230,138,0.28)",
          background: "rgba(28,25,23,0.94)",
          position: "absolute",
        }}
      />


      {TELEGRAPH_ORDERS.map((order, index) => {
        const angle = orderAngleDeg(index, TELEGRAPH_ORDERS.length);
        const labelPoint = polar(angle, 48);
        const isActive = index === activeIndex;
        const isAstern = order.side === "astern";
        const isAhead = order.side === "ahead";
        const labelRotation = normalizeAngleDeg(angle + (isAhead ? 270 : 90));

        return (
          <div key={`${order.side}-${order.label}-${index}`}>
            <button
              type="button"
              onClick={() =>
                setControls((value) => ({
                  ...value,
                  telegraphIndex: index,
                }))
              }
              style={{
                position: "absolute",
                left: `calc(50% + ${labelPoint.x}px - 23px)`,
                top: `calc(90px + ${labelPoint.y}px - 10px)`,
                width: "52px",
                minHeight: "22px",
                border: isActive ? "1px solid rgba(134,239,172,0.75)" : "1px solid transparent",
                borderRadius: "4px",
                background: "transparent",
                color: isActive ? "#86efac" : isAstern ? "#fca5a5" : "#fde68a",
                fontSize: order.label.includes("DEAD") ? "8px" : "10px",
                fontWeight: 900,
                lineHeight: 0.92,
                whiteSpace: "pre-line",
                textAlign: "center",
                padding: "2px 1px",
                cursor: "pointer",
                letterSpacing: "0.02em",
                transform: `rotate(${labelRotation}deg)`,
                transformOrigin: "50% 50%",
              }}
            >
              {order.label}
            </button>
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "180px",
          color: "#d6d3d1",
          fontSize: "9px",
          fontWeight: 800,
          letterSpacing: "0.04em",
          textAlign: "center",
          textTransform: "uppercase",
        }}
      >
        {activeReply}
      </div>

    </div>
  );
}