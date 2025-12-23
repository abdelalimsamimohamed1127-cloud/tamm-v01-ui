(function () {
  const script = document.currentScript;
  if (!script) {
    console.error("tamm embed: unable to locate currentScript");
    return;
  }

  const agentId = script.dataset.agentId;
  if (!agentId) {
    console.error("tamm embed: data-agent-id is required");
    return;
  }

  const baseUrl = script.dataset.baseUrl || new URL(script.src).origin;

  if (document.getElementById("tamm-widget-container")) {
    return;
  }

  const container = document.createElement("div");
  container.id = "tamm-widget-container";
  document.body.appendChild(container);

  const style = document.createElement("style");
  style.textContent = `
    #tamm-widget-button {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      border: none;
      background: #2563eb;
      color: #fff;
      cursor: pointer;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.16);
      z-index: 9999;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    #tamm-widget-button:hover {
      transform: scale(1.05);
      box-shadow: 0 12px 35px rgba(0, 0, 0, 0.2);
    }
    #tamm-widget-iframe {
      position: fixed;
      bottom: 100px;
      right: 20px;
      width: 380px;
      height: 600px;
      border-radius: 12px;
      z-index: 9999;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
      border: none;
      background: transparent;
      display: none;
    }
    @media (max-width: 480px) {
      #tamm-widget-iframe {
        width: 100%;
        height: 100%;
        bottom: 0;
        right: 0;
        border-radius: 0;
      }
      #tamm-widget-button {
        bottom: 16px;
        right: 16px;
      }
    }
  `;
  document.head.appendChild(style);

  const button = document.createElement("button");
  button.id = "tamm-widget-button";
  button.setAttribute("aria-label", "Open chat widget");
  button.textContent = "💬";

  const iframe = document.createElement("iframe");
  iframe.id = "tamm-widget-iframe";
  iframe.src = `${baseUrl}/chat/${agentId}?mode=embed`;
  iframe.allow = "clipboard-write";

  let isOpen = false;
  button.addEventListener("click", function () {
    isOpen = !isOpen;
    iframe.style.display = isOpen ? "block" : "none";
    button.textContent = isOpen ? "✕" : "💬";
    button.setAttribute("aria-label", isOpen ? "Close chat widget" : "Open chat widget");
  });

  container.appendChild(button);
  container.appendChild(iframe);
})();
