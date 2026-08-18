import { Hono } from 'hono'
import type { AppEnv } from '../types/env'
import { requireAuth } from '../middleware/auth'
import { requireManager, requireOwner, requireWorkspace } from '../middleware/workspace'
import { validateBody, validateQuery } from '../middleware/validate'
import { rateLimitBy } from '../middleware/rateLimit'
import {
  createCategorySchema,
  createInvitationSchema,
  createTransactionSchema,
  createWorkspaceSchema,
  joinWorkspaceSchema,
  listTransactionsQuerySchema,
  periodQuerySchema,
  updateCategorySchema,
  updateMemberSchema,
  updateProfileSchema,
  updateTransactionSchema,
  updateWorkspaceSchema,
  uploadSignatureSchema,
  workspaceSettingsSchema,
  attachmentInputSchema,
} from '../schemas'

import * as workspaces from '../controllers/workspaces.controller'
import * as transactions from '../controllers/transactions.controller'
import * as attachments from '../controllers/attachments.controller'
import * as members from '../controllers/members.controller'
import * as invitations from '../controllers/invitations.controller'
import * as analytics from '../controllers/analytics.controller'
import * as categories from '../controllers/categories.controller'
import * as profile from '../controllers/profile.controller'

/**
 * Route table.
 *
 * Everything below `/workspaces/:workspaceId` passes through `requireWorkspace`,
 * which turns the untrusted id in the URL into a verified membership before any
 * controller runs. Manager-only routes add `requireManager` on top.
 */
export function createApiRoutes() {
  const api = new Hono<AppEnv>()

  // - Public ---------------------------------------------------------------
  api.get('/health', (c) =>
    c.json({
      data: {
        status: 'ok',
        environment: c.env.ENVIRONMENT ?? 'unknown',
        time: new Date().toISOString(),
      },
    })
  )

  // - Everything past this point requires a valid Supabase session ---------
  api.use('/me/*', requireAuth)
  api.use('/workspaces', requireAuth)
  api.use('/workspaces/*', requireAuth)
  api.use('/invitations/*', requireAuth)

  // - Current user ---------------------------------------------------------
  api.get('/me', requireAuth, profile.getMe)
  api.patch('/me', requireAuth, validateBody(updateProfileSchema), profile.updateMe)

  // - Workspace collection -------------------------------------------------
  api.get('/workspaces', workspaces.listWorkspaces)
  api.post(
    '/workspaces',
    rateLimitBy({ bucket: 'workspace-create', limit: 10, windowSeconds: 3600 }),
    validateBody(createWorkspaceSchema),
    workspaces.createWorkspace
  )
  api.post(
    '/workspaces/join',
    rateLimitBy({ bucket: 'workspace-join', limit: 20, windowSeconds: 3600 }),
    validateBody(joinWorkspaceSchema),
    workspaces.joinWorkspace
  )

  // Invite preview is deliberately rate limited: it is the one endpoint that
  // reveals whether a code exists, so it must not be brute-forceable.
  api.get(
    '/invitations/preview',
    rateLimitBy({ bucket: 'invite-preview', limit: 30, windowSeconds: 600 }),
    workspaces.previewInvitation
  )

  // - Single workspace -----------------------------------------------------
  const ws = new Hono<AppEnv>()
  ws.use('*', requireWorkspace)

  ws.get('/', workspaces.getWorkspace)
  ws.patch('/', requireManager, validateBody(updateWorkspaceSchema), workspaces.updateWorkspace)
  ws.delete('/', requireOwner, workspaces.deleteWorkspace)
  ws.post('/leave', workspaces.leaveWorkspace)

  ws.get('/settings', workspaces.getSettings)
  ws.patch('/settings', requireManager, validateBody(workspaceSettingsSchema), workspaces.updateSettings)

  // - Analytics ------------------------------------------------------------
  ws.get('/stats', validateQuery(periodQuerySchema), analytics.getDashboardStats)
  ws.get('/series', validateQuery(periodQuerySchema), analytics.getSeries)
  ws.get('/breakdown', validateQuery(periodQuerySchema), analytics.getCategoryBreakdown)
  ws.get('/recent', analytics.getRecentTransactions)

  // - Transactions ---------------------------------------------------------
  ws.get('/transactions', validateQuery(listTransactionsQuerySchema), transactions.listTransactions)
  ws.post('/transactions', validateBody(createTransactionSchema), transactions.createTransaction)
  ws.get('/transactions/:transactionId', transactions.getTransaction)
  ws.patch('/transactions/:transactionId', validateBody(updateTransactionSchema), transactions.updateTransaction)
  ws.delete('/transactions/:transactionId', transactions.deleteTransaction)

  // - Attachments ----------------------------------------------------------
  ws.post(
    '/uploads/sign',
    rateLimitBy({ bucket: 'upload-sign', limit: 120, windowSeconds: 3600 }),
    validateBody(uploadSignatureSchema),
    attachments.getUploadConfig
  )
  ws.get('/transactions/:transactionId/attachments', attachments.listAttachments)
  ws.post(
    '/transactions/:transactionId/attachments',
    validateBody(attachmentInputSchema),
    attachments.addAttachment
  )
  ws.delete('/attachments/:attachmentId', attachments.deleteAttachment)

  // - Categories -----------------------------------------------------------
  ws.get('/categories', categories.listCategories)
  ws.post('/categories', validateBody(createCategorySchema), categories.createCategory)
  ws.patch('/categories/:categoryId', requireManager, validateBody(updateCategorySchema), categories.updateCategory)
  ws.delete('/categories/:categoryId', requireManager, categories.deleteCategory)

  // - Members --------------------------------------------------------------
  ws.get('/members', members.listMembers)
  ws.patch('/members/:memberId', requireManager, validateBody(updateMemberSchema), members.updateMemberRole)
  ws.delete('/members/:memberId', requireManager, members.removeMember)

  // - Invitations ----------------------------------------------------------
  ws.get('/invitations', requireManager, invitations.listInvitations)
  ws.post(
    '/invitations',
    requireManager,
    rateLimitBy({ bucket: 'invite-create', limit: 30, windowSeconds: 3600 }),
    validateBody(createInvitationSchema),
    invitations.createInvitation
  )
  ws.post('/invitations/:invitationId/revoke', requireManager, invitations.revokeInvitation)
  ws.delete('/invitations/:invitationId', requireManager, invitations.deleteInvitation)

  api.route('/workspaces/:workspaceId', ws)

  // An unmatched /api path must answer as the API, not fall through to the
  // asset handler - a client expecting JSON should never receive index.html.
  api.all('*', (c) =>
    c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'That endpoint does not exist.',
          requestId: c.get('requestId'),
        },
      },
      404
    )
  )

  return api
}
