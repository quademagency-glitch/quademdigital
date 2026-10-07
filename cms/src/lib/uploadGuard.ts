import { APIError, type CollectionBeforeOperationHook, type CollectionConfig } from 'payload'

/*
  An upload must carry its file.

  Payload accepts a second way to attach a file: instead of the bytes, the
  request sends a small JSON `file` field naming a collection and a filename,
  and the server fetches that file out of storage itself
  (payload/dist/utilities/addDataAndFileToRequest.js). It is meant for the
  admin's direct-to-bucket uploads. The fetch goes through the named
  collection's file handler with no access check, and the collection is the
  sender's choice, so anyone who may upload anywhere could name a signed
  contract or a team member's private file and receive a copy as their own
  upload.

  Nothing here uses that route: the admin uploads files the ordinary way, and
  the portal sends real files. So it is refused outright, on every upload
  collection. A file attached that way is the only kind that carries a
  `clientUploadContext` key.
*/
export const refuseFileByName: CollectionBeforeOperationHook = ({ args, operation, req }) => {
  if ((operation === 'create' || operation === 'update') && req.file && Object.prototype.hasOwnProperty.call(req.file, 'clientUploadContext')) {
    throw new APIError('Send the file itself. A file already in storage cannot be attached by its name.', 400, null, true)
  }
  return args
}

/** Applied to every collection; changes only those that take uploads. */
export function guardUploads(collection: CollectionConfig): CollectionConfig {
  if (!collection.upload) return collection
  return { ...collection, hooks: { ...collection.hooks, beforeOperation: [refuseFileByName, ...(collection.hooks?.beforeOperation ?? [])] } }
}
