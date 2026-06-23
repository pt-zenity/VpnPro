import { defineConfig } from '@prisma/config'

export default defineConfig({
  earlyAccess: true,
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrate: {
    databaseUrl: process.env.DATABASE_URL,
  },
})
