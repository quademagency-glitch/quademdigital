'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
export const DashboardRefresh = ({ label = 'Refresh' }: { label?: string }) => {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      className="qd-button qd-button--quiet"
      disabled={pending}
      onClick={() => start(() => router.refresh())}
    >
      <RefreshCw size={15} aria-hidden="true" />
      {pending ? 'Refreshing…' : label}
    </button>
  )
}
