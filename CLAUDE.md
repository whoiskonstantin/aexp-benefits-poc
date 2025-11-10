# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**aexp-benefits-poc** is a proof of concept web application for an American Express benefits platform. This is a early-stage Next.js 16 project using modern React patterns (React 19, App Router, Server Components by default). The project is currently in scaffolding phase with only the default Next.js starter template.

**Technology Stack:**
- Next.js 16.0.1 (React framework with App Router, SSR, file-based routing)
- React 19.2.0 with TypeScript strict mode
- Tailwind CSS v4 with PostCSS
- ESLint for code quality

## Common Development Commands

```bash
# Start development server (runs on http://localhost:3000 with hot reload)
yarn dev

# Build for production
yarn build

# Start production server (requires prior build)
yarn start

# Run linting checks
yarn lint
```

## Project Structure

The project uses **Next.js App Router** (modern pattern, recommended since Next.js 13+). Key directories:

- **`app/`** - Next.js App Router directory with file-based routing
  - `layout.tsx` - Root layout component (imports global styles, sets up Geist fonts)
  - `page.tsx` - Home page component
  - `globals.css` - Global styles with Tailwind CSS and CSS variable definitions for theming
- **`public/`** - Static assets served as-is (images, SVGs)
- **`.next/`** - Build output (generated, ignored by git)

## Architecture Notes

### Server Components by Default
Next.js 16 and React 19 use Server Components by default. Client-side interactivity requires `"use client"` directive. When adding components:
- Server Components (default) - fetch data, access secrets safely
- Client Components (`"use client"`) - use hooks, event listeners, browser APIs

### Styling Approach
- **Tailwind CSS v4** for utility-first styling
- **CSS Variables** defined in `globals.css` (`--background`, `--foreground`)
- **Dark mode support** via `prefers-color-scheme` media query
- Components use inline Tailwind classes (not CSS modules)

### Type Safety
- TypeScript strict mode enabled (`tsconfig.json`)
- Path alias `@/*` points to project root for clean absolute imports
- All dependencies have type definitions installed

## Environment Setup

**Requirements:**
- Node.js 20+
- Yarn package manager

**Initial setup:**
```bash
yarn install
yarn dev
```

**Environment variables:**
- Create `.env.local` for local development
- Use `.env.production` for production settings
- Never commit secrets to the repository

## Configuration Files

- **`tsconfig.json`** - TypeScript configuration with strict mode and path aliases
- **`next.config.ts`** - Next.js configuration (minimal, ready for customization)
- **`postcss.config.mjs`** - PostCSS with Tailwind CSS plugin
- **`eslint.config.mjs`** - ESLint config extending Next.js best practices
- **`.gitignore`** - Standard Node.js/Next.js ignores

## Key Patterns and Conventions

### Imports
Use absolute imports via `@/` alias instead of relative paths:
```typescript
// Good
import { Button } from '@/components/button'

// Avoid
import { Button } from '../components/button'
```

### Component Organization (Future)
As the project grows, consider:
- `components/` - Reusable UI components
- `lib/` - Utility functions and helpers
- `api/` - Route handlers and API utilities (using Next.js `/app/api` route handlers)

### Fonts
The project uses Geist fonts via `next/font/google`. Additional fonts can be added in `layout.tsx`.

## Testing

No testing framework is currently configured. When adding tests, consider:
- Jest or Vitest for unit tests
- Playwright or Cypress for E2E tests
- Add test commands to `package.json`

## Deployment

The README suggests Vercel as the deployment target (made by Next.js creators), but this can run on any Node.js host. When deploying:
- Run `yarn build` to create production build
- Set environment variables in deployment platform
- The `.next/` directory and `package.json` are needed for running the app
