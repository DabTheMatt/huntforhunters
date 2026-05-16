export default function DevelopmentPanel({
  onFullAhead,
  onHardStarboard,
  onCrashStop,
  onReset,
  panelStyle,
  labelStyle,
  buttonStyle,
  dangerButtonStyle,
}) {
  return (
    <div style={{ ...panelStyle, height: "168px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
      <div>
        <div style={labelStyle}>Development</div>
        <div style={{ marginTop: "4px", color: "#d6d3d1", fontSize: "14px" }}>
          Current test: UI fit · course keeping · ASDIC contact · ship silhouette.
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button style={buttonStyle} onClick={onFullAhead}>Full Ahead</button>
        <button style={buttonStyle} onClick={onHardStarboard}>Hard Starboard</button>
        <button style={buttonStyle} onClick={onCrashStop}>Crash Stop</button>
        <button style={dangerButtonStyle} onClick={onReset}>Reset Trial</button>
      </div>
    </div>
  );
}