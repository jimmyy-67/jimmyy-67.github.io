/* ============================================================================
 * contact.js - interacciones de la vista de contacto (copiar Discord)
 * ==========================================================================*/

/* discord copy with fallback */
export function initContact() {
  const discordBtn = document.getElementById("discord-copy");
  if (!discordBtn) return;

  const copyDiscord = async () => {
    const text = "jimy1_";
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("no clipboard");
      }
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* The legacy copy fallback is best-effort. */
      }
      ta.remove();
    }
    const status = document.getElementById("discord-status");
    if (status) status.textContent = "Discord username copied to clipboard.";
    const prev = discordBtn.textContent;
    discordBtn.textContent = "Copied!";
    setTimeout(() => {
      discordBtn.textContent = prev;
    }, 1500);
  };
  // #discord-copy es ahora un <button> real: Enter y Espacio ya disparan
  // "click" de forma nativa, sin listener de teclado adicional.
  discordBtn.addEventListener("click", copyDiscord);
}
