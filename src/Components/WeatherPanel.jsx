

export default function WeatherPanel({
  environment,
  setEnvironment,
  AutoPanel,
  labelStyle,
  StatusBox,
  SEA_STATES,
}) {
  return (
    <AutoPanel minHeight={216}>
      <div style={labelStyle}>Weather</div>

      <div
        style={{
          marginTop: "8px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "5px",
        }}
      >
        <StatusBox
          label="Wind"
          value={`${environment.windDirDeg}° ${environment.windKn} kn`}
        />

        <StatusBox
          label="Cloud"
          value={`${environment.cloudCoverOktas ?? 0}/8`}
        />

        <StatusBox
          label="Base"
          value={`${environment.cloudBaseM ?? 1800} m`}
        />

        <StatusBox
          label="Sea"
          value={
            SEA_STATES[environment.seaIndex].label
              .split(" ")
              .slice(1)
              .join(" ")
          }
        />
      </div>

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
    </AutoPanel>
  );
}