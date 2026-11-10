import QRCode from "qrcode";

export const qrImageOptions = { errorCorrectionLevel: "M", margin: 4, width: 640, color: { dark: "#000000", light: "#ffffff" } };
export const renderPaynowImage = (payload) => QRCode.toDataURL(payload, qrImageOptions);

export async function savePaynowImage(dataUrl, reference, browser = { navigator, document }) {
  if (!/^data:image\/png;base64,/.test(dataUrl) || !/^[A-Za-z0-9-]{1,25}$/.test(reference)) throw new Error("QR is not ready");
  const bytes = Uint8Array.from(atob(dataUrl.split(",")[1]), char => char.charCodeAt(0));
  const file = new File([bytes], `swirl-paynow-${reference}.png`, { type: "image/png" });
  if (browser.navigator.canShare?.({ files: [file] }) && browser.navigator.share) {
    try {
      await browser.navigator.share({ files: [file], title: "Swirl Girl payment QR" });
      return "shared";
    } catch (error) {
      if (error.name === "AbortError") return "cancelled";
      // A browser can report file sharing support but still reject a share.
    }
  }
  const link = browser.document.createElement("a");
  link.href = dataUrl;
  link.download = file.name;
  browser.document.body.appendChild(link);
  link.click();
  link.remove();
  return "downloaded";
}
