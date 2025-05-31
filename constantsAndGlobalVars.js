import { getViewWindow } from "./game.js";

//DEBUG
export let debugFlag = false;
export let debugOptionFlag = false;
export let stateLoading = false;

//ELEMENTS
let elements;
let localization = {};
let language = "en";
let languageSelected = "en";
let oldLanguage = "en";

//CONSTANTS
export let gameState;
export const SCROLL_SPEED = 10;
export const SCROLL_EDGE_THRESHOLD = 50;

export const GAME_CANVAS_WIDTH = 1280;
export const GAME_CANVAS_HEIGHT = 720;
export const GAME_ASPECT_RATIO = GAME_CANVAS_WIDTH / GAME_CANVAS_HEIGHT;

export const MENU_STATE = "menuState";
export const GAME_VISIBLE_PAUSED = "gameVisiblePaused";
export const GAME_VISIBLE_ACTIVE = "gameVisibleActive";
export const NUMBER_OF_ENEMY_SQUARES = 10;
export const INITIAL_SPEED_PLAYER = 4;
export const INITIAL_SPEED_MOVING_ENEMY = 4;
export const MAX_ATTEMPTS_TO_DRAW_ENEMIES = 1000;
export const LEVEL_WIDTH = 2560;
export const LEVEL_HEIGHT = 720;
export const TERRAIN_TYPES = ["ice", "grassland", "ocean"];

export const mainGridObject = (function () {
  const CELL_WIDTH = 10;
  const CELL_HEIGHT = 10;
  const GRID_COLS = Math.floor(LEVEL_WIDTH / CELL_WIDTH);
  const GRID_ROWS = Math.floor(LEVEL_HEIGHT / CELL_HEIGHT);

  let grid = [];

  const defaultCell = (x, y) => ({
    x,
    y,
    walkable: true,
    type: "empty",
    terrainType: null,
    metadata: {},
  });

  for (let y = 0; y < GRID_ROWS; y++) {
    const row = [];
    for (let x = 0; x < GRID_COLS; x++) {
      row.push(defaultCell(x, y));
    }
    grid.push(row);
  }

  return {
    CELL_WIDTH,
    CELL_HEIGHT,
    GRID_COLS,
    GRID_ROWS,

    getCell(x, y) {
      if (this.isValid(x, y)) return grid[y][x];
      return null;
    },

    setCellData(x, y, data) {
      const cell = this.getCell(x, y);
      if (cell) {
        cell.walkable = data.walkable ?? cell.walkable;
        cell.type = data.type ?? cell.type;
        cell.terrainType = data.terrainType ?? cell.terrainType;
        cell.metadata = data.metadata ?? cell.metadata;
      }
    },

    setCellProperty(x, y, key, value) {
      const cell = this.getCell(x, y);
      if (cell && key in cell) {
        cell[key] = value;
      }
    },

    getCellProperty(x, y, key) {
      const cell = this.getCell(x, y);
      return cell ? cell[key] : null;
    },

    isValid(x, y) {
      return (
        Number.isInteger(x) &&
        Number.isInteger(y) &&
        x >= 0 &&
        y >= 0 &&
        x < GRID_COLS &&
        y < GRID_ROWS
      );
    },

    getGrid() {
      return grid;
    },

    screenToGrid(screenX, screenY) {
      const zoom = getZoomLevel();
      const { viewWidth, viewHeight } = getViewWindow(zoom);
      const canvas = getElements().canvas;
      const canvasHeight = canvas.height;

      const scale = canvasHeight / viewHeight;

      const cameraX = getCameraX();
      const cameraY = getCameraY();

      const worldX = cameraX + screenX / scale;
      const worldY = cameraY + screenY / scale;

      const wrappedX =
        ((worldX % (GRID_COLS * CELL_WIDTH)) + GRID_COLS * CELL_WIDTH) %
        (GRID_COLS * CELL_WIDTH);

      const gridX = Math.floor(wrappedX / CELL_WIDTH);
      const gridY = Math.floor(worldY / CELL_HEIGHT);

      return this.getCell(gridX, gridY);
    },

    saveGrid() {
      return JSON.stringify(grid);
    },

    loadGrid(json) {
      try {
        const parsed = JSON.parse(json);
        if (
          Array.isArray(parsed) &&
          parsed.length === GRID_ROWS &&
          parsed[0].length === GRID_COLS
        ) {
          grid = parsed;
        }
      } catch (e) {
        console.error("Failed to load grid:", e);
      }
    },
  };
})();

//GLOBAL VARIABLES
let cameraX = 0;
let cameraY = 0;
let zoomLevel = 0;
let hoveredCell = null;
let showGrid = false;

let backgroundImage = new Image();
let backgroundLoaded = false;

//FLAGS
let audioMuted;
let languageChangedFlag;
let beginGameState = true;
let gameInProgress = false;
let scrollLeft = false;
let scrollRight = false;
let scrollUp = false;
let scrollDown = false;

let autoSaveOn = false;
export let pauseAutoSaveCountdown = true;

export function loadBackgroundImage(callback) {
  backgroundImage.src = "./assets/world/worldMap.png";
  backgroundImage.onload = () => {
    backgroundLoaded = true;
    callback && callback();
  };
}

//GETTER SETTER METHODS
export function setElements() {
  elements = {
    menu: document.getElementById("menu"),
    menuTitle: document.getElementById("menuTitle"),
    newGameMenuButton: document.getElementById("newGame"),
    resumeGameMenuButton: document.getElementById("resumeFromMenu"),
    loadGameButton: document.getElementById("loadGame"),
    saveGameButton: document.getElementById("saveGame"),
    saveLoadPopup: document.getElementById("loadSaveGameStringPopup"),
    loadSaveGameStringTextArea: document.getElementById(
      "loadSaveGameStringTextArea"
    ),
    loadStringButton: document.getElementById("loadStringButton"),
    textAreaLabel: document.getElementById("textAreaLabel"),
    returnToMenuButton: document.getElementById("returnToMenu"),
    pauseResumeGameButton: document.getElementById("resumeGame"),
    canvas: document.getElementById("canvas"),
    canvasContainer: document.getElementById("canvasContainer"),
    buttonRow: document.getElementById("buttonRow"),
    btnEnglish: document.getElementById("btnEnglish"),
    btnSpanish: document.getElementById("btnSpanish"),
    btnFrench: document.getElementById("btnFrench"),
    btnGerman: document.getElementById("btnGerman"),
    btnItalian: document.getElementById("btnItalian"),
    copyButtonSavePopup: document.getElementById("copyButtonSavePopup"),
    closeButtonSavePopup: document.getElementById("closeButtonSavePopup"),
    overlay: document.getElementById("overlay"),
  };
}

export function getPlayerObject() {
  return playerObject;
}

export function setGameStateVariable(value) {
  gameState = value;
}

export function getGameStateVariable() {
  return gameState;
}

export function getElements() {
  return elements;
}

export function getLanguageChangedFlag() {
  return languageChangedFlag;
}

export function setLanguageChangedFlag(value) {
  languageChangedFlag = value;
}

export function resetAllVariables() {
  // GLOBAL VARIABLES
  // FLAGS
}

export function captureGameStatusForSaving() {
  let gameState = {};

  // Game variables

  // Flags

  // UI elements

  gameState.language = getLanguage();

  return gameState;
}
export function restoreGameStatus(gameState) {
  return new Promise((resolve, reject) => {
    try {
      // Game variables

      // Flags

      // UI elements

      setLanguage(gameState.language);

      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

export function setLocalization(value) {
  localization = value;
}

export function getLocalization() {
  return localization;
}

export function setLanguage(value) {
  language = value;
}

export function getLanguage() {
  return language;
}

export function setOldLanguage(value) {
  oldLanguage = value;
}

export function getOldLanguage() {
  return oldLanguage;
}

export function setAudioMuted(value) {
  audioMuted = value;
}

export function getAudioMuted() {
  return audioMuted;
}

export function getMenuState() {
  return MENU_STATE;
}

export function getGameVisiblePaused() {
  return GAME_VISIBLE_PAUSED;
}

export function getGameVisibleActive() {
  return GAME_VISIBLE_ACTIVE;
}

export function getNumberOfEnemySquares() {
  return NUMBER_OF_ENEMY_SQUARES;
}

export function getInitialSpeedPlayer() {
  return INITIAL_SPEED_PLAYER;
}

export function getInitialSpeedMovingEnemy() {
  return INITIAL_SPEED_MOVING_ENEMY;
}

export function getMaxAttemptsToDrawEnemies() {
  return MAX_ATTEMPTS_TO_DRAW_ENEMIES;
}

export function getLanguageSelected() {
  return languageSelected;
}

export function setLanguageSelected(value) {
  languageSelected = value;
}

export function getBeginGameStatus() {
  return beginGameState;
}

export function setBeginGameStatus(value) {
  beginGameState = value;
}

export function getGameInProgress() {
  return gameInProgress;
}

export function setGameInProgress(value) {
  gameInProgress = value;
}

export function getCanvasWidth() {
  return GAME_CANVAS_WIDTH;
}

export function getCanvasHeight() {
  return GAME_CANVAS_HEIGHT;
}

export function getCanvasAspectRatio() {
  return GAME_ASPECT_RATIO;
}

export function getCameraX() {
  return cameraX;
}

export function getCameraY() {
  return cameraY;
}

export function setCameraX(value) {
  cameraX = value;
}

export function setCameraY(value) {
  cameraY = value;
}

export function getScrollUpFlag() {
  return scrollUp;
}

export function getScrollDownFlag() {
  return scrollDown;
}

export function setScrollUpFlag(val) {
  scrollUp = val;
}

export function setScrollDownFlag(val) {
  scrollDown = val;
}

export function getScrollLeftFlag() {
  return scrollLeft;
}

export function setScrollLeftFlag(value) {
  scrollLeft = value;
}

export function getScrollRightFlag() {
  return scrollRight;
}

export function setScrollRightFlag(value) {
  scrollRight = value;
}

export function getBackgroundImage() {
  return backgroundImage;
}

export function getBackgroundLoaded() {
  return backgroundLoaded;
}

export function getLevelWidth() {
  return LEVEL_WIDTH;
}

export function getLevelHeight() {
  return LEVEL_HEIGHT;
}

export function getZoomLevel() {
  return zoomLevel;
}

export function setZoomLevel(value) {
  zoomLevel = value;
}

export function getHoveredCell() {
  return hoveredCell;
}

export function setHoveredCell(value) {
  hoveredCell = value;
}

export function getShowGrid() {
  return showGrid;
}

export function setShowGrid(value) {
  showGrid = value;
}

export function getTerrainTypes() {
  return TERRAIN_TYPES;
}
