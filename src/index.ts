export interface VisualObserverEntry {
  target: Element;
  contentRect: DOMRectReadOnly;
  isAppearing: boolean;
}

export interface VisualObserverCallback {
  (this: VisualObserver, entries: VisualObserverEntry[], observer: VisualObserver): void;
}

interface VisualObserverElement {
  io: IntersectionObserver | null;
  threshold: number;
  isFirstUpdate: boolean;
}

/**
 * Create an observer that notifies when an element is resized, moved, or added/removed from the DOM.
 */
export class VisualObserver {
  #root = document.documentElement;
  #rootRect = this.#root.getBoundingClientRect();

  #callback: VisualObserverCallback;

  constructor(callback: VisualObserverCallback) {
    this.#callback = callback;
  }

  #elements = new Map<Element, VisualObserverElement>();

  #resizeObserver = new ResizeObserver((entries) => {
    const visualEntries: VisualObserverEntry[] = [];

    const rootEntry = entries.find((entry) => entry.target === this.#root);
    // Any time the root element resizes we need to refresh all the observed elements.
    if (rootEntry !== undefined) {
      this.#rootRect = rootEntry.contentRect;

      this.#elements.forEach((_, target) => {
        // Why force a refresh? we really just need to reset the IntersectionObserver?
        visualEntries.push(this.#refreshElement(target));
      });
    } else {
      for (const entry of entries) {
        visualEntries.push(this.#refreshElement(entry.target));
      }
    }

    this.#callback(visualEntries, this);
  });

  // We should be guaranteed that each `IntersectionObserver` only observes one element.
  #onIntersection = ([
    { target, intersectionRatio, boundingClientRect },
  ]: IntersectionObserverEntry[]) => {
    const el = this.#elements.get(target);

    if (el === undefined) return;

    if (intersectionRatio !== el.threshold) {
      // It's possible for the watched element to not be at perfect 1.0 visibility when we create
      // the IntersectionObserver. This has a couple of causes:
      //   - elements being on partial pixels
      //   - elements being hidden offscreen (e.g., <html> has `overflow: hidden`)
      //   - delays: if your DOM change occurs due to e.g., page resize, you can see elements
      //     behind their actual position
      //
      // In all of these cases, refresh but with this lower ratio of threshold. When the element
      // moves beneath _that_ new value, the user will get notified.

      if (el.isFirstUpdate) {
        el.threshold =
          intersectionRatio === 0.0
            ? 0.0000001 // just needs to be non-zero
            : intersectionRatio;
      }

      this.#callback([this.#refreshElement(target, boundingClientRect)], this);
    }

    el.isFirstUpdate = false;
  };

  #refreshElement(
    target: Element,
    contentRect: DOMRectReadOnly = target.getBoundingClientRect()
  ): VisualObserverEntry {
    // Assume el exists
    const el = this.#elements.get(target)!;

    el.io?.disconnect();
    el.io = null;

    const { left, top, height, width } = contentRect;
    // Don't create a IntersectionObserver until the target has a size.
    if (width === 0 && height === 0) {
      return {
        target,
        contentRect,
        isAppearing: false,
      };
    }

    // The biggest bottleneck Im seeing is accessing these `root` properties
    const x = left + this.#root.scrollLeft;
    const y = top + this.#root.scrollTop;

    const floor = Math.floor;
    // `${-insetTop}px ${-insetRight}px ${-insetBottom}px ${-insetLeft}px`;
    const rootMargin = `${-floor(y)}px ${-floor(this.#rootRect.width - (x + width))}px ${-floor(
      this.#rootRect.height - (y + height)
    )}px ${-floor(x)}px`;

    // Reset the threshold and isFirstUpdate before creating a new Intersection Observer.
    const { threshold } = el;
    el.threshold = 1;
    el.isFirstUpdate = true;

    el.io = new IntersectionObserver(this.#onIntersection, {
      root: this.#root,
      rootMargin,
      threshold,
    });

    el.io.observe(target);

    return {
      target,
      contentRect: DOMRectReadOnly.fromRect({
        x,
        y,
        width,
        height,
      }),
      isAppearing: true,
    };
  }

  disconnect(): void {
    this.#elements.forEach((el) => el.io?.disconnect());
    this.#elements.clear();
    this.#resizeObserver.disconnect();
  }

  observe(target: Element): void {
    if (this.#elements.has(target)) return;

    if (this.#elements.size === 0) {
      // Note that this will also kick of the resize observer and currently refreshes all elements
      this.#resizeObserver.observe(this.#root);
    }

    this.#elements.set(target, {
      io: null,
      threshold: 1,
      isFirstUpdate: true,
    });

    // The resize observer will be called immediately, so we don't have to manually refresh.
    this.#resizeObserver.observe(target);
  }

  unobserve(target: Element): void {
    const el = this.#elements.get(target);

    if (el === undefined) return;

    this.#resizeObserver.unobserve(target);

    el.io?.disconnect();
    el.io = null;

    this.#elements.delete(target);

    if (this.#elements.size === 0) {
      this.#resizeObserver.disconnect();
    }
  }
}
