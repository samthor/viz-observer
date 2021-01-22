/**
 * @fileoverview This is an ES Module which exports `vizObserver`, see its function below.
 *
 * This uses a combination of IntersectionObserver and ResizeObserver to inform you when DOM
 * nodes move around on a page (and also when they're resized). This might be useful if
 * you're trying to track a complex HTML structure, perhaps one you don't cotrol.
 *
 * It also works with target nodes inside Shadow DOM.
 */

const debug = false;
const root = document.documentElement;

import * as types from './types/index.js';


// It's possible to run without ResizeObserver, which is marginally less supported than
// IntersectionObserver. This will track element moves, size increases, DOM removals, but not
// elements becoming smaller.
if (!window.IntersectionObserver) {
  throw new Error(`viz-observer requires IntersectionObserver`);
}
const hasResizeObserver = !!(window.ResizeObserver);


/** @type {Set<() => void>} */
const activeObservers = new Set();


/**
 * @type {(enable: boolean) => void}
 */
const controlGlobalResize = (() => {
  const globalResizeHandler = () => activeObservers.forEach((handler) => handler());

  if (!hasResizeObserver) {
    return (enable) => {
      if (enable) {
        window.addEventListener('resize', globalResizeHandler);
      } else {
        window.removeEventListener('resize', globalResizeHandler);
      }
    };
  }

  const documentResizeObserver = new ResizeObserver(globalResizeHandler);
  return (enable) => {
    if (enable) {
      documentResizeObserver.observe(root);
    } else {
      documentResizeObserver.disconnect();
    }
  };
})();


/**
 * @param {Element} element to observe
 * @param {(rect: types.Rect) => void} callback on move or resize
 * @param {types.Options=} options
 * @return {() => void} cleanup function
 */
export default function vizObserver(element, callback, options) {
  /** @type {IntersectionObserver?} */
  let io = null;

  const viz = document.createElement('div');
  viz.className = 'viz';
  debug && document.body.append(viz);

  const refresh = (threshold = 1.0) => {
    io && io.disconnect();
    io = null;

    const rect = element.getBoundingClientRect();
    const se = /** @type {HTMLElement} */ (document.scrollingElement);
    const top = rect.top + se.scrollTop;
    const left = rect.left + se.scrollLeft;

    if (!rect.width || !rect.height) {
      callback({appear: false, x: 0, y: 0, width: 0, height: 0});
      return;  // Wait for the element to be resized to a sensible size.
    }
    callback({
      appear: true,
      x: left,
      y: top,
      width: rect.width,
      height: rect.height,
    });

    // Calculate the exact position this element holds on the page.
    const x = (v) => Math.floor(v);
    const {offsetWidth: dw, offsetHeight: dh} = root;
    const insetTop = x(top);
    const insetLeft = x(left);
    const insetRight = x(dw - (left + rect.width));
    const insetBottom = x(dh - (top + rect.height));
    const rootMargin = `${-insetTop}px ${-insetRight}px ${-insetBottom}px ${-insetLeft}px`;

    const options = {root, rootMargin, threshold};
    let isFirstUpdate = true;

    io = new IntersectionObserver((entries) => {
      const only = entries[0];

      debug && console.warn('got update', only.intersectionRatio, 'first?', isFirstUpdate, 'refresh', threshold !== only.intersectionRatio);
      if (threshold !== only.intersectionRatio) {
        if (!isFirstUpdate) {
          return refresh();
        }

        // It's possible for the watched element to not be at perfect 1.0 visibility when we create
        // the IntersectionObserver. This has a couple of causes:
        //   - elements being on partial pixels
        //   - elements being hidden offscreen (e.g., <html> has `overflow: hidden`)
        //   - delays: if your DOM change occurs due to e.g., page resize, you can see elements
        //     behind their actual position
        //
        // In all of these cases, refresh but with this lower ratio of threshold. When the element
        // moves beneath _that_ new value, the user will get notified.

        let update = only.intersectionRatio;
        if (update === 0.0) {
          update = 0.0000001;  // just needs to be non-zero
        }
        refresh(update);
      }

      isFirstUpdate = false;
    }, options);
    debug && console.debug('watching', {element, rootMargin, threshold});
    io.observe(element);

    viz.style.margin = `${insetTop}px ${insetRight}px ${insetBottom}px ${insetLeft}px`;
  };

  activeObservers.add(refresh);
  if (activeObservers.size === 1) {
    controlGlobalResize(true);
  }
  refresh();

  let ro = null;
  if (hasResizeObserver) {
    // Always add a ResizeObserver. This does nothing but force a refresh of the
    // IntersectionObserver, since the element has now changed size.
    ro = new ResizeObserver(() => refresh());
    ro.observe(element);
  }

  const signal = options && options.signal || null;

  let released = false;
  const abort = () => {
    if (released) {
      return;
    }
    released = true;
    signal && signal.removeEventListener('abort', abort);

    ro && ro.disconnect();
    io && io.disconnect();
    activeObservers.delete(refresh);

    if (activeObservers.size === 0) {
      controlGlobalResize(false);
    }
  };

  signal && signal.addEventListener('abort', abort);
  return abort;
}
