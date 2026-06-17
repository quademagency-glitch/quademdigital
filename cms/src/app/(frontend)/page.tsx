import { redirect } from 'next/navigation'
import configPromise from '@/payload.config'

export default async function HomePage() {
  const config = await configPromise
  redirect(config.routes.admin)
}
