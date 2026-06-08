import {useState} from 'react'

export function ShareLinkedInAction(props: any) {
  const [isSharing, setIsSharing] = useState(false)

  return {
    label: isSharing ? 'Sharing...' : 'Share to LinkedIn',
    onHandle: async () => {
      setIsSharing(true)
      try {
        if (!props.published) {
          alert('You must publish this blog post first before sharing it to LinkedIn.')
          setIsSharing(false)
          return
        }

        const currentUrl = window.location.hostname === 'localhost' 
          ? 'http://localhost:4321' 
          : 'https://quademdigital.com'

        // Send the document data to the Astro API route
        const response = await fetch(`${currentUrl}/api/linkedin-share`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            documentId: props.id,
            title: props.published.title,
            slug: props.published.slug?.current,
            excerpt: props.published.excerpt,
          }),
        })

        const result = await response.json()

        if (response.ok && result.success) {
          alert('Successfully shared to LinkedIn!')
        } else {
          alert(`Failed to share: ${result.error || 'Unknown error'}`)
        }
      } catch (err: any) {
        alert(`Error sharing to LinkedIn: ${err.message}`)
      } finally {
        setIsSharing(false)
        props.onComplete()
      }
    },
  }
}
