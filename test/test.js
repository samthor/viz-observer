
import vizObserver from './index.js';

// @ts-ignore
const suite = window.suite;
// @ts-ignore
const test = window.test;
// @ts-ignore
const assert = window.assert;

  // called before any tests are run
  const e = window.onerror;
  window.onerror = function(err) {
    console.warn('err', err);
    if(err === 'ResizeObserver loop limit exceeded') {
      console.warn('Ignored: ResizeObserver loop limit exceeded');
      return false;
    }
  }

suite('move', () => {
  test('callback on element move', async () => {

    const node = document.createElement('div');
    node.style.height = '100px';
    node.style.width = '100px';
    node.style.background = 'blue';
    document.body.append(node);

    const rects = [];

    const cleanup = vizObserver(node, (rect) => {
      console.info('got update', rect);
      rects.push(rect);
    });

    await Promise.resolve();
    rects.splice(0, rects.length);
    console.warn('clearing');

    const shifter = document.createElement('div');
    shifter.style.height = '200px';
    document.body.insertBefore(shifter, node);

    await new Promise((r) => window.setTimeout(r, 1000));
    assert.deepEqual(rects, [{}]);
  });
});
