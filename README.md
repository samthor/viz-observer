
This is an ES Module which exports the default method `vizObserver`.
It notifies you when an element is resized or moved on a page, including when it appears or disappears (similar to but _not quite_ being added/removed from the DOM).
See [this post](https://whistlr.info/2021/observing-dom/) for an explanation, or see this animation:

<img src="https://storage.googleapis.com/hwhistlr.appspot.com/assets/node-io-hack.webp" />

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

## Notes

This works inside Shadow DOM.
