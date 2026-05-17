export default function ZoomPanel({ zoom, setZoom }) {
  return (
    <div style={{ padding: "8px 12px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <button
          type="button"
          style={{
            border: "1px solid rgba(253,230,138,0.22)",
            borderRadius: "8px",
            background: "rgba(41,37,36,0.92)",
            color: "#fde68a",
            fontFamily: "ui-monospace, monospace",
            fontSize: "11px",
            fontWeight: 800,
            cursor: "pointer",
            padding: "5px 8px",
          }}
          onClick={() => setZoom((value) => Math.max(0.45, value / 1.18))}
        >
          −
        </button>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
          <div
            style={{
              textAlign: "center",
              color: "#fde68a",
              fontFamily: "ui-monospace, monospace",
              fontSize: "10px",
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            {zoom.toFixed(2)}x
          </div>

          <input
            type="range"
            min="0.45"
            max="6"
            step="0.05"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            style={{ width: "100%", margin: 0 }}
          />
        </div>

        <button
          type="button"
          style={{
            border: "1px solid rgba(253,230,138,0.22)",
            borderRadius: "8px",
            background: "rgba(41,37,36,0.92)",
            color: "#fde68a",
            fontFamily: "ui-monospace, monospace",
            fontSize: "11px",
            fontWeight: 800,
            cursor: "pointer",
            padding: "5px 8px",
          }}
          onClick={() => setZoom((value) => Math.min(6, value * 1.18))}
        >
          +
        </button>
      </div>
    </div>
  );
}