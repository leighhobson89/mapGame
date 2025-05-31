import {
  setHoveredCell,
  mainGridObject,
  getBackgroundImage,
  setCameraX,
  setCameraY,
  getCameraX,
  getCameraY,
  setZoomLevel,
  getZoomLevel,
  SCROLL_EDGE_THRESHOLD,
  setScrollUpFlag,
  setScrollDownFlag,
  setScrollLeftFlag,
  setScrollRightFlag,
  gameState,
  getLanguage,
  setElements,
  getElements,
  setBeginGameStatus,
  getGameInProgress,
  setGameInProgress,
  getGameVisibleActive,
  getMenuState,
  getLanguageSelected,
  setLanguageSelected,
  setLanguage,
  getShowGrid,
  setShowGrid,
  getLevelHeight,
} from "./constantsAndGlobalVars.js";
import { setGameState, startGame, gameLoop, getViewWindow } from "./game.js";
import { initLocalization, localize } from "./localization.js";
import {
  loadGameOption,
  loadGame,
  saveGame,
  copySaveStringToClipBoard,
} from "./saveLoadGame.js";

document.addEventListener("DOMContentLoaded", async () => {
  setElements();

  const canvas = getElements().canvas;

  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cell = mainGridObject.screenToGrid(x, y);
    if (cell) {
      console.log(`Clicked on grid cell: (${cell.x}, ${cell.y})`, cell.data);
    } else {
      console.log("Click out of bounds");
    }
  });

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    setScrollLeftFlag(mouseX < SCROLL_EDGE_THRESHOLD);
    setScrollRightFlag(mouseX > canvasWidth - SCROLL_EDGE_THRESHOLD);
    setScrollUpFlag(mouseY < SCROLL_EDGE_THRESHOLD);
    setScrollDownFlag(mouseY > canvasHeight - SCROLL_EDGE_THRESHOLD);

    const cell = mainGridObject.screenToGrid(mouseX, mouseY);
    setHoveredCell(cell);

    const tooltip = document.getElementById("grid-tooltip");

    if (getShowGrid() && cell) {
      const content =
        `(${cell.x}, ${cell.y})\n` +
        Object.entries(cell)
          .filter(([key]) => !["x", "y"].includes(key))
          .map(
            ([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`
          )
          .join("\n");

      tooltip.textContent = content;
      tooltip.style.left = `${e.clientX + 12}px`;
      tooltip.style.top = `${e.clientY + 12}px`;
      tooltip.style.display = "block";
    } else {
      tooltip.style.display = "none";
    }
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const mouseX_css = e.clientX - rect.left;
    const mouseY_css = e.clientY - rect.top;

    const canvasHeight = canvas.height;
    const scale = canvasHeight / getViewWindow(getZoomLevel()).viewHeight;

    const mouseX = mouseX_css;
    const mouseY = mouseY_css;

    const oldZoom = getZoomLevel();
    const zoomDelta = e.deltaY < 0 ? 1 : -1;
    const newZoom = Math.min(Math.max(0, oldZoom + zoomDelta), 9);
    if (newZoom === oldZoom) return;

    const oldView = getViewWindow(oldZoom);
    const newView = getViewWindow(newZoom);

    const oldScale = canvasHeight / oldView.viewHeight;
    const newScale = canvasHeight / newView.viewHeight;

    const worldX = getCameraX() + mouseX / oldScale;
    const worldY = getCameraY() + mouseY / oldScale;

    const newCameraX = worldX - mouseX / newScale;
    const newCameraY = worldY - mouseY / newScale;

    setZoomLevel(newZoom);
    setCameraX(newCameraX);

    const maxCameraY = getLevelHeight() - newView.viewHeight;
    setCameraY(Math.min(Math.max(newCameraY, 0), maxCameraY));
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "g") {
      setShowGrid(!getShowGrid());
      console.log("Grid debug view:", getShowGrid() ? "ON" : "OFF");
    }
  });

  getElements().newGameMenuButton.addEventListener("click", () => {
    setBeginGameStatus(true);
    if (!getGameInProgress()) {
      setGameInProgress(true);
    }
    disableActivateButton(
      getElements().resumeGameMenuButton,
      "active",
      "btn-primary"
    );
    disableActivateButton(
      getElements().saveGameButton,
      "active",
      "btn-primary"
    );
    setGameState(getGameVisibleActive());
    try {
      requestCanvasFullscreen();
    } catch (err) {
      console.warn("Fullscreen request failed or was canceled:", err);
    }
    startGame();
  });

  getElements().resumeGameMenuButton.addEventListener("click", () => {
    if (gameState === getMenuState()) {
      setGameState(getGameVisibleActive());
    }
    try {
      requestCanvasFullscreen();
    } catch (err) {
      console.warn("Fullscreen request failed or was canceled:", err);
    }
    gameLoop();
  });

  getElements().returnToMenuButton.addEventListener("click", () => {
    setGameState(getMenuState());
    exitFullscreen();
  });

  getElements().btnEnglish.addEventListener("click", () => {
    handleLanguageChange("en");
    setGameState(getMenuState());
  });

  getElements().btnSpanish.addEventListener("click", () => {
    handleLanguageChange("es");
    setGameState(getMenuState());
  });

  getElements().btnGerman.addEventListener("click", () => {
    handleLanguageChange("de");
    setGameState(getMenuState());
  });

  getElements().btnItalian.addEventListener("click", () => {
    handleLanguageChange("it");
    setGameState(getMenuState());
  });

  getElements().btnFrench.addEventListener("click", () => {
    handleLanguageChange("fr");
    setGameState(getMenuState());
  });

  getElements().saveGameButton.addEventListener("click", function () {
    getElements().overlay.classList.remove("d-none");
    saveGame(true);
  });

  getElements().loadGameButton.addEventListener("click", function () {
    getElements().overlay.classList.remove("d-none");
    loadGameOption();
  });

  getElements().copyButtonSavePopup.addEventListener("click", function () {
    copySaveStringToClipBoard();
  });

  getElements().closeButtonSavePopup.addEventListener("click", function () {
    getElements().saveLoadPopup.classList.add("d-none");
    getElements().overlay.classList.add("d-none");
  });

  getElements().loadStringButton.addEventListener("click", function () {
    loadGame(true)
      .then(() => {
        setElements();
        getElements().saveLoadPopup.classList.add("d-none");
        document.getElementById("overlay").classList.add("d-none");
        setGameState(getMenuState());
      })
      .catch((error) => {
        console.error("Error loading game:", error);
      });
  });
  setGameState(getMenuState());
  handleLanguageChange(getLanguageSelected());
});

async function setElementsLanguageText() {
  // Localization text
  getElements().menuTitle.innerHTML = `<h2>${localize(
    "menuTitle",
    getLanguage()
  )}</h2>`;
  getElements().newGameMenuButton.innerHTML = `${localize(
    "newGame",
    getLanguage()
  )}`;
  getElements().resumeGameMenuButton.innerHTML = `${localize(
    "resumeGame",
    getLanguage()
  )}`;
  getElements().loadGameButton.innerHTML = `${localize(
    "loadGame",
    getLanguage()
  )}`;
  getElements().saveGameButton.innerHTML = `${localize(
    "saveGame",
    getLanguage()
  )}`;
  getElements().loadStringButton.innerHTML = `${localize(
    "loadButton",
    getLanguage()
  )}`;
}

export async function handleLanguageChange(languageCode) {
  setLanguageSelected(languageCode);
  await setupLanguageAndLocalization();
  setElementsLanguageText();
}

async function setupLanguageAndLocalization() {
  setLanguage(getLanguageSelected());
  await initLocalization(getLanguage());
}

export function disableActivateButton(button, action, activeClass) {
  switch (action) {
    case "active":
      button.classList.remove("disabled");
      button.classList.add(activeClass);
      break;
    case "disable":
      button.classList.remove(activeClass);
      button.classList.add("disabled");
      break;
  }
}

function requestCanvasFullscreen() {
  const elem = document.getElementById("fullscreenContainer");
  if (elem.requestFullscreen) {
    elem.requestFullscreen();
  } else if (elem.mozRequestFullScreen) {
    elem.mozRequestFullScreen();
  } else if (elem.webkitRequestFullscreen) {
    elem.webkitRequestFullscreen();
  } else if (elem.msRequestFullscreen) {
    elem.msRequestFullscreen();
  }
}

function exitFullscreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.mozCancelFullScreen) {
    document.mozCancelFullScreen();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
  }
}

export function drawDebugGrid(ctx) {
  if (!getShowGrid()) return;
  const canvas = getElements().canvas;
  const canvasHeight = canvas.height;
  const canvasWidth = canvas.width;

  const zoom = getZoomLevel();
  const { viewWidth, viewHeight } = getViewWindow(zoom);

  const scale = canvasHeight / viewHeight;
  const cameraX = getCameraX();
  const cameraY = getCameraY();

  const cellW = mainGridObject.CELL_WIDTH;
  const cellH = mainGridObject.CELL_HEIGHT;
  const gridW = mainGridObject.GRID_COLS * cellW;

  ctx.save();
  ctx.strokeStyle = "rgba(0, 255, 0, 0.3)";
  ctx.lineWidth = 1;

  const leftWorld = cameraX;
  const rightWorld = cameraX + canvasWidth / scale;
  const topWorld = cameraY;
  const bottomWorld = cameraY + canvasHeight / scale;

  const startX = Math.floor(leftWorld / cellW) * cellW;
  const endX = Math.ceil(rightWorld / cellW) * cellW;

  const startY = Math.floor(topWorld / cellH) * cellH;
  const endY = Math.ceil(bottomWorld / cellH) * cellH;

  for (let x = startX; x < endX; x += cellW) {
    const wrappedX = ((x % gridW) + gridW) % gridW;
    const screenX = (x - cameraX) * scale;
    ctx.beginPath();
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, canvasHeight);
    ctx.stroke();
  }

  for (let y = startY; y < endY; y += cellH) {
    const screenY = (y - cameraY) * scale;
    ctx.beginPath();
    ctx.moveTo(0, screenY);
    ctx.lineTo(canvasWidth, screenY);
    ctx.stroke();
  }

  ctx.restore();
}
