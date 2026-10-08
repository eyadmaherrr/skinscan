# Privacy

Facial photos are sensitive personal data (biometric and potentially
health-related). The scan is designed so that we process as little as
possible and keep nothing.

## What happens to a photo

1. **On the device.** The browser re-draws the photo onto a canvas, limits it
   to 2560 px and re-encodes it as JPEG. This drops all metadata (EXIF,
   GPS location, camera serials). The original file never leaves the device.
2. **In transit.** The prepared photo is sent over HTTPS to
   `/api/skin-scan` on our own server — the same origin as the page.
3. **On the server.** The photo is decoded and analysed **in memory** only.
   It is never written to disk, a database, object storage, a cache or a log,
   and it is never sent to another service. The models run locally inside
   the server process.
4. **After the request.** The response contains scores, explanations and
   region outlines (normalised coordinates of the analysed areas so the page
   can draw them). Nothing about the scan is stored on the server; the image
   buffer is released when the request ends. Responses are marked
   `Cache-Control: no-store`.
5. **In the browser.** The results page shows the photo from a local
   `blob:` URL, which is released when the user starts again or leaves.
   Nothing is saved in `localStorage` or cookies.

## Consent

Before taking or uploading a photo the user must tick a consent box stating
that the scan is informational, not a diagnosis, and that the photo will be
analysed and not stored.

## Logging

Server logs contain one line per scan: outcome code, quality-issue codes,
duration and overall confidence. They never contain image data, file names,
IP addresses, user agents or any personal data. Unexpected errors log only
the error message.

## Rate limiting

To prevent abuse, the server keeps an in-memory counter per client. The key
is a SHA-256 hash of the client IP (the IP itself is not stored) and entries
expire after the rate-limit window.

## Third parties and analytics

- No analytics, advertising pixels, tag managers or session recorders are
  included.
- Fonts are self-hosted at build time (`next/font`), so the visitor's browser
  makes no requests to Google.
- The only external links are to drmahermahmoud.com (booking/clinic pages),
  opened in a new tab.

If analytics are added later they **must not** receive images, image URLs,
scores linked to identities, names, emails, phone numbers or any medical
information. Only aggregate, anonymous events (e.g. "scan_completed",
"retake_requested: too_dark") are acceptable.

## Infrastructure requirements

- Serve only over HTTPS (HSTS is sent in production).
- Do not enable request-body logging on the hosting platform or any proxy in
  front of `/api/skin-scan`.
- Keep the region of the hosting provider in line with the clinic's data
  protection obligations (Egypt's Personal Data Protection Law No. 151 of
  2020 treats biometric and health data as sensitive).

## Future patient accounts

If results are ever saved to a Dr. Maher patient account, that must be a
separate, explicit opt-in step, storing scores (not photos) unless the
patient gives separate consent to store the image, with retention and
deletion rules published in the clinic privacy policy.
