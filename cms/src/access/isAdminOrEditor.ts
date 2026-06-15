import type { Access } from 'payload'

export const isAdminOrEditor: Access = ({ req: { user } }) => {
  if (user) {
    return Boolean(user.role === 'admin' || user.role === 'editor')
  }
  return false
}
