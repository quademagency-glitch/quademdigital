import type { CollectionBeforeChangeHook } from 'payload'

export const createFrontendActionHook = ({
  triggerField,
  endpointPath,
  payloadBuilder,
}: {
  triggerField: string
  endpointPath: string
  payloadBuilder: (data: any, originalDoc: any) => any
}): CollectionBeforeChangeHook => {
  return async ({ data, req, originalDoc }) => {
    if (data[triggerField] === true) {
      const baseUrl = process.env.FRONTEND_URL
      if (!baseUrl) {
        req.payload.logger.warn(`${triggerField} was checked but FRONTEND_URL is not set — skipping ${endpointPath}`)
        data[triggerField] = false
        return data
      }
      const apiUrl = `${baseUrl}${endpointPath}`

      try {
        const bodyPayload = payloadBuilder(data, originalDoc)

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(bodyPayload),
        })

        const result = await response.json().catch(() => null)

        if (!response.ok) {
          req.payload.logger.error(`Failed to trigger ${endpointPath}: ${JSON.stringify(result)}`)
          // You could throw an error here if you want to block the save, 
          // but usually it's better to log it and reset the field.
        } else {
          req.payload.logger.info(`Successfully triggered ${endpointPath}`)
        }
      } catch (err: any) {
        req.payload.logger.error(`Error triggering ${endpointPath}: ${err.message}`)
      }

      // Reset the trigger field to false so it doesn't fire again unless checked
      data[triggerField] = false
      // Optionally store a timestamp
      data[`${triggerField}LastTriggeredAt`] = new Date().toISOString()
    }

    return data
  }
}
