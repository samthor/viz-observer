
This is an ES Module which exports the default method `vizObserver`.
It notifies you when an element is resized or moved on a page, including when it appears or disappears (similar to but _not quite_ being added/removed from the DOM).
See [this post](https://whistlr.info/2021/observing-dom/) for an explanation, or see this animation:

<div style="text-align: center">
  <img src="https://storage.googleapis.com/hwhistlr.appspot.com/assets/node-io-hack.webp" />
</div>

## Usage

Install as "viz-observer".

```js
import vizObserver from 'viz-observer';

const cleanup = vizObserver(yourElement, (rect) => {
  console.info('element is now at', rect);
});

// later
cleanup();
```

This returns a cleanup method which you _must_ call when done.
You can pass an `AbortSignal` as `{signal}` in the third argument:

```js
const ac = new AbortController();

vizObserver(yourElement, yourCallback, {signal: ac.signal});

// later
ac.abort();
```

## Requirements

This requires `IntersectionObserver`, which [is pretty widely supported](https://caniuse.com/intersectionobserver).

It works without `ResizeObserver` in a slightly crippled mode _just_ to support Safari 12.x, as it was the only browser to introduce `InteresectionObserver` _before_ `ResizeObserve`.
It won't report elements shrinking—only elements growing, moving or being removed from the page.

## Notes

This works totally fine inside Shadow DOM.
It's how the author uses it: I report the location of interesting elements and "attach" unrelated elemnents to them, such as for a popup or tooltip.
