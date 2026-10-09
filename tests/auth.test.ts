import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { startClinicMock, VALID_TOKEN, type ClinicMock } from './clinic-mock';

let clinic: ClinicMock;
let auth: typeof import('../lib/auth');
let logout: typeof import('../app/api/auth/logout/route');
let me: typeof import('../app/api/auth/me/route');

before(async () => {
  clinic = await startClinicMock();
  process.env.CLINIC_URL = clinic.url;
  process.env.SKINSCAN_REQUIRE_AUTH = 'true';
  auth = await import('../lib/auth');
  logout = await import('../app/api/auth/logout/route');
  me = await import('../app/api/auth/me/route');
});
after(() => clinic.close());

const request = (url: string, headers: Record<string, string> = {}, method = 'GET') => new Request(url, { method, headers });

describe('session token', () => {
  it('prefers the header, then the newest cookie', () => {
    assert.equal(auth.getPatientSessionToken(request('http://x/', { 'x-patient-session': 'h' })), 'h');
    assert.equal(auth.getPatientSessionToken(request('http://x/', { cookie: 'a=1; patient_session=old; patient_session=new' })), 'new');
    assert.equal(auth.getPatientSessionToken(request('http://x/', { cookie: 'patient_session=%E0%A4%A' })), null);
    assert.equal(auth.getPatientSessionToken(request('http://x/')), null);
  });
});

describe('clinic session check', () => {
  it('accepts only sessions the clinic website accepts, and keeps only name and email', async () => {
    const ok = await auth.verifyPatientSession(VALID_TOKEN);
    assert.deepEqual(ok, { authenticated: true, patient: { name: 'Mona Ali', email: 'mona@example.com' } });
    assert.equal((await auth.verifyPatientSession('b'.repeat(64))).authenticated, false);
    // The removed test backdoor must not authenticate.
    assert.equal((await auth.verifyPatientSession('test-session-token')).authenticated, false);
    assert.equal((await auth.verifyPatientSession(null)).authenticated, false);
  });

  it('reports an unreachable clinic website instead of failing', async () => {
    const saved = process.env.CLINIC_URL;
    const { serverConfig } = await import('../lib/config');
    const original = serverConfig.clinicUrl;
    (serverConfig as { clinicUrl: string }).clinicUrl = 'http://127.0.0.1:9';
    try {
      assert.deepEqual(await auth.verifyPatientSession(VALID_TOKEN), { authenticated: false, unavailable: true });
    } finally {
      (serverConfig as { clinicUrl: string }).clinicUrl = original;
      process.env.CLINIC_URL = saved;
    }
  });
});

describe('/api/auth/me', () => {
  it('says whether scanning needs a sign-in and who is signed in', async () => {
    const out = await (await me.GET(request('http://localhost/api/auth/me', { cookie: `patient_session=${VALID_TOKEN}` }))).json();
    assert.deepEqual(out, { authenticated: true, required: true, patient: { name: 'Mona Ali', email: 'mona@example.com' } });
    const anon = await (await me.GET(request('http://localhost/api/auth/me'))).json();
    assert.deepEqual(anon, { authenticated: false, required: true });
  });
});

describe('/api/auth/logout', () => {
  it('ends the session on the clinic website and removes both cookie copies', async () => {
    const res = await logout.POST(
      request(
        'https://skinscan.drmahermahmoud.com/api/auth/logout',
        { cookie: `patient_session=${VALID_TOKEN}`, origin: 'https://skinscan.drmahermahmoud.com' },
        'POST',
      ),
    );
    assert.equal(res.status, 200);
    assert.deepEqual(clinic.revoked, [VALID_TOKEN]);
    const cookies = res.headers.getSetCookie();
    assert.equal(cookies.length, 2);
    assert.ok(cookies.some((c) => /patient_session=;/.test(c) && /Domain=\.drmahermahmoud\.com/i.test(c)));
    assert.ok(cookies.some((c) => /patient_session=;/.test(c) && !/Domain=/i.test(c)));
  });

  it('keeps cookies host-only outside the clinic domain', async () => {
    const res = await logout.POST(request('http://localhost:3000/api/auth/logout', {}, 'POST'));
    const cookies = res.headers.getSetCookie();
    assert.equal(cookies.length, 1);
    assert.ok(!/Domain=/i.test(cookies[0]));
  });

  it('refuses sign-out requests from other sites', async () => {
    const res = await logout.POST(
      request('https://skinscan.drmahermahmoud.com/api/auth/logout', { origin: 'https://evil.example' }, 'POST'),
    );
    assert.equal(res.status, 403);
  });
});
