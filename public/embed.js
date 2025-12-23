(function () {
  var script = document.currentScript;
  if (!script) return;

  var agentId = script.getAttribute("data-agent-id");
  if (!agentId) {
    console.error("Tamm Widget: data-agent-id is required");
    return;
  }

  var baseUrl =
    script.getAttribute("data-base-url") || new URL(script.src).origin;

  var style = document.createElement("style");
  style.textContent = "\n    #tamm-widget-container {\n      position: relative;\n      z-index: 9999;\n    }\n\n    #tamm-widget-launcher {\n      position: fixed;\n      bottom: 20px;\n      right: 20px;\n      width: 60px;\n      height: 60px;\n      border-radius: 9999px;\n      border: none;\n      background: #111827;\n      color: white;\n      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);\n      cursor: pointer;\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      transition: transform 0.2s ease;\n    }\n\n    #tamm-widget-launcher:hover {\n      transform: translateY(-2px);\n    }\n\n    #tamm-widget-iframe {\n      position: fixed;\n      bottom: 100px;\n      right: 20px;\n      width: 380px;\n      height: 600px;\n      border: none;\n      border-radius: 16px;\n      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);\n      background: white;\n      z-index: 9999;\n      display: none;\n    }\n\n    @media (max-width: 480px) {\n      #tamm-widget-iframe {\n        width: 100%;\n        height: 100%;\n        bottom: 0;\n        right: 0;\n        border-radius: 0;\n      }\n    }\n  ";
  document.head.appendChild(style);

  var container = document.createElement("div");
  container.id = "tamm-widget-container";
  document.body.appendChild(container);

  var chatIcon =
    '<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" width=\"26\" height=\"26\"><path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z\"></path></svg>';
  var closeIcon =
    '<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" width=\"22\" height=\"22\"><line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"></line><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"></line></svg>';

  var launcher = document.createElement("button");
  launcher.id = "tamm-widget-launcher";
  launcher.type = "button";
  launcher.innerHTML = chatIcon;
  container.appendChild(launcher);

  var iframe = document.createElement("iframe");
  iframe.id = "tamm-widget-iframe";
  iframe.title = "Tamm Chat";
  iframe.src = baseUrl + "/chat/" + encodeURIComponent(agentId) + "?mode=embed";
  iframe.loading = "lazy";
  container.appendChild(iframe);

  var isOpen = false;
  launcher.addEventListener("click", function () {
    isOpen = !isOpen;
    iframe.style.display = isOpen ? "block" : "none";
    launcher.innerHTML = isOpen ? closeIcon : chatIcon;
  });
})();
