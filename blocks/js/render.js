/**
 * Markdown rendering utilities
 */

/**
 * Renders markdown text with support for Mermaid diagrams and KaTeX
 * @param {string} text - The markdown text to render
 * @returns {string} - HTML output
 */
function renderMarkdown(text) {
  const html = marked.parse(text);
  const container = document.createElement("div");
  container.innerHTML = html;

  // Replace ```mermaid blocks with <div class="mermaid">
  container.querySelectorAll("code.language-mermaid").forEach(code => {
    const div = document.createElement("div");
    div.className = "mermaid";
    div.textContent = code.textContent;
    code.parentElement.replaceWith(div);
  });

  // Render KaTeX
  if (typeof renderMathInElement === "function") {
    try {
      renderMathInElement(container, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false }
        ]
      });
    } catch (e) {
      console.warn("KaTeX rendering failed:", e);
    }
  }

  // We don't render Mermaid here, as it should be rendered after the container 
  // is added to the DOM. Instead, we expect the caller to call renderMermaidIn
  // after adding the HTML to the DOM.

  return container.innerHTML;
}

/**
 * Render Mermaid diagrams in the specified container
 * @param {string|Element} selector - CSS selector or DOM element containing Mermaid diagrams
 */
function renderMermaidIn(selector) {
  if (typeof mermaid === "undefined") return;

  const blocks = typeof selector === 'string' 
    ? document.querySelectorAll(selector) 
    : selector.querySelectorAll ? selector.querySelectorAll(".mermaid") : [];
    
  if (!blocks.length) return;

  // Defer rendering to avoid layout issues
  setTimeout(() => {
    try {
      mermaid.init(undefined, blocks);
    } catch (e) {
      console.warn("Mermaid rendering error:", e);
    }
  }, 100);
}

/**
 * Load Mermaid and KaTeX libraries
 */
function loadMermaidAndKatex() {
  // Check if already loaded
  if (typeof mermaid !== "undefined" && typeof katex !== "undefined") {
    return;
  }
  
  // Mermaid
  if (typeof mermaid === "undefined") {
    const mermaidScript = document.createElement("script");
    mermaidScript.src = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
    mermaidScript.onload = () => mermaid.initialize({ startOnLoad: false });
    document.head.appendChild(mermaidScript);
  }

  // KaTeX CSS
  if (!document.querySelector('link[href*="katex.min.css"]')) {
    const katexCSS = document.createElement("link");
    katexCSS.rel = "stylesheet";
    katexCSS.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
    document.head.appendChild(katexCSS);
  }

  // Load KaTeX first
  if (typeof katex === "undefined") {
    const katexScript = document.createElement("script");
    katexScript.src = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js";
    katexScript.onload = () => {
      // Load auto-render AFTER katex is available
      const autoRender = document.createElement("script");
      autoRender.src = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js";
      autoRender.onload = () => {
        console.log("KaTeX auto-render loaded.");
      };
      document.head.appendChild(autoRender);
    };
    document.head.appendChild(katexScript);
  }
}

// Call this function on page load to ensure the libraries are available
document.addEventListener('DOMContentLoaded', loadMermaidAndKatex);
