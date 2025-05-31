import { localize } from "./localization.js";
import {
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
  getGameInProgress
} from "./constantsAndGlobalVars.js";

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
    setCameraY(0);
    setZoomLevel(0);

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

  // console.log("Camera X:", getCameraX());
  // console.log("Camera Y:", getCameraY());
  // console.log("Zoom Level:", getZoomLevel());

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground(ctx);
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
  const bgImage = getBackgroundImage();
  const maxZoom = 9;
  const zoomFactor = 1 - (zoomLevel / maxZoom) * 0.7;

  const viewWidth = bgImage.width * zoomFactor;
  const viewHeight = bgImage.height * zoomFactor;

  return { viewWidth, viewHeight };
}

export function drawBackground(ctx) {
  if (!getBackgroundLoaded()) return;

  const canvas = getElements().canvas;
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  const bgImage = getBackgroundImage();

  const cameraX = getCameraX();
  let cameraY = getCameraY();
  const zoomLevel = getZoomLevel();
  const { viewWidth, viewHeight } = getViewWindow(zoomLevel);

  cameraY = Math.min(Math.max(0, cameraY), bgImage.height - viewHeight);

  const scale = canvasHeight / viewHeight;

  const wrappedCameraX =
    ((cameraX % bgImage.width) + bgImage.width) % bgImage.width;

  const rightPartWidth = bgImage.width - wrappedCameraX;
  const viewWidthFirstPart = Math.min(viewWidth, rightPartWidth);
  const viewWidthSecondPart = viewWidth - viewWidthFirstPart;

  const destWidthFirstPart = Math.round(viewWidthFirstPart * scale);
  const destWidthSecondPart = viewWidthSecondPart * scale;

  ctx.drawImage(
    bgImage,
    wrappedCameraX,
    cameraY,
    viewWidthFirstPart,
    viewHeight,
    0,
    0,
    destWidthFirstPart,
    canvasHeight
  );

  if (viewWidthSecondPart > 0) {
    ctx.drawImage(
      bgImage,
      0,
      cameraY,
      viewWidthSecondPart,
      viewHeight,
      destWidthFirstPart,
      0,
      destWidthSecondPart,
      canvasHeight
    );
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
