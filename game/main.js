/* Lantern Lane — bootstrap.
   One job: wait for the document, then hand control to LanternGame.
   Loaded last, after scenes.js, render.js, audio.js and game.js. */

document.addEventListener('DOMContentLoaded', function () {
  LanternGame.init();
});
