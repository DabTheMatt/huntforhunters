

export default function MapLayersPanel({
  environment,
  setEnvironment,
  vectorsVisible,
  setVectorsVisible,
  visualRangeVisible,
  setVisualRangeVisible,
  mapTheme,
  setMapTheme,
  uiSnapEnabled,
  setUiSnapEnabled,
  AutoPanel,
  labelStyle,
  buttonStyle,
  activeButtonStyle,
}) {
  return (
    <AutoPanel minHeight={216}>
      <div style={labelStyle}>Map Layers</div>

      <button
        style={{ ...(environment.cloudsVisible ? activeButtonStyle : buttonStyle), marginTop: "8px", width: "100%" }}
        onClick={() => setEnvironment((env) => ({ ...env, cloudsVisible: !env.cloudsVisible }))}
      >
        Clouds {environment.cloudsVisible ? "ON" : "OFF"}
      </button>

      <button
        style={{ ...(environment.wavesVisible ? activeButtonStyle : buttonStyle), marginTop: "8px", width: "100%" }}
        onClick={() => setEnvironment((env) => ({ ...env, wavesVisible: !env.wavesVisible }))}
      >
        Waves {environment.wavesVisible ? "ON" : "OFF"}
      </button>

      <button
        style={{ ...(vectorsVisible ? activeButtonStyle : buttonStyle), marginTop: "8px", width: "100%" }}
        onClick={() => setVectorsVisible((v) => !v)}
      >
        Vectors {vectorsVisible ? "ON" : "OFF"}
      </button>

      <button
        style={{ ...(visualRangeVisible ? activeButtonStyle : buttonStyle), marginTop: "8px", width: "100%" }}
        onClick={() => setVisualRangeVisible((v) => !v)}
      >
        Visual range {visualRangeVisible ? "ON" : "OFF"}
      </button>

      <button
        style={{ ...(mapTheme === "atlantic" ? activeButtonStyle : buttonStyle), marginTop: "8px", width: "100%" }}
        onClick={() => setMapTheme((theme) => (theme === "chart" ? "atlantic" : "chart"))}
      >
        Theme: {mapTheme === "atlantic" ? "Atlantic" : "Chart"}
      </button>

      <button
        style={{ ...(uiSnapEnabled ? activeButtonStyle : buttonStyle), marginTop: "8px", width: "100%" }}
        onClick={() => setUiSnapEnabled((enabled) => !enabled)}
      >
        UI snap {uiSnapEnabled ? "ON" : "OFF"}
      </button>
    </AutoPanel>
  );
}