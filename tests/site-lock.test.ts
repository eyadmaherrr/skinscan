import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, it } from 'node:test';
import { createSiteLockCache, fetchClinicSiteLock } from '../lib/site-lock';

function setup(answers: (boolean | Error)[]) {
  let clock = 0;
  let calls = 0;
  const background: Promise<unknown>[] = [];
  const cache = createSiteLockCache({
    ttlMs: 10_000,
    maxStaleMs: 30_000,
    now: () => clock,
    fetchLocked: async () => {
      const answer = answers[Math.min(calls++, answers.length - 1)];
      if (answer instanceof Error) throw answer;
      return answer;
    },
  });
  const check = (prefetch = false) => cache.isLocked({ prefetch, waitUntil: (p) => background.push(p) });
  return {
    check,
    calls: () => calls,
    advance: (ms: number) => (clock += ms),
    settle: () => Promise.all(background.splice(0)),
  };
}

describe('site lock (shared with drmahermahmoud.com)', () => {
  it('asks once, then reuses the answer for 10 s', async () => {
    const lock = setup([true]);
    assert.equal(await lock.check(), true);
    lock.advance(9_000);
    assert.equal(await lock.check(), true);
    assert.equal(lock.calls(), 1);
  });

  it('serves a stale answer while refreshing, then the new one', async () => {
    const lock = setup([false, true]);
    assert.equal(await lock.check(), false);
    lock.advance(15_000);
    assert.equal(await lock.check(), false); // stale, refresh in background
    await lock.settle();
    assert.equal(await lock.check(), true);
  });

  it('waits for a fresh answer when the last one is too old', async () => {
    const lock = setup([false, true]);
    await lock.check();
    lock.advance(31_000);
    assert.equal(await lock.check(), true);
  });

  it('never makes a prefetch wait', async () => {
    const lock = setup([true]);
    assert.equal(await lock.check(true), false);
    await lock.settle();
    assert.equal(await lock.check(true), true);
  });

  it('fails open when the clinic website cannot be asked', async () => {
    const lock = setup([new Error('down')]);
    assert.equal(await lock.check(), false);
  });

  it('reads the clinic website status endpoint', async () => {
    let locked = true;
    const server = createServer((req, res) => {
      if (req.url !== '/api/site/status') {
        res.statusCode = 404;
        return res.end();
      }
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ locked }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      assert.equal(await fetchClinicSiteLock(url), true);
      locked = false;
      assert.equal(await fetchClinicSiteLock(url), false);
      await assert.rejects(fetchClinicSiteLock(`${url}/nothing-here`));
    } finally {
      server.close();
    }
  });
});
