(() => {
  "use strict";

  /*
   * Sisslerfeld hero — complete intro sequence
   *
   * - At the top of the page, the active wordmark loops through its SVG words.
   * - After leaving the top, the active wordmark is replaced by the inactive one.
   * - Continued scrolling moves the wordmark to its authored final anchor.
   * - The heart detaches, travels into the expanding map, morphs into the
   *   Sisslerfeld shape and reveals the final double-beat pulse.
   * - Every scroll-owned part is rendered from absolute scroll position, so
   *   reversing, jumping and restoring the page are deterministic.
   *
   * The public controller is exposed as window.__sisslerfeldHeroIntro.
   * Its small API is intentionally phase-agnostic so later hero phases can take
   * ownership cleanly without changing the word-loop implementation.
   */

  const INSTANCE_KEY = "__sisslerfeldHeroIntro";
  const STYLE_ID = "sisslerfeld-hero-intro-styles";
  const READY_ATTRIBUTE = "data-sisslerfeld-intro-ready";

  const SELECTORS = Object.freeze({
    root: ".section__hero-animation",
    stage: ".logo-main-holder",
    active: "#seq-active, .logo-seqence-holder",
    inactive: "#seq-inactive, .logo-w-h-wrap",
    leadingLogo: ".l-s-main",
    wordWindow: ".logo-seqence-imgs",
    words: ".l-s-sequence-word",
    inactiveLogo: ":scope > .l-s-main",
    finalLogo: "#seq-last",
    movingHeart: "#moving-heart, .l-s-heart",
    finalAnchor: ".anim-final-img-location",
    mapViewport: ".hero-anim-map-holder",
    map: ".anim-map-holder",
    mapImage: ".anim-map",
    shapePlaceholder: "#map-shape-placeholder, .anim-m-shape-placeholder",
    finalPulse: "#final-hearth-pulse, .anim-m-last-pulse",
    sticky: ".anim-main-holder"
  });

  /*
   * Movement values are adapted directly from Codrops Text Block Transitions,
   * example 6. Because each Sisslerfeld state is one SVG image rather than a
   * staggered group of words, both the outgoing and incoming tween start at 0.
   */
  const SETTINGS = Object.freeze({
    holdDuration: 1.3,
    outgoingDuration: 0.15,
    incomingDuration: 0.6,
    outgoingEase: "power1.in",
    incomingEase: "back.out(1.70158)",
    sizeEase: "power3.inOut",
    outgoingYPercent: -125,
    incomingYPercent: 125,
    outgoingRotation: 3,
    incomingRotation: -3,
    topEnterTolerance: 1,
    topLeaveTolerance: 2,
    assetWaitTimeout: 6000,
    logoSwitchProgress: 0.9,
    logoSwitchSpan: 0.025,
    morphDuration: 0.5,
    morphEase: "power2.inOut",
    morphPointCount: 128,
    mapStartWidth: 50,
    mapEndWidth: 100,
    pulsePeakScale: 1.1053,
    pulseRiseDuration: 0.16,
    pulseFirstFallDuration: 0.12,
    pulseSecondFallDuration: 0.48,
    pulseRepeatDelay: 0.8
  });

  const previousInstance = window[INSTANCE_KEY];
  if (previousInstance && typeof previousInstance.destroy === "function") {
    previousInstance.destroy();
  }

  const findElements = () => {
    const root = document.querySelector(SELECTORS.root);
    if (!root) return null;

    const stage = root.querySelector(SELECTORS.stage);
    const active = root.querySelector(SELECTORS.active);
    const inactive = root.querySelector(SELECTORS.inactive);
    const leadingLogo = active?.querySelector(SELECTORS.leadingLogo);
    const wordWindow = active?.querySelector(SELECTORS.wordWindow);
    const words = wordWindow
      ? Array.from(wordWindow.querySelectorAll(SELECTORS.words))
      : [];
    const inactiveLogo = inactive?.querySelector(SELECTORS.inactiveLogo);
    const finalLogo = root.querySelector(SELECTORS.finalLogo);
    const movingHeart = inactive?.querySelector(SELECTORS.movingHeart);
    const movingHeartSvg = movingHeart?.querySelector("svg");
    const movingHeartPath = movingHeartSvg?.querySelector("path");
    const finalAnchor = root.querySelector(SELECTORS.finalAnchor);
    const mapViewport = root.querySelector(SELECTORS.mapViewport);
    const map = mapViewport?.querySelector(SELECTORS.map);
    const mapImage = map?.querySelector(SELECTORS.mapImage);
    const shapePlaceholder = map?.querySelector(
      SELECTORS.shapePlaceholder
    );
    const shapeSvg = shapePlaceholder?.querySelector("svg");
    const shapePath = shapeSvg?.querySelector("path");
    const finalPulse = map?.querySelector(SELECTORS.finalPulse);
    const sticky = root.querySelector(SELECTORS.sticky);

    if (
      !stage ||
      !active ||
      !inactive ||
      !leadingLogo ||
      !wordWindow ||
      words.length < 2
    ) {
      return null;
    }

    const journeyReady = Boolean(
      inactiveLogo &&
        finalLogo &&
        movingHeart &&
        movingHeartSvg &&
        movingHeartPath &&
        finalAnchor &&
        mapViewport &&
        map &&
        shapePlaceholder &&
        shapeSvg &&
        shapePath &&
        finalPulse &&
        sticky
    );

    return {
      root,
      stage,
      active,
      inactive,
      leadingLogo,
      wordWindow,
      words,
      inactiveLogo,
      finalLogo,
      movingHeart,
      movingHeartSvg,
      movingHeartPath,
      finalAnchor,
      mapViewport,
      map,
      mapImage,
      shapePlaceholder,
      shapeSvg,
      shapePath,
      finalPulse,
      sticky,
      journeyReady
    };
  };

  class HeroIntroController {
    constructor(elements, gsap) {
      this.gsap = gsap;
      this.root = elements.root;
      this.stage = elements.stage;
      this.active = elements.active;
      this.inactive = elements.inactive;
      this.leadingLogo = elements.leadingLogo;
      this.wordWindow = elements.wordWindow;
      this.words = elements.words;
      this.inactiveLogo = elements.inactiveLogo;
      this.finalLogo = elements.finalLogo;
      this.movingHeart = elements.movingHeart;
      this.movingHeartSvg = elements.movingHeartSvg;
      this.movingHeartPath = elements.movingHeartPath;
      this.finalAnchor = elements.finalAnchor;
      this.mapViewport = elements.mapViewport;
      this.map = elements.map;
      this.mapImage = elements.mapImage;
      this.shapePlaceholder = elements.shapePlaceholder;
      this.shapeSvg = elements.shapeSvg;
      this.shapePath = elements.shapePath;
      this.finalPulse = elements.finalPulse;
      this.sticky = elements.sticky;
      this.journeyReady = elements.journeyReady;

      this.mode = null;
      this.ready = false;
      this.destroyed = false;
      this.currentIndex = Math.max(
        0,
        this.words.findIndex(
          (word) => window.getComputedStyle(word).display !== "none"
        )
      );
      this.pendingIndex = null;
      this.wordMetrics = [];
      this.wordWindowHeight = 0;
      this.activeHeight = 0;
      this.activeYOffset = 0;
      this.wordTimeline = null;
      this.stateTimeline = null;
      this.loopDelay = null;
      this.morphTimeline = null;
      this.pulseTimeline = null;
      this.morphModel = null;
      this.journeyGeometry = null;
      this.logoJourneyProgress = 0;
      this.heartJourneyProgress = 0;
      this.mapJourneyProgress = 0;
      this.heartDetached = false;
      this.heartMarker = null;
      this.heartOverlay = null;
      this.morphDirection = 0;
      this.journeyGeometryDirty = false;
      this.scrollFrame = 0;
      this.resizeFrame = 0;
      this.pageShowFrame = 0;
      this.loopVersion = 0;
      this.stateVersion = 0;
      this.layoutViewportWidth = this.getLayoutViewportWidth();
      this.layoutViewportHeight = this.getViewportHeight();

      this.reducedMotionQuery = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      );

      this.touchedElements = [
        this.root,
        this.stage,
        this.active,
        this.inactive,
        this.leadingLogo,
        this.wordWindow,
        ...this.words,
        this.inactiveLogo,
        this.finalLogo,
        this.movingHeart,
        this.movingHeartSvg,
        this.movingHeartPath,
        this.map,
        this.shapePlaceholder,
        this.shapeSvg,
        this.shapePath,
        this.finalPulse
      ].filter(Boolean);
      this.originalStyles = new Map(
        this.touchedElements.map((element) => [
          element,
          element.getAttribute("style")
        ])
      );
      this.originalReadyAttribute = this.root.getAttribute(READY_ATTRIBUTE);
      this.originalHeartParent = this.movingHeart?.parentNode || null;
      this.originalHeartNextSibling =
        this.movingHeart?.nextSibling || null;
      this.originalHeartPathD =
        this.movingHeartPath?.getAttribute("d") || "";
      this.originalHeartColor = this.movingHeart
        ? window.getComputedStyle(this.movingHeart).color
        : "red";

      this.onScroll = this.onScroll.bind(this);
      this.onResize = this.onResize.bind(this);
      this.onPageShow = this.onPageShow.bind(this);
      this.onPageHide = this.onPageHide.bind(this);
      this.onVisibilityChange = this.onVisibilityChange.bind(this);
      this.onReducedMotionChange = this.onReducedMotionChange.bind(this);

      this.installStyles();
      this.createHeartLayer();
      this.prepareLayout();
      this.bindEvents();

      if (!this.journeyReady) {
        console.warn(
          "[Sisslerfeld hero] Final animation elements were not found; the intro will keep its phase-one behavior."
        );
      }

      /*
       * Establish the correct state synchronously. This prevents a restored
       * page below the top from briefly starting the active loop.
       */
      this.syncToScroll({ immediate: true, force: true });
      this.prepareAssets();
    }

    installStyles() {
      document.getElementById(STYLE_ID)?.remove();

      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
        [${READY_ATTRIBUTE}] .logo-main-holder {
          width: 100% !important;
          max-width: none !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          grid-template-rows: minmax(0, 1fr) !important;
          place-items: center !important;
          will-change: transform;
        }

        [${READY_ATTRIBUTE}] #seq-active,
        [${READY_ATTRIBUTE}] .logo-seqence-holder,
        [${READY_ATTRIBUTE}] #seq-inactive,
        [${READY_ATTRIBUTE}] .logo-w-h-wrap {
          grid-area: 1 / 1 !important;
          align-self: center !important;
          justify-self: center !important;
          margin: 0 !important;
          backface-visibility: hidden;
          will-change: transform, opacity;
        }

        [${READY_ATTRIBUTE}] #seq-active,
        [${READY_ATTRIBUTE}] .logo-seqence-holder {
          display: flex !important;
          position: relative !important;
        }

        [${READY_ATTRIBUTE}] #seq-inactive,
        [${READY_ATTRIBUTE}] .logo-w-h-wrap {
          display: flex !important;
          position: relative !important;
        }

        [${READY_ATTRIBUTE}] #seq-last,
        [${READY_ATTRIBUTE}] .l-s-last {
          grid-area: 1 / 1 !important;
          align-self: center !important;
          justify-self: center !important;
          display: block !important;
          margin: 0 !important;
          flex: none !important;
          pointer-events: none;
          backface-visibility: hidden;
          will-change: opacity, transform;
        }

        [${READY_ATTRIBUTE}] #seq-inactive > .l-s-main {
          will-change: opacity;
        }

        [${READY_ATTRIBUTE}] .l-s-heart {
          transform-origin: 50% 50%;
          will-change: transform;
        }

        [${READY_ATTRIBUTE}] .sisslerfeld-heart-marker {
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }

        [${READY_ATTRIBUTE}] .anim-map-holder {
          will-change: width;
        }

        [${READY_ATTRIBUTE}] .anim-m-last-pulse {
          transform-origin: 50% 50%;
          will-change: transform, opacity;
        }

        @media screen and (min-width: 992px) {
          [${READY_ATTRIBUTE}] #seq-inactive,
          [${READY_ATTRIBUTE}] .logo-w-h-wrap {
            padding-top: 2em !important;
            padding-bottom: 2em !important;
          }
        }

        [${READY_ATTRIBUTE}] .logo-seqence-imgs {
          position: relative !important;
          display: block !important;
          flex: none !important;
          min-width: 0 !important;
          gap: 0 !important;
          isolation: isolate;
          will-change: width;
        }

        [${READY_ATTRIBUTE}] .logo-seqence-imgs .l-s-sequence-word {
          position: absolute !important;
          top: var(--sisslerfeld-word-offset-y, 0px) !important;
          right: auto !important;
          bottom: auto !important;
          left: 0 !important;
          display: block !important;
          width: auto !important;
          max-width: none !important;
          margin: 0 !important;
          flex: none !important;
          pointer-events: none;
          backface-visibility: hidden;
          will-change: transform;
        }
      `;

      document.head.appendChild(style);
      this.styleElement = style;
      this.root.setAttribute(READY_ATTRIBUTE, "");
    }

    createHeartLayer() {
      if (
        !this.journeyReady ||
        !this.movingHeart ||
        !this.originalHeartParent
      ) {
        return;
      }

      /*
       * The invisible marker keeps the authored responsive heart geometry in
       * the wordmark while the real heart is temporarily moved into a fixed
       * overlay. This avoids nested-transform math and lets the travelling
       * heart cross the clipping boundary of .logo-main-holder.
       */
      const marker = this.movingHeart.cloneNode(true);
      marker.removeAttribute("id");
      marker.querySelectorAll("[id]").forEach((element) => {
        element.removeAttribute("id");
      });
      marker.classList.add("sisslerfeld-heart-marker");
      marker.setAttribute("aria-hidden", "true");

      this.originalHeartParent.insertBefore(
        marker,
        this.originalHeartNextSibling
      );
      this.heartMarker = marker;

      const overlay = document.createElement("div");
      overlay.setAttribute("data-sisslerfeld-heart-overlay", "");
      overlay.setAttribute("aria-hidden", "true");
      Object.assign(overlay.style, {
        position: "fixed",
        inset: "0",
        width: "100%",
        height: "100%",
        overflow: "visible",
        pointerEvents: "none",
        zIndex: "4"
      });

      document.body.appendChild(overlay);
      this.heartOverlay = overlay;
    }

    prepareLayout() {
      /*
       * Keep the complete wordmark stage hidden until the external SVGs have
       * decoded. This avoids a cold-load frame where an auto-sized image has
       * no intrinsic dimensions yet and its clipping window collapses.
       */
      this.gsap.set(this.stage, { autoAlpha: 0 });

      this.gsap.set(this.words, {
        autoAlpha: 0,
        x: 0,
        yPercent: 0,
        rotation: 0,
        transformOrigin: "0% 50%",
        force3D: true
      });

      this.gsap.set(this.leadingLogo, { x: 0, force3D: true });

      this.gsap.set([this.active, this.inactive], {
        force3D: true
      });

      /*
       * Runtime CSS makes the optional final wordmark measurable. Keep it
       * hidden even when another journey node is missing and phase one is the
       * only available fallback; the journey renderer is its sole revealer.
       */
      if (this.finalLogo) {
        this.gsap.set(this.finalLogo, {
          autoAlpha: 0,
          x: 0,
          y: 0,
          force3D: true
        });
      }

      if (this.journeyReady) {
        this.gsap.set(this.inactiveLogo, { autoAlpha: 1 });
        this.gsap.set(this.movingHeart, {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          transformOrigin: "50% 50%",
          force3D: true
        });
        this.gsap.set(this.map, {
          width: `${SETTINGS.mapStartWidth}%`,
          autoRound: false
        });
        this.gsap.set(this.finalPulse, {
          autoAlpha: 0,
          scale: 0,
          transformOrigin: "50% 50%",
          force3D: true
        });

        this.prepareMorphModel();
        this.createPulseTimeline();
      }
    }

    clamp01(value) {
      return Math.min(1, Math.max(0, value));
    }

    lerp(start, end, progress) {
      return start + (end - start) * progress;
    }

    easeInOut(progress) {
      const value = this.clamp01(progress);
      return value < 0.5
        ? 2 * value * value
        : 1 - Math.pow(-2 * value + 2, 2) / 2;
    }

    readViewBox(svg) {
      const values = (svg?.getAttribute("viewBox") || "")
        .trim()
        .split(/[\s,]+/)
        .map(Number);

      if (
        values.length !== 4 ||
        values.some((value) => !Number.isFinite(value)) ||
        values[2] <= 0 ||
        values[3] <= 0
      ) {
        return null;
      }

      return {
        x: values[0],
        y: values[1],
        width: values[2],
        height: values[3]
      };
    }

    sampleClosedPath(path, count) {
      const length = path.getTotalLength();
      if (!Number.isFinite(length) || length <= 0) return [];

      return Array.from({ length: count }, (_, index) => {
        const point = path.getPointAtLength((index / count) * length);
        return { x: point.x, y: point.y };
      });
    }

    getSignedArea(points) {
      return (
        points.reduce((area, point, index) => {
          const next = points[(index + 1) % points.length];
          return area + point.x * next.y - next.x * point.y;
        }, 0) / 2
      );
    }

    alignClosedPoints(source, target) {
      let candidate = target.slice();

      if (
        Math.sign(this.getSignedArea(source)) !==
        Math.sign(this.getSignedArea(candidate))
      ) {
        candidate.reverse();
      }

      let bestShift = 0;
      let bestCost = Number.POSITIVE_INFINITY;

      for (let shift = 0; shift < candidate.length; shift += 1) {
        let cost = 0;

        for (let index = 0; index < source.length; index += 1) {
          const sourcePoint = source[index];
          const targetPoint =
            candidate[(index + shift) % candidate.length];
          const deltaX = sourcePoint.x - targetPoint.x;
          const deltaY = sourcePoint.y - targetPoint.y;
          cost += deltaX * deltaX + deltaY * deltaY;
        }

        if (cost < bestCost) {
          bestCost = cost;
          bestShift = shift;
        }
      }

      return source.map(
        (_, index) => candidate[(index + bestShift) % candidate.length]
      );
    }

    pointsToPath(points) {
      if (!points.length) return "";

      return (
        `M${points[0].x.toFixed(3)} ${points[0].y.toFixed(3)}` +
        points
          .slice(1)
          .map(
            (point) =>
              `L${point.x.toFixed(3)} ${point.y.toFixed(3)}`
          )
          .join("") +
        "Z"
      );
    }

    prepareMorphModel() {
      if (
        !this.journeyReady ||
        !this.movingHeartPath ||
        !this.shapePath
      ) {
        return false;
      }

      try {
        const sourceViewBox = this.readViewBox(this.movingHeartSvg);
        const targetViewBox = this.readViewBox(this.shapeSvg);
        if (!sourceViewBox || !targetViewBox) return false;

        const sourcePoints = this.sampleClosedPath(
          this.movingHeartPath,
          SETTINGS.morphPointCount
        );
        const rawTargetPoints = this.sampleClosedPath(
          this.shapePath,
          SETTINGS.morphPointCount
        );

        if (
          sourcePoints.length !== SETTINGS.morphPointCount ||
          rawTargetPoints.length !== SETTINGS.morphPointCount
        ) {
          return false;
        }

        /*
         * Morph both shapes in the moving SVG's coordinate system. Equal
         * arc-length sampling, winding normalization and the cheapest cyclic
         * point alignment give GSAP core two paths with identical topology.
         */
        const mappedTargetPoints = rawTargetPoints.map((point) => ({
          x:
            sourceViewBox.x +
            ((point.x - targetViewBox.x) / targetViewBox.width) *
              sourceViewBox.width,
          y:
            sourceViewBox.y +
            ((point.y - targetViewBox.y) / targetViewBox.height) *
              sourceViewBox.height
        }));
        const alignedTargetPoints = this.alignClosedPoints(
          sourcePoints,
          mappedTargetPoints
        );

        this.morphModel = {
          sourceD: this.pointsToPath(sourcePoints),
          targetD: this.pointsToPath(alignedTargetPoints)
        };

        this.gsap.set(this.movingHeartPath, {
          attr: { d: this.morphModel.sourceD }
        });
        return true;
      } catch (error) {
        console.warn(
          "[Sisslerfeld hero] The SVG paths could not be normalized; using the non-morphing final fallback.",
          error
        );
        this.morphModel = null;
        return false;
      }
    }

    createPulseTimeline() {
      if (!this.finalPulse) return;

      this.pulseTimeline?.kill();
      this.pulseTimeline = this.gsap.timeline({
        paused: true,
        repeat: -1,
        repeatDelay: SETTINGS.pulseRepeatDelay
      });

      /*
       * These values are measured from .hero--gif: scale 1.1053 at 160 ms,
       * back at 280 ms, the second peak at 440 ms and rest at 920 ms.
       */
      this.pulseTimeline
        .to(this.finalPulse, {
          scale: SETTINGS.pulsePeakScale,
          duration: SETTINGS.pulseRiseDuration,
          ease: "sine.inOut"
        })
        .to(this.finalPulse, {
          scale: 1,
          duration: SETTINGS.pulseFirstFallDuration,
          ease: "sine.inOut"
        })
        .to(this.finalPulse, {
          scale: SETTINGS.pulsePeakScale,
          duration: SETTINGS.pulseRiseDuration,
          ease: "sine.inOut"
        })
        .to(this.finalPulse, {
          scale: 1,
          duration: SETTINGS.pulseSecondFallDuration,
          ease: "sine.inOut"
        });
    }

    createMorphTimeline() {
      if (!this.journeyReady || !this.journeyGeometry) return;

      const previousProgress = this.morphTimeline
        ? this.morphTimeline.progress()
        : 0;
      const previousDirection = this.morphDirection;

      this.morphTimeline?.kill();
      this.morphTimeline = null;

      /*
       * GSAP records the pre-tween value for an immediateRender:false fromTo.
       * Rebuilds can happen while the previous timeline is already at its
       * target (resize, bfcache or reduced-motion changes), so normalize the
       * real element first. Reapplying previousProgress below restores the
       * exact visible state in the same frame and guarantees that reverse 0 is
       * always the true source shape and scale.
       */
      this.gsap.set(this.movingHeart, {
        scaleX: 1,
        scaleY: 1
      });
      if (this.morphModel) {
        this.gsap.set(this.movingHeartPath, {
          attr: { d: this.morphModel.sourceD }
        });
      }

      const sourceWidth = Math.max(
        1,
        this.journeyGeometry.heartSourceWidth
      );
      const sourceHeight = Math.max(
        1,
        this.journeyGeometry.heartSourceHeight
      );
      const scaleX =
        this.journeyGeometry.targetFinalWidth / sourceWidth;
      const scaleY =
        this.journeyGeometry.targetFinalHeight / sourceHeight;

      this.morphTimeline = this.gsap.timeline({
        paused: true,
        onComplete: () => {
          if (this.destroyed) return;
          this.morphDirection = 0;
          if (this.heartJourneyProgress >= 0.999) {
            this.startPulse();
          }
        },
        onReverseComplete: () => {
          if (this.destroyed) return;
          this.morphDirection = 0;
          this.stopPulse();
          this.gsap.set(this.movingHeart, {
            scaleX: 1,
            scaleY: 1
          });
          if (this.morphModel) {
            this.gsap.set(this.movingHeartPath, {
              attr: { d: this.morphModel.sourceD }
            });
          }

          if (this.heartJourneyProgress <= 0.001) {
            this.reattachHeart();
          }
        }
      });

      if (this.morphModel) {
        this.morphTimeline.fromTo(
          this.movingHeartPath,
          { attr: { d: this.morphModel.sourceD } },
          {
            attr: { d: this.morphModel.targetD },
            duration: SETTINGS.morphDuration,
            ease: SETTINGS.morphEase,
            immediateRender: false
          },
          0
        );
      }

      this.morphTimeline.fromTo(
        this.movingHeart,
        { scaleX: 1, scaleY: 1 },
        {
          scaleX,
          scaleY,
          duration: SETTINGS.morphDuration,
          ease: SETTINGS.morphEase,
          immediateRender: false
        },
        0
      );

      this.morphTimeline.progress(previousProgress).pause();

      if (previousDirection > 0 && previousProgress < 1) {
        this.morphDirection = 1;
        this.morphTimeline.play();
      } else if (previousDirection < 0 && previousProgress > 0) {
        this.morphDirection = -1;
        this.morphTimeline.reverse();
      }
    }

    startPulse() {
      if (
        !this.finalPulse ||
        this.destroyed ||
        document.hidden ||
        this.heartJourneyProgress < 0.999
      ) {
        return;
      }

      if (this.reducedMotionQuery.matches) {
        this.pulseTimeline?.pause(0);
        this.gsap.set(this.finalPulse, {
          autoAlpha: 1,
          scale: 1,
          transformOrigin: "50% 50%"
        });
        return;
      }

      if (this.pulseTimeline?.isActive()) {
        return;
      }

      this.gsap.set(this.finalPulse, {
        autoAlpha: 1,
        scale: 1,
        transformOrigin: "50% 50%"
      });
      this.pulseTimeline?.restart();
    }

    stopPulse({ hide = true } = {}) {
      this.pulseTimeline?.pause(0);

      if (hide && this.finalPulse) {
        this.gsap.set(this.finalPulse, {
          autoAlpha: 0,
          scale: 0,
          transformOrigin: "50% 50%"
        });
      }
    }

    requestMorph(finalState, { immediate = false } = {}) {
      if (!this.morphTimeline) {
        if (finalState) this.startPulse();
        else this.stopPulse();
        return;
      }

      const shouldSetImmediately =
        immediate || this.reducedMotionQuery.matches;

      if (shouldSetImmediately) {
        this.morphDirection = 0;
        this.morphTimeline.pause();
        this.morphTimeline.progress(finalState ? 1 : 0);

        if (finalState) {
          this.startPulse();
        } else {
          this.stopPulse();
          if (this.heartJourneyProgress <= 0.001) {
            this.reattachHeart();
          }
        }
        return;
      }

      if (finalState) {
        if (
          this.morphTimeline.progress() >= 0.999 ||
          this.morphDirection > 0
        ) {
          if (this.morphTimeline.progress() >= 0.999) {
            this.startPulse();
          }
          return;
        }

        this.morphDirection = 1;
        this.morphTimeline.play();
        return;
      }

      this.stopPulse();
      if (
        this.morphTimeline.progress() <= 0.001 ||
        this.morphDirection < 0
      ) {
        if (
          this.morphTimeline.progress() <= 0.001 &&
          this.heartJourneyProgress <= 0.001
        ) {
          this.reattachHeart();
        }
        return;
      }

      this.morphDirection = -1;
      this.morphTimeline.reverse();
    }

    getOffsetWithin(element, ancestor) {
      let current = element;
      let x = 0;
      let y = 0;

      while (current && current !== ancestor) {
        x += current.offsetLeft || 0;
        y += current.offsetTop || 0;
        current = current.offsetParent;
      }

      if (current === ancestor) return { x, y };

      const elementRect = element.getBoundingClientRect();
      const ancestorRect = ancestor.getBoundingClientRect();
      return {
        x: elementRect.left - ancestorRect.left,
        y: elementRect.top - ancestorRect.top
      };
    }

    ensureHeartDetached() {
      if (
        this.heartDetached ||
        !this.heartOverlay ||
        !this.heartMarker ||
        !this.movingHeart
      ) {
        return;
      }

      const markerRect = this.heartMarker.getBoundingClientRect();
      const width =
        this.journeyGeometry?.heartSourceWidth || markerRect.width;
      const height =
        this.journeyGeometry?.heartSourceHeight || markerRect.height;
      const morphProgress = this.morphTimeline?.progress() || 0;

      this.heartOverlay.appendChild(this.movingHeart);
      this.heartDetached = true;

      this.gsap.set(this.movingHeart, {
        position: "absolute",
        top: 0,
        right: "auto",
        bottom: "auto",
        left: 0,
        width,
        height,
        margin: 0,
        display: "flex",
        autoAlpha: 1,
        color: this.originalHeartColor,
        zIndex: 4,
        x: markerRect.left,
        y: markerRect.top,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        transformOrigin: "50% 50%",
        force3D: true,
        autoRound: false
      });

      if (this.morphTimeline) {
        this.morphTimeline.progress(morphProgress).pause();
      }
    }

    reattachHeart({ force = false } = {}) {
      if (
        !this.heartDetached ||
        !this.originalHeartParent ||
        !this.movingHeart
      ) {
        return;
      }

      if (
        !force &&
        this.morphTimeline &&
        this.morphTimeline.progress() > 0.001
      ) {
        return;
      }

      if (this.heartMarker?.parentNode === this.originalHeartParent) {
        this.originalHeartParent.insertBefore(
          this.movingHeart,
          this.heartMarker
        );
      } else {
        this.originalHeartParent.insertBefore(
          this.movingHeart,
          this.originalHeartNextSibling
        );
      }

      this.gsap.set(this.movingHeart, { clearProps: "all" });
      const originalStyle = this.originalStyles.get(this.movingHeart);
      if (originalStyle === null) {
        this.movingHeart.removeAttribute("style");
      } else if (typeof originalStyle === "string") {
        this.movingHeart.setAttribute("style", originalStyle);
      }

      if (this.originalHeartPathD) {
        this.movingHeartPath.setAttribute(
          "d",
          this.originalHeartPathD
        );
      }

      this.heartDetached = false;
    }

    getViewportHeight() {
      return Math.max(
        1,
        window.visualViewport?.height ||
          document.documentElement.clientHeight ||
          window.innerHeight ||
          1
      );
    }

    refreshJourneyGeometry() {
      if (
        !this.journeyReady ||
        !this.heartMarker ||
        !this.map ||
        !this.finalAnchor
      ) {
        return false;
      }

      const scrollY = this.getScrollY();
      const scrollX = Math.max(0, window.scrollX || window.pageXOffset || 0);
      const viewportHeight = this.getViewportHeight();
      const stageOffset = this.getOffsetWithin(this.stage, this.sticky);
      const heartOffset = this.getOffsetWithin(
        this.heartMarker,
        this.stage
      );
      const stageWidth = this.stage.offsetWidth;
      const stageHeight = this.stage.offsetHeight;
      const heartMarkerStyle = window.getComputedStyle(this.heartMarker);
      const heartSourceWidth =
        this.readPixelValue(heartMarkerStyle.width) ||
        this.heartMarker.offsetWidth ||
        this.heartMarker.getBoundingClientRect().width;
      const heartSourceHeight =
        this.readPixelValue(heartMarkerStyle.height) ||
        this.heartMarker.offsetHeight ||
        this.heartMarker.getBoundingClientRect().height;

      const anchorRect = this.finalAnchor.getBoundingClientRect();
      const mapViewportRect = this.mapViewport.getBoundingClientRect();
      const rootRect = this.root.getBoundingClientRect();
      const anchorDocumentX = anchorRect.left + scrollX;
      const anchorDocumentY = anchorRect.top + scrollY;
      const mapDocumentTop = mapViewportRect.top + scrollY;
      const mapDocumentBottom = mapViewportRect.bottom + scrollY;
      const rootDocumentTop = rootRect.top + scrollY;

      const previousMapWidth =
        this.map.style.width || `${SETTINGS.mapStartWidth}%`;
      this.gsap.set(this.map, {
        width: `${SETTINGS.mapEndWidth}%`,
        autoRound: false
      });
      const targetRect = this.shapePlaceholder.getBoundingClientRect();
      const targetFinalDocument = {
        left: targetRect.left + scrollX,
        top: targetRect.top + scrollY,
        width: targetRect.width,
        height: targetRect.height,
        centerX: targetRect.left + scrollX + targetRect.width / 2,
        centerY: targetRect.top + scrollY + targetRect.height / 2
      };
      this.gsap.set(this.map, {
        width: previousMapWidth,
        autoRound: false
      });

      const stageStartScroll = Math.max(
        0,
        rootDocumentTop + SETTINGS.topLeaveTolerance
      );
      const stageEndScroll = Math.max(
        stageStartScroll + 1,
        mapDocumentTop - viewportHeight
      );
      const heartStartScroll = this.lerp(
        stageStartScroll,
        stageEndScroll,
        SETTINGS.logoSwitchProgress
      );
      const mapEndScroll = Math.max(
        stageEndScroll + 1,
        mapDocumentBottom - viewportHeight
      );
      const stickyTop =
        this.readPixelValue(window.getComputedStyle(this.sticky).top) || 0;
      const stageLocalCenter = {
        x: stageOffset.x + stageWidth / 2,
        y: stageOffset.y + stageHeight / 2
      };
      const stageElementCenter = {
        x: stageWidth / 2,
        y: stageHeight / 2
      };
      const heartLocalCenter = {
        x: heartOffset.x + heartSourceWidth / 2,
        y: heartOffset.y + heartSourceHeight / 2
      };
      const stageStartCenter = {
        x: stageLocalCenter.x,
        y: stickyTop + stageLocalCenter.y
      };
      const stageLandingCenter = {
        x: anchorDocumentX + anchorRect.width / 2 - scrollX,
        y: anchorDocumentY - stageEndScroll
      };
      const stageAtHeartStart = {
        x: this.lerp(
          stageStartCenter.x,
          stageLandingCenter.x,
          this.easeInOut(SETTINGS.logoSwitchProgress)
        ),
        y: this.lerp(
          stageStartCenter.y,
          stageLandingCenter.y,
          this.easeInOut(SETTINGS.logoSwitchProgress)
        )
      };
      const heartStartCenter = {
        x:
          stageAtHeartStart.x +
          (heartLocalCenter.x - stageElementCenter.x),
        y:
          stageAtHeartStart.y +
          (heartLocalCenter.y - stageElementCenter.y)
      };

      this.journeyGeometry = {
        viewportHeight,
        stageStartScroll,
        stageEndScroll,
        heartStartScroll,
        mapEndScroll,
        stageLocalCenter,
        stageElementCenter,
        heartLocalCenter,
        stageStartCenter,
        stageLandingCenter,
        anchorDocumentX:
          anchorDocumentX + anchorRect.width / 2,
        anchorDocumentY,
        heartStartCenter,
        heartEndCenter: {
          x: targetFinalDocument.centerX - scrollX,
          y: targetFinalDocument.centerY - mapEndScroll
        },
        targetFinalDocument,
        targetFinalWidth: targetFinalDocument.width,
        targetFinalHeight: targetFinalDocument.height,
        heartSourceWidth,
        heartSourceHeight
      };

      /*
       * A width/orientation change also changes the authored vw-sized heart.
       * While detached, the real heart no longer participates in that layout,
       * so keep its fixed overlay box synchronized with the responsive marker
       * before rebuilding the scale tween. Otherwise the new target scale
       * would be applied to the stale pre-resize pixel dimensions.
       */
      if (this.heartDetached) {
        this.gsap.set(this.movingHeart, {
          width: heartSourceWidth,
          height: heartSourceHeight,
          autoRound: false
        });
      }

      this.layoutViewportHeight = viewportHeight;
      this.journeyGeometryDirty = false;
      this.createMorphTimeline();
      return true;
    }

    getJourneyProgress(scrollY, start, end) {
      return this.clamp01((scrollY - start) / Math.max(1, end - start));
    }

    getStageDesiredCenter(scrollY, logoProgress) {
      const geometry = this.journeyGeometry;
      if (!geometry) return { x: 0, y: 0 };

      if (logoProgress < 1) {
        const eased = this.easeInOut(logoProgress);
        return {
          x: this.lerp(
            geometry.stageStartCenter.x,
            geometry.stageLandingCenter.x,
            eased
          ),
          y: this.lerp(
            geometry.stageStartCenter.y,
            geometry.stageLandingCenter.y,
            eased
          )
        };
      }

      return {
        x: geometry.anchorDocumentX - (window.scrollX || 0),
        y: geometry.anchorDocumentY - scrollY
      };
    }

    renderJourneyFromScroll({
      immediate = false,
      forceReset = false
    } = {}) {
      if (
        !this.ready ||
        !this.journeyReady ||
        !this.journeyGeometry
      ) {
        return;
      }

      const geometry = this.journeyGeometry;
      const scrollY = forceReset ? geometry.stageStartScroll : this.getScrollY();
      const logoProgress = forceReset
        ? 0
        : this.getJourneyProgress(
            scrollY,
            geometry.stageStartScroll,
            geometry.stageEndScroll
          );
      const heartProgress = forceReset
        ? 0
        : this.getJourneyProgress(
            scrollY,
            geometry.heartStartScroll,
            geometry.mapEndScroll
          );
      const mapProgress = forceReset
        ? 0
        : this.getJourneyProgress(
            scrollY,
            geometry.stageEndScroll,
            geometry.mapEndScroll
          );
      const switchStart =
        SETTINGS.logoSwitchProgress - SETTINGS.logoSwitchSpan / 2;
      const switchProgress = this.clamp01(
        (logoProgress - switchStart) / SETTINGS.logoSwitchSpan
      );

      this.logoJourneyProgress = logoProgress;
      this.heartJourneyProgress = heartProgress;
      this.mapJourneyProgress = mapProgress;

      const stageDesired = this.getStageDesiredCenter(
        scrollY,
        logoProgress
      );
      const stickyRect = this.sticky.getBoundingClientRect();
      const stageBase = {
        x: stickyRect.left + geometry.stageLocalCenter.x,
        y: stickyRect.top + geometry.stageLocalCenter.y
      };

      this.gsap.set(this.stage, {
        x: stageDesired.x - stageBase.x,
        y: stageDesired.y - stageBase.y,
        autoRound: false,
        force3D: true
      });
      this.gsap.set(this.inactiveLogo, {
        autoAlpha: 1 - switchProgress
      });
      this.gsap.set(this.finalLogo, {
        autoAlpha: switchProgress
      });
      this.gsap.set(this.map, {
        width: `${this.lerp(
          SETTINGS.mapStartWidth,
          SETTINGS.mapEndWidth,
          mapProgress
        )}%`,
        autoRound: false
      });

      /*
       * Keep rendering the overlay at the scroll-owned source position while
       * a reverse morph is still finishing after a large upward scroll jump.
       * Otherwise a detached heart would shrink at its stale map position and
       * teleport only when the reverse tween reattached it to the wordmark.
       */
      if (
        heartProgress > 0.0001 ||
        this.heartDetached ||
        (this.morphTimeline?.progress() || 0) > 0.001
      ) {
        this.ensureHeartDetached();

        const easedHeart = this.easeInOut(heartProgress);
        let heartCenter;

        if (heartProgress <= 0.0001) {
          /*
           * Before the authored departure point the responsive marker is the
           * true source of position, because the wordmark stage is still
           * moving. This also makes a jump from the map straight to the top
           * finish its reverse morph exactly where reattachment will occur.
           */
          const markerRect = this.heartMarker.getBoundingClientRect();
          heartCenter = {
            x: markerRect.left + geometry.heartSourceWidth / 2,
            y: markerRect.top + geometry.heartSourceHeight / 2
          };
        } else if (heartProgress < 1) {
          heartCenter = {
            x: this.lerp(
              geometry.heartStartCenter.x,
              geometry.heartEndCenter.x,
              easedHeart
            ),
            y: this.lerp(
              geometry.heartStartCenter.y,
              geometry.heartEndCenter.y,
              easedHeart
            )
          };
        } else {
          heartCenter = {
            x:
              geometry.targetFinalDocument.centerX -
              (window.scrollX || 0),
            y: geometry.targetFinalDocument.centerY - scrollY
          };
        }

        this.gsap.set(this.movingHeart, {
          x: heartCenter.x - geometry.heartSourceWidth / 2,
          y: heartCenter.y - geometry.heartSourceHeight / 2,
          autoRound: false,
          force3D: true
        });
      }

      if (heartProgress >= 0.9999) {
        this.requestMorph(true, { immediate });
      } else {
        this.requestMorph(false, {
          immediate: immediate || forceReset
        });
      }

      if (
        heartProgress <= 0.0001 &&
        (!this.morphTimeline ||
          this.morphTimeline.progress() <= 0.001)
      ) {
        this.reattachHeart();
      }
    }

    bindEvents() {
      window.addEventListener("scroll", this.onScroll, { passive: true });
      window.addEventListener("resize", this.onResize, { passive: true });
      window.visualViewport?.addEventListener("resize", this.onResize, {
        passive: true
      });
      window.addEventListener("pageshow", this.onPageShow);
      window.addEventListener("pagehide", this.onPageHide);
      document.addEventListener("visibilitychange", this.onVisibilityChange);

      if (typeof this.reducedMotionQuery.addEventListener === "function") {
        this.reducedMotionQuery.addEventListener(
          "change",
          this.onReducedMotionChange
        );
      } else {
        this.reducedMotionQuery.addListener(this.onReducedMotionChange);
      }
    }

    async prepareAssets() {
      /*
       * Only wordmark assets block the first visible frame. The large map and
       * unrelated hero GIF can decode in parallel without holding the intro
       * stage invisible for up to six seconds on a cold mobile connection.
       */
      const images = [
        this.leadingLogo,
        ...this.words,
        this.inactiveLogo,
        this.finalLogo
      ].filter((image) => image?.tagName === "IMG");
      const journeyImages = [this.mapImage].filter(
        (image) => image?.tagName === "IMG"
      );

      const waitForImage = (image) => {
        const decode = () => {
          if (typeof image.decode !== "function") return Promise.resolve();
          return image.decode().catch(() => undefined);
        };

        if (image.complete) return decode();

        return new Promise((resolve) => {
          const finish = () => {
            image.removeEventListener("load", finish);
            image.removeEventListener("error", finish);
            decode().finally(resolve);
          };

          image.addEventListener("load", finish, { once: true });
          image.addEventListener("error", finish, { once: true });
        });
      };

      let timeoutId = 0;
      const timeout = new Promise((resolve) => {
        timeoutId = window.setTimeout(resolve, SETTINGS.assetWaitTimeout);
      });

      const assetsReady = Promise.allSettled(images.map(waitForImage));
      await Promise.race([assetsReady, timeout]);
      window.clearTimeout(timeoutId);

      if (this.destroyed) return;

      this.ready = true;
      const measured = this.refresh({ immediate: true });

      if (!measured) {
        /*
         * If an asset is still dimensionless after the bounded wait (or
         * failed), return to the authored DOM and keep a correct static
         * top/scrolled state. Never expose a permanently collapsed stage.
         */
        this.ready = false;
        this.activateAssetFallback();
        return;
      }

      this.gsap.set(this.stage, { autoAlpha: 1 });

      Promise.allSettled(journeyImages.map(waitForImage)).then(() => {
        if (this.destroyed || !this.ready || !this.journeyReady) return;
        this.refreshJourneyGeometry();
        this.renderJourneyFromScroll({ immediate: true });
      });
    }

    activateAssetFallback() {
      const elements = {
        root: this.root,
        stage: this.stage,
        active: this.active,
        inactive: this.inactive,
        wordWindow: this.wordWindow,
        words: this.words
      };

      console.warn(
        "[Sisslerfeld hero] SVG dimensions were unavailable; using the static state fallback."
      );
      this.destroy();
      const fallback = createStaticFallback(elements);
      window[INSTANCE_KEY] = fallback;
    }

    readWordMetric(word) {
      const computed = window.getComputedStyle(word);
      const computedWidth = Number.parseFloat(computed.width);
      const computedHeight = Number.parseFloat(computed.height);
      let height =
        computedHeight ||
        word.offsetHeight ||
        word.naturalHeight ||
        0;
      let width = 0;

      /*
       * Prefer intrinsic ratio + computed CSS height. Unlike
       * getBoundingClientRect(), these values do not include the current
       * rotation/translation of the word or its active holder.
       */
      if (height && word.naturalWidth && word.naturalHeight) {
        width = height * (word.naturalWidth / word.naturalHeight);
      }

      if (!width) {
        width = computedWidth || word.offsetWidth || 0;
      }

      /*
       * Rects are a final fallback only. They are useful for non-image
       * replacements, but normal SVG measurement never reaches this branch.
       */
      if (!width || !height) {
        const rect = word.getBoundingClientRect();
        width ||= rect.width;
        height ||= rect.height;
      }

      return {
        width: Math.max(0, Math.round(width * 1000) / 1000),
        height: Math.max(0, Math.round(height * 1000) / 1000)
      };
    }

    readPixelValue(value) {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    getLayoutViewportWidth() {
      return (
        document.documentElement.clientWidth ||
        window.innerWidth ||
        0
      );
    }

    refreshLayoutGeometry() {
      const baselineMetric = this.wordMetrics[0];
      if (!baselineMetric) return false;

      const wordWindowStyle = window.getComputedStyle(this.wordWindow);
      const windowPaddingTop = this.readPixelValue(
        wordWindowStyle.paddingTop
      );
      const windowPaddingBottom = this.readPixelValue(
        wordWindowStyle.paddingBottom
      );
      const windowMarginTop = this.readPixelValue(wordWindowStyle.marginTop);
      const windowMarginBottom = this.readPixelValue(
        wordWindowStyle.marginBottom
      );
      const windowMaxHeight = Number.parseFloat(wordWindowStyle.maxHeight);
      const constrainWindowHeight = (height) =>
        Number.isFinite(windowMaxHeight)
          ? Math.min(height, windowMaxHeight)
          : height;
      const naturalWindowHeight =
        baselineMetric.height + windowPaddingTop + windowPaddingBottom;
      const tallestWordHeight = Math.max(
        ...this.wordMetrics.map((metric) => metric.height)
      );
      const tallestWindowHeight = constrainWindowHeight(
        tallestWordHeight + windowPaddingTop + windowPaddingBottom
      );

      this.wordWindowHeight = constrainWindowHeight(naturalWindowHeight);

      const activeStyle = window.getComputedStyle(this.active);
      const activePaddingTop = this.readPixelValue(activeStyle.paddingTop);
      const activePaddingBottom = this.readPixelValue(
        activeStyle.paddingBottom
      );
      const activePadding =
        activePaddingTop + activePaddingBottom;
      const activeBorderTop = this.readPixelValue(
        activeStyle.borderTopWidth
      );
      const activeBorderBottom = this.readPixelValue(
        activeStyle.borderBottomWidth
      );
      const activeBorders = activeBorderTop + activeBorderBottom;

      const leadingLogoStyle = window.getComputedStyle(this.leadingLogo);
      const leadingLogoHeight =
        this.readPixelValue(leadingLogoStyle.height) ||
        this.leadingLogo.offsetHeight;
      const leadingLogoOuterHeight =
        leadingLogoHeight +
        this.readPixelValue(leadingLogoStyle.marginTop) +
        this.readPixelValue(leadingLogoStyle.marginBottom);
      const baselineWindowOuterHeight =
        this.wordWindowHeight + windowMarginTop + windowMarginBottom;
      const tallestWindowOuterHeight =
        tallestWindowHeight + windowMarginTop + windowMarginBottom;
      const baselineWordExtent =
        windowMarginTop + windowPaddingTop + baselineMetric.height;
      const tallestWordExtent =
        windowMarginTop + windowPaddingTop + tallestWordHeight;

      /*
       * Keep one clipping height for the complete loop. The taller "Life"
       * artwork must fit inside #seq-active, but making the holder taller would
       * normally move its top edge because the stage centers it. The matching
       * positive y offset compensates for exactly half of that height delta:
       * the holder's visible top and every word's authored top stay fixed while
       * its clipping box gains the missing room below.
       */
      const baselineActiveHeight =
        activeBorders +
        activePadding +
        Math.max(
          leadingLogoOuterHeight,
          baselineWindowOuterHeight,
          baselineWordExtent
        );
      this.activeHeight =
        activeBorders +
        activePadding +
        Math.max(
          leadingLogoOuterHeight,
          tallestWindowOuterHeight,
          tallestWordExtent
        );
      this.activeYOffset = Math.max(
        0,
        (this.activeHeight - baselineActiveHeight) / 2
      );

      this.wordWindow.style.setProperty(
        "--sisslerfeld-word-offset-y",
        `${windowPaddingTop}px`
      );
      this.gsap.set(this.wordWindow, {
        height: this.wordWindowHeight,
        autoRound: false
      });
      this.gsap.set(this.active, {
        height: this.activeHeight,
        y: this.activeYOffset,
        yPercent: 0,
        rotation: 0,
        autoRound: false
      });

      /*
       * The outer stage is the second clipping boundary. At a few intermediate
       * responsive widths its authored height can be slightly shorter than the
       * tallest word. Move the complete active wordmark up only by that measured
       * overflow, keeping the correction constant for every word in the loop.
       */
      const stageRect = this.stage.getBoundingClientRect();
      const wordWindowRect = this.wordWindow.getBoundingClientRect();
      const tallestWordTop = wordWindowRect.top + windowPaddingTop;
      const tallestWordBottom = tallestWordTop + tallestWordHeight;
      const clipSafety = 0.5;
      let stageCorrection = 0;

      if (tallestWordBottom > stageRect.bottom - clipSafety) {
        stageCorrection -=
          tallestWordBottom - (stageRect.bottom - clipSafety);
      }

      if (tallestWordTop + stageCorrection < stageRect.top + clipSafety) {
        stageCorrection +=
          stageRect.top + clipSafety - (tallestWordTop + stageCorrection);
      }

      if (stageCorrection) {
        this.activeYOffset += stageCorrection;
        this.gsap.set(this.active, {
          y: this.activeYOffset,
          autoRound: false
        });
      }

      this.layoutViewportWidth = this.getLayoutViewportWidth();
      return true;
    }

    refreshMeasurements() {
      const nextMetrics = this.words.map((word) => this.readWordMetric(word));

      if (
        nextMetrics.every(
          (metric) =>
            Number.isFinite(metric.width) &&
            Number.isFinite(metric.height) &&
            metric.width > 0 &&
            metric.height > 0
        )
      ) {
        this.wordMetrics = nextMetrics;
      }

      if (!this.wordMetrics.length) {
        return false;
      }

      if (!this.refreshLayoutGeometry()) {
        return false;
      }

      this.currentIndex = Math.min(
        Math.max(0, this.currentIndex),
        this.words.length - 1
      );
      this.renderCurrentWord();

      if (this.journeyReady) {
        this.refreshJourneyGeometry();
      }

      return true;
    }

    renderCurrentWord() {
      const currentWord = this.words[this.currentIndex];
      const metric = this.wordMetrics[this.currentIndex];
      if (!currentWord || !metric) return;

      this.gsap.set(this.words, {
        autoAlpha: 0,
        x: 0,
        yPercent: 0,
        rotation: 0,
        transformOrigin: "0% 50%"
      });
      this.gsap.set(this.leadingLogo, { x: 0 });
      this.gsap.set(currentWord, {
        autoAlpha: 1,
        x: 0,
        yPercent: 0,
        rotation: 0
      });
      this.gsap.set(this.wordWindow, {
        width: metric.width,
        height: this.wordWindowHeight,
        autoRound: false
      });
      this.gsap.set(this.active, {
        height: this.activeHeight,
        y: this.activeYOffset,
        autoRound: false
      });
    }

    getScrollY() {
      return Math.max(
        0,
        window.scrollY ||
          window.pageYOffset ||
          document.documentElement.scrollTop ||
          0
      );
    }

    getDesiredMode() {
      const scrollY = this.getScrollY();

      if (this.mode === "top") {
        return scrollY > SETTINGS.topLeaveTolerance ? "scrolled" : "top";
      }

      if (this.mode === "scrolled") {
        return scrollY <= SETTINGS.topEnterTolerance ? "top" : "scrolled";
      }

      return scrollY <= SETTINGS.topEnterTolerance ? "top" : "scrolled";
    }

    syncToScroll({ immediate = false, force = false } = {}) {
      const desiredMode = this.getDesiredMode();
      this.setMode(desiredMode, { immediate, force });
      this.renderJourneyFromScroll({
        immediate,
        forceReset: desiredMode === "top"
      });
    }

    setMode(nextMode, { immediate = false, force = false } = {}) {
      if (this.destroyed) return;
      if (!force && this.mode === nextMode) return;

      const reducedMotion = this.reducedMotionQuery.matches;
      const shouldSetImmediately = immediate || reducedMotion;
      const version = ++this.stateVersion;

      this.stateTimeline?.kill();
      this.stateTimeline = null;
      this.stopLoop({ normalize: false });
      this.mode = nextMode;

      if (shouldSetImmediately) {
        this.renderCurrentWord();

        if (nextMode === "top") {
          this.gsap.set(this.active, {
            autoAlpha: 1,
            yPercent: 0,
            rotation: 0,
            transformOrigin: "0% 50%"
          });
          this.gsap.set(this.inactive, {
            autoAlpha: 0,
            yPercent: SETTINGS.incomingYPercent,
            rotation: SETTINGS.incomingRotation,
            transformOrigin: "0% 50%"
          });
          this.startLoop();
        } else {
          this.gsap.set(this.active, {
            autoAlpha: 0,
            yPercent: SETTINGS.outgoingYPercent,
            rotation: SETTINGS.outgoingRotation,
            transformOrigin: "100% 50%"
          });
          this.gsap.set(this.inactive, {
            autoAlpha: 1,
            yPercent: 0,
            rotation: 0,
            transformOrigin: "0% 50%"
          });
        }
        return;
      }

      if (nextMode === "top") {
        /*
         * The active holder is normalized while hidden below the clipping
         * window. This makes even a rapid direction reversal deterministic.
         */
        this.gsap.set(this.active, {
          autoAlpha: 0,
          yPercent: SETTINGS.incomingYPercent,
          rotation: SETTINGS.incomingRotation,
          transformOrigin: "0% 50%"
        });
        this.renderCurrentWord();
        this.gsap.set([this.active, this.inactive], { autoAlpha: 1 });

        this.stateTimeline = this.gsap.timeline({
          onComplete: () => {
            if (this.destroyed || version !== this.stateVersion) return;

            this.gsap.set(this.inactive, {
              autoAlpha: 0,
              yPercent: SETTINGS.outgoingYPercent,
              rotation: SETTINGS.outgoingRotation
            });
            this.gsap.set(this.active, {
              autoAlpha: 1,
              yPercent: 0,
              rotation: 0
            });
            this.stateTimeline = null;
            if (this.journeyGeometryDirty) {
              this.refreshJourneyGeometry();
            }
            this.renderJourneyFromScroll({
              immediate: true,
              forceReset: true
            });
            this.startLoop();
          }
        });

        this.stateTimeline
          .to(
            this.inactive,
            {
              duration: SETTINGS.outgoingDuration,
              yPercent: SETTINGS.outgoingYPercent,
              rotation: SETTINGS.outgoingRotation,
              transformOrigin: "100% 50%",
              ease: SETTINGS.outgoingEase,
              overwrite: true
            },
            0
          )
          .to(
            this.active,
            {
              duration: SETTINGS.incomingDuration,
              yPercent: 0,
              rotation: 0,
              transformOrigin: "0% 50%",
              ease: SETTINGS.incomingEase,
              overwrite: true
            },
            0
          );
      } else {
        this.gsap.set(this.inactive, {
          autoAlpha: 1,
          yPercent: SETTINGS.incomingYPercent,
          rotation: SETTINGS.incomingRotation,
          transformOrigin: "0% 50%"
        });
        this.gsap.set(this.active, { autoAlpha: 1 });

        this.stateTimeline = this.gsap.timeline({
          onComplete: () => {
            if (this.destroyed || version !== this.stateVersion) return;

            this.gsap.set(this.active, {
              autoAlpha: 0,
              yPercent: SETTINGS.outgoingYPercent,
              rotation: SETTINGS.outgoingRotation
            });
            this.gsap.set(this.inactive, {
              autoAlpha: 1,
              yPercent: 0,
              rotation: 0
            });
            this.renderCurrentWord();
            this.stateTimeline = null;
            if (this.journeyGeometryDirty) {
              this.refreshJourneyGeometry();
            }
            this.renderJourneyFromScroll();
          }
        });

        this.stateTimeline
          .to(
            this.active,
            {
              duration: SETTINGS.outgoingDuration,
              yPercent: SETTINGS.outgoingYPercent,
              rotation: SETTINGS.outgoingRotation,
              transformOrigin: "100% 50%",
              ease: SETTINGS.outgoingEase,
              overwrite: true
            },
            0
          )
          .to(
            this.inactive,
            {
              duration: SETTINGS.incomingDuration,
              yPercent: 0,
              rotation: 0,
              transformOrigin: "0% 50%",
              ease: SETTINGS.incomingEase,
              overwrite: true
            },
            0
          );
      }
    }

    startLoop() {
      if (
        this.destroyed ||
        !this.ready ||
        this.mode !== "top" ||
        this.stateTimeline ||
        this.reducedMotionQuery.matches ||
        document.hidden
      ) {
        return;
      }

      this.loopDelay?.kill();
      const version = this.loopVersion;
      this.loopDelay = this.gsap.delayedCall(SETTINGS.holdDuration, () => {
        this.loopDelay = null;
        if (version !== this.loopVersion) return;
        this.runWordSwap();
      });
    }

    stopLoop({ normalize = true } = {}) {
      this.loopVersion += 1;
      this.loopDelay?.kill();
      this.loopDelay = null;

      if (this.pendingIndex !== null) {
        this.currentIndex = this.pendingIndex;
      }

      this.wordTimeline?.kill();
      this.wordTimeline = null;
      this.pendingIndex = null;

      if (normalize && this.wordMetrics.length) {
        this.renderCurrentWord();
      }
    }

    runWordSwap() {
      if (
        this.destroyed ||
        this.mode !== "top" ||
        this.stateTimeline ||
        this.reducedMotionQuery.matches ||
        document.hidden ||
        this.words.length < 2
      ) {
        return;
      }

      const outgoingIndex = this.currentIndex;
      const incomingIndex = (outgoingIndex + 1) % this.words.length;
      const outgoingWord = this.words[outgoingIndex];
      const incomingWord = this.words[incomingIndex];
      const outgoingMetric = this.wordMetrics[outgoingIndex];
      const incomingMetric = this.wordMetrics[incomingIndex];
      const version = ++this.loopVersion;

      if (
        !outgoingWord ||
        !incomingWord ||
        !outgoingMetric ||
        !incomingMetric
      ) {
        return;
      }

      this.pendingIndex = incomingIndex;
      this.gsap.set(this.leadingLogo, { x: 0 });
      this.gsap.set(this.wordWindow, {
        height: this.wordWindowHeight,
        autoRound: false
      });

      const expandsWindow =
        incomingMetric.width > outgoingMetric.width + 0.001;
      let expansionCorrection = 0;

      if (expandsWindow) {
        /*
         * Expand the holder before the incoming image becomes visible. The
         * parent remains the clipping boundary, but already has enough width
         * for the complete new word — "Connect" can never appear as "conn".
         *
         * Expanding the flex item recenters the holder synchronously. Offset
         * the existing logo/word by the exact layout shift, then ease only that
         * visual correction away. This preserves a polished horizontal move
         * without using the inner wrapper as a clipping mask.
         */
        const leadingLeft = this.leadingLogo.getBoundingClientRect().left;
        this.gsap.set(this.wordWindow, {
          width: incomingMetric.width,
          autoRound: false
        });
        expansionCorrection =
          leadingLeft - this.leadingLogo.getBoundingClientRect().left;
      }

      this.gsap.set(outgoingWord, {
        autoAlpha: 1,
        x: expansionCorrection,
        yPercent: 0,
        rotation: 0,
        transformOrigin: "100% 50%"
      });
      this.gsap.set(this.leadingLogo, { x: expansionCorrection });
      this.gsap.set(incomingWord, {
        autoAlpha: 1,
        x: 0,
        yPercent: SETTINGS.incomingYPercent,
        rotation: SETTINGS.incomingRotation,
        transformOrigin: "0% 50%"
      });

      this.wordTimeline = this.gsap.timeline({
        onComplete: () => {
          if (this.destroyed || version !== this.loopVersion) return;

          this.currentIndex = incomingIndex;
          this.pendingIndex = null;
          this.wordTimeline = null;
          this.renderCurrentWord();
          this.startLoop();
        }
      });

      this.wordTimeline
        .to(
          outgoingWord,
          {
            duration: SETTINGS.outgoingDuration,
            yPercent: SETTINGS.outgoingYPercent,
            rotation: SETTINGS.outgoingRotation,
            transformOrigin: "100% 50%",
            ease: SETTINGS.outgoingEase
          },
          0
        )
        .set(outgoingWord, { autoAlpha: 0 })
        .to(
          incomingWord,
          {
            duration: SETTINGS.incomingDuration,
            yPercent: 0,
            rotation: 0,
            transformOrigin: "0% 50%",
            ease: SETTINGS.incomingEase
          },
          0
        );

      if (expandsWindow) {
        this.wordTimeline.to(
          this.leadingLogo,
          {
            duration: SETTINGS.outgoingDuration,
            x: 0,
            ease: SETTINGS.sizeEase
          },
          0
        );
      } else {
        this.wordTimeline.to(
          this.wordWindow,
          {
            duration: SETTINGS.incomingDuration,
            width: incomingMetric.width,
            ease: SETTINGS.sizeEase,
            autoRound: false
          },
          0
        );
      }
    }

    onScroll() {
      if (this.scrollFrame || this.destroyed) return;

      this.scrollFrame = window.requestAnimationFrame(() => {
        this.scrollFrame = 0;
        this.syncToScroll();
      });
    }

    onResize() {
      if (this.resizeFrame || this.destroyed) return;

      this.resizeFrame = window.requestAnimationFrame(() => {
        this.resizeFrame = 0;

        /*
         * Mobile Safari emits resize events while its bottom browser bar
         * collapses/expands. Only the viewport height changes, so the vw-based
         * word geometry is unchanged. Never run the destructive full refresh
         * during that event: it would kill the active/inactive transition.
         * The final journey does depend on the visible height, so update only
         * its anchor geometry once the state transition is not running.
         */
        const nextLayoutWidth = this.getLayoutViewportWidth();
        const nextViewportHeight = this.getViewportHeight();
        if (
          Math.abs(nextLayoutWidth - this.layoutViewportWidth) < 1
        ) {
          this.layoutViewportHeight = nextViewportHeight;

          if (!this.journeyReady) return;
          if (this.stateTimeline) {
            this.journeyGeometryDirty = true;
            return;
          }

          this.refreshJourneyGeometry();
          this.renderJourneyFromScroll();
          return;
        }

        this.layoutViewportWidth = nextLayoutWidth;
        this.layoutViewportHeight = nextViewportHeight;
        this.refresh({ immediate: true });
      });
    }

    onPageShow() {
      if (this.pageShowFrame || this.destroyed) return;

      this.pageShowFrame = window.requestAnimationFrame(() => {
        this.pageShowFrame = window.requestAnimationFrame(() => {
          this.pageShowFrame = 0;
          this.refresh({ immediate: true });
        });
      });
    }

    onPageHide() {
      this.stopLoop({ normalize: false });
      this.stateVersion += 1;
      this.stateTimeline?.kill();
      this.stateTimeline = null;
      this.morphTimeline?.pause();
      this.pulseTimeline?.pause();
    }

    onVisibilityChange() {
      if (document.hidden) {
        this.stopLoop({ normalize: false });
        this.morphTimeline?.pause();
        this.stopPulse({ hide: false });
        return;
      }

      this.refresh({ immediate: true });
    }

    onReducedMotionChange() {
      this.refresh({ immediate: true });
    }

    refresh({ immediate = true } = {}) {
      if (this.destroyed) return false;

      this.stopLoop({ normalize: false });
      this.stateVersion += 1;
      this.stateTimeline?.kill();
      this.stateTimeline = null;
      const measured = this.refreshMeasurements();
      this.syncToScroll({ immediate, force: true });
      return measured;
    }

    enterTop({ immediate = false } = {}) {
      this.setMode("top", { immediate, force: true });
      this.renderJourneyFromScroll({
        immediate: true,
        forceReset: true
      });
    }

    leaveTop({ immediate = false } = {}) {
      this.setMode("scrolled", { immediate, force: true });
      this.renderJourneyFromScroll({ immediate });
    }

    getState() {
      return {
        mode: this.mode,
        ready: this.ready,
        currentIndex: this.currentIndex,
        currentSource: this.words[this.currentIndex]?.currentSrc || "",
        reducedMotion: this.reducedMotionQuery.matches,
        scrollY: this.getScrollY(),
        journeyReady: this.journeyReady,
        logoProgress: this.logoJourneyProgress,
        heartProgress: this.heartJourneyProgress,
        mapProgress: this.mapJourneyProgress,
        heartDetached: this.heartDetached,
        morphProgress: this.morphTimeline?.progress() || 0,
        pulseActive: Boolean(
          this.pulseTimeline && this.pulseTimeline.isActive()
        ),
        journeyScroll: this.journeyGeometry
          ? {
              start: this.journeyGeometry.stageStartScroll,
              logoLanding: this.journeyGeometry.stageEndScroll,
              heartDeparture: this.journeyGeometry.heartStartScroll,
              heartLanding: this.journeyGeometry.mapEndScroll
            }
          : null
      };
    }

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;

      this.stopLoop({ normalize: false });
      this.stateVersion += 1;
      this.stateTimeline?.kill();
      this.stateTimeline = null;
      this.morphTimeline?.kill();
      this.morphTimeline = null;
      this.pulseTimeline?.kill();
      this.pulseTimeline = null;
      this.reattachHeart({ force: true });

      if (this.scrollFrame) window.cancelAnimationFrame(this.scrollFrame);
      if (this.resizeFrame) window.cancelAnimationFrame(this.resizeFrame);
      if (this.pageShowFrame) window.cancelAnimationFrame(this.pageShowFrame);

      window.removeEventListener("scroll", this.onScroll);
      window.removeEventListener("resize", this.onResize);
      window.visualViewport?.removeEventListener(
        "resize",
        this.onResize
      );
      window.removeEventListener("pageshow", this.onPageShow);
      window.removeEventListener("pagehide", this.onPageHide);
      document.removeEventListener(
        "visibilitychange",
        this.onVisibilityChange
      );

      if (typeof this.reducedMotionQuery.removeEventListener === "function") {
        this.reducedMotionQuery.removeEventListener(
          "change",
          this.onReducedMotionChange
        );
      } else {
        this.reducedMotionQuery.removeListener(this.onReducedMotionChange);
      }

      this.gsap.killTweensOf(this.touchedElements);
      this.heartMarker?.remove();
      this.heartOverlay?.remove();
      this.styleElement?.remove();

      this.originalStyles.forEach((styleValue, element) => {
        if (styleValue === null) {
          element.removeAttribute("style");
        } else {
          element.setAttribute("style", styleValue);
        }
      });

      /*
       * Clearing a child transform can make GSAP recreate an empty style
       * attribute while the remaining elements are being restored. Normalize
       * elements that originally had no inline style after the full pass.
       */
      this.originalStyles.forEach((styleValue, element) => {
        if (styleValue === null && element.getAttribute("style") === "") {
          element.removeAttribute("style");
        }
      });

      if (this.movingHeartPath && this.originalHeartPathD) {
        this.movingHeartPath.setAttribute(
          "d",
          this.originalHeartPathD
        );
      }

      if (this.originalReadyAttribute === null) {
        this.root.removeAttribute(READY_ATTRIBUTE);
      } else {
        this.root.setAttribute(
          READY_ATTRIBUTE,
          this.originalReadyAttribute
        );
      }

      if (window[INSTANCE_KEY] === this) {
        delete window[INSTANCE_KEY];
      }
    }
  }

  const createStaticFallback = (elements) => {
    const { active, inactive } = elements;
    const activeStyle = active.getAttribute("style");
    const inactiveStyle = inactive.getAttribute("style");
    let frame = 0;
    let destroyed = false;

    const update = () => {
      frame = 0;
      if (destroyed) return;

      const atTop =
        Math.max(0, window.scrollY || document.documentElement.scrollTop || 0) <=
        SETTINGS.topEnterTolerance;

      active.style.display = atTop ? "flex" : "none";
      inactive.style.display = atTop ? "none" : "flex";
    };

    const onScroll = () => {
      if (frame || destroyed) return;
      frame = window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    update();

    return {
      getState: () => ({
        mode:
          active.style.display === "none" ? "scrolled" : "top",
        ready: false,
        fallback: true
      }),
      refresh: update,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        if (frame) window.cancelAnimationFrame(frame);
        window.removeEventListener("scroll", onScroll);

        if (activeStyle === null) active.removeAttribute("style");
        else active.setAttribute("style", activeStyle);

        if (inactiveStyle === null) inactive.removeAttribute("style");
        else inactive.setAttribute("style", inactiveStyle);

        if (window[INSTANCE_KEY] === this) {
          delete window[INSTANCE_KEY];
        }
      }
    };
  };

  let cancelled = false;
  let retryTimer = 0;
  let domReadyListener = null;
  let attempts = 0;

  const bootstrapHandle = {
    destroy() {
      cancelled = true;
      window.clearTimeout(retryTimer);
      if (domReadyListener) {
        document.removeEventListener("DOMContentLoaded", domReadyListener);
      }
      if (window[INSTANCE_KEY] === bootstrapHandle) {
        delete window[INSTANCE_KEY];
      }
    }
  };

  window[INSTANCE_KEY] = bootstrapHandle;

  const tryStart = () => {
    if (cancelled) return;

    const elements = findElements();
    const gsap = window.gsap;

    if (elements && gsap && typeof gsap.timeline === "function") {
      const controller = new HeroIntroController(elements, gsap);

      if (cancelled || window[INSTANCE_KEY] !== bootstrapHandle) {
        controller.destroy();
        return;
      }

      window[INSTANCE_KEY] = controller;
      return;
    }

    attempts += 1;
    if (attempts < 120) {
      retryTimer = window.setTimeout(tryStart, 50);
      return;
    }

    if (elements) {
      console.warn(
        "[Sisslerfeld hero] GSAP was not available; using the static state fallback."
      );
      const fallback = createStaticFallback(elements);
      if (!cancelled && window[INSTANCE_KEY] === bootstrapHandle) {
        window[INSTANCE_KEY] = fallback;
      } else {
        fallback.destroy();
      }
    } else {
      console.warn(
        "[Sisslerfeld hero] Required hero elements were not found."
      );
    }
  };

  if (document.readyState === "loading") {
    domReadyListener = () => {
      domReadyListener = null;
      tryStart();
    };
    document.addEventListener("DOMContentLoaded", domReadyListener, {
      once: true
    });
  } else {
    tryStart();
  }
})();
