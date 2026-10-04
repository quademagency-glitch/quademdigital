import type { Field, FieldAccess } from 'payload'
import { adminField } from '../access/roles'
import { currencyOptions } from './terms'

/**
 * A team member's profile, on their account.
 *
 * Shown only when the role is Team. Most of it is set by Ernest and only an
 * admin can change it, including how they are paid. A team member can change
 * the parts that are theirs: phone, Greytag, city, emergency contact and the
 * portal's look, alongside the name and picture every account already has.
 *
 * What a person is paid is not here. It lives in `member-terms`, with a date,
 * so a change never rewrites past money. ID copies and bank numbers are never
 * stored in the CMS at all; they stay on the QUADEM drive.
 */

const adminSets: { create: FieldAccess; update: FieldAccess } = { create: adminField, update: adminField }
/** The person and Ernest. Never their manager: how they are paid, their agreement, private contacts. */
const selfOrAdmin: FieldAccess = ({ req: { user }, doc }) => user?.role === 'admin' || Boolean(user && doc && String(doc.id) === String(user.id))
const privateField = { read: selfOrAdmin }
const half = { width: '50%' }
const third = { width: '33%' }
const day = { pickerAppearance: 'dayOnly' as const, displayFormat: 'd MMM yyyy' }

export const TEAM_STATUSES = [
  { label: 'Invited', value: 'invited' },
  { label: 'Active', value: 'active' },
  { label: 'On leave', value: 'on-leave' },
  { label: 'On notice', value: 'on-notice' },
  { label: 'Ended', value: 'ended' },
]

export const teamProfileFields = (): Field[] => [
  {
    type: 'collapsible',
    label: 'Team profile',
    admin: { condition: (data) => data?.role === 'team' },
    fields: [
      {
        type: 'row',
        fields: [
          { name: 'jobRole', label: 'Job role', type: 'relationship', relationTo: 'job-roles', access: adminSets, admin: half },
          { name: 'jobTitle', label: 'Job title', type: 'text', access: adminSets, admin: { ...half, description: 'For example Trainee, Business Development.' } },
        ],
      },
      {
        type: 'row',
        fields: [
          {
            name: 'status',
            type: 'select',
            options: TEAM_STATUSES,
            index: true,
            access: adminSets,
            admin: { ...third, description: 'Invited until they first sign in.' },
          },
          {
            name: 'statusSince',
            label: 'Since',
            type: 'date',
            access: adminSets,
            admin: { ...third, date: day },
          },
          {
            name: 'statusReason',
            label: 'Why',
            type: 'text',
            access: { ...privateField, ...adminSets },
            admin: { ...third, description: 'For on leave, on notice and ended.' },
          },
        ],
      },
      {
        type: 'row',
        fields: [
          {
            name: 'isManager',
            label: 'Manager',
            type: 'checkbox',
            defaultValue: false,
            access: adminSets,
            admin: { ...half, description: 'Sees and manages the people assigned to them. Never their terms or money.' },
          },
          {
            name: 'manager',
            label: 'Reports to',
            type: 'relationship',
            relationTo: 'users',
            access: adminSets,
            filterOptions: { or: [{ role: { equals: 'admin' } }, { isManager: { equals: true } }] },
            admin: half,
          },
        ],
      },
      {
        type: 'row',
        fields: [
          { name: 'startDate', label: 'Start date', type: 'date', access: adminSets, admin: { ...third, date: day } },
          { name: 'trialEndsAt', label: 'Trial ends', type: 'date', access: adminSets, admin: { ...third, date: day } },
          {
            name: 'endedAt',
            label: 'Agreement ends',
            type: 'date',
            access: adminSets,
            admin: { ...third, date: day, description: 'A future date puts them on notice; on that day the agreement ends and sign-in stops.' },
          },
        ],
      },
      {
        name: 'agreementRef',
        label: 'Agreement reference',
        type: 'text',
        access: { ...privateField, ...adminSets },
        admin: { description: 'For example QDE/BDA/2026/001.' },
      },
      {
        type: 'row',
        fields: [
          {
            name: 'country',
            type: 'text',
            access: adminSets,
            admin: { ...half, description: 'Two letters: NG, GH, KE… Sets the currency when the account is made.' },
            validate: (value: unknown) =>
              !value || /^[A-Z]{2}$/.test(String(value).trim().toUpperCase()) || 'Two letters, such as NG or GH.',
          },
          {
            name: 'currency',
            type: 'select',
            options: currencyOptions,
            access: adminSets,
            admin: { ...half, description: 'What their money is shown and paid in.' },
          },
        ],
      },
      {
        type: 'row',
        fields: [
          { name: 'phone', type: 'text', admin: third },
          { name: 'greytag', label: 'Greytag', type: 'text', access: privateField, admin: { ...third, description: 'Where Grey payouts go.' } },
          { name: 'city', type: 'text', admin: third },
        ],
      },
      {
        name: 'payoutMethod',
        label: 'Paid by',
        type: 'select',
        defaultValue: 'grey',
        access: { ...privateField, ...adminSets },
        options: [
          { label: 'Grey', value: 'grey' },
          { label: 'Bank transfer', value: 'bank' },
          { label: 'Mobile money', value: 'mobile-money' },
        ],
        admin: {
          description: 'How their payouts are usually sent; each payout can still say otherwise. Bank account numbers are never stored here: keep them as a saved payee in the bank app.',
        },
      },
      {
        name: 'emergencyContact',
        label: 'Emergency contact',
        type: 'group',
        access: privateField,
        fields: [
          {
            type: 'row',
            fields: [
              { name: 'name', type: 'text', admin: third },
              { name: 'phone', type: 'text', admin: third },
              { name: 'relationship', type: 'text', admin: third },
            ],
          },
        ],
      },
      {
        name: 'look',
        label: 'Portal look',
        type: 'select',
        defaultValue: 'system',
        options: [
          { label: 'Follow the device', value: 'system' },
          { label: 'Paper (light)', value: 'paper' },
          { label: 'Night (dark)', value: 'night' },
        ],
      },
      {
        type: 'row',
        fields: [
          {
            name: 'clientWorkConfirmedAt',
            label: 'Moved into client work',
            type: 'date',
            access: adminSets,
            admin: { ...half, date: day },
          },
          {
            name: 'salaryStartDate',
            label: 'Salary started',
            type: 'date',
            access: { ...privateField, ...adminSets },
            admin: { ...half, date: day, description: 'Empty until the salary trigger is met.' },
          },
        ],
      },
      {
        name: 'statusLog',
        label: 'Status history',
        type: 'array',
        access: { ...privateField, ...adminSets },
        admin: { readOnly: true, initCollapsed: true, description: 'Written automatically whenever the status changes.' },
        fields: [
          {
            type: 'row',
            fields: [
              { name: 'status', type: 'select', options: TEAM_STATUSES, admin: { width: '25%' } },
              { name: 'from', type: 'date', admin: { width: '25%', date: day } },
              { name: 'reason', type: 'text', admin: { width: '30%' } },
              { name: 'by', type: 'relationship', relationTo: 'users', admin: { width: '20%' } },
            ],
          },
          { name: 'at', type: 'date', admin: { hidden: true } },
        ],
      },
      {
        name: 'exitChecklist',
        label: 'Exit checklist',
        type: 'array',
        access: { read: adminField, ...adminSets },
        admin: { initCollapsed: true, description: 'Opens when an end date is set. Tick each item as it is done.' },
        fields: [
          {
            type: 'row',
            fields: [
              { name: 'item', type: 'text', required: true, admin: { width: '50%' } },
              { name: 'done', type: 'checkbox', defaultValue: false, admin: { width: '15%' } },
              { name: 'doneAt', label: 'Done on', type: 'date', admin: { width: '20%', date: day } },
              { name: 'by', type: 'relationship', relationTo: 'users', admin: { width: '15%' } },
            ],
          },
        ],
      },
      {
        name: 'pastAgreements',
        label: 'Earlier agreements',
        type: 'array',
        access: { read: adminField, ...adminSets },
        admin: { readOnly: true, initCollapsed: true, description: 'Kept when someone is re-hired.' },
        fields: [
          {
            type: 'row',
            fields: [
              { name: 'startDate', label: 'Started', type: 'date', admin: { width: '25%', date: day } },
              { name: 'endedAt', label: 'Ended', type: 'date', admin: { width: '25%', date: day } },
              { name: 'reason', label: 'Why it ended', type: 'text', admin: { width: '30%' } },
              { name: 'agreementRef', label: 'Agreement', type: 'text', admin: { width: '20%' } },
            ],
          },
        ],
      },
    ],
  },
]
