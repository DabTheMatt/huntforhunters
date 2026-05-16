import { cloneElement, isValidElement, useEffect, useRef, useState } from "react";

const UI_SNAP_GRID_PX = 24;

export default function DraggablePanel({ children, style = {}, snapEnabled = true, width }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const dragStartRef = useRef(null);
  const panelRef = useRef(null);

  const isInteractiveTarget = (target) => {
    return Boolean(target.closest?.("button, input, select, textarea, option"));
  };

  const startDrag = (event) => {
    if (event.button !== 0 || isInteractiveTarget(event.target)) return;

    const rect = panelRef.current?.getBoundingClientRect();

    dragStartRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
      baseLeft: rect ? rect.left - offset.x : 0,
      baseTop: rect ? rect.top - offset.y : 0,
    };
    setDragging(true);
    event.preventDefault();
  };

  useEffect(() => {
    const onDrag = (event) => {
      if (!dragging || !dragStartRef.current) return;

      let x = dragStartRef.current.offsetX + (event.clientX - dragStartRef.current.pointerX);
      let y = dragStartRef.current.offsetY + (event.clientY - dragStartRef.current.pointerY);

      if (snapEnabled) {
        x = Math.round((dragStartRef.current.baseLeft + x) / UI_SNAP_GRID_PX) * UI_SNAP_GRID_PX - dragStartRef.current.baseLeft;
        y = Math.round((dragStartRef.current.baseTop + y) / UI_SNAP_GRID_PX) * UI_SNAP_GRID_PX - dragStartRef.current.baseTop;
      }

      setOffset({ x, y });
    };

    const stopDrag = () => {
      dragStartRef.current = null;
      setDragging(false);
    };

    window.addEventListener("mousemove", onDrag);
    window.addEventListener("mouseup", stopDrag);

    return () => {
      window.removeEventListener("mousemove", onDrag);
      window.removeEventListener("mouseup", stopDrag);
    };
  }, [dragging, snapEnabled]);

  const panelContent = isValidElement(children)
    ? cloneElement(children, { collapsed })
    : children;

  return (
    <>
      {dragging && snapEnabled && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2,
            pointerEvents: "none",
            backgroundColor: "rgba(0,0,0,0.04)",
            backgroundImage: `linear-gradient(rgba(253,230,138,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(253,230,138,0.18) 1px, transparent 1px)`,
            backgroundSize: `${UI_SNAP_GRID_PX}px ${UI_SNAP_GRID_PX}px`,
            backgroundPosition: "0 0",
          }}
        />
      )}

      <div
        ref={panelRef}
        onMouseDown={startDrag}
        style={{
          ...style,
          width: width ?? style.width,
          minWidth: width ?? style.width,
          maxWidth: width ?? style.width,
          transform: `translate(${offset.x}px, ${offset.y}px)`,
          cursor: dragging ? "grabbing" : "grab",
          userSelect: dragging ? "none" : "auto",
          outline: dragging && snapEnabled ? "1px dashed rgba(250,204,21,0.85)" : "none",
          outlineOffset: "0px",
          boxSizing: "border-box",
          position: style.position ?? "relative",
        }}
      >
        <button
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => setCollapsed((old) => !old)}
          title={collapsed ? "Expand panel" : "Collapse panel"}
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            width: "18px",
            height: "18px",
            zIndex: 100,
            border: "1px solid rgba(253,230,138,0.24)",
            borderRadius: "50%",
            background: "rgba(28,25,23,0.86)",
            color: "#fde68a",
            cursor: "pointer",
            fontSize: "12px",
            lineHeight: "16px",
            padding: 0,
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {collapsed ? "+" : "−"}
        </button>
        {panelContent}
      </div>
    </>
  );
}