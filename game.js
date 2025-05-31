import { localize } from "./localization.js";
import { drawDebugGrid } from "./ui.js";

import {
  getTerrainTypes,
  getShowGrid,
  setShowGrid,
  mainGridObject,
  getScrollUpFlag,
  getScrollDownFlag,
  setZoomLevel,
  getLevelWidth,
  getLevelHeight,
  getBackgroundLoaded,
  getBackgroundImage,
  loadBackgroundImage,
  SCROLL_SPEED,
  LEVEL_WIDTH,
  getCameraX,
  getCameraY,
  setCameraX,
  setCameraY,
  getScrollLeftFlag,
  getScrollRightFlag,
  getZoomLevel,
  getCanvasHeight,
  getCanvasWidth,
  setGameStateVariable,
  getPlayerObject,
  getMenuState,
  getGameVisiblePaused,
  getGameVisibleActive,
  getElements,
  getLanguage,
  getGameInProgress,
  getHoveredCell,
} from "./constantsAndGlobalVars.js";

//--------------------------------------------------------------------------------------------------------

export async function startGame() {
  const canvas = getElements().canvas;
  const ctx = canvas.getContext("2d");
  const container = getElements().canvasContainer;

  const internalWidth = getCanvasWidth();
  const internalHeight = getCanvasHeight();

  canvas.width = internalWidth;
  canvas.height = internalHeight;

  await updateCanvasSize(container, internalWidth, internalHeight, canvas, ctx);
  window.addEventListener("resize", () => {
    updateCanvasSize(container, internalWidth, internalHeight, canvas, ctx);
  });

  setCameraX((LEVEL_WIDTH - canvas.width) / 2);
  setCameraY(0);
  setZoomLevel(0);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  generateWorldMap(ctx, {
    landArea: 15,
    numberOfContinents: 3,
    numberOfIslands: 15,
    temperature: 15,
  });

  gameLoop();
}

export function gameLoop() {
  updateCamera();

  const ctx = getElements().canvas.getContext("2d");
  const canvas = getElements().canvas;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground(ctx);
  drawDebugGrid(ctx);
  requestAnimationFrame(gameLoop);
}

async function updateCanvasSize(
  container,
  internalWidth,
  internalHeight,
  canvas,
  ctx
) {
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;

  const scaleX = containerWidth / internalWidth;
  const scaleY = containerHeight / internalHeight;
  const scale = Math.min(scaleX, scaleY);

  const visibleWidth = internalWidth * scale;
  const visibleHeight = internalHeight * scale;

  canvas.style.width = `${visibleWidth}px`;
  canvas.style.height = `${visibleHeight}px`;

  ctx.setTransform(1, 0, 0, 1, 0, 0);

  console.log("Canvas internal size:", canvas.width, "x", canvas.height);
  console.log(
    "Canvas visible size:",
    canvas.offsetWidth,
    "x",
    canvas.offsetHeight
  );
  console.log("Canvas scale factor:", scale.toFixed(3));
}

export function updateCamera() {
  let newCameraX = getCameraX();
  let newCameraY = getCameraY();

  if (getScrollLeftFlag()) {
    newCameraX -= SCROLL_SPEED;
  }
  if (getScrollRightFlag()) {
    newCameraX += SCROLL_SPEED;
  }
  if (getScrollUpFlag()) {
    newCameraY -= SCROLL_SPEED;
  }
  if (getScrollDownFlag()) {
    newCameraY += SCROLL_SPEED;
  }

  const LEVEL_WIDTH = getLevelWidth();
  newCameraX = ((newCameraX % LEVEL_WIDTH) + LEVEL_WIDTH) % LEVEL_WIDTH;

  const zoomLevel = getZoomLevel();
  const { viewHeight } = getViewWindow(zoomLevel);
  const LEVEL_HEIGHT = getLevelHeight();
  newCameraY = clamp(newCameraY, 0, LEVEL_HEIGHT - viewHeight);

  setCameraX(newCameraX);
  setCameraY(newCameraY);
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function getViewWindow(zoomLevel) {
  const maxZoom = 9;
  const zoomFactor = 1 - (zoomLevel / maxZoom) * 0.7;

  const viewWidth = getLevelWidth() * zoomFactor;
  const viewHeight = getLevelHeight() * zoomFactor;

  return {
    viewWidth,
    viewHeight,
  };
}

export function drawBackground(ctx) {
  const canvas = getElements().canvas;
  const canvasHeight = canvas.height;
  const canvasWidth = canvas.width;

  ctx.imageSmoothingEnabled = false;

  const zoomLevel = getZoomLevel();
  const { viewWidth, viewHeight } = getViewWindow(zoomLevel);
  const scale = canvasHeight / viewHeight;

  let cameraX = getCameraX();
  let cameraY = getCameraY();

  const gridHeightPx = mainGridObject.GRID_ROWS * mainGridObject.CELL_HEIGHT;
  cameraY = Math.min(Math.max(0, cameraY), gridHeightPx - viewHeight);

  const gridWidthPx = mainGridObject.GRID_COLS * mainGridObject.CELL_WIDTH;
  const wrappedCameraX = ((cameraX % gridWidthPx) + gridWidthPx) % gridWidthPx;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const firstVisibleCol = Math.floor(
    wrappedCameraX / mainGridObject.CELL_WIDTH
  );
  const lastVisibleCol = Math.floor(
    (wrappedCameraX + viewWidth) / mainGridObject.CELL_WIDTH
  );
  const firstVisibleRow = Math.floor(cameraY / mainGridObject.CELL_HEIGHT);
  const lastVisibleRow = Math.floor(
    (cameraY + viewHeight) / mainGridObject.CELL_HEIGHT
  );

  for (let row = firstVisibleRow; row <= lastVisibleRow; row++) {
    if (row < 0 || row >= mainGridObject.GRID_ROWS) continue;

    for (
      let colOffset = 0;
      colOffset <= lastVisibleCol - firstVisibleCol;
      colOffset++
    ) {
      const col = (firstVisibleCol + colOffset) % mainGridObject.GRID_COLS;

      const cell = mainGridObject.getCell(col, row);
      if (!cell) continue;

      const color = getTerrainColor(cell.terrainType);

      const cellWorldX = col * mainGridObject.CELL_WIDTH;
      const cellWorldY = row * mainGridObject.CELL_HEIGHT;

      let screenX = (cellWorldX - wrappedCameraX) * scale;
      const screenY = (cellWorldY - cameraY) * scale;

      if (screenX < 0) {
        screenX += gridWidthPx * scale;
      }

      const cellWidthPx = mainGridObject.CELL_WIDTH * scale;
      const cellHeightPx = mainGridObject.CELL_HEIGHT * scale;

      const drawX = Math.floor(screenX);
      const drawY = Math.floor(screenY);
      const drawW = Math.ceil(cellWidthPx);
      const drawH = Math.ceil(cellHeightPx);

      ctx.fillStyle = color;
      ctx.fillRect(drawX, drawY, drawW, drawH);
    }
  }

  if (getHoveredCell() && getShowGrid()) {
    ctx.fillStyle = "rgba(255, 255, 0, 0.2)";

    const hovered = getHoveredCell();
    let hoverScreenX =
      (hovered.x * mainGridObject.CELL_WIDTH - wrappedCameraX) * scale;
    const hoverScreenY =
      (hovered.y * mainGridObject.CELL_HEIGHT - cameraY) * scale;

    if (hoverScreenX < 0) {
      hoverScreenX += gridWidthPx * scale;
    }

    const hoverW = mainGridObject.CELL_WIDTH * scale;
    const hoverH = mainGridObject.CELL_HEIGHT * scale;

    const drawX = Math.floor(hoverScreenX);
    const drawY = Math.floor(hoverScreenY);
    const drawW = Math.ceil(hoverW);
    const drawH = Math.ceil(hoverH);

    ctx.fillRect(drawX, drawY, drawW, drawH);
  }
}

export function setGameState(newState) {
  setGameStateVariable(newState);

  switch (newState) {
    case getMenuState():
      getElements().menu.classList.remove("d-none");
      getElements().menu.classList.add("d-flex");
      getElements().buttonRow.classList.add("d-none");
      getElements().buttonRow.classList.remove("d-flex");
      getElements().canvasContainer.classList.remove("d-flex");
      getElements().canvasContainer.classList.add("d-none");
      getElements().returnToMenuButton.classList.remove("d-flex");
      getElements().returnToMenuButton.classList.add("d-none");

      const languageButtons = [
        getElements().btnEnglish,
        getElements().btnSpanish,
        getElements().btnGerman,
        getElements().btnItalian,
        getElements().btnFrench,
      ];
      languageButtons.forEach((button) => {
        button.classList.remove("active");
      });

      const currentLanguage = getLanguage();
      console.log("Language is " + getLanguage());
      switch (currentLanguage) {
        case "en":
          console.log("Setting Active state on English");
          getElements().btnEnglish.classList.add("active");
          break;
        case "es":
          console.log("Setting Active state on Spanish");
          getElements().btnSpanish.classList.add("active");
          break;
        case "de":
          console.log("Setting Active state on German");
          getElements().btnGerman.classList.add("active");
          break;
        case "it":
          console.log("Setting Active state on Italian");
          getElements().btnItalian.classList.add("active");
          break;
        case "fr":
          console.log("Setting Active state on French");
          getElements().btnFrench.classList.add("active");
          break;
      }

      if (getGameInProgress()) {
        getElements().copyButtonSavePopup.innerHTML = `${localize(
          "copyButton",
          getLanguage()
        )}`;
        getElements().closeButtonSavePopup.innerHTML = `${localize(
          "closeButton",
          getLanguage()
        )}`;
      }
      break;
    case getGameVisiblePaused():
      getElements().menu.classList.remove("d-flex");
      getElements().menu.classList.add("d-none");
      getElements().buttonRow.classList.remove("d-none");
      getElements().buttonRow.classList.add("d-flex");
      getElements().canvasContainer.classList.remove("d-none");
      getElements().canvasContainer.classList.add("d-flex");
      getElements().returnToMenuButton.classList.remove("d-none");
      getElements().returnToMenuButton.classList.add("d-flex");
      getElements().returnToMenuButton.innerHTML = `${localize(
        "menuTitle",
        getLanguage()
      )}`;
      break;
    case getGameVisibleActive():
      getElements().menu.classList.remove("d-flex");
      getElements().menu.classList.add("d-none");
      getElements().buttonRow.classList.remove("d-none");
      getElements().buttonRow.classList.add("d-flex");
      getElements().canvasContainer.classList.remove("d-none");
      getElements().canvasContainer.classList.add("d-flex");
      getElements().returnToMenuButton.classList.remove("d-none");
      getElements().returnToMenuButton.classList.add("d-flex");
      getElements().returnToMenuButton.innerHTML = `${localize(
        "menuTitle",
        getLanguage()
      )}`;
      break;
  }
}

function isFarEnough(x, y, occupiedTiles, minDistance) {
  for (let dx = -minDistance; dx <= minDistance; dx++) {
    for (let dy = -minDistance; dy <= minDistance; dy++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      if (occupiedTiles.has(`${nx},${ny}`)) return false;
    }
  }
  return true;
}

function generateWorldMap(
  ctx,
  { landArea, numberOfContinents, numberOfIslands, temperature } = {}
) {
  const cols = mainGridObject.GRID_COLS;
  const rows = mainGridObject.GRID_ROWS;
  const totalTiles = cols * rows;

  const landTilesCount = Math.floor((landArea / 100) * totalTiles);
  const waterTilesCount = totalTiles - landTilesCount;
  const iceTilesCount = Math.floor((temperature / 100) * waterTilesCount);

  const continentTilesCount = Math.floor(landTilesCount * 0.8);
  const islandTilesCount = landTilesCount - continentTilesCount;

  const landSet = new Set();
  const occupiedTiles = new Set();

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      mainGridObject.setCellData(x, y, {
        terrainType: "ocean",
      });
    }
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
  }

  function createOrganicCluster(startX, startY, size, occupiedTiles) {
    const cols = mainGridObject.GRID_COLS;
    const rows = mainGridObject.GRID_ROWS;

    const clusterTiles = new Set();
    const frontier = new Set();

    function keyOf(x, y) {
      return `${x},${y}`;
    }

    function parseKey(key) {
      const [x, y] = key.split(",").map(Number);
      return { x, y };
    }

    clusterTiles.add(keyOf(startX, startY));

    const deltas = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    for (const [dx, dy] of deltas) {
      const nx = startX + dx,
        ny = startY + dy;
      const k = keyOf(nx, ny);
      if (
        nx >= 0 &&
        nx < cols &&
        ny >= 0 &&
        ny < rows &&
        !occupiedTiles.has(k) &&
        !clusterTiles.has(k)
      ) {
        frontier.add(k);
      }
    }

    const eastWestBias = 3;
    const peninsulaBias = 2;
    const distanceBias = 2;

    function distance(x, y) {
      return Math.sqrt((x - startX) ** 2 + (y - startY) ** 2);
    }

    while (clusterTiles.size < size && frontier.size > 0) {
      const frontierArr = Array.from(frontier);

      const weights = frontierArr.map((k) => {
        const { x, y } = parseKey(k);

        let adjCount = 0;
        for (const [dx, dy] of deltas) {
          const nx = x + dx,
            ny = y + dy;
          if (clusterTiles.has(keyOf(nx, ny))) adjCount++;
        }

        let w = 1 / (adjCount + 1);
        if (x !== startX) {
          w *= eastWestBias;
        }

        const maxDist = Math.sqrt(cols ** 2 + rows ** 2);
        const distFactor = distance(x, y) / maxDist;
        w *= 1 + distFactor * distanceBias;

        if (adjCount <= 2) {
          w *= peninsulaBias;
        }

        return w;
      });

      const totalWeight = weights.reduce((acc, w) => acc + w, 0);
      let r = Math.random() * totalWeight;
      let chosenIndex = 0;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r <= 0) {
          chosenIndex = i;
          break;
        }
      }

      const chosenKey = frontierArr[chosenIndex];
      frontier.delete(chosenKey);
      clusterTiles.add(chosenKey);

      const { x: cx, y: cy } = parseKey(chosenKey);
      for (const [dx, dy] of deltas) {
        const nx = cx + dx,
          ny = cy + dy;
        const k2 = keyOf(nx, ny);
        if (
          nx >= 0 &&
          nx < cols &&
          ny >= 0 &&
          ny < rows &&
          !occupiedTiles.has(k2) &&
          !clusterTiles.has(k2)
        ) {
          frontier.add(k2);
        }
      }
    }

    if (clusterTiles.size < size) {
      const fillQueue = Array.from(clusterTiles).map((k) => parseKey(k));
      while (clusterTiles.size < size && fillQueue.length > 0) {
        const { x: cx, y: cy } = fillQueue.shift();
        for (const [dx, dy] of deltas) {
          if (clusterTiles.size >= size) break;
          const nx = cx + dx,
            ny = cy + dy;
          const k2 = keyOf(nx, ny);
          if (
            nx < 0 ||
            nx >= cols ||
            ny < 0 ||
            ny >= rows ||
            occupiedTiles.has(k2) ||
            clusterTiles.has(k2)
          ) {
            continue;
          }
          clusterTiles.add(k2);
          fillQueue.push({ x: nx, y: ny });
        }
      }
    }

    return clusterTiles;
  }

  const continentMinX = 10;
  const continentMaxX = 240;
  const continentMinY = 4;
  const continentMaxY = rows - 4;

  for (let i = 0; i < numberOfContinents; i++) {
    const avgSize = Math.floor(continentTilesCount / numberOfContinents);
    let attempts = 0;
    let cluster = null;

    while (attempts < 50) {
      const startX = randInt(continentMinX, continentMaxX);
      const startY = randInt(continentMinY, continentMaxY);

      if (!occupiedTiles.has(`${startX},${startY}`)) {
        cluster = createOrganicCluster(startX, startY, avgSize, occupiedTiles);
        if (cluster.size === avgSize) break;
      }
      attempts++;
    }

    if (cluster) {
      for (const coord of cluster) {
        occupiedTiles.add(coord);
        const [x, y] = coord.split(",").map(Number);
        mainGridObject.setCellData(x, y, {
          terrainType: "grassland",
        });
        landSet.add(coord);
      }
    }
  }


  for (let i = 0; i < numberOfIslands; i++) {
    const avgSize = Math.floor(islandTilesCount / numberOfIslands);
    let attempts = 0;
    let cluster = null;

    while (attempts < 50) {
      const startX = randInt(0, cols);
      const startY = randInt(0, rows);

      if (!occupiedTiles.has(`${startX},${startY}`)) {
        cluster = createOrganicCluster(startX, startY, avgSize, occupiedTiles);
        if (cluster.size === avgSize) break;
      }
      attempts++;
    }

    if (cluster) {
      for (const coord of cluster) {
        occupiedTiles.add(coord);
        const [x, y] = coord.split(",").map(Number);
        mainGridObject.setCellData(x, y, {
          terrainType: "grassland",
        });
        landSet.add(coord);
      }
    }
  }

  const oceanTiles = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const key = `${x},${y}`;
      if (!landSet.has(key)) {
        oceanTiles.push(key);
      }
    }
  }

  for (let i = 0; i < iceTilesCount; i++) {
    if (oceanTiles.length === 0) break;
    const idx = randInt(0, oceanTiles.length);
    const key = oceanTiles.splice(idx, 1)[0];
    const [x, y] = key.split(",").map(Number);
    mainGridObject.setCellData(x, y, {
      terrainType: "ice",
    });
  }

  relocateMidRowIceTilesToPoles(temperature);
  generateTundra(temperature);

  const neighborDeltas = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];

  function getModalTerrain(x, y) {
    const counts = {};
    let maxCount = 0;
    let modal = null;
    for (const [dx, dy] of neighborDeltas) {
      const nx = x + dx,
        ny = y + dy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const t = mainGridObject.getCell(nx, ny).terrainType;
      if (!t || t === "ocean") continue;
      counts[t] = (counts[t] || 0) + 1;
      if (counts[t] > maxCount) {
        maxCount = counts[t];
        modal = t;
      }
    }
    return modal;
  }

  const toChange = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = mainGridObject.getCell(x, y);
      if (!cell || cell.terrainType !== "ocean") continue;
      let countNonOcean = 0;
      for (const [dx, dy] of neighborDeltas) {
        const nx = x + dx,
          ny = y + dy;
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
        const t = mainGridObject.getCell(nx, ny).terrainType;
        if (t && t !== "ocean") {
          countNonOcean++;
        }
      }
      if (countNonOcean > 5) {
        const modal = getModalTerrain(x, y);
        if (modal) {
          toChange.push({ x, y, terrain: modal });
        }
      }
    }
  }

  for (const { x, y, terrain } of toChange) {
    mainGridObject.setCellData(x, y, { terrainType: terrain });
  }
}

function getTerrainColor(type) {
  switch (type) {
    case "ice":
      return "#FFFFFF";
    case "grassland":
      return "#7CFC00";
    case "ocean":
      return "#1E90FF";
    case "tundra":
      return "#8B7D6B";
    default:
      return "#000000";
  }
}

function relocateMidRowIceTilesToPoles(temperature) {
  const cols = mainGridObject.GRID_COLS;
  const rows = mainGridObject.GRID_ROWS;
  const polarRowCount = Math.max(0, 15 - Math.floor((30 - temperature) / 4));

  const midRowIceTiles = [];
  const polarOceanTiles = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = mainGridObject.getCell(x, y);
      if (!cell) continue;

      const terrain = cell.terrainType;

      if (terrain === "ice") {
        if (y >= polarRowCount && y < rows - polarRowCount) {
          midRowIceTiles.push({
            x,
            y,
          });
        }
      } else if (terrain === "ocean") {
        if (y < polarRowCount || y >= rows - polarRowCount) {
          polarOceanTiles.push({
            x,
            y,
          });
        }
      }
    }
  }

  function getWeight(y) {
    if (y < polarRowCount) {
      return polarRowCount - y;
    } else if (y >= rows - polarRowCount) {
      return y - (rows - polarRowCount - 1);
    }
    return 0;
  }

  function weightedShuffle(tiles) {
    const weighted = tiles.flatMap((tile) => {
      const weight = getWeight(tile.y);
      return Array(weight).fill(tile);
    });

    const result = [];
    const seen = new Set();
    while (result.length < tiles.length && weighted.length > 0) {
      const idx = Math.floor(Math.random() * weighted.length);
      const selected = weighted.splice(idx, 1)[0];
      const key = `${selected.x},${selected.y}`;
      if (!seen.has(key)) {
        result.push(selected);
        seen.add(key);
      }
    }
    return result;
  }

  const shuffledMidIce = [...midRowIceTiles];
  for (let i = shuffledMidIce.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledMidIce[i], shuffledMidIce[j]] = [
      shuffledMidIce[j],
      shuffledMidIce[i],
    ];
  }

  const shuffledPolarOcean = weightedShuffle(polarOceanTiles);

  const swaps = Math.min(shuffledMidIce.length, shuffledPolarOcean.length);
  for (let i = 0; i < swaps; i++) {
    const ice = shuffledMidIce[i];
    const ocean = shuffledPolarOcean[i];

    mainGridObject.setCellData(ice.x, ice.y, {
      terrainType: "ocean",
    });
    mainGridObject.setCellData(ocean.x, ocean.y, {
      terrainType: "ice",
    });
  }

  for (let y = 0; y < rows; y++) {
    if (y >= polarRowCount && y < rows - polarRowCount) continue;

    const isInnermostTopRow = y === polarRowCount - 1;
    const isSecondInnermostTopRow = y === polarRowCount - 2;
    const isInnermostBottomRow = y === rows - polarRowCount;
    const isSecondInnermostBottomRow = y === rows - polarRowCount + 1;

    for (let x = 0; x < cols; x++) {
      const cell = mainGridObject.getCell(x, y);
      if (!cell) continue;

      if (cell.terrainType !== "ice" && cell.terrainType !== "ocean") {
        let chance = 1;
        if (isInnermostTopRow || isInnermostBottomRow) {
          chance = 0.5;
        } else if (isSecondInnermostTopRow || isSecondInnermostBottomRow) {
          chance = 0.8;
        }

        if (Math.random() > chance) {
          continue;
        }

        mainGridObject.setCellData(x, y, {
          terrainType: "ice",
        });
      }
    }
  }
}

function generateTundra(temperature) {
  const cols = mainGridObject.GRID_COLS;
  const rows = mainGridObject.GRID_ROWS;
  const polarRowCount = Math.max(0, 15 - Math.floor((30 - temperature) / 4));

  const probs = [0.9, 0.8, 0.7, 0.6, 0.5];

  function maybeTundra(chance) {
    return Math.random() < chance;
  }

  for (let y = 0; y < polarRowCount; y++) {
    if (y >= rows) break;
    for (let x = 0; x < cols; x++) {
      const cell = mainGridObject.getCell(x, y);
      if (!cell) continue;
      const terrain = cell.terrainType;
      if (terrain !== "ocean" && terrain !== "ice" && terrain !== "tundra") {
        mainGridObject.setCellData(x, y, { terrainType: "tundra" });
      }
    }
  }

  for (let y = rows - polarRowCount; y < rows; y++) {
    if (y < 0) continue;
    for (let x = 0; x < cols; x++) {
      const cell = mainGridObject.getCell(x, y);
      if (!cell) continue;
      const terrain = cell.terrainType;
      if (terrain !== "ocean" && terrain !== "ice" && terrain !== "tundra") {
        mainGridObject.setCellData(x, y, { terrainType: "tundra" });
      }
    }
  }

  for (let i = 0; i < 5; i++) {
    const y = polarRowCount + i;
    if (y >= rows) break;
    const chance = probs[i];
    for (let x = 0; x < cols; x++) {
      const cell = mainGridObject.getCell(x, y);
      if (!cell) continue;
      const terrain = cell.terrainType;
      if (terrain !== "ocean" && terrain !== "ice" && terrain !== "tundra") {
        if (maybeTundra(chance)) {
          mainGridObject.setCellData(x, y, { terrainType: "tundra" });
        }
      }
    }
  }

  for (let i = 0; i < 5; i++) {
    const y = rows - polarRowCount - 1 - i;
    if (y < 0) break;
    const chance = probs[i];
    for (let x = 0; x < cols; x++) {
      const cell = mainGridObject.getCell(x, y);
      if (!cell) continue;
      const terrain = cell.terrainType;
      if (terrain !== "ocean" && terrain !== "ice" && terrain !== "tundra") {
        if (maybeTundra(chance)) {
          mainGridObject.setCellData(x, y, { terrainType: "tundra" });
        }
      }
    }
  }
}

