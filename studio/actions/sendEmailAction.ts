import { useState } from 'react';
import { DocumentActionProps } from 'sanity';

export function SendEmailAction(props: DocumentActionProps) {
  const [isSending, setIsSending] = useState(false);
  const [hasSent, setHasSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return {
    label: isSending ? 'Sending...' : error ? 'Error: Try Again' : hasSent ? 'Email Sent ✓' : 'Send Email to Client ✉️',
    disabled: isSending || hasSent || props.type !== 'invoice',
    onHandle: async () => {
      setIsSending(true);
      setError(null);
      
      const baseUrl = window.location.hostname.includes('localhost') 
        ? 'http://localhost:4321' 
        : 'https://quademdigital.com';

      try {
        const res = await fetch(`${baseUrl}/api/send-invoice-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: props.id })
        });
        
        const data = await res.json();
        
        if (res.ok) {
          setHasSent(true);
          // Reset after a few seconds so they can send again if needed
          setTimeout(() => { setHasSent(false); }, 5000);
        } else {
          setError(data.error || 'Failed to send');
          alert('Error sending email: ' + (data.error || 'Unknown error'));
        }
      } catch (e: any) {
        setError(e.message);
        alert('Error sending email: ' + e.message);
      } finally {
        setIsSending(false);
      }
    }
  };
}
