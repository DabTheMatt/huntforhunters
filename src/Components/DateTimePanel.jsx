export default function DateTimePanel({
  ship,
  timeScale,
  setTimeScale,
  paused,
  setPaused,
  labelStyle,
  activeButtonStyle,
  buttonStyle,
  dangerButtonStyle,
  formatTime,
}) {
  const compactButtonStyle = {
    ...buttonStyle,
    minWidth: "0",
    padding: "4px 7px",
    fontSize: "11px",
    lineHeight: 1,
    flex: "0 0 auto",
  };

  const compactActiveButtonStyle = {
    ...activeButtonStyle,
    minWidth: "0",
    padding: "4px 7px",
    fontSize: "11px",
    lineHeight: 1,
    flex: "0 0 auto",
  };

  const compactDangerButtonStyle = {
    ...dangerButtonStyle,
    minWidth: "0",
    padding: "4px 6px",
    fontSize: "10px",
    lineHeight: 1,
    flex: "0 0 auto",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>

      <div style={{ display: "flex", alignItems: "flex-end", gap: "12px" }}>
        <div
          style={{
            marginTop: "12px",
            fontSize: "14px",
            fontWeight: 600,
            color: "#fde68a",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {formatTime(ship.simTime)}
        </div>

        <button
          style={paused ? compactDangerButtonStyle : compactButtonStyle}
          onClick={() => setPaused((value) => !value)}
        >
          {paused ? "Paused" : "Pause"}
        </button>
      </div>

      <div
        style={{
          marginTop: "6px",
          display: "flex",
          flexWrap: "nowrap",
          gap: "2px",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        {[0.5, 1, 5, 20, 100].map((scale) => (
          <button
            key={scale}
            style={timeScale === scale ? compactActiveButtonStyle : compactButtonStyle}
            onClick={() => setTimeScale(scale)}
          >
            {scale}x
          </button>
        ))}
      </div>
    </div>
  );
}