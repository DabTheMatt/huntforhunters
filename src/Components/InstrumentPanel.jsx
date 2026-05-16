

import CompassPanel from "./CompassPanel";
import DraggablePanel from "./DraggablePanel";

export default function InstrumentPanel({
  ship,
  environment,
  orderedCourseDeg,
  courseKeepingEnabled,
  DEG,
  panelStyle,
  labelStyle,
  buttonStyle,
  bearingLabel,
  formatTime,
  uiSnapEnabled,
}) {
  return (
    <DraggablePanel
      snapEnabled={uiSnapEnabled}
      style={{ position: "fixed", right: "240px", top: "240px", zIndex: 3, width: "240px" }}
    >
      <CompassPanel
        ship={ship}
        environment={environment}
        orderedCourseDeg={orderedCourseDeg}
        courseKeepingEnabled={courseKeepingEnabled}
        DEG={DEG}
        panelStyle={panelStyle}
        labelStyle={labelStyle}
        buttonStyle={buttonStyle}
        bearingLabel={bearingLabel}
        formatTime={formatTime}
      />
    </DraggablePanel>
  );
}