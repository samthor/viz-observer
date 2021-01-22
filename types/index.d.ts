
/**
 * Sets up an observer that notifies on element resize or move.
 *
 * Returns a method to remove the observer (or accepts an AbortSignal). You should be sure to clean
 * up outstanding observers even if you otherwise discard the element, otherwise you could leak
 * memory.
 */
export default function vizObserver(
  element: Element,
  callback: (rect: Rect) => void,
  options?: Options,
): () => void;

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