/* global SwaggerUIBundle, SwaggerUIStandalonePreset */

const initSwaggerUI = async () => {
  const response = await fetch("./swagger.json");
  const spec = await response.json();

  // Build Swagger UI
  window.ui = SwaggerUIBundle({
    spec,
    dom_id: "#remote",
    deepLinking: true,
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    plugins: [SwaggerUIBundle.plugins.DownloadUrl],
    layout: "StandaloneLayout"
  });

  // Hide try-it buttons on GitHub Pages
  if (window.location.href.includes("github")) {
    const style = document.createElement("style");
    style.textContent = "button.btn.try-out__btn, .auth-wrapper {display: none !important;}";
    document.head.appendChild(style);
  }

  // Rearrange documentation elements
  reorganizeInfoSection();

  // Watch for Swagger UI updates and apply enhancements
  observeSwaggerUI();
};

const reorganizeInfoSection = () => {
  const extdocs = document.querySelector(".info__extdocs");
  const info = document.querySelector(".info");
  const license = document.querySelector(".info__license");

  if (extdocs && info) {
    const wrapper = document.createElement("div");
    wrapper.appendChild(extdocs);
    info.appendChild(wrapper);
  }

  license?.parentElement?.appendChild(license);
};

const enhanceUI = () => {
  // Move response controls to the end of their parent
  document.querySelectorAll(".response-controls").forEach((item) => {
    const parent = item.parentNode;
    if (parent?.lastChild !== item) {
      parent?.appendChild(item);
    }
  });

  // Remove empty content-type selects
  document.querySelectorAll("select.content-type").forEach((select) => {
    if (select.childNodes.length <= 1) {
      select.parentNode?.remove();
    }
  });
};

const observeSwaggerUI = () => {
  const targetNode = document.getElementById("remote");
  if (!targetNode) return;

  const observer = new MutationObserver((mutations) => {
    // Check if mutations include added nodes that need enhancement
    const hasRelevantChanges = mutations.some((mutation) => mutation.addedNodes.length > 0 || mutation.type === "attributes");

    if (hasRelevantChanges) {
      enhanceUI();
    }
  });

  observer.observe(targetNode, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"]
  });

  // Initial enhancement
  enhanceUI();
};

window.addEventListener("DOMContentLoaded", initSwaggerUI);

