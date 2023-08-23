import React, { useEffect, useState, useRef } from "react";

const canvasTypes = ["grid", "drawing", "interface"];

const drawGrid = (ctx, transform) => {
  ctx.save();
  ctx.translate(transform.x, transform.y);
  const gridSize = 100;
  const [viewMin, viewMax] = [
    { x: -10000, y: -10000 },
    { x: 10000, y: 10000 },
  ];
  const minx = Math.floor(viewMin.x / gridSize - 1) * gridSize;
  const miny = Math.floor(viewMin.y / gridSize - 1) * gridSize;
  const maxx = viewMax.x + gridSize;
  const maxy = viewMax.y + gridSize;

  ctx.beginPath();
  ctx.setLineDash([5, 1]);
  ctx.setLineDash([]);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 0.5;

  let countX = minx;
  const gridSizeX = 100;
  while (countX < maxx) {
    countX += gridSizeX;
    ctx.moveTo(countX, miny);
    ctx.lineTo(countX, maxy);
  }
  ctx.stroke();

  let countY = miny;
  const gridSizeY = 100;
  while (countY < maxy) {
    countY += gridSizeY;
    ctx.moveTo(minx, countY);
    ctx.lineTo(maxx, countY);
  }
  ctx.stroke();
  ctx.restore();
};

const clientPointFromEvent = (e) => {
  // use cursor pos as default
  let clientX = e.clientX;
  let clientY = e.clientY;

  // use first touch if available
  if (e.changedTouches && e.changedTouches.length > 0) {
    clientX = e.changedTouches[0].clientX;
    clientY = e.changedTouches[0].clientY;
  }

  return { x: clientX, y: clientY };
};

function MapCanvas() {
  const [canvasSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const canvasRef = useRef({});
  const ctxRef = useRef({});
  const touchStart = useRef(null);
  const panPos = useRef({ x: 0, y: 0 });

  const updateCanvasSize = () => {
    for (let canvasType of canvasTypes) {
      const canvas = canvasRef.current[canvasType];
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.style.width = window.innerWidth;
        canvas.style.height = window.innerHeight;
      }
    }
  };

  const draw = (transform) => {
    const ctx = ctxRef.current.grid;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const actualTransform = {
      x: transform.x + panPos.current.x,
      y: transform.y + panPos.current.y,
    };
    ctx.beginPath();
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 10;
    ctx.rect(0, 0, 100, 100);
    ctx.stroke();
    drawGrid(ctx, actualTransform);
  };

  useEffect(() => {
    updateCanvasSize();
    draw({ x: 0, y: 0 });
  }, []);

  const onTouchStart = (e) => {
    touchStart.current = clientPointFromEvent(e);
  };

  const onTouchMove = (e) => {
    if (!touchStart.current) return;
    const point = clientPointFromEvent(e);
    const touchDiff = {
      x: point.x - touchStart.current.x,
      y: point.y - touchStart.current.y,
    };
    draw(touchDiff);
  };

  const onTouchEnd = (e) => {
    const point = clientPointFromEvent(e);
    if (touchStart.current) {
      const touchDiff = {
        x: point.x - touchStart.current.x,
        y: point.y - touchStart.current.y,
      };
      panPos.current = {
        x: panPos.current.x + touchDiff.x,
        y: panPos.current.y + touchDiff.y,
      };
      touchStart.current = null;
      draw({ x: 0, y: 0 });
    }
  };

  return (
    <div
      className={"canvas-container"}
      style={{
        display: "block",
        background: "#fff",
        touchAction: "none",
        width: canvasSize.width,
        height: canvasSize.height,
      }}
    >
      {canvasTypes.map((name) => {
        const isInterface = name === "interface";
        return (
          <canvas
            className={`canvas-${name}`}
            key={name}
            ref={(canvas) => {
              if (canvas) {
                canvasRef.current[name] = canvas;
                ctxRef.current[name] = canvas.getContext("2d");
              }
            }}
            style={{
              display: "block",
              position: "absolute",
            }}
            onMouseDown={isInterface ? onTouchStart : undefined}
            onMouseMove={isInterface ? onTouchMove : undefined}
            onMouseUp={isInterface ? onTouchEnd : undefined}
            onMouseOut={isInterface ? onTouchEnd : undefined}
            onTouchStart={isInterface ? onTouchStart : undefined}
            onTouchMove={isInterface ? onTouchMove : undefined}
            onTouchEnd={isInterface ? onTouchEnd : undefined}
            onTouchCancel={isInterface ? onTouchEnd : undefined}
          />
        );
      })}
    </div>
  );
}

export default MapCanvas;
