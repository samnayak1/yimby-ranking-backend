import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    './src/models/politicians.models.ts',
     './src/models/cities.models.ts',
     './src/models/media.models.ts'
    ],
  out:    './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './db/database.sqlite',
  },
});