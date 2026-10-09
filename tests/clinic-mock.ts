import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Stand-in for the clinic website's auth API (drmahermahmoud.com): GET
 * /api/auth/me and POST /api/auth/logout, keyed by the x-patient-session header.
 */

export const VALID_TOKEN = 'a'.repeat(64);

export interface ClinicMock {
  url: string;
  revoked: string[];
  close: () => Promise<void>;
}

export async function startClinicMock(): Promise<ClinicMock> {
  const revoked: string[] = [];
  const server: Server = createServer((req, res) => {
    const token = req.headers['x-patient-session'];
    req.resume();
    req.on('end', () => {
      if (req.method === 'GET' && req.url === '/api/auth/me') {
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify(
            token === VALID_TOKEN
              ? {
                  authenticated: true,
                  patient: { id: 'p1', name: 'Mona Ali', email: 'mona@example.com', phone: '01000000000', points: 40 },
                }
              : { authenticated: false },
          ),
        );
        return;
      }
      if (req.method === 'POST' && req.url === '/api/auth/logout') {
        if (typeof token === 'string') revoked.push(token);
        res.statusCode = 303;
        res.setHeader('location', '/login');
        res.end();
        return;
      }
      res.statusCode = 404;
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    revoked,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
