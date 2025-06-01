import { localize } from "./localization.js";
import { drawDebugGrid } from "./ui.js";

import {
  getMaxZoomLevel,
  getShowGrid,
  mainGridObject,
  getScrollUpFlag,
  getScrollDownFlag,
  setZoomLevel,
  getLevelWidth,
  getLevelHeight,
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
    landArea: 40,
    numberOfContinents: 2,
    numberOfIslands: 70,
    temperature: 6,
    peninsulaBias: 5,
    eastWestBias: 6,
    distanceBias: 4,
    mountainBias: 0.9,
    hillBias: 0.5,
    riverBias: 0.85,
    desertBias: 0.5,
    plainsBias: 0.9,
    vegetationBias: 0.7,
    floodPlainBias: 0.5
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
  const maxZoom = getMaxZoomLevel();
  const zoomFactor = 1 - (zoomLevel / maxZoom) * 0.8;

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

function generateWorldMap(
  ctx,
  {
    landArea,
    numberOfContinents,
    numberOfIslands,
    temperature,
    peninsulaBias,
    eastWestBias,
    distanceBias,
    mountainBias,
    hillBias,
    riverBias,
    desertBias,
    plainsBias,
    vegetationBias,
    floodPlainBias,
  } = {}
) {
  const borderLimit = 2;
  const borderLimitModifier = 10;
  const cols = mainGridObject.GRID_COLS;
  const rows = mainGridObject.GRID_ROWS;
  const totalTiles = cols * rows;

  const landTilesCount = Math.floor((landArea / 100) * totalTiles);
  const waterTilesCount = totalTiles - landTilesCount;
  const iceTilesCount = Math.floor((temperature / 100) * waterTilesCount);

  const continentTilesCount = Math.floor(landTilesCount * 0.5);
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
        nx >= borderLimit &&
        nx < cols - borderLimit &&
        ny >= 0 &&
        ny < rows &&
        !occupiedTiles.has(k) &&
        !clusterTiles.has(k)
      ) {
        frontier.add(k);
      }
    }

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
          nx >= borderLimit &&
          nx < cols - borderLimit &&
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

  const continentMinY = 4;
  const continentMaxY = rows - 4;

  for (let i = 0; i < numberOfContinents; i++) {
    const avgSize = Math.floor(continentTilesCount / numberOfContinents);
    let attempts = 0;
    let cluster = null;

    const minContinentDistance = 40;

    while (attempts < 50) {
      const startX = randInt(
        borderLimit * borderLimitModifier,
        cols - borderLimit * borderLimitModifier
      );
      const startY = randInt(continentMinY, continentMaxY);

      if (
        !occupiedTiles.has(`${startX},${startY}`) &&
        isFarEnoughFromExistingContinents(startX, startY, minContinentDistance)
      ) {
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
      const startX = randInt(
        borderLimit * borderLimitModifier,
        cols - borderLimit * borderLimitModifier
      );
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
  generateMountainRanges(mountainBias);

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

  function isFarEnoughFromExistingContinents(startX, startY, minDistance) {
    for (const coord of occupiedTiles) {
      const [x, y] = coord.split(",").map(Number);
      const dist = Math.sqrt((x - startX) ** 2 + (y - startY) ** 2);
      if (dist < minDistance) return false;
    }
    return true;
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

  generateHills(hillBias);
  generateRivers(riverBias);
  generateDeserts(desertBias);
  generatePlains(plainsBias);
  generateVegetation(vegetationBias);
  generateFloodPlains(floodPlainBias);
}

function getTerrainColor(type) {
  switch (type) {
    case "ice":
      return "#FFFFFF";
    case "grassland":
      return "#7CFC00";
    case "floodPlain":
      return "#DFFF55";
    case "jungle":
      return "#228B22";
    case "forest":
      return "#004d00";
    case "ocean":
      return "#00008B";
    case "tundra":
      return "#8B7D6B";
    case "mountain":
      return "#696969";
    case "hill":
      return "#A9A9A9";
    case "river":
      return "#1E90FF";
    case "desert":
      return "#FFD700";
    case "plains":
      return "#FFA500";
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

function generateMountainRanges(mountainBias) {
  const cols = mainGridObject.GRID_COLS;
  const rows = mainGridObject.GRID_ROWS;

  const isMountainCandidate = (cell) =>
    cell && (cell.terrainType === "grassland" || cell.terrainType === "tundra");

  const isNearOcean = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (mainGridObject.isValid(nx, ny)) {
          const neighbor = mainGridObject.getCell(nx, ny);
          if (neighbor && neighbor.terrainType === "ocean") {
            return true;
          }
        }
      }
    }
    return false;
  };

  const mountainCandidates = [];

  for (let y = 0; y < rows; y++) {
    let sequence = [];
    for (let x = 0; x < cols; x++) {
      const cell = mainGridObject.getCell(x, y);
      if (isMountainCandidate(cell)) {
        sequence.push({ x, y });
      } else {
        if (sequence.length >= 8 && Math.random() < mountainBias) {
          mountainCandidates.push({
            start: sequence[0],
            direction: "horizontal",
            length: sequence.length,
          });
        }
        sequence = [];
      }
    }
    if (sequence.length >= 8 && Math.random() < mountainBias) {
      mountainCandidates.push({
        start: sequence[0],
        direction: "horizontal",
        length: sequence.length,
      });
    }
  }

  for (let x = 0; x < cols; x++) {
    let sequence = [];
    for (let y = 0; y < rows; y++) {
      const cell = mainGridObject.getCell(x, y);
      if (isMountainCandidate(cell)) {
        sequence.push({ x, y });
      } else {
        if (sequence.length >= 8 && Math.random() < mountainBias) {
          mountainCandidates.push({
            start: sequence[0],
            direction: "vertical",
            length: sequence.length,
          });
        }
        sequence = [];
      }
    }
    if (sequence.length >= 8 && Math.random() < mountainBias) {
      mountainCandidates.push({
        start: sequence[0],
        direction: "vertical",
        length: sequence.length,
      });
    }
  }

  for (const { start, direction } of mountainCandidates) {
    const rangeLength = Math.floor(Math.random() * 15) + 6;
    let width = Math.floor(Math.random() * 5) + 1;

    let { x, y } = start;

    for (let i = 0; i < rangeLength; i++) {
      if (direction === "horizontal") {
        x += 1;
        y += Math.floor(Math.random() * 3) - 1;
      } else {
        y += 1;
        x += Math.floor(Math.random() * 3) - 1;
      }

      x = Math.max(0, Math.min(cols - 1, x));
      y = Math.max(0, Math.min(rows - 1, y));

      const actualWidth = Math.max(
        1,
        Math.min(3, width + (Math.random() > 0.5 ? 1 : 0))
      );

      for (let wx = 0; wx < actualWidth; wx++) {
        for (let wy = 0; wy < actualWidth; wy++) {
          const tx = direction === "horizontal" ? x : x + wx;
          const ty = direction === "horizontal" ? y + wy : y;

          if (
            mainGridObject.isValid(tx, ty) &&
            isMountainCandidate(mainGridObject.getCell(tx, ty)) &&
            !isNearOcean(tx, ty)
          ) {
            if (width === 3 && actualWidth >= 3 && Math.random() < 0.6) {
              mainGridObject.setCellData(tx, ty, {
                terrainType: "ice",
                type: "impassable",
                walkable: false,
              });
            } else {
              mainGridObject.setCellData(tx, ty, {
                terrainType: "mountain",
                type: "impassable",
                walkable: false,
              });
            }
          }
        }
      }
    }
  }
}

function generateHills(hillBias) {
  const cols = mainGridObject.GRID_COLS;
  const rows = mainGridObject.GRID_ROWS;

  const isForbidden = (cell) =>
    !cell || ["ice", "ocean", "mountain"].includes(cell.terrainType);

  const isHillCandidate = (cell) => cell && !isForbidden(cell);

  const getNeighbors = (x, y) => {
    const neighbors = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (mainGridObject.isValid(nx, ny)) {
          neighbors.push(mainGridObject.getCell(nx, ny));
        }
      }
    }
    return neighbors;
  };

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = mainGridObject.getCell(x, y);

      if (!isHillCandidate(cell)) continue;

      const neighbors = getNeighbors(x, y);

      const hasMountainNeighbor = neighbors.some(
        (n) => n && n.terrainType === "mountain"
      );

      const allNeighborsGood =
        neighbors.length === 8 && neighbors.every((n) => !isForbidden(n));

      let chance = 0;
      if (hasMountainNeighbor) chance = 0.6 * hillBias;
      else if (allNeighborsGood) chance = 0.3 * hillBias;

      if (Math.random() < chance) {
        mainGridObject.setCellData(x, y, {
          terrainType: "hill",
          type: "walkable",
          walkable: true,
        });
      }
    }
  }
}

function generateRivers(riverBias) {
  const cols = mainGridObject.GRID_COLS;
  const rows = mainGridObject.GRID_ROWS;

  const isValidRiverTile = (cell) =>
    cell && (cell.terrainType === "grassland" || cell.terrainType === "hill");

  const isNextToMountain = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (mainGridObject.isValid(nx, ny)) {
          const neighbor = mainGridObject.getCell(nx, ny);
          if (neighbor && neighbor.terrainType === "mountain" || neighbor.terrainType === "hill") {
            return true;
          }
        }
      }
    }
    return false;
  };

  const isNextToOcean = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (mainGridObject.isValid(nx, ny)) {
          const neighbor = mainGridObject.getCell(nx, ny);
          if (neighbor && neighbor.terrainType === "ocean") {
            return true;
          }
        }
      }
    }
    return false;
  };

  const getNextRiverStep = (x, y, direction) => {
    const deltas = {
      north: [
        { dx: 0, dy: -1 },
        { dx: -1, dy: -1 },
        { dx: 1, dy: -1 },
      ],
      south: [
        { dx: 0, dy: 1 },
        { dx: -1, dy: 1 },
        { dx: 1, dy: 1 },
      ],
      east: [
        { dx: 1, dy: 0 },
        { dx: 1, dy: -1 },
        { dx: 1, dy: 1 },
      ],
      west: [
        { dx: -1, dy: 0 },
        { dx: -1, dy: -1 },
        { dx: -1, dy: 1 },
      ],
    };

    const options = deltas[direction];
    const validSteps = options.filter(({ dx, dy }) => {
      const nx = x + dx;
      const ny = y + dy;
      if (!mainGridObject.isValid(nx, ny)) return false;
      const cell = mainGridObject.getCell(nx, ny);
      return isValidRiverTile(cell);
    });

    if (validSteps.length === 0) return null;

    const choice = validSteps[Math.floor(Math.random() * validSteps.length)];
    return { x: x + choice.dx, y: y + choice.dy };
  };

  const directions = ["north", "south", "east", "west"];
  const candidates = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = mainGridObject.getCell(x, y);
      if (isValidRiverTile(cell) && isNextToMountain(x, y)) {
        candidates.push({ x, y });
      }
    }
  }

  const shuffleArray = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  shuffleArray(candidates);

  const targetCount = Math.floor(50 * riverBias);
  let placedCount = 0;
  let attempts = 0;

  while (
    placedCount < targetCount &&
    attempts < 10000 &&
    candidates.length > 0
  ) {
    const { x: startX, y: startY } = candidates.pop();
    const dir = directions[Math.floor(Math.random() * directions.length)];

    let x = startX;
    let y = startY;
    const path = [];

    let steps = 0;
    while (steps < 100) {
      const cell = mainGridObject.getCell(x, y);
      if (!isValidRiverTile(cell)) break;

      path.push({ x, y });

      if (isNextToOcean(x, y)) {
        for (const { x: rx, y: ry } of path) {
          mainGridObject.setCellData(rx, ry, {
            terrainType: "river",
            type: "walkable",
            walkable: true,
          });
        }
        placedCount++;
        break;
      }

      const nextStep = getNextRiverStep(x, y, dir);
      if (!nextStep) break;

      x = nextStep.x;
      y = nextStep.y;
      steps++;
    }

    attempts++;
  }
}

function generateDeserts(desertBias) {
  const cols = mainGridObject.GRID_COLS;
  const rows = mainGridObject.GRID_ROWS;
  const middleRow = Math.floor(rows / 2);

  const isDesertCandidate = (cell) =>
    cell &&
    !["ice", "mountain", "ocean", "river", "desert", "tundra"].includes(cell.terrainType);

  const isFarFromWater = (x, y) => {
    let desertMinDistanceFromWater = 4;

    if (Math.abs(y - middleRow) <= 5) {
      desertMinDistanceFromWater = Math.floor(desertMinDistanceFromWater / 2);
    }

    for (
      let dy = -desertMinDistanceFromWater;
      dy <= desertMinDistanceFromWater;
      dy++
    ) {
      for (
        let dx = -desertMinDistanceFromWater;
        dx <= desertMinDistanceFromWater;
        dx++
      ) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (mainGridObject.isValid(nx, ny)) {
          const neighbor = mainGridObject.getCell(nx, ny);
          if (
            neighbor &&
            (neighbor.terrainType === "ocean" ||
              neighbor.terrainType === "river")
          ) {
            return false;
          }
        }
      }
    }
    return true;
  };

  const tryMakeDesert = (x, y, bias = 1) => {
    if (
      mainGridObject.isValid(x, y) &&
      isDesertCandidate(mainGridObject.getCell(x, y)) &&
      Math.random() < 0.5 * bias
    ) {
      mainGridObject.setCellData(x, y, {
        terrainType: "desert",
        type: "walkable",
        walkable: true,
      });
      return true;
    }
    return false;
  };

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = mainGridObject.getCell(x, y);

      if (
        isDesertCandidate(cell) &&
        isFarFromWater(x, y) &&
        Math.random() < desertBias
      ) {
        const success = tryMakeDesert(x, y, 1);
        if (success) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              tryMakeDesert(x + dx, y + dy, desertBias);
            }
          }
        }
      }
    }
  }
}

function generatePlains(plainsBias) {
  const cols = mainGridObject.GRID_COLS;
  const rows = mainGridObject.GRID_ROWS;
  const middleRow = Math.floor(rows / 2);
  const equatorRange = 10;

  const forbiddenTypes = [
    "river",
    "hill",
    "mountain",
    "desert",
    "ice",
    "ocean",
    "tundra"
  ];

  const isPlainCandidate = (cell) =>
    cell && !forbiddenTypes.includes(cell.terrainType);

  const getNeighbors = (x, y) => {
    const neighbors = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (mainGridObject.isValid(nx, ny)) {
          neighbors.push(mainGridObject.getCell(nx, ny));
        }
      }
    }
    return neighbors;
  };

  const isNearType = (x, y, types, distance) => {
    for (let dy = -distance; dy <= distance; dy++) {
      for (let dx = -distance; dx <= distance; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (mainGridObject.isValid(nx, ny)) {
          const neighbor = mainGridObject.getCell(nx, ny);
          if (neighbor && types.includes(neighbor.terrainType)) {
            return true;
          }
        }
      }
    }
    return false;
  };

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = mainGridObject.getCell(x, y);
      if (!isPlainCandidate(cell)) continue;

      const neighbors = getNeighbors(x, y);

      const hasDesertNeighbor = neighbors.some(
        (n) => n && n.terrainType === "desert"
      );

      let chance = 0;

      if (hasDesertNeighbor) {
        chance = 0.3 * plainsBias;
      } else {
        const nearRiverOrOcean = isNearType(x, y, ["river", "ocean"], 2);
        if (!nearRiverOrOcean) {
          chance =
            (Math.abs(y - middleRow) <= equatorRange ? 0.7 : 0.4) * plainsBias;
        }
      }

      if (Math.random() < chance) {
        mainGridObject.setCellData(x, y, {
          terrainType: "plains",
          type: "walkable",
          walkable: true,
        });
      }
    }
  }
}

function generateVegetation(vegetationBias) {
  const cols = mainGridObject.GRID_COLS;
  const rows = mainGridObject.GRID_ROWS;
  const equatorStart = Math.floor(rows / 2) - 7;
  const equatorEnd = Math.floor(rows / 2) + 7;

  const forbiddenTypes = [
    "mountain",
    "hill",
    "river",
    "desert",
    "ice",
    "ocean",
    "jungle",
    "forest",
  ];

  const isVegetationCandidate = (cell) =>
    cell &&
    !forbiddenTypes.includes(cell.terrainType) &&
    cell.terrainType === "grassland";

  const isRiver = (cell) => cell && cell.terrainType === "river";
  const isDesert = (cell) => cell && cell.terrainType === "desert";
  const isJungleOrForest = (cell) =>
    cell && (cell.terrainType === "jungle" || cell.terrainType === "forest");

  const getNeighbors = (x, y) => {
    const neighbors = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (mainGridObject.isValid(nx, ny)) {
          neighbors.push(mainGridObject.getCell(nx, ny));
        }
      }
    }
    return neighbors;
  };

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = mainGridObject.getCell(x, y);
      if (!isVegetationCandidate(cell)) continue;

      const neighbors = getNeighbors(x, y);
      const nearRiver = neighbors.some(isRiver);
      const grasslandCount = neighbors.filter(
        (c) => c && c.terrainType === "grassland"
      ).length;
      const enoughGrasslandNeighbors = grasslandCount >= 5;
      const nearDesert = neighbors.some(isDesert);
      if (nearDesert) continue;

      let chance = 0;
      if (nearRiver) chance = 0.7 * vegetationBias;
      else if (enoughGrasslandNeighbors) chance = 0.8 * vegetationBias;

      if (Math.random() < chance) {
        mainGridObject.setCellData(x, y, {
          terrainType:
            y >= equatorStart && y <= equatorEnd ? "jungle" : "forest",
          type: "walkable",
          walkable: true,
        });
      }
    }
  }

  // Second pass for grassland tiles next to jungle/forest
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = mainGridObject.getCell(x, y);
      if (!isVegetationCandidate(cell)) continue;

      const neighbors = getNeighbors(x, y);
      const hasDesertNeighbor = neighbors.some(isDesert);
      if (hasDesertNeighbor) continue;

      const jungleOrForestNeighbors = neighbors.filter(isJungleOrForest);
      if (jungleOrForestNeighbors.length === 0) continue;

      if (Math.random() < 0.4) {
        const terrainType =
          y >= equatorStart && y <= equatorEnd ? "jungle" : "forest";
        mainGridObject.setCellData(x, y, {
          terrainType,
          type: "walkable",
          walkable: true,
        });
      }
    }
  }
}

function generateFloodPlains(floodPlainBias) {
  const cols = mainGridObject.GRID_COLS;
  const rows = mainGridObject.GRID_ROWS;

  const isGrassland = (cell) => cell && cell.terrainType === "grassland";
  const isRiver = (cell) => cell && cell.terrainType === "river";
  const isOcean = (cell) => cell && cell.terrainType === "ocean";

  const getNeighbors = (x, y) => {
    const neighbors = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (mainGridObject.isValid(nx, ny)) {
          neighbors.push(mainGridObject.getCell(nx, ny));
        }
      }
    }
    return neighbors;
  };

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = mainGridObject.getCell(x, y);
      if (!isGrassland(cell)) continue;

      const neighbors = getNeighbors(x, y);
      const hasRiverNeighbor = neighbors.some(isRiver);
      const hasOceanNeighbor = neighbors.some(isOcean);

      if (hasRiverNeighbor && hasOceanNeighbor) {
        if (Math.random() < floodPlainBias) {
          mainGridObject.setCellData(x, y, {
            terrainType: "floodPlain",
            type: "walkable",
            walkable: true,
          });
        }
      }
    }
  }
}
