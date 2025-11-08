# Collections Dashboard Frontend

An interactive analytics dashboard for monitoring NFT / digital asset collections. Built with Vue 3, Vite, Vue Router, Pinia, Axios, and ECharts.

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
cd frontend
npm install
```

All subsequent commands assume you are inside the `frontend/` directory.

### Development Server

```bash
npm run dev
```

The app runs at [http://localhost:5173](http://localhost:5173) by default. Hot Module Replacement is enabled.

### Building for Production

```bash
npm run build
```

The production build output is placed in the `dist/` directory. Preview the built site locally with:

```bash
npm run preview
```

### Testing

```bash
npm run test
```

Vitest runs the unit tests located under `tests/`. The configuration uses the JSDOM environment and the Vue Test Utils plugin.

## Environment Variables

- `VITE_API_BASE_URL` — (optional) Base URL for API requests. Defaults to the current origin when undefined.

Create a `.env.local` file if you need to override these values for local development.

## Project Structure

```
frontend/
├── index.html
├── package.json
├── src/
│   ├── App.vue
│   ├── assets/
│   ├── components/
│   ├── composables/
│   ├── router/
│   ├── services/
│   ├── stores/
│   └── views/
├── tests/
├── tsconfig.json
└── vite.config.ts
```

## Features

- **Dashboard Overview** — Summary KPIs, global market trend chart, top movers table, and alert feed.
- **Collection Detail** — Deep dive views with metadata, price/volume charts, listings, purchases, and alert history.
- **State Management** — Pinia stores deduplicate and sanitize incoming API data, tracking filters and refresh cadence.
- **Auto Refresh** — Shared composable refreshes data every 60 seconds with safe cleanup on navigation.
- **Typed API Client** — Axios helpers encapsulate response typing and centralized toast-style error notifications.
- **Reusable UI Components** — Statistic cards, toggle controls, tables, activity feeds, and ECharts-powered trend visualizations.

## Deployment

1. Build the project with `npm run build`.
2. Serve the static assets in the `dist/` directory using your preferred hosting solution (e.g., Netlify, Vercel, S3/CloudFront, nginx).
3. Ensure the hosting environment exposes the required API endpoints (`/api/collections`, `/api/alerts`, etc.) and sets the `VITE_API_BASE_URL` if necessary.
