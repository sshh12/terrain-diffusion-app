import React, { useEffect, useState, useRef } from "react";

const canvasTypes = ["grid", "map", "drawing", "interface"];

const drawGrid = (ctx, transform) => {
  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.scale, transform.scale);
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

const drawMap = (ctx, transform, canvas) => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.scale, transform.scale);
  ctx.drawImage(canvas, 0, 0, 512, 512);
  ctx.restore();
};

const drawInter = (ctx, transform) => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.beginPath();
  ctx.strokeStyle = "#00ff00";
  ctx.lineWidth = 10 * transform.scale;
  const size = 512 * transform.scale;
  ctx.rect(
    (window.innerWidth - size) / 2,
    (window.innerHeight - size) / 2,
    size,
    size
  );
  ctx.stroke();
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
  const globalTransform = useRef({ scale: 0.5, x: 0, y: 0 });
  const images = useRef({});

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
    const actualTransform = {
      x: transform.x + globalTransform.current.x,
      y: transform.y + globalTransform.current.y,
      scale: globalTransform.current.scale,
    };

    const gridCtx = ctxRef.current.grid;
    gridCtx.clearRect(0, 0, gridCtx.canvas.width, gridCtx.canvas.height);
    drawGrid(gridCtx, actualTransform);

    const interCtx = ctxRef.current.interface;
    drawInter(interCtx, actualTransform);

    const mapCtx = ctxRef.current.map;
    drawMap(mapCtx, actualTransform, canvasRef.current.map.offscreenCanvas);
  };

  useEffect(() => {
    updateCanvasSize();
    draw({ x: 0, y: 0 });
    const onImageLoaded = (img) => {
      canvasRef.current.map.offscreenCanvas
        .getContext("2d")
        .drawImage(img, 0, 0);
      draw({ x: 0, y: 0 });
    };
    images.current["map"] = new Image();
    images.current["map"].width = 512;
    images.current["map"].height = 512;
    images.current["map"].addEventListener(
      "load",
      () => {
        onImageLoaded(images.current["map"]);
      },
      false
    );
    images.current["map"].src = "https://picsum.photos/512";
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
      globalTransform.current = {
        x: globalTransform.current.x + touchDiff.x,
        y: globalTransform.current.y + touchDiff.y,
        scale: globalTransform.current.scale,
      };
      touchStart.current = null;
      draw({ x: 0, y: 0 });
    }
  };

  const onScroll = (e) => {
    globalTransform.current.scale = Math.max(
      Math.min(globalTransform.current.scale + e.deltaY * -0.0005, 4.0),
      0.15
    );
    draw({ x: 0, y: 0 });
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
        const isMap = name === "map";
        return (
          <canvas
            className={`canvas-${name}`}
            key={name}
            ref={(canvas) => {
              if (canvas) {
                canvasRef.current[name] = canvas;
                ctxRef.current[name] = canvas.getContext("2d");
                if (isInterface) {
                  canvasRef.current[name].addEventListener(
                    "wheel",
                    (e) => onScroll(e),
                    { passive: true }
                  );
                }
                if (isMap) {
                  canvasRef.current[name].offscreenCanvas =
                    document.createElement("canvas");
                }
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
