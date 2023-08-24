import React, { useEffect, useState, useRef } from "react";

const canvasTypes = ["grid", "map", "drawing", "interface"];

const drawGrid = (ctx, transform) => {
  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.scale, transform.scale);
  const gridSize = 1000;
  const gridSpace = 64;

  ctx.beginPath();
  ctx.setLineDash([5, 1]);
  ctx.setLineDash([]);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 0.5;

  for (let i = 0; i < gridSize * gridSpace; i += gridSpace) {
    ctx.moveTo(i, 0);
    ctx.lineTo(i, gridSize * gridSpace);
  }
  ctx.stroke();

  for (let i = 0; i < gridSize * gridSpace; i += gridSpace) {
    ctx.moveTo(0, i);
    ctx.lineTo(gridSize * gridSpace, i);
  }
  ctx.stroke();
  ctx.restore();
};

const drawMap = (ctx, transform, tiles) => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.scale, transform.scale);
  for (let tileName in tiles) {
    const [tileRow, tileCol] = tileName.split("_");
    ctx.drawImage(
      tiles[tileName],
      parseInt(tileCol) * 512,
      parseInt(tileRow) * 512,
      512,
      512
    );
  }
  ctx.restore();
};

const getEditPortDimensions = (transform) => {
  const size = 512;
  const offsetX =
    -transform.x / transform.scale +
    (window.innerWidth / transform.scale - size) / 2;
  const offsetY =
    -transform.y / transform.scale +
    (window.innerHeight / transform.scale - size) / 2;
  return { x: Math.floor(offsetX), y: Math.floor(offsetY), size };
};

const drawInter = (ctx, transform) => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.scale, transform.scale);
  ctx.beginPath();
  ctx.strokeStyle = "#00ff00";
  ctx.lineWidth = 10;
  const { x: offsetX, y: offsetY, size } = getEditPortDimensions(transform);
  ctx.rect(offsetX, offsetY, size, size);
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

function MapCanvas({ renderTile }) {
  const [canvasSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const canvasRef = useRef({});
  const ctxRef = useRef({});
  const touchStart = useRef(null);
  const globalTransform = useRef({
    scale: 1,
    x: 0,
    y: 0,
    touchDiff: { x: 0, y: 0 },
  });
  const tileRef = useRef({});

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

  const draw = () => {
    const actualTransform = {
      x: globalTransform.current.x + globalTransform.current.touchDiff.x,
      y: globalTransform.current.y + globalTransform.current.touchDiff.y,
      scale: globalTransform.current.scale,
    };

    const gridCtx = ctxRef.current.grid;
    gridCtx.clearRect(0, 0, gridCtx.canvas.width, gridCtx.canvas.height);
    drawGrid(gridCtx, actualTransform);

    const interCtx = ctxRef.current.interface;
    drawInter(interCtx, actualTransform);

    const mapCtx = ctxRef.current.map;
    drawMap(mapCtx, actualTransform, tileRef.current);
  };

  window.onGenerate = () => {
    renderTile(getEditPortDimensions(globalTransform.current));
  };

  useEffect(() => {
    updateCanvasSize();
    draw();
    const onImageLoaded = (img, tileRow, tileCol) => {
      const offscreen = new OffscreenCanvas(512, 512);
      tileRef.current[`${tileRow}_${tileCol}`] = offscreen;
      offscreen.getContext("2d").drawImage(img, 0, 0);
      draw();
    };
    window.addEventListener("resize", (event) => {
      updateCanvasSize();
      draw();
    });
    window.onUpdateTiles = (tiles) => {
      console.log("Updating tiles", tiles);
      for (let tile of tiles) {
        const tileURL = `https://terrain-diffusion-app.s3.amazonaws.com/public/tiles/global/${
          tile[0]
        }_${tile[1]}.png?${+Date.now()}`;
        const image = new Image();
        image.width = 512;
        image.height = 512;
        image.addEventListener(
          "load",
          () => {
            onImageLoaded(image, tile[0], tile[1]);
          },
          false
        );
        image.src = tileURL;
      }
    };
  }, []);

  const onTouchStart = (e) => {
    touchStart.current = clientPointFromEvent(e);
  };

  const onTouchMove = (e) => {
    if (!touchStart.current) return;
    const point = clientPointFromEvent(e);
    globalTransform.current.touchDiff = {
      x: point.x - touchStart.current.x,
      y: point.y - touchStart.current.y,
    };
    draw();
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
        touchDiff: { x: 0, y: 0 },
      };
      touchStart.current = null;
      draw();
    }
  };

  const onScroll = (e) => {
    const oldScale = globalTransform.current.scale;
    const newScale = Math.max(
      Math.min(oldScale + e.deltaY * -0.0005, 4.0),
      0.15
    );
    globalTransform.current.scale = newScale;
    const scaleDifference = newScale - oldScale;
    globalTransform.current.x -= globalTransform.current.x * scaleDifference;
    globalTransform.current.y -= globalTransform.current.y * scaleDifference;
    draw();
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
