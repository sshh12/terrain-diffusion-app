import React, { useEffect, useState, useRef } from "react";

const CANVAS_TYPES = ["grid", "map", "drawing", "interface"];

function logZoomSpace(start, end, num) {
  const logStart = Math.log(start);
  const logEnd = Math.log(end);
  const step = (logEnd - logStart) / (num - 1);
  let values = [];

  for (let i = 0; i < num; i++) {
    const value = Math.exp(logStart + step * i);
    values.push(Math.round(value * 100000) / 100000);
  }

  if (!values.includes(0.5)) {
    values.push(0.5);
  }

  values.sort((a, b) => a - b);

  return values;
}

function indexOfClosest(array, value) {
  let closest = Infinity;
  let index = 0;

  for (let i = 0; i < array.length; i++) {
    const diff = Math.abs(array[i] - value);

    if (diff < closest) {
      closest = diff;
      index = i;
    }
  }

  return index;
}

const ZOOM_SCALES = logZoomSpace(0.01, 2, 40);

const getViewPort = (transform) => {
  const minX = -transform.x / transform.scale;
  const minY = -transform.y / transform.scale;
  const maxX = (-transform.x + window.innerWidth) / transform.scale;
  const maxY = (-transform.y + window.innerHeight) / transform.scale;
  return { minX, minY, maxX, maxY };
};

const drawGrid = (ctx, transform) => {
  ctx.fillStyle = "#080808";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.scale, transform.scale);

  const gridSpace = 64;

  let { minX, minY, maxX, maxY } = getViewPort(transform);
  minX = Math.floor(minX / gridSpace) * gridSpace;
  minY = Math.floor(minY / gridSpace) * gridSpace;

  ctx.beginPath();
  ctx.setLineDash([5, 1]);
  ctx.setLineDash([]);
  ctx.strokeStyle = "#eee";
  ctx.lineWidth = 0.5;

  for (let i = minX; i < maxX; i += gridSpace) {
    ctx.moveTo(i, minY);
    ctx.lineTo(i, maxY);
  }
  ctx.stroke();

  for (let i = minY; i < maxY; i += gridSpace) {
    ctx.moveTo(minX, i);
    ctx.lineTo(maxX, i);
  }
  ctx.stroke();
  ctx.restore();
};

const drawMap = (ctx, transform, tiles, tileLoads) => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.scale, transform.scale);
  for (let tileName in tiles) {
    const [tileRow, tileCol] = tileName.split("_");
    if (
      inViewPort(
        {
          x: tileCol * 512,
          y: tileRow * 512,
          x2: tileCol * 512 + 512,
          y2: tileRow * 512 + 512,
        },
        transform
      )
    ) {
      ctx.drawImage(tiles[tileName], tileCol * 512, tileRow * 512, 512, 512);
    }
  }
  for (let tileLoad of tileLoads) {
    ctx.beginPath();
    ctx.fillStyle = `rgba(200, 200, 200, ${
      ((Date.now() % 3500) + 100) / 3600
    })`;
    ctx.rect(tileLoad.x, tileLoad.y, 512, 512);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = "#111";
    ctx.font = "30px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`Generating...`, tileLoad.x + 256, tileLoad.y + 80);
    ctx.fillText(`(up to 30s)`, tileLoad.x + 256, tileLoad.y + 120);
    ctx.fillText(`"${tileLoad.caption}"`, tileLoad.x + 256, tileLoad.y + 256);
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
  const { x: offsetX, y: offsetY, size } = getEditPortDimensions(transform);

  ctx.beginPath();
  ctx.strokeStyle = "#eee";
  ctx.lineWidth = 10;
  ctx.rect(offsetX, offsetY, size, size);
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = "#ccc";
  ctx.lineWidth = 10;
  ctx.rect(offsetX - 2, offsetY - 2, size + 4, size + 4);
  ctx.stroke();

  // draw text that says "loading"
  ctx.beginPath();
  ctx.fillStyle = "#fff";
  ctx.font = "30px Arial";
  ctx.textAlign = "center";
  ctx.fillText(
    `${Math.floor(offsetX)}, ${Math.floor(offsetY)}`,
    offsetX + size / 2,
    offsetY + size + 50,
    size,
    size
  );

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

const inViewPort = ({ x, y, x2, y2 }, transform) => {
  const { minX, minY, maxX, maxY } = getViewPort(transform);
  const isAnyCornerInViewPort =
    (x >= minX && x <= maxX && y >= minY && y <= maxY) || // Top-left corner
    (x2 >= minX && x2 <= maxX && y >= minY && y <= maxY) || // Top-right corner
    (x >= minX && x <= maxX && y2 >= minY && y2 <= maxY) || // Bottom-left corner
    (x2 >= minX && x2 <= maxX && y2 >= minY && y2 <= maxY); // Bottom-right corner

  const isAnyViewPortCornerInRect =
    (minX >= x && minX <= x2 && minY >= y && minY <= y2) || // Top-left corner
    (maxX >= x && maxX <= x2 && minY >= y && minY <= y2) || // Top-right corner
    (minX >= x && minX <= x2 && maxY >= y && maxY <= y2) || // Bottom-left corner
    (maxX >= x && maxX <= x2 && maxY >= y && maxY <= y2); // Bottom-right corner

  return isAnyCornerInViewPort || isAnyViewPortCornerInRect;
};

const loadTile = (tileKey, tiles, draw) => {
  const tileURL = `https://terrain-diffusion-app.s3.amazonaws.com/public/tiles/${
    window.space
  }/${tileKey}.png?${+Date.now()}`;
  const image = new Image();
  image.width = 512;
  image.height = 512;
  const offscreen = new OffscreenCanvas(512, 512);
  tiles[tileKey] = offscreen;
  image.addEventListener(
    "load",
    () => {
      const ctx = tiles[tileKey].getContext("2d");
      ctx.clearRect(0, 0, 512, 512);
      ctx.drawImage(image, 0, 0);
      draw();
    },
    false
  );
  // draw blue place holder
  const ctx = tiles[tileKey].getContext("2d");
  ctx.fillStyle = "#11111";
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = "#eee";
  ctx.font = "30px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`Loading...`, 256, 256);
  image.src = tileURL;
};

function MapCanvas({
  renderTile,
  clearTiles,
  space,
  startZoom = 0.5,
  startX = 0,
  startY = 0,
}) {
  const [canvasSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const canvasRef = useRef({});
  const ctxRef = useRef({});
  const knownTilesLoadedRef = useRef({});
  const touchStart = useRef(null);
  const touchTwoStart = useRef(null);
  const globalTransform = useRef({
    scale: startZoom,
    x: startX,
    y: startY,
    touchDiff: { x: 0, y: 0 },
    touchScale: 1.0,
  });
  const tileRef = useRef({});
  const tileLoadRef = useRef([]);

  const updateCanvasSize = () => {
    for (let canvasType of CANVAS_TYPES) {
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
      scale: globalTransform.current.scale * globalTransform.current.touchScale,
    };

    if (globalTransform.current.touchScale !== 1.0) {
      const oldScale = globalTransform.current.scale;
      const newScale = actualTransform.scale;
      actualTransform.x =
        (-actualTransform.x / oldScale +
          window.innerWidth / oldScale / 2 -
          window.innerWidth / newScale / 2) *
        -newScale;
      actualTransform.y =
        (-actualTransform.y / oldScale +
          window.innerHeight / oldScale / 2 -
          window.innerHeight / newScale / 2) *
        -newScale;
    }

    actualTransform.x = Math.round(actualTransform.x);
    actualTransform.y = Math.round(actualTransform.y);

    const gridCtx = ctxRef.current.grid;
    gridCtx.clearRect(0, 0, gridCtx.canvas.width, gridCtx.canvas.height);
    drawGrid(gridCtx, actualTransform);

    const interCtx = ctxRef.current.interface;
    drawInter(interCtx, actualTransform);

    for (let tileKey in knownTilesLoadedRef.current) {
      const [tileRow, tileCol] = tileKey.split("_");
      if (!knownTilesLoadedRef.current[tileKey]) {
        if (
          inViewPort(
            {
              x: tileCol * 512,
              y: tileRow * 512,
              x2: tileCol * 512 + 512,
              y2: tileRow * 512 + 512,
            },
            actualTransform
          )
        ) {
          console.log("Loading tile image", tileKey);
          loadTile(tileKey, tileRef.current, window.draw);
          knownTilesLoadedRef.current[tileKey] = true;
        }
      }
    }

    const mapCtx = ctxRef.current.map;
    drawMap(mapCtx, actualTransform, tileRef.current, tileLoadRef.current);

    localStorage.setItem("position", JSON.stringify(actualTransform));
  };
  // DIRTY HACKS
  window.draw = draw;
  window.space = space;

  useEffect(() => {
    const interval = setInterval(() => {
      window.draw();
    }, 100);
    return () => clearInterval(interval);
  }, []);

  window.onGenerate = (caption, id) => {
    const location = getEditPortDimensions(globalTransform.current);
    renderTile(location, caption, id);
    tileLoadRef.current.push({ id: id, caption: caption, ...location });
    draw();
  };

  window.lastZoom = null;
  window.zoom = (amt) => {
    // weird super scrolling bug
    if (window.lastZoom && Date.now() - window.lastZoom < 50) {
      return;
    }
    const oldScale = globalTransform.current.scale;
    const newScaleIndex = Math.max(
      Math.min(
        indexOfClosest(ZOOM_SCALES, oldScale) + amt,
        ZOOM_SCALES.length - 1
      ),
      0
    );
    const newScale = ZOOM_SCALES[newScaleIndex];

    globalTransform.current.scale = newScale;
    globalTransform.current.x =
      (-globalTransform.current.x / oldScale +
        window.innerWidth / oldScale / 2 -
        window.innerWidth / newScale / 2) *
      -newScale;
    globalTransform.current.y =
      (-globalTransform.current.y / oldScale +
        window.innerHeight / oldScale / 2 -
        window.innerHeight / newScale / 2) *
      -newScale;
    window.lastZoom = Date.now();
    draw();
  };

  useEffect(() => {
    updateCanvasSize();
    draw();
    window.addEventListener("resize", (event) => {
      updateCanvasSize();
      draw();
    });
    window.onUpdateTiles = (tiles, id) => {
      console.log("Updating tiles", tiles, id);
      if (id) {
        tileLoadRef.current = tileLoadRef.current.filter(
          (tile) => tile.id !== id
        );
      }
      for (let tile of tiles) {
        const tileKey = `${tile[0]}_${tile[1]}`;
        knownTilesLoadedRef.current[tileKey] = false;
      }
      draw();
    };
  }, []);

  const onAuxClick = (e) => {
    const location = getEditPortDimensions(globalTransform.current);
    clearTiles(location);
  };

  const onTouchStart = (e) => {
    if (!e.touches || e.touches.length === 1) {
      touchStart.current = clientPointFromEvent(e);
    }
    if (e.touches && e.touches.length >= 2) {
      touchTwoStart.current = {
        t1: clientPointFromEvent(e.touches[0]),
        t2: clientPointFromEvent(e.touches[1]),
      };
      touchStart.current = null;
    }
  };

  const onTouchMove = (e) => {
    if (touchStart.current) {
      const point = clientPointFromEvent(e);
      globalTransform.current.touchDiff = {
        x: point.x - touchStart.current.x,
        y: point.y - touchStart.current.y,
      };
    }
    if (touchTwoStart.current && e.touches && e.touches.length >= 2) {
      const prev = touchTwoStart.current;
      const cur = {
        t1: clientPointFromEvent(e.touches[0]),
        t2: clientPointFromEvent(e.touches[1]),
      };
      const pdx = prev.t1.x - prev.t2.x;
      const pdy = prev.t1.y - prev.t2.y;
      const dx = cur.t1.x - cur.t2.x;
      const dy = cur.t1.y - cur.t2.y;
      const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
      const dist = Math.sqrt(dx * dx + dy * dy);
      globalTransform.current.touchScale = dist / pdist;
    }
    draw();
  };

  const onTouchEnd = (e) => {
    const point = clientPointFromEvent(e);
    if (touchStart.current) {
      const touchDiff = {
        x: point.x - touchStart.current.x,
        y: point.y - touchStart.current.y,
      };
      globalTransform.current.x = globalTransform.current.x + touchDiff.x;
      globalTransform.current.y = globalTransform.current.y + touchDiff.y;
      globalTransform.current.touchDiff = { x: 0, y: 0 };
      touchStart.current = null;
    }
    if (touchTwoStart.current) {
      const oldScale = globalTransform.current.scale;
      const newScale =
        globalTransform.current.scale * globalTransform.current.touchScale;
      globalTransform.current.scale = newScale;
      globalTransform.current.touchScale = 1.0;
      globalTransform.current.x =
        (-globalTransform.current.x / oldScale +
          window.innerWidth / oldScale / 2 -
          window.innerWidth / newScale / 2) *
        -newScale;
      globalTransform.current.y =
        (-globalTransform.current.y / oldScale +
          window.innerHeight / oldScale / 2 -
          window.innerHeight / newScale / 2) *
        -newScale;
      touchTwoStart.current = null;
    }
    draw();
  };

  const onScroll = (e) => {
    window.zoom(e.deltaY > 0 ? -1 : 1);
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
      {CANVAS_TYPES.map((name) => {
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
                  canvasRef.current[name].addEventListener("auxclick", (e) => {
                    if (e.button === 1) {
                      onAuxClick(e);
                    }
                  });
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
