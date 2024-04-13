/**
 * @fileoverview This is an ES Module which exports `vizObserver`, see its function below.
 *
 * This uses a combination of IntersectionObserver and ResizeObserver to inform you when DOM
 * nodes move around on a page (and also when they're resized). This might be useful if
 * you're trying to track a complex HTML structure, perhaps one you don't control.
 *
 * It also works with target nodes inside Shadow DOM.
 */

/**
 * This is an element's position relative to the page's documentElement.
 */
export interface Rect {
  appear: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Options {
  signal?: AbortSignal;
}

export interface VisualObserverEntry {
  target: Element;
  contentRect: DOMRectReadOnly;
  isAppearing: boolean;
}

export interface VisualObserverCallback {
  (entries: VisualObserverEntry[], observer: VisualObserver): void;
}

interface VisualObserverElement {
  intersectionObserver: IntersectionObserver;
}

/**
 * Create an observer that notifies when an element resizes, moves, or is added/removed from the DOM.
 */
export class VisualObserver {
  #callback: VisualObserverCallback;

  constructor(callback: VisualObserverCallback) {
    this.#callback = callback;
  }

  #elementCount = 0;
  // Unsure whether to use a Map or WeakMap. Not using a weak map means we are prone to memory leaks, but it also means that we cant iterate and/or clear the map.
  #elements = new WeakMap<Element, VisualObserverElement>();

  #onResize = (entries: ResizeObserverEntry[]) => {};

  #resizeObserver = new ResizeObserver(this.#onResize);

  #onIntersection = (entries: IntersectionObserverEntry[]) => {};

  get #root() {
    return document.documentElement;
  }

  disconnect(): void {
    this.#resizeObserver.disconnect();
  }

  observe(target: Element): void {
    if (this.#elementCount === 0) {
      this.#resizeObserver.observe(this.#root);
    }
    this.#elementCount += 1;
    this.#elements.set(target, {
      intersectionObserver: new IntersectionObserver(this.#onIntersection),
    });
  }

  unobserve(target: Element): void {
    if (this.#elementCount === 1) {
      this.#resizeObserver.unobserve(this.#root);
    }
    this.#elementCount -= 1;
    // Do we need to disconnect the IntersectionObserver or does that happen when it's garbage collected?
    this.#elements.delete(target);
  }
}

/* Old implementation */
// const debug = false;

const handlers = new WeakMap<Element, () => void>();

const activeObservers = new Set<() => void>();
handlers.set(document.documentElement, () => activeObservers.forEach((handler) => handler()));

const ro = new ResizeObserver((entries) => {
  for (const entry of entries) {
    handlers.get(entry.target)?.();
  }
});

function vizObserver(element: Element, callback: (rect: Rect) => void) {
  let io: IntersectionObserver | null = null;

  // const viz = document.createElement('div');
  // viz.className = 'viz';
  // debug && document.body.append(viz);

  const refresh = (threshold = 1.0) => {
    io?.disconnect();
    io = null;

    const rect = element.getBoundingClientRect();
    const se = document.scrollingElement;
    const top = rect.top + (se?.scrollTop ?? 0);
    const left = rect.left + (se?.scrollLeft ?? 0);

    if (!rect.width || !rect.height) {
      callback({ appear: false, x: 0, y: 0, width: 0, height: 0 });
      return; // Wait for the element to be resized to a sensible size.
    }
    callback({
      appear: true,
      x: left,
      y: top,
      width: rect.width,
      height: rect.height,
    });

    // Calculate the exact position this element holds on the page.
    const { offsetWidth: dw, offsetHeight: dh } = root;
    const insetTop = Math.floor(top);
    const insetLeft = Math.floor(left);
    const insetRight = Math.floor(dw - (left + rect.width));
    const insetBottom = Math.floor(dh - (top + rect.height));
    const rootMargin = `${-insetTop}px ${-insetRight}px ${-insetBottom}px ${-insetLeft}px`;

    const options = { root, rootMargin, threshold };
    let isFirstUpdate = true;

    io = new IntersectionObserver((entries) => {
      const only = entries[0];

      // debug &&
      //   console.warn(
      //     'got update',
      //     only.intersectionRatio,
      //     'first?',
      //     isFirstUpdate,
      //     'refresh',
      //     threshold !== only.intersectionRatio
      //   );
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
          update = 0.0000001; // just needs to be non-zero
        }
        refresh(update);
      }

      isFirstUpdate = false;
    }, options);
    // debug && console.debug('watching', { element, rootMargin, threshold });
    io.observe(element);

    // viz.style.margin = `${insetTop}px ${insetRight}px ${insetBottom}px ${insetLeft}px`;
  };

  activeObservers.add(refresh);

  if (activeObservers.size === 1) {
    ro.observe(root);
  }

  refresh();

  // ro.observe(element);

  let released = false;

  return () => {
    if (released) return;

    released = true;

    ro.unobserve(element);
    io?.disconnect();
    activeObservers.delete(refresh);

    if (activeObservers.size === 0) {
      ro.unobserve(root);
    }
  };
}
