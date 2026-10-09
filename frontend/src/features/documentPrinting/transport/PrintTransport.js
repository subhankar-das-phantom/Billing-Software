/**
 * Robust Browser Print Transport with Explicit 8-Step Lifecycle
 * Bharat Enterprise Billing System
 */

import { PRINT_FORMATS } from '../formats/documentPrintFormats';

const DYNAMIC_STYLE_ID = 'bharat-dynamic-print-page-style';

/**
 * Generates format-specific CSS @page rules
 * @param {string} format - One of PRINT_FORMATS
 */
function getFormatPageCss(format) {
  switch (format) {
    case PRINT_FORMATS.A5:
      return `@page { size: A5 portrait; margin: 5mm; }`;
    case PRINT_FORMATS.THERMAL_80:
      return `@page { size: 80mm auto; margin: 2mm; }`;
    case PRINT_FORMATS.THERMAL_58:
      return `@page { size: 58mm auto; margin: 2mm; }`;
    case PRINT_FORMATS.A4:
    default:
      return `@page { size: A4 portrait; margin: 6mm; }`;
  }
}

/**
 * Injects dynamic format-specific @page style tag into document head
 * Prevents unrelated print jobs or subsequent prints from inheriting past dimensions
 */
export function injectDynamicPageStyle(format) {
  let styleEl = document.getElementById(DYNAMIC_STYLE_ID);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = DYNAMIC_STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `@media print { ${getFormatPageCss(format)} }`;
}

/**
 * Cleans up the dynamic @page style tag
 */
export function removeDynamicPageStyle() {
  const styleEl = document.getElementById(DYNAMIC_STYLE_ID);
  if (styleEl) {
    styleEl.remove();
  }
}

/**
 * Ensures React DOM commit and style computation have completed via double requestAnimationFrame
 */
export function waitForRenderReady() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

/**
 * Waits for fonts and any unmounted images inside the printable container to finish loading
 */
export async function waitForAssetsReady(containerElement = null) {
  // 1. Wait for web fonts if supported
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Non-fatal if font loading times out
    }
  }

  // 2. Wait for images inside container if any
  if (containerElement) {
    const images = Array.from(containerElement.querySelectorAll('img'));
    const pendingImages = images.filter((img) => !img.complete);
    if (pendingImages.length > 0) {
      await Promise.all(
        pendingImages.map(
          (img) =>
            new Promise((res) => {
              img.onload = res;
              img.onerror = res;
              // Guard with max 1s timeout
              setTimeout(res, 1000);
            })
        )
      );
    }
  }
}

/**
 * Executes the complete 8-step browser print lifecycle.
 * Resolves safely when print dialog closes or errors occur without unmounting prematurely.
 *
 * @param {Object} options
 * @param {string} options.format - Target format (A4, A5, THERMAL_80, THERMAL_58)
 * @param {HTMLElement} [options.containerElement] - Root element of printable document
 * @returns {Promise<{ success: boolean, format: string, error?: any }>}
 */
export async function executeBrowserPrint({ format = PRINT_FORMATS.A4, containerElement = null } = {}) {
  try {
    // Step 5: Inject dynamic format-specific page sizing rule
    injectDynamicPageStyle(format);

    // Step 6: Wait for DOM frame synchronization
    await waitForRenderReady();

    // Step 7: Wait for fonts & images
    await waitForAssetsReady(containerElement);

    // Step 8: Trigger window.print() and coordinate cleanup via afterprint
    return new Promise((resolve) => {
      let resolved = false;

      const handleAfterPrint = () => {
        if (resolved) return;
        resolved = true;
        window.removeEventListener('afterprint', handleAfterPrint);
        removeDynamicPageStyle();
        resolve({
          success: true,
          format,
          printedVia: 'BrowserPrintTransport'
        });
      };

      window.addEventListener('afterprint', handleAfterPrint, { once: true });

      // Immediate browser print call
      window.print();

      // Guard: Some older webviews or headless test runners may not dispatch afterprint
      // We set a passive check that ensures resolved state does not hang indefinitely
      setTimeout(() => {
        if (!resolved) {
          handleAfterPrint();
        }
      }, 5000);
    });
  } catch (err) {
    removeDynamicPageStyle();
    return {
      success: false,
      format,
      error: err
    };
  }
}
