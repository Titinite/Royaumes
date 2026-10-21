import { defineConfig } from 'drizzle-kit'

/**
 * Configuration de drizzle-kit, qui produit les migrations SQL.
 * Chaque brique de la plateforme et chaque module déclare ses tables dans un fichier
 * schema.ts qui lui est propre ; drizzle-kit les rassemble pour produire les migrations.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: [
    './src/platform/event-store/schema.ts',
    './src/modules/*/infrastructure/schema.ts',
    './src/platform/auth/schema.ts',
    './src/platform/projection/schema.ts',
    './src/platform/outbox/schema.ts',
    './src/platform/privacy/schema.ts',
  ],
  out: './drizzle',
})
