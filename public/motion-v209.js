(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const initialized = new WeakSet();
  const observed = new WeakSet();
  let initialDesk = true;
  let initialPublic = true;
  let observer = null;
  let scanQueued = false;

  function gsapInstance() {
    return window.gsap && typeof window.gsap.timeline === "function" ? window.gsap : null;
  }

  function motionAllowed() {
    return !reduceMotion.matches && Boolean(gsapInstance());
  }

  function present(nodes) {
    return nodes.filter((node) => node && node instanceof Element);
  }

  function revealOnView(nodes) {
    const gsap = gsapInstance();
    if (!motionAllowed() || !gsap || !nodes.length) return;
    if (!observer) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.target.dataset.motionV209Seen) return;
          entry.target.dataset.motionV209Seen = "true";
          gsap.fromTo(entry.target, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.38, ease: "power2.out", overwrite: "auto" });
          observer.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -10%", threshold: 0.08 });
    }
    nodes.forEach((node) => {
      if (!observed.has(node)) {
        observed.add(node);
        observer.observe(node);
      }
    });
  }

  function animatePublic(app) {
    const gsap = gsapInstance();
    const shell = app.firstElementChild;
    if (!motionAllowed() || !gsap || !shell || initialized.has(shell)) return;
    initialized.add(shell);

    const header = document.querySelector(".site-header");
    const hero = shell.querySelector(".template-product-hero, .product-pricing-hero, .product-gate, .account-access-shell");
    const copy = hero && hero.querySelector("h1, .account-access-card");
    const supporting = hero && hero.querySelectorAll(".eyebrow, p, .template-product-actions, .product-pricing-actions, .product-gate-actions, .template-product-steps, .pricing-rate-board, .account-access-route");
    const timeline = gsap.timeline({ defaults: { ease: "power2.out", overwrite: "auto" } });

    if (initialPublic) {
      initialPublic = false;
      if (header) timeline.from(header, { autoAlpha: 0, y: -10, duration: 0.24 });
    }
    if (hero) timeline.from(hero, { autoAlpha: 0, y: 18, duration: 0.34 }, initialPublic ? "<" : 0);
    if (copy) timeline.from(copy, { autoAlpha: 0, y: 14, duration: 0.4 }, "-=0.14");
    const supportingNodes = present(Array.from(supporting || []));
    if (supportingNodes.length) timeline.from(supportingNodes, { autoAlpha: 0, y: 10, duration: 0.28, stagger: 0.05 }, "-=0.16");

    revealOnView(Array.from(shell.querySelectorAll(".template-quick-picks, .template-video-section, .pricing-principles, .pricing-production-flow, .product-gate")));
  }

  function animateDesk(workspace) {
    const gsap = gsapInstance();
    if (!motionAllowed() || !gsap || initialized.has(workspace)) return;
    initialized.add(workspace);
    const header = workspace.querySelector(".v206-header");
    const sources = Array.from(workspace.querySelectorAll(".v206-source"));
    const stage = workspace.querySelector(".v206-stage");
    const inspector = workspace.querySelector(".v206-control");
    const timeline = gsap.timeline({ defaults: { ease: "power2.out", overwrite: "auto" } });

    if (initialDesk) {
      initialDesk = false;
      if (header) timeline.from(header, { autoAlpha: 0, y: -10, duration: 0.22 });
      const sourceNodes = present(sources);
      if (sourceNodes.length) timeline.from(sourceNodes, { autoAlpha: 0, x: -10, duration: 0.24, stagger: 0.035 }, "-=0.08");
      if (stage) timeline.from(stage, { autoAlpha: 0, y: 16, duration: 0.38 }, "-=0.18");
      if (inspector) timeline.from(inspector, { autoAlpha: 0, x: 12, duration: 0.3 }, "-=0.25");
      return;
    }

    if (stage) timeline.from(stage, { autoAlpha: 0, y: 9, duration: 0.2 });
    if (inspector) timeline.from(inspector, { autoAlpha: 0, x: 8, duration: 0.18 }, "<");
  }

  function animateOverlays() {
    const gsap = gsapInstance();
    if (!motionAllowed() || !gsap) return;
    document.querySelectorAll(".v206-thread, .v206-sheet").forEach((panel) => {
      if (initialized.has(panel)) return;
      initialized.add(panel);
      const overlay = panel.closest("#v206-app")?.querySelector(".v206-overlay");
      if (overlay) gsap.fromTo(overlay, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.18, ease: "power1.out", overwrite: "auto" });
      gsap.fromTo(panel, { autoAlpha: 0, y: panel.classList.contains("v206-thread") ? 16 : 22 }, { autoAlpha: 1, y: 0, duration: 0.24, ease: "power3.out", overwrite: "auto" });
    });
  }

  function scan() {
    scanQueued = false;
    if (!motionAllowed()) return;
    const desk = document.querySelector("[data-v206-workspace]");
    if (desk) animateDesk(desk);
    const app = document.querySelector("#app");
    if (app?.firstElementChild) animatePublic(app);
    animateOverlays();
  }

  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(scan);
  }

  function bindMicroFeedback() {
    document.addEventListener("pointerenter", (event) => {
      if (!motionAllowed() || event.pointerType === "touch") return;
      const target = event.target instanceof Element
        ? event.target.closest(".template-quick-pick, .template-video-card, .v206-source, .v206-material")
        : null;
      if (target) gsapInstance().to(target, { y: -2, scale: 1.006, duration: 0.16, ease: "power2.out", overwrite: "auto" });
    }, true);
    document.addEventListener("pointerleave", (event) => {
      if (!motionAllowed() || event.pointerType === "touch") return;
      const target = event.target instanceof Element
        ? event.target.closest(".template-quick-pick, .template-video-card, .v206-source, .v206-material")
        : null;
      if (target) gsapInstance().to(target, { y: 0, scale: 1, duration: 0.18, ease: "power2.out", overwrite: "auto" });
    }, true);
  }

  function start() {
    if (!gsapInstance()) return window.setTimeout(start, 40);
    if (reduceMotion.matches) return;
    bindMicroFeedback();
    const mutationObserver = new MutationObserver(queueScan);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("pagehide", () => {
      mutationObserver.disconnect();
      observer?.disconnect();
    }, { once: true });
    reduceMotion.addEventListener("change", () => {
      if (reduceMotion.matches) observer?.disconnect();
      else queueScan();
    });
    queueScan();
  }

  start();
})();
