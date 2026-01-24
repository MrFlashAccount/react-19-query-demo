import { PIP_STYLES } from "./styles";

interface CreatePIPParams {
  width?: number;
  height?: number;
  element: HTMLElement;
  onClose?: (element: HTMLElement) => void;
}

export async function createPIP(params: CreatePIPParams) {
  const { element, onClose, width = 800, height = 500 } = params;

  if (!window.documentPictureInPicture) return null;

  try {
    // Request PiP window
    const pipWindow = await window.documentPictureInPicture.requestWindow({
      width,
      height,
    });

    // Style the PiP body
    const pipBody = pipWindow.document.body;
    const pipHead = pipWindow.document.head;

    // Create a wrapper element for the PiP window with its own shadow DOM
    const pipWrapper = pipWindow.document.createElement("div");
    pipWrapper.id = "pip-wrapper";
    const pipShadow = pipWrapper.attachShadow({ mode: "open" });
    pipShadow.appendChild(element);
    pipBody.append(pipWrapper);

    const style = document.createElement("style");
    style.textContent = PIP_STYLES;

    pipHead.append(style);

    function onPageHide() {
      const content = pipShadow.removeChild(element);
      pipWindow.close();
      pipWindow.removeEventListener("pagehide", onPageHide);
      onClose?.(content);

      return content;
    }

    pipWindow.addEventListener("pagehide", onPageHide);

    return {
      window: pipWindow,
      close: onPageHide,
    };
  } catch (err) {
    console.error("Failed to enter PiP mode:", err);
    return null;
  }
}
