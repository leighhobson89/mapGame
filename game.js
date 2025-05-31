import { localize } from "./localization.js";
import {
  getLevelWidth,
  getBackgroundLoaded,
  getBackgroundImage,
  loadBackgroundImage,
  SCROLL_SPEED,
  LEVEL_WIDTH,
  getCameraX,
  setCameraX,
  getScrollLeftFlag,
  getScrollRightFlag,
  getCanvasHeight,
  getCanvasWidth,
  getCanvasAspectRatio,
  getInitialSpeedMovingEnemy,
  setGameStateVariable,
  getBeginGameStatus,
  getMaxAttemptsToDrawEnemies,
  getPlayerObject,
  getMenuState,
  getGameVisiblePaused,
  getGameVisibleActive,
  getNumberOfEnemySquares,
  getElements,
  getLanguage,
  getGameInProgress,
  gameState,
} from "./constantsAndGlobalVars.js";

let playerObject = getPlayerObject();
let movingEnemy = {};

const enemySquares = [];

//--------------------------------------------------------------------------------------------------------

export async function startGame() {
  const ctx = getElements().canvas.getContext("2d");
  const canvas = getElements().canvas;
  const container = getElements().canvasContainer;

  const internalWidth = getCanvasWidth();
  const internalHeight = getCanvasHeight();

  canvas.width = internalWidth;
  canvas.height = internalHeight;

  await updateCanvasSize(container, internalWidth, internalHeight, canvas, ctx);
  window.addEventListener("resize", () => {
    updateCanvasSize(container, internalWidth, internalHeight, canvas, ctx);
  });

  loadBackgroundImage(() => {
    setCameraX((LEVEL_WIDTH - canvas.width) / 2);

    gameLoop();
  });
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
  requestAnimationFrame(gameLoop);
}

export function updateCamera() {
  let newCameraX = getCameraX();

  if (getScrollLeftFlag()) {
    newCameraX -= SCROLL_SPEED;
  }
  if (getScrollRightFlag()) {
    newCameraX += SCROLL_SPEED;
  }

  const LEVEL_WIDTH = getLevelWidth();
  newCameraX = ((newCameraX % LEVEL_WIDTH) + LEVEL_WIDTH) % LEVEL_WIDTH;

  setCameraX(newCameraX);
}

function drawBackground(ctx) {
  if (!getBackgroundLoaded()) return;

  const canvas = getElements().canvas;
  const canvasHeight = canvas.height;

  const bgImage = getBackgroundImage();
  const LEVEL_WIDTH = getLevelWidth();

  // Scale factor to fit the image height to canvas height
  const scale = canvasHeight / bgImage.height;

  const scaledWidth = bgImage.width * scale;
  const scaledHeight = bgImage.height * scale;

  const cameraX = getCameraX();
  const scaledCameraX = cameraX * scale;

  const drawX = scaledCameraX % scaledWidth;

  ctx.drawImage(
    bgImage,
    drawX / scale,
    0,
    bgImage.width - drawX / scale,
    bgImage.height,
    0,
    0,
    scaledWidth - drawX,
    scaledHeight
  );

  ctx.drawImage(
    bgImage,
    0,
    0,
    drawX / scale,
    bgImage.height,
    scaledWidth - drawX,
    0,
    drawX,
    scaledHeight
  );
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
