/* odflens — progressive enhancement only.
   Everything here is optional: the site is fully usable with JS disabled.
   No network calls. */
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("has-js");

  /* ----- Theme toggle ----------------------------------------------------
     A stored preference wins; otherwise the OS preference is honoured.
     The button is created only when the header exists, so no-JS keeps the
     dark-default stylesheet and prefers-color-scheme. */
  function initTheme() {
    var host =
      document.querySelector(".header-actions") ||
      document.querySelector(".header-inner");
    if (!host) return;

    var button = document.createElement("button");
    button.type = "button";
    button.className = "theme-toggle";

    function prefersDark() {
      return (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      );
    }

    function current() {
      var attr = root.getAttribute("data-theme");
      if (attr === "dark" || attr === "light") return attr;
      return prefersDark() ? "dark" : "light";
    }

    function sync() {
      var mode = current();
      var next = mode === "dark" ? "light" : "dark";
      button.textContent = next === "dark" ? "Dark" : "Light";
      button.setAttribute("aria-label", "Switch to " + next + " theme");
      button.setAttribute("title", "Switch to " + next + " theme");
    }

    button.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try {
        localStorage.setItem("odflens-theme", next);
      } catch (error) {
        /* storage unavailable; the in-page toggle still works */
      }
      sync();
    });

    host.appendChild(button);

    /* If there is no explicit choice yet, set one from the OS and keep the
       toggle label in sync with what is actually rendered. */
    if (!root.getAttribute("data-theme")) {
      root.setAttribute("data-theme", prefersDark() ? "dark" : "light");
    }
    sync();
  }

  /* ----- Active section highlight ---------------------------------------
     Marks the nav link for the section currently in the URL fragment. */
  function highlightActiveNav() {
    var links = document.querySelectorAll(".nav a[href^='#']");
    if (links.length === 0) return;

    function sync() {
      var hash = location.hash || "#main";
      Array.prototype.forEach.call(links, function (link) {
        if (link.getAttribute("href") === hash) {
          link.setAttribute("aria-current", "page");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }

    sync();
    window.addEventListener("hashchange", sync);
  }

  /* ----- Sticky nav shadow on scroll ------------------------------------ */
  function initHeaderShadow() {
    var header = document.querySelector(".site-header");
    if (!header) return;

    function sync() {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    }

    sync();
    window.addEventListener("scroll", sync, { passive: true });
  }

  /* ----- Mobile nav ------------------------------------------------------ */
  function initMobileNav() {
    var toggle = document.querySelector(".nav-toggle");
    var links = document.querySelector(".nav-links");
    if (!toggle || !links) return;

    function setOpen(open) {
      links.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }

    toggle.addEventListener("click", function () {
      setOpen(!links.classList.contains("is-open"));
    });

    links.addEventListener("click", function (event) {
      if (event.target && event.target.closest("a")) setOpen(false);
    });

    window.addEventListener("hashchange", function () {
      setOpen(false);
    });
  }

  /* ----- Scroll reveal ---------------------------------------------------
     Content is visible by default. Only below-the-fold nodes are hidden and
     observed, so nothing can be stranded hidden if the observer never fires. */
  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (items.length === 0) return;
    if (
      !("IntersectionObserver" in window) ||
      (window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    ) {
      return;
    }

    var showAll = function () {
      Array.prototype.forEach.call(items, function (item) {
        item.classList.remove("reveal-hidden");
      });
    };

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.remove("reveal-hidden");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    Array.prototype.forEach.call(items, function (item) {
      var rect = item.getBoundingClientRect();
      if (rect.top > window.innerHeight * 0.9) {
        item.classList.add("reveal-hidden");
        observer.observe(item);
      }
    });

    /* Safety net: if anything is still hidden after a few seconds, show it. */
    window.setTimeout(showAll, 4000);
  }

  /* ----- Pause the ambient aurora when the tab is hidden ---------------- */
  function initAurora() {
    var aurora = document.querySelector(".hero-aurora");
    if (!aurora) return;

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        aurora.setAttribute("data-paused", "");
      } else {
        aurora.removeAttribute("data-paused");
      }
    });
  }

  /* ----- Copy-to-clipboard for code blocks ------------------------------
     Adds a button to every <pre class="code">. Only added when the browser
     can actually copy, so unsupported browsers keep the plain block. */
  function enhanceCodeBlocks() {
    var blocks = document.querySelectorAll("pre.code");

    Array.prototype.forEach.call(blocks, function (pre) {
      var code = pre.querySelector("code") || pre;
      var text = code.textContent;

      var button = document.createElement("button");
      button.type = "button";
      button.className = "code-copy";
      button.textContent = "Copy";
      button.setAttribute("aria-label", "Copy code to clipboard");

      button.addEventListener("click", function () {
        copyText(text).then(
          function () {
            setCopied(button, true);
          },
          function () {
            setCopied(button, false);
          },
        );
      });

      if (getComputedStyle(pre).position === "static") {
        pre.style.position = "relative";
      }
      pre.appendChild(button);
    });
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }

    return new Promise(function (resolve, reject) {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.top = "-1000px";
      document.body.appendChild(area);
      area.select();

      try {
        var ok = document.execCommand("copy");
        document.body.removeChild(area);
        ok ? resolve() : reject(new Error("copy failed"));
      } catch (err) {
        document.body.removeChild(area);
        reject(err);
      }
    });
  }

  function setCopied(button, ok) {
    button.textContent = ok ? "Copied" : "Copy failed";
    button.setAttribute("data-copied", ok ? "true" : "false");
    button.setAttribute("aria-live", "polite");

    window.clearTimeout(button._resetTimer);
    button._resetTimer = window.setTimeout(function () {
      button.textContent = "Copy";
      button.removeAttribute("data-copied");
    }, 1600);
  }

  function canCopy() {
    if (navigator.clipboard && window.isSecureContext) {
      return true;
    }
    return (
      typeof document.queryCommandSupported === "function" &&
      document.queryCommandSupported("copy")
    );
  }

  function init() {
    initTheme();
    highlightActiveNav();
    initHeaderShadow();
    initMobileNav();
    initReveal();
    initAurora();

    if (canCopy()) {
      enhanceCodeBlocks();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
