export default function MapLayersPanel({
  environment,
  setEnvironment,
  vectorsVisible,
  setVectorsVisible,
  visualRangeVisible,
  setVisualRangeVisible,
  mapInfoVisible,
  setMapInfoVisible,
  mapTheme,
  setMapTheme,
  uiSnapEnabled,
  setUiSnapEnabled,
  legendVisible,
  setLegendVisible,
  AutoPanel,
  labelStyle,
  buttonStyle,
  activeButtonStyle,
}) {
  return (
    <AutoPanel minHeight={220}>

      <button
        style={{ ...(environment.cloudsVisible ? activeButtonStyle : buttonStyle), marginTop: "6px", width: "100%", fontSize: "10px", padding: "4px 4px" }}
        onClick={() => setEnvironment((env) => ({ ...env, cloudsVisible: !env.cloudsVisible }))}
      >
        Clouds {environment.cloudsVisible ? "ON" : "OFF"}
      </button>

      <button
        style={{ ...(environment.wavesVisible ? activeButtonStyle : buttonStyle), marginTop: "6px", width: "100%", fontSize: "10px", padding: "4px 4px" }}
        onClick={() => setEnvironment((env) => ({ ...env, wavesVisible: !env.wavesVisible }))}
      >
        Waves {environment.wavesVisible ? "ON" : "OFF"}
      </button>

      <button
        style={{ ...(vectorsVisible ? activeButtonStyle : buttonStyle), marginTop: "6px", width: "100%", fontSize: "10px", padding: "4px 4px" }}
        onClick={() => setVectorsVisible((v) => !v)}
      >
        Vectors {vectorsVisible ? "ON" : "OFF"}
      </button>

      <button
        style={{ ...(visualRangeVisible ? activeButtonStyle : buttonStyle), marginTop: "6px", width: "100%", fontSize: "10px", padding: "4px 4px" }}
        onClick={() => setVisualRangeVisible((v) => !v)}
      >
        Visual range {visualRangeVisible ? "ON" : "OFF"}
      </button>

      <button
        style={{ ...(mapInfoVisible ? activeButtonStyle : buttonStyle), marginTop: "6px", width: "100%", fontSize: "10px", padding: "4px 4px" }}
        onClick={() => setMapInfoVisible((visible) => !visible)}
      >
        Map info {mapInfoVisible ? "ON" : "OFF"}
      </button>

      <button
        style={{ ...(legendVisible ? activeButtonStyle : buttonStyle), marginTop: "6px", width: "100%", fontSize: "10px", padding: "4px 4px" }}
        onClick={() => setLegendVisible((visible) => !visible)}
      >
        Legend {legendVisible ? "ON" : "OFF"}
      </button>

      <button
        style={{ ...(mapTheme === "atlantic" ? activeButtonStyle : buttonStyle), marginTop: "6px", width: "100%", fontSize: "10px", padding: "4px 4px" }}
        onClick={() => setMapTheme((theme) => (theme === "chart" ? "atlantic" : "chart"))}
      >
        Theme: {mapTheme === "atlantic" ? "Atlantic" : "Chart"}
      </button>

      <button
        style={{ ...(uiSnapEnabled ? activeButtonStyle : buttonStyle), marginTop: "6px", width: "100%", fontSize: "10px", padding: "4px 4px" }}
        onClick={() => setUiSnapEnabled((enabled) => !enabled)}
      >
        UI snap {uiSnapEnabled ? "ON" : "OFF"}
      </button>
    </AutoPanel>
  );
}