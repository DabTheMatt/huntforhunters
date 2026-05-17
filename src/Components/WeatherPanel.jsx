import { useState } from "react";
export default function WeatherPanel({
  environment,
  setEnvironment,
  AutoPanel,
  labelStyle,
  StatusBox,
  SEA_STATES,
}) {
  const [adjustmentsVisible, setAdjustmentsVisible] = useState(false);
  const [forecastVisible, setForecastVisible] = useState(false);
  return (
    <div
      style={{
        minHeight: adjustmentsVisible ? "620px" : forecastVisible ? "438px" : "244px",
        width: "100%",
        boxSizing: "border-box",
        padding: "0 12px 14px",
        background: "transparent",
        border: "none",
        borderRadius: 0,
        boxShadow: "none",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          marginTop: "12px",
          fontSize: "10px",
          lineHeight: 1.45,
          color: "#fde68a",
          textAlign: "center",
        }}
      >
        <div>Historical weather</div>
        <div>52°00′N 34°00′W</div>
        <div>18 Mar 1943 · 09:00</div>
      </div>

      <div
        style={{
          marginTop: "10px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "4px",
        }}
      >
        <div style={{ transform: "scale(0.92)", transformOrigin: "top left" }}>
          <StatusBox label="Wind" value={`${environment.windDirDeg}° / ${environment.windKn} kn`} />
        </div>

        <div style={{ transform: "scale(0.92)", transformOrigin: "top left" }}>
          <StatusBox label="Cloud" value={`${environment.cloudCoverOktas ?? 0}/8 oktas`} />
        </div>

        <div style={{ transform: "scale(0.92)", transformOrigin: "top left" }}>
          <StatusBox label="Base" value={`${environment.cloudBaseM ?? 1800} m`} />
        </div>

        <div style={{ transform: "scale(0.92)", transformOrigin: "top left" }}>
          <StatusBox label="Sea" value={SEA_STATES[environment.seaIndex].label.replace(/^Sea State\s*/i, "")} />
        </div>

        <div style={{ transform: "scale(0.92)", transformOrigin: "top left" }}>
          <StatusBox label="Air" value={`${environment.airTempC ?? 4}°C`} />
        </div>

        <div style={{ transform: "scale(0.92)", transformOrigin: "top left" }}>
          <StatusBox label="Water" value={`${environment.waterTempC ?? 6}°C`} />
        </div>
      </div>

      <div
        style={{
          marginTop: "12px",
          marginBottom: "10px",
          height: "1px",
          width: "100%",
          background: "rgba(253,230,138,0.18)",
        }}
      />
      <button
        type="button"
        style={{
          width: "100%",
          borderRadius: "10px",
          border: "1px solid rgba(253,230,138,0.24)",
          background: adjustmentsVisible ? "rgba(253,230,138,0.22)" : "rgba(253,230,138,0.12)",
          color: "#fde68a",
          cursor: "pointer",
          fontSize: "10px",
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: "0.04em",
          textTransform: "none",
          padding: "6px 6px",
          fontFamily: "ui-monospace, monospace",
          boxShadow: adjustmentsVisible
            ? "inset 0 0 0 1px rgba(253,230,138,0.18)"
            : "none",
          transition: "all 120ms ease",
        }}
        onClick={() => setAdjustmentsVisible((visible) => !visible)}
      >
        Weather adjustment {adjustmentsVisible ? "on" : "off"}
      </button>

      <button
        type="button"
        style={{
          marginTop: "8px",
          width: "100%",
          borderRadius: "10px",
          border: "1px solid rgba(253,230,138,0.24)",
          background: forecastVisible ? "rgba(253,230,138,0.22)" : "rgba(253,230,138,0.12)",
          color: "#fde68a",
          cursor: "pointer",
          fontSize: "10px",
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: "0.04em",
          textTransform: "none",
          padding: "6px 6px",
          fontFamily: "ui-monospace, monospace",
          boxShadow: forecastVisible
            ? "inset 0 0 0 1px rgba(253,230,138,0.18)"
            : "none",
          transition: "all 120ms ease",
        }}
        onClick={() => setForecastVisible((visible) => !visible)}
      >
        Weather forecast {forecastVisible ? "on" : "off"}
      </button>

      {forecastVisible && (
        <div
          style={{
            marginTop: "10px",
            fontSize: "9px",
            lineHeight: 1.35,
            color: "#d6d3d1",
            textAlign: "left",
          }}
        >
          <div style={{ color: "#fde68a", textAlign: "center", marginBottom: "6px" }}>
            Weather signal forecast
          </div>

          <div style={{ color: "#a8a29e", marginBottom: "8px", textAlign: "center" }}>
            Royal Navy convoy routing signal
          </div>

          <div style={{ lineHeight: 1.45 }}>
            <div>
              <span style={{ color: "#a8a29e" }}>Issued:</span>{" "}
              <span style={{ color: "#fde68a" }}>0900Z</span>
            </div>

            <div>
              <span style={{ color: "#a8a29e" }}>Valid:</span>{" "}
              <span>next 12 hours</span>
            </div>

            <div>
              <span style={{ color: "#a8a29e" }}>Confidence:</span>{" "}
              <span>moderate</span>
            </div>

            <div style={{ marginTop: "8px" }}>
              <span style={{ color: "#a8a29e" }}>Trend:</span>
            </div>

            <div style={{ marginTop: "2px", color: "#d6d3d1" }}>
              WSW 28–31 kn. Sea State 6. Rain squalls expected 1100–1300. Visibility 5–9 km. Low cloud and heavy Atlantic swell continuing.
            </div>

            <div style={{ marginTop: "8px" }}>
              <span style={{ color: "#a8a29e" }}>Next signal:</span>{" "}
              <span style={{ color: "#fde68a" }}>2100Z</span>
            </div>
          </div>
        </div>
      )}

      {adjustmentsVisible && (
        <>
          <div
            style={{
              marginTop: "8px",
              fontSize: "11px",
              color: "#d6d3d1",
            }}
          >
            Sea: {SEA_STATES[environment.seaIndex].label}
          </div>

          <select
            style={{
              marginTop: "6px",
              width: "100%",
              borderRadius: "10px",
              background: "#292524",
              color: "#f5f5f4",
              padding: "6px",
              fontSize: "11px",
            }}
            value={environment.seaIndex}
            onChange={(e) =>
              setEnvironment((env) => ({
                ...env,
                seaIndex: Number(e.target.value),
              }))
            }
          >
            {SEA_STATES.map((s, i) => (
              <option key={s.label} value={i}>
                {s.label} — {s.note}
              </option>
            ))}
          </select>

          <div
            style={{
              marginTop: "8px",
              fontSize: "11px",
              color: "#d6d3d1",
            }}
          >
            Wind direction: {environment.windDirDeg}°
          </div>

          <input
            style={{ marginTop: "6px", width: "100%" }}
            type="range"
            min="0"
            max="359"
            step="1"
            value={environment.windDirDeg}
            onChange={(e) =>
              setEnvironment((env) => ({
                ...env,
                windDirDeg: Number(e.target.value),
              }))
            }
          />

          <div
            style={{
              marginTop: "8px",
              fontSize: "11px",
              color: "#d6d3d1",
            }}
          >
            Wind speed: {environment.windKn} kn
          </div>

          <input
            style={{ marginTop: "6px", width: "100%" }}
            type="range"
            min="0"
            max="60"
            step="1"
            value={environment.windKn}
            onChange={(e) =>
              setEnvironment((env) => ({
                ...env,
                windKn: Number(e.target.value),
              }))
            }
          />

          <div
            style={{
              marginTop: "8px",
              fontSize: "11px",
              color: "#d6d3d1",
            }}
          >
            Cloud cover: {environment.cloudCoverOktas ?? 0}/8 oktas
          </div>

          <input
            style={{ marginTop: "6px", width: "100%" }}
            type="range"
            min="0"
            max="8"
            step="1"
            value={environment.cloudCoverOktas ?? 0}
            onChange={(e) =>
              setEnvironment((env) => ({
                ...env,
                cloudCoverOktas: Number(e.target.value),
              }))
            }
          />

          <div
            style={{
              marginTop: "8px",
              fontSize: "11px",
              color: "#d6d3d1",
            }}
          >
            Cloud base: {environment.cloudBaseM ?? 1800} m
          </div>

          <input
            style={{ marginTop: "6px", width: "100%" }}
            type="range"
            min="300"
            max="5000"
            step="100"
            value={environment.cloudBaseM ?? 1800}
            onChange={(e) =>
              setEnvironment((env) => ({
                ...env,
                cloudBaseM: Number(e.target.value),
              }))
            }
          />

          <div
            style={{
              marginTop: "8px",
              fontSize: "11px",
              color: "#d6d3d1",
            }}
          >
            Rain intensity: {Math.round((environment.rainIntensity ?? 0) * 100)}%
          </div>

          <input
            style={{ marginTop: "6px", width: "100%" }}
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={environment.rainIntensity ?? 0}
            onChange={(e) =>
              setEnvironment((env) => ({
                ...env,
                rainIntensity: Number(e.target.value),
              }))
            }
          />
        </>
      )}
    </div>
  );
}