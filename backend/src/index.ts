import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import { logger } from 'hono/logger'
import type { AppEnv } from './types/env'
import { createApiRoutes } from './routes'
import { onError, onNotFound } from './middleware/error'

/**
 * Zefinoro Worker.
 *
 * One Worker serves both the JSON API under /api and the built SPA. Same
 * origin, so there is no CORS surface and no preflight on every request; the
 * asset handler picks up anything the router does not claim, and unknown paths
 * fall back to index.html for client-side routing.
 */
const app = new Hono<AppEnv>()

// A request id threads through logs and error responses so a user-reported
// failure can be traced without asking them to reproduce it.
app.use('*', async (c, next) => {
  c.set('requestId', crypto.randomUUID())
  await next()
  c.header('X-Request-Id', c.get('requestId'))
})

app.use('*', logger())

app.use(
  '*',
  secureHeaders({
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    referrerPolicy: 'strict-origin-when-cross-origin',
    strictTransportSecurity: 'max-age=31536000; includeSubDomains',
    crossOriginEmbedderPolicy: false,
  })
)

app.onError(onError)
app.notFound(onNotFound)

app.route('/api', createApiRoutes())

/**
 * Anything that is not an API route is a static asset or an SPA deep link.
 * `not_found_handling: single-page-application` in wrangler.jsonc makes the
 * asset binding return index.html for unmatched paths, so /billing/received
 * reloads correctly instead of 404ing.
 */
app.all('*', async (c) => {
  if (!c.env.ASSETS) {
    return c.text('Frontend assets are not bound. Run `npm run build` in ../frontend.', 503)
  }
  return c.env.ASSETS.fetch(c.req.raw)
})

export default app
