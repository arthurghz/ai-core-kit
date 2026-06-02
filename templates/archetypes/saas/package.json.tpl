{
  "name": "${project.name}",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "next": "^15.3.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "@clerk/nextjs": "^6.20.0",
    "stripe": "^18.1.0",
    "drizzle-orm": "^0.44.0",
    "postgres": "^3.4.5",
    "@supabase/supabase-js": "^2.49.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.3.0"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "@types/node": "^22.15.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "drizzle-kit": "^0.31.0",
    "tailwindcss": "^4.1.0",
    "@tailwindcss/postcss": "^4.1.0",
    "eslint": "^9.27.0",
    "eslint-config-next": "^15.3.0"
  }
}
