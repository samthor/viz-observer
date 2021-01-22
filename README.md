
This is an ES Module which exports the default method `vizObserver`.
It notifies you when an element is resized or moved on a page, including when it appears or disappears (similar to but _not quite_ being added/removed from the DOM).
See [this post](https://whistlr.info/2021/observing-dom/) for an explanation.

## Usage

```js
import vizObserver from 'viz-observer';

vizObserver(yourElement, (rect) => {
  console.info('element is now at', rect);
});
```

This returns a cleanup method which you _must_ call when done.
You can pass an `AbortSignal` as `{signal}` in the third argument:

```js
const ac = new AbortController();

vizObserver(yourElement, yourCallback, {signal: ac.signal});

// later
ac.abort();
```
