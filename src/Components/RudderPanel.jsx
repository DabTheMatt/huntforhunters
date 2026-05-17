export default function RudderPanel({
  controls,
  setControls,
  setCourseKeepingEnabled,
  turningDiameterM,
  maxRudderDeg,
  buttonStyle,
  courseKeepingEnabled = false,
}) {
  const clampRudder = (nextAngle) => Math.max(-maxRudderDeg, Math.min(maxRudderDeg, nextAngle));

  const setRudderDelta = (delta) => {
    setCourseKeepingEnabled(false);
    setControls((controlsState) => ({
      ...controlsState,
      rudderDeg: Math.round(clampRudder(controlsState.rudderDeg + delta)),
    }));
  };

  const setRudderAngle = (nextAngle) => {
    setCourseKeepingEnabled(false);
    setControls((controlsState) => ({
      ...controlsState,
      rudderDeg: Math.round(clampRudder(nextAngle)),
    }));
  };

  const rudderLabel =
    Math.round(controls.rudderDeg) < 0
      ? `PORT ${Math.abs(Math.round(controls.rudderDeg))}°`
      : Math.round(controls.rudderDeg) > 0
        ? `STBD ${Math.round(controls.rudderDeg)}°`
        : "MIDSHIPS";

  return (
    <div
      style={{
        minHeight: "240px",
        width: "100%",
        boxSizing: "border-box",
        padding: "12px",
        background: "transparent",
        border: "none",
        borderRadius: 0,
        boxShadow: "none",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "5px" }}>
        <button style={{ ...buttonStyle, fontSize: "10px", padding: "4px 4px" }} onClick={() => setRudderDelta(-5)}>
          Port 5°
        </button>
        <button style={{ ...buttonStyle, fontSize: "10px", padding: "4px 4px" }} onClick={() => setRudderAngle(0)}>
          Midships
        </button>
        <button style={{ ...buttonStyle, fontSize: "10px", padding: "4px 4px" }} onClick={() => setRudderDelta(5)}>
          Stbd 5°
        </button>
      </div>

      <div
        style={{
          marginTop: "10px",
          borderRadius: "8px",
          background: "rgba(41,37,36,0.72)",
          padding: "7px 8px",
          textAlign: "center",
          fontSize: "16px",
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color: "#fde68a",
        }}
      >
        {rudderLabel}
      </div>

      <input
        style={{
          marginTop: "10px",
          width: "100%",
          opacity: 1,
          cursor: "pointer",
          outline: "none",
          boxShadow: "none",
          accentColor: "#fde68a",
        }}
        onFocus={(event) => event.currentTarget.blur()}
        type="range"
        min={-maxRudderDeg}
        max={maxRudderDeg}
        step="1"
        value={controls.rudderDeg}
        onPointerDown={() => setCourseKeepingEnabled(false)}
        onMouseDown={() => setCourseKeepingEnabled(false)}
        onChange={(event) => setRudderAngle(Number(event.target.value))}
      />

      <div
        style={{
          marginTop: "0px",
          display: "flex",
          justifyContent: "space-between",
          fontSize: "9px",
          color: "#a8a29e",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>PORT {maxRudderDeg}°</span>
        <span>STBD {maxRudderDeg}°</span>
      </div>

      <div
        style={{
          marginTop: "8px",
          fontSize: "10px",
          color: "#d6d3d1",
          lineHeight: 1.35,
          textAlign: "center",
        }}
      >
        <span style={{ color: "#fde68a" }}>
          Predicted turning circle: {turningDiameterM ? `${Math.round(turningDiameterM)} m Ø` : "—"}
        </span>
        <br />
        <span style={{ color: courseKeepingEnabled ? "#86efac" : "#d6d3d1" }}>
          {courseKeepingEnabled
            ? "Rudder controlled by ordered course"
            : "Manual rudder control"}
        </span>
      </div>
    </div>
  );
}