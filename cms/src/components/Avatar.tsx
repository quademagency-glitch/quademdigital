import React from 'react'
import { getPayload } from 'payload'
import { headers as nextHeaders } from 'next/headers'
import config from '@payload-config'

const DefaultAvatarIcon: React.FC = () => (
  <svg height="25" viewBox="0 0 25 25" width="25" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12.5" cy="12.5" r="11.5" fill="rgba(0, 174, 239, 0.12)" />
    <circle cx="12.5" cy="10.73" r="3.98" fill="#8892a4" />
    <path
      d="M12.5,24a11.44,11.44,0,0,0,7.66-2.94c-.5-2.71-3.73-4.8-7.66-4.8s-7.16,2.09-7.66,4.8A11.44,11.44,0,0,0,12.5,24Z"
      fill="#8892a4"
    />
  </svg>
)

export const Avatar: React.FC = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })

  if (user) {
    const fullUser = await payload
      .findByID({ collection: 'users', id: user.id, depth: 1 })
      .catch(() => null)

    const avatar = (fullUser as { avatar?: unknown } | null)?.avatar
    const avatarUrl = avatar && typeof avatar === 'object' ? (avatar as { url?: string }).url : null

    if (avatarUrl) {
      return (
        <div
          style={{
            width: 25,
            height: 25,
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            border: '1px solid rgba(0, 174, 239, 0.28)',
          }}
        >
          <img
            src={avatarUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      )
    }
  }

  return <DefaultAvatarIcon />
}
