import { defineConfig } from 'drizzle-kit'

/**
 * Configuration de drizzle-kit, qui produit les migrations SQL.
 * Chaque brique de la plateforme et chaque module déclare ses tables dans un fichier
 * schema.ts qui lui est propre ; drizzle-kit les rassemble pour produire les migrations.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: [
    './src/plateform/event-store/schema.ts',
    './src/modules/*/infrastructure/schema.ts',
    './src/plateform/auth/schema.ts',
    './src/plateform/projection/schema.ts',
    './src/plateform/outbox/schema.ts',
  ],
  out: './drizzle',
})
