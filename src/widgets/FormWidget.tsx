import * as stylex from '@stylexjs/stylex'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput'
import { DateInput } from '@astryxdesign/core/DateInput'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { List, ListItem } from '@astryxdesign/core/List'
import { NumberInput } from '@astryxdesign/core/NumberInput'
import { Selector } from '@astryxdesign/core/Selector'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { useState, type FormEvent } from 'react'
import type { Field, FormWidget as FormWidgetModel } from '../model/types'
import { formatCell } from '../store/human'
import { submitFormValues } from '../store/submit'

type FormValue = string | number | boolean | undefined
type FormValues = Record<string, FormValue>
type ISODate = `${number}${number}${number}${number}-${number}${number}-${number}${number}`

const styles = stylex.create({
  form: {
    width: '100%',
  },
})

function initialValues(fields: Field[]): FormValues {
  return Object.fromEntries(
    fields.map((field) => [
      field.key,
      field.type === 'boolean' ? false : undefined,
    ]),
  )
}

function textValue(value: FormValue): string {
  return typeof value === 'string' ? value : ''
}

function numberValue(value: FormValue): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function booleanValue(value: FormValue): boolean {
  return typeof value === 'boolean' ? value : false
}

function isISODate(value: string): value is ISODate {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function dateValue(value: FormValue): ISODate | undefined {
  return typeof value === 'string' && isISODate(value)
    ? value
    : undefined
}

function SubmissionField({
  field,
  value,
  onChange,
  defaultOptionality,
}: {
  field: Field
  value: FormValue
  onChange: (value: FormValue) => void
  defaultOptionality: 'optional' | 'required'
}) {
  const optionality =
    defaultOptionality === 'required'
      ? field.required
        ? {}
        : { isOptional: true as const }
      : field.required
        ? { isRequired: true as const }
        : {}
  switch (field.type) {
    case 'text':
    case 'url':
      return (
        <TextInput
          label={field.label}
          description={field.description}
          value={textValue(value)}
          onChange={onChange}
          htmlName={field.key}
          width="100%"
          {...optionality}
        />
      )
    case 'number':
      return (
        <NumberInput
          label={field.label}
          description={field.description}
          value={numberValue(value)}
          onChange={(next) => onChange(next ?? undefined)}
          htmlName={field.key}
          hasClear
          width="100%"
          {...optionality}
        />
      )
    case 'date':
      return (
        <DateInput
          label={field.label}
          description={field.description}
          value={dateValue(value)}
          onChange={onChange}
          format="system_date"
          hasClear
          width="100%"
          {...optionality}
        />
      )
    case 'select':
      if (field.required) {
        return (
          <Selector
            label={field.label}
            description={field.description}
            options={field.options ?? []}
            value={textValue(value) || undefined}
            onChange={onChange}
            htmlName={field.key}
            width="100%"
            {...optionality}
          />
        )
      }
      return (
        <Selector
          label={field.label}
          description={field.description}
          options={field.options ?? []}
          value={textValue(value) || null}
          onChange={(next: string | null) =>
            onChange(next ?? undefined)
          }
          htmlName={field.key}
          hasClear
          width="100%"
          {...optionality}
        />
      )
    case 'boolean':
      return (
        <CheckboxInput
          label={field.label}
          description={field.description}
          value={booleanValue(value)}
          onChange={onChange}
          htmlName={field.key}
          width="100%"
          {...optionality}
        />
      )
    default: {
      const _exhaustive: never = field.type
      return _exhaustive
    }
  }
}

export function FormWidgetView({
  widget,
}: {
  widget: FormWidgetModel
}) {
  const fields = widget.dataset.fields
  const [values, setValues] = useState<FormValues>(() =>
    initialValues(fields),
  )
  const [error, setError] = useState<string>()

  if (fields.length === 0) {
    return (
      <EmptyState
        isCompact
        headingLevel={3}
        title="No columns yet"
        description="Ask the agent to call bind_data and define this form's fields."
      />
    )
  }

  const requiredCount = fields.filter((field) => field.required).length
  const defaultOptionality =
    requiredCount > fields.length / 2 ? 'required' : 'optional'
  const recent =
    widget.config.showRecentSubmissions > 0
      ? widget.dataset.rows
          .slice(-widget.config.showRecentSubmissions)
          .reverse()
      : []

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = submitFormValues(widget.id, values)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setError(undefined)
    setValues(initialValues(fields))
  }

  return (
    <VStack gap={4}>
      {widget.config.description && (
        <Text color="secondary">{widget.config.description}</Text>
      )}
      <form onSubmit={submit} {...stylex.props(styles.form)}>
        <FormLayout
          direction="vertical"
          defaultOptionality={defaultOptionality}
        >
          {fields.map((field) => (
            <SubmissionField
              key={field.key}
              field={field}
              value={values[field.key]}
              defaultOptionality={defaultOptionality}
              onChange={(value) =>
                setValues((current) => ({
                  ...current,
                  [field.key]: value,
                }))
              }
            />
          ))}
          {error && (
            <Banner
              status="error"
              container="card"
              title="Could not submit"
              description={error}
            />
          )}
          <Button
            label={widget.config.submitLabel}
            type="submit"
            variant="primary"
            width="100%"
          />
        </FormLayout>
      </form>
      {recent.length > 0 && (
        <List
          density="compact"
          hasDividers
          header={<Text weight="semibold">Recent submissions</Text>}
        >
          {recent.map((row) => (
            <ListItem
              key={row._id}
              label={
                fields
                  .map((field) => formatCell(field, row))
                  .filter(Boolean)
                  .join(' · ') || 'Empty submission'
              }
              description={new Date(row._createdAt).toLocaleString()}
            />
          ))}
        </List>
      )}
    </VStack>
  )
}
