import { localize } from "./localization.js";
import { drawDebugGrid } from "./ui.js";

import {
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
  getHoveredCell
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

  generateMap(ctx);

  gameLoop();
}

async function updateCanvasSize(container, internalWidth, internalHeight, canvas, ctx) {
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

export function gameLoop() {
  updateCamera();

  const ctx = getElements().canvas.getContext("2d");
  const canvas = getElements().canvas;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground(ctx);
  drawDebugGrid(ctx);
  requestAnimationFrame(gameLoop);
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

  return { viewWidth, viewHeight };
}

export function drawBackground(ctx) {
  const canvas = getElements().canvas;
  const canvasHeight = canvas.height;
  const canvasWidth = canvas.width;

  const zoomLevel = getZoomLevel();
  const { viewWidth, viewHeight } = getViewWindow(zoomLevel);
  const scale = canvasHeight / viewHeight;

  let cameraX = getCameraX();
  let cameraY = getCameraY();

  // Clamp cameraY within vertical bounds (grid height)
  const gridHeightPx = mainGridObject.GRID_ROWS * mainGridObject.CELL_HEIGHT;
  cameraY = Math.min(Math.max(0, cameraY), gridHeightPx - viewHeight);

  // Wrap cameraX horizontally within grid width
  const gridWidthPx = mainGridObject.GRID_COLS * mainGridObject.CELL_WIDTH;
  const wrappedCameraX = ((cameraX % gridWidthPx) + gridWidthPx) % gridWidthPx;

  // Clear canvas first
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Calculate visible grid cells range
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

  // Helper to get cell color by terrain type (expand as needed)
  function getTerrainColor(type) {
    switch (type) {
      case "ice":
        return "#FFFFFF"; // white for ice
      // add other terrain types here
      default:
        return "#000000"; // fallback black
    }
  }

  // Draw visible cells (handle wrapping horizontally)
  for (let row = firstVisibleRow; row <= lastVisibleRow; row++) {
    // Clamp row within grid bounds
    if (row < 0 || row >= mainGridObject.GRID_ROWS) continue;

    for (
      let colOffset = 0;
      colOffset <= lastVisibleCol - firstVisibleCol;
      colOffset++
    ) {
      // Calculate wrapped column index
      const col = (firstVisibleCol + colOffset) % mainGridObject.GRID_COLS;

      const cell = mainGridObject.getCell(col, row);
      if (!cell) continue;

      const color = getTerrainColor(cell.terrainType);

      // Calculate screen position of cell (in pixels)
      const cellWorldX = col * mainGridObject.CELL_WIDTH;
      const cellWorldY = row * mainGridObject.CELL_HEIGHT;

      // Translate world coords to screen coords, considering camera and scale
      let screenX = (cellWorldX - wrappedCameraX) * scale;
      const screenY = (cellWorldY - cameraY) * scale;

      // If screenX < 0, means wrapping — add gridWidthPx*scale to move into visible range
      if (screenX < 0) {
        screenX += gridWidthPx * scale;
      }

      const cellWidthPx = mainGridObject.CELL_WIDTH * scale;
      const cellHeightPx = mainGridObject.CELL_HEIGHT * scale;

      // Draw the cell rectangle
      ctx.fillStyle = color;
      ctx.fillRect(screenX, screenY, cellWidthPx, cellHeightPx);
    }
  }

  // Draw hovered cell highlight if needed
  if (getHoveredCell() && getShowGrid()) {
    ctx.fillStyle = "rgba(255, 255, 0, 0.2)";

    const hovered = getHoveredCell();

    // Calculate screen position for hovered cell (consider wrapping)
    let hoverScreenX =
      (hovered.x * mainGridObject.CELL_WIDTH - wrappedCameraX) * scale;
    const hoverScreenY =
      (hovered.y * mainGridObject.CELL_HEIGHT - cameraY) * scale;

    if (hoverScreenX < 0) {
      hoverScreenX += gridWidthPx * scale;
    }

    ctx.fillRect(
      hoverScreenX,
      hoverScreenY,
      mainGridObject.CELL_WIDTH * scale,
      mainGridObject.CELL_HEIGHT * scale
    );
  }
}


function paintCell(ctx, cellX, cellY) {
  const cell = mainGridObject.getCell(cellX, cellY);
  if (!cell) return;

  const { CELL_WIDTH, CELL_HEIGHT } = mainGridObject;

  const px = cellX * CELL_WIDTH;
  const py = cellY * CELL_HEIGHT;

  ctx.fillStyle = 'white';
  ctx.fillRect(px, py, CELL_WIDTH, CELL_HEIGHT);
}

function generateMap(ctx) {
  const { GRID_COLS, GRID_ROWS } = mainGridObject;

  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      paintCell(ctx, x, y);

      mainGridObject.setCellData(x, y, { terrainType: 'ice' });
    }
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
