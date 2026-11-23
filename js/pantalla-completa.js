(() => {
  const button = document.getElementById("fullscreen-toggle");
  if (!button) return;

  const isFullscreen = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  const updateButton = () => {
    const active = isFullscreen();
    const label = active ? "Salir de pantalla completa" : "Ver en pantalla completa";
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(active));
    button.title = label;
    button.querySelector(".fullscreen-icon").textContent = active ? "⤢" : "⛶";
  };

  button.addEventListener("click", async () => {
    try {
      if (isFullscreen()) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } else {
        const page = document.documentElement;
        if (page.requestFullscreen) await page.requestFullscreen();
        else if (page.webkitRequestFullscreen) page.webkitRequestFullscreen();
      }
    } catch (error) {
      console.warn("No fue posible cambiar el modo de pantalla completa.", error);
    }
    updateButton();
  });

  document.addEventListener("fullscreenchange", updateButton);
  document.addEventListener("webkitfullscreenchange", updateButton);
  updateButton();
})();
