export default function SimulationLog({
  panelStyle,
  labelStyle,
  simulationLog = [],
  collapsed = false,
}) {
  if (collapsed) {
    return (
      <div
        style={{
          ...(panelStyle ?? {}),
          width: "432px",
          minHeight: "44px",
          height: "44px",
          transformOrigin: "top center",
          boxSizing: "border-box",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
      </div>
    );
  }

  return (
    <div
      style={{
        width: "432px",
        minHeight: "240px",
        transformOrigin: "top center",
        boxSizing: "border-box",
        overflow: "hidden",
        padding: "0 16px 16px",
        background: "transparent",
        border: "none",
        borderRadius: 0,
      }}
    >

      <div
        style={{
          maxHeight: "150px",
          marginTop: "12px",
          overflowY: "auto",
          fontSize: "11px",
          lineHeight: 1.35,
          color: "#d6d3d1",
          fontFamily: "ui-monospace, monospace",
          textAlign: "left",
        }}
      >
        {simulationLog.length === 0 ? (
          <div style={{ opacity: 0.65 }}>Awaiting simulation events...</div>
        ) : (
          simulationLog.slice().reverse().map((entry, index) => {
            const time = typeof entry === "object" && entry !== null ? entry.time : "";
            const message = typeof entry === "object" && entry !== null ? entry.message : String(entry);

            return (
              <div
                key={`${index}-${time}-${message}`}
                style={{
                  padding: "4px 0",
                  borderTop: index > 0 ? "1px solid rgba(253,230,138,0.08)" : "none",
                }}
              >
                {time && <span style={{ color: "#fde68a" }}>{time}</span>} {message}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}