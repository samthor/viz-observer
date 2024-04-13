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

// TODO: should we flush the entries every animation frame?
/**
 * Create an observer that notifies when an element resizes, moves, or is added/removed from the DOM.
 */
export class VisualObserver {
  #callback: VisualObserverCallback;

  #root = document.documentElement;

  constructor(callback: VisualObserverCallback) {
    this.#callback = callback.bind(this);
  }

  #elements = new Map<Element, VisualObserverElement>();

  #resizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]) => {
    const visualEntries: VisualObserverEntry[] = [];

    const root = entries.find((entry) => entry.target === this.#root);

    // Any time the root element resizes we need to refresh all the observed elements.
    if (root !== undefined) {
      this.#elements.forEach((_, target) => {
        visualEntries.push(this.#refreshElement(target));
      });
    } else {
      for (const entry of entries) {
        if (entry.target === this.#root) continue;
        visualEntries.push(this.#refreshElement(entry.target, entry.contentRect));
      }
    }

    this.#callback(visualEntries, this);
  });

  // We should be guaranteed that each `IntersectionObserver` only observes one element.
  #onIntersection = ([entry]: IntersectionObserverEntry[]) => {
    let el = this.#elements.get(entry.target);

    if (el === undefined) return;

    if (entry.intersectionRatio !== el.threshold) {
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
          entry.intersectionRatio === 0.0
            ? 0.0000001 // just needs to be non-zero
            : entry.intersectionRatio;
      }

      this.#callback([this.#refreshElement(entry.target, entry.boundingClientRect)], this);
    }

    el.isFirstUpdate = false;
  };

  #refreshElement(
    target: Element,
    contentRect: DOMRectReadOnly = target.getBoundingClientRect()
  ): VisualObserverEntry {
    let el = this.#elements.get(target);

    if (el === undefined) throw new Error('Cant refresh target with no record.');

    el.io?.disconnect();

    // Don't create a IntersectionObserver until the target has a size.
    if (contentRect.width === 0 && contentRect.height === 0) {
      return {
        target,
        contentRect,
        isAppearing: false,
      };
    }
    const root = this.#root;
    // This was previously document.scrollingElement?
    const x = contentRect.left + root.scrollLeft;
    const y = contentRect.top + root.scrollTop;

    const insetLeft = Math.floor(x);
    const insetTop = Math.floor(y);
    const insetRight = Math.floor(root.offsetWidth - (x + contentRect.width));
    const insetBottom = Math.floor(root.offsetHeight - (y + contentRect.height));
    const rootMargin = `${-insetTop}px ${-insetRight}px ${-insetBottom}px ${-insetLeft}px`;

    // Reset the threshold and isFirstUpdate before creating a new Intersection Observer.
    const { threshold } = el;
    el.threshold = 1;
    el.isFirstUpdate = true;

    el.io = new IntersectionObserver(this.#onIntersection, {
      root,
      rootMargin,
      threshold,
    });

    el.io.observe(target);

    return {
      target,
      contentRect: DOMRectReadOnly.fromRect({
        x,
        y,
        width: contentRect.width,
        height: contentRect.height,
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

    this.#elements.delete(target);

    if (this.#elements.size === 0) {
      this.#resizeObserver.disconnect();
    }
  }
}
