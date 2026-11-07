type DocumentPictureInPicture = {
  window: Window | null;
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
};

const MINI_URL = "/mini";
const POPUP_FEATURES = "popup=yes,width=360,height=620";

/** True when this browser can float the agenda above every other window (Chrome/Edge 116+). */
export function canPinMiniAgenda() {
  return "documentPictureInPicture" in window;
}

/**
 * Opens the compact agenda as a small always-on-top window (Document Picture-in-Picture).
 * It stays open as long as the VetVAX tab that opened it is open. Browsers without the API
 * get a regular small popup window instead.
 */
export async function openMiniAgenda() {
  const pip = (window as unknown as { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture;
  if (!pip) {
    window.open(MINI_URL, "vetvax-mini", POPUP_FEATURES);
    return;
  }

  if (pip.window) {
    pip.window.focus();
    return;
  }

  const win = await pip.requestWindow({ width: 360, height: 620 });
  win.document.title = "Agenda VetVAX";
  win.document.body.style.margin = "0";
  win.document.body.style.overflow = "hidden";

  const frame = win.document.createElement("iframe");
  frame.src = `${window.location.origin}${MINI_URL}`;
  frame.style.cssText = "border:0;width:100vw;height:100vh;display:block";
  win.document.body.append(frame);
}
