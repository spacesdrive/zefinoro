import type { Context } from 'hono'
import type { z } from 'zod'
import type { AppEnv } from '../types/env'
import type { CategoryRow } from '../types/database'
import { ApiError, fromPostgrestError } from '../lib/errors'
import { created, noContent, ok } from '../lib/response'
import { serializeCategory } from '../lib/serializers'
import { getValidated } from '../middleware/validate'
import { CacheKeys, CacheTTL, cached, getRedis, getWorkspaceVersion } from '../lib/redis'
import type { createCategorySchema, updateCategorySchema } from '../schemas'
import { requireUuidParam } from '../lib/params'

export async function listCategories(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const workspace = c.get('workspace')
  const typeFilter = c.req.query('type')

  const redis = getRedis(c.env)
  const version = await getWorkspaceVersion(redis, workspace.id)
  const key = `${CacheKeys.categories(workspace.id)}:v${version}`

  const all = await cached(redis, key, CacheTTL.categories, async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('type', { ascending: true })
      .order('name', { ascending: true })

    if (error) throw fromPostgrestError(error)
    return (data ?? []).map((row) => serializeCategory(row as CategoryRow))
  })

  const filtered =
    typeFilter === 'received' || typeFilter === 'spent'
      ? all.filter((cat) => cat.type === typeFilter)
      : all

  return ok(c, filtered)
}

export async function createCategory(c: Context<AppEnv>) {
  const input = getValidated<z.infer<typeof createCategorySchema>>(c)
  const supabase = c.get('supabase')
  const workspace = c.get('workspace')

  const { data, error } = await supabase
    .from('categories')
    .insert({
      workspace_id: workspace.id,
      name: input.name,
      type: input.type,
      color: input.color ?? null,
      icon: input.icon ?? null,
      is_system: false,
    })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw ApiError.conflict('A category with that name already exists for this type.')
    }
    throw fromPostgrestError(error)
  }

  await bumpCategories(c)
  return created(c, serializeCategory(data as CategoryRow))
}

export async function updateCategory(c: Context<AppEnv>) {
  const input = getValidated<z.infer<typeof updateCategorySchema>>(c)
  const supabase = c.get('supabase')
  const workspace = c.get('workspace')
  const categoryId = requireUuidParam(c, 'categoryId')

  const patch: Partial<CategoryRow> = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.type !== undefined) patch.type = input.type
  if (input.color !== undefined) patch.color = input.color ?? null
  if (input.icon !== undefined) patch.icon = input.icon ?? null

  const { data, error } = await supabase
    .from('categories')
    .update(patch)
    .eq('id', categoryId)
    .eq('workspace_id', workspace.id)
    .select('*')
    .maybeSingle()

  if (error) throw fromPostgrestError(error)
  if (!data) {
    throw ApiError.notFound('That category could not be found. Built-in categories cannot be edited.')
  }

  await bumpCategories(c)
  return ok(c, serializeCategory(data as CategoryRow))
}

export async function deleteCategory(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const workspace = c.get('workspace')
  const categoryId = requireUuidParam(c, 'categoryId')

  // Transactions keep their history: the FK is ON DELETE SET NULL, so removing
  // a category re-labels those transactions "Uncategorized" rather than
  // destroying them.
  const { data, error } = await supabase
    .from('categories')
    .delete()
    .eq('id', categoryId)
    .eq('workspace_id', workspace.id)
    .select('id')
    .maybeSingle()

  if (error) throw fromPostgrestError(error)
  if (!data) {
    throw ApiError.notFound('That category could not be found. Built-in categories cannot be deleted.')
  }

  await bumpCategories(c)
  return noContent(c)
}

async function bumpCategories(c: Context<AppEnv>) {
  const { bumpWorkspaceVersion } = await import('../lib/redis')
  await bumpWorkspaceVersion(getRedis(c.env), c.get('workspace').id)
}
