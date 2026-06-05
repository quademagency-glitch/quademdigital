import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemas'

export default defineConfig({
  name: 'default',
  title: 'Quadem Digital',

  projectId: 'xectqauu',
  dataset: 'production',

  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title('Content')
          .items(
            S.documentTypeListItems().sort((a, b) => {
              const titleA = (a.serialize().title || '').toLowerCase()
              const titleB = (b.serialize().title || '').toLowerCase()
              return titleA.localeCompare(titleB)
            })
          ),
    }),
    visionTool(),
  ],

  schema: {
    types: schemaTypes,
  },

  document: {
    // Enable live editing so changes are published immediately
    actions: (prev, context) => {
      return prev;
    },
  },
})
