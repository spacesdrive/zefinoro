import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileUploader,
  completedAttachments,
  hasUploadsInFlight,
  type PendingUpload,
} from '@/components/files/file-uploader'
import { MAX_FILES_PER_TRANSACTION } from '@/lib/files'
import { transactionFormSchema, type TransactionFormValues } from '@/schemas'
import {
  useAddAttachments,
  useCategories,
  useCreateTransaction,
  useUpdateTransaction,
} from '@/features/transactions/hooks'
import { useWorkspace } from '@/contexts/workspace-context'
import { useWorkspaceSettings } from '@/features/workspaces/hooks'
import { CURRENCIES } from '@/config'
import { toDateInputValue } from '@/lib/format'
import { ApiError } from '@/lib/api/client'
import type { Transaction, TransactionType } from '@/types'
import { cn } from '@/lib/utils'

interface TransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present when editing; absent when creating. */
  transaction?: Transaction | null
  defaultType?: TransactionType
}

/**
 * Create or edit a transaction.
 *
 * Attachments upload as soon as they are picked, so submitting only records
 * metadata that is already stored. Files can be added while editing too; the
 * ones already on the transaction are managed from its detail view.
 */
export function TransactionDialog({
  open,
  onOpenChange,
  transaction,
  defaultType = 'spent',
}: TransactionDialogProps) {
  const isEditing = Boolean(transaction)
  const { workspaceId } = useWorkspace()
  const { data: settings } = useWorkspaceSettings()
  const [uploads, setUploads] = useState<PendingUpload[]>([])

  const createMutation = useCreateTransaction()
  const updateMutation = useUpdateTransaction()
  const addAttachments = useAddAttachments()
  const mutation = isEditing ? updateMutation : createMutation
  const busy = mutation.isPending || addAttachments.isPending

  // Existing files count towards the per-transaction cap.
  const existingCount = transaction?.attachments.length ?? 0
  const remainingSlots = Math.max(0, MAX_FILES_PER_TRANSACTION - existingCount)

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      type: defaultType,
      amount: '',
      currency: settings?.defaultCurrency ?? 'INR',
      title: '',
      description: '',
      categoryId: '',
      transactionDate: toDateInputValue(new Date()),
    },
  })

  const selectedType = form.watch('type')
  const { data: categories = [], isLoading: categoriesLoading } = useCategories(selectedType)

  // Reset the form whenever the dialog opens, so a previous edit never bleeds
  // into the next one.
  useEffect(() => {
    if (!open) return

    setUploads([])
    form.reset(
      transaction
        ? {
            type: transaction.type,
            amount: String(transaction.amount),
            currency: transaction.currency,
            title: transaction.title,
            description: transaction.description ?? '',
            categoryId: transaction.category?.id ?? '',
            transactionDate: transaction.transactionDate,
          }
        : {
            type: defaultType,
            amount: '',
            currency: settings?.defaultCurrency ?? 'INR',
            title: '',
            description: '',
            categoryId: '',
            transactionDate: toDateInputValue(new Date()),
          }
    )
  }, [open, transaction, defaultType, settings?.defaultCurrency, form])

  // A category belongs to one transaction type; flipping the type invalidates
  // any selection made before the flip.
  useEffect(() => {
    const current = form.getValues('categoryId')
    if (!current) return
    if (!categories.some((category) => category.id === current)) {
      form.setValue('categoryId', '')
    }
  }, [categories, form])

  const uploading = hasUploadsInFlight(uploads)
  const ready = useMemo(() => completedAttachments(uploads), [uploads])

  const onSubmit = async (values: TransactionFormValues) => {
    const payload = {
      type: values.type,
      amount: Number(values.amount.replace(/,/g, '')),
      currency: values.currency,
      title: values.title,
      description: values.description?.trim() ? values.description.trim() : null,
      categoryId: values.categoryId || null,
      transactionDate: values.transactionDate,
    }

    try {
      if (isEditing && transaction) {
        await updateMutation.mutateAsync({ id: transaction.id, input: payload })
        if (ready.length) {
          await addAttachments.mutateAsync({ transactionId: transaction.id, inputs: ready })
        }
      } else {
        await createMutation.mutateAsync({ ...payload, attachments: ready })
      }
      onOpenChange(false)
    } catch (error) {
      // Surface server-side field errors on the fields they belong to; the
      // mutation hook has already shown a toast for the general failure.
      if (error instanceof ApiError) {
        for (const [path, message] of Object.entries(error.fieldErrors)) {
          if (path in payload) {
            form.setError(path as keyof TransactionFormValues, { message })
          }
        }
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-6 py-4 text-left">
          <DialogTitle>{isEditing ? 'Edit transaction' : 'Add transaction'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the details of this transaction.'
              : 'Record money received or spent in this workspace.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
              <div className="space-y-5 px-6 py-5">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Transaction type</FormLabel>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className="grid grid-cols-2 gap-3"
                        >
                          {(
                            [
                              { value: 'received', label: 'Received', hint: 'Money in' },
                              { value: 'spent', label: 'Spent', hint: 'Money out' },
                            ] as const
                          ).map((option) => (
                            <Label
                              key={option.value}
                              htmlFor={`type-${option.value}`}
                              className={cn(
                                'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                                'hover:bg-accent/50',
                                field.value === option.value && 'border-primary bg-accent/40'
                              )}
                            >
                              <RadioGroupItem value={option.value} id={`type-${option.value}`} className="mt-0.5" />
                              <span className="grid gap-0.5">
                                <span className="text-sm font-medium">{option.label}</span>
                                <span className="text-muted-foreground text-xs font-normal">{option.hint}</span>
                              </span>
                            </Label>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-[1fr_130px]">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            inputMode="decimal"
                            placeholder="0.00"
                            autoComplete="off"
                            className="tabular-nums-amount"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CURRENCIES.map((currency) => (
                              <SelectItem key={currency.code} value={currency.code}>
                                {currency.symbol} {currency.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. Office rent for August" autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select
                          value={field.value || 'none'}
                          onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                          disabled={categoriesLoading}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Uncategorized" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Uncategorized</SelectItem>
                            {categories.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                <span className="flex items-center gap-2">
                                  {category.color && (
                                    <span
                                      className="size-2 rounded-full"
                                      style={{ backgroundColor: category.color }}
                                      aria-hidden="true"
                                    />
                                  )}
                                  {category.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="transactionDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" max={toDateInputValue(new Date())} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Description <span className="text-muted-foreground font-normal">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} placeholder="Add any details worth remembering..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {workspaceId && (
                  <div className="space-y-2">
                    <Label>
                      {isEditing ? 'Add attachments' : 'Attachment'}{' '}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <FileUploader
                      workspaceId={workspaceId}
                      uploads={uploads}
                      onChange={setUploads}
                      maxFiles={remainingSlots}
                    />
                    <FormDescription>
                      {isEditing && existingCount > 0
                        ? `This transaction already has ${existingCount} file${existingCount === 1 ? '' : 's'}. New files are added on save; remove existing ones from the transaction's detail view.`
                        : 'Receipts, invoices, screenshots - anything worth keeping with this record.'}
                    </FormDescription>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2 border-t px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy || uploading}>
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {uploading
                  ? 'Waiting for uploads...'
                  : isEditing
                    ? 'Save changes'
                    : 'Add transaction'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
