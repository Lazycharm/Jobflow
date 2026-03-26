# JobFlow CRM

React + Vite + Tailwind + shadcn/ui + TanStack Query app migrated to Supabase.

## Local setup

1. Install dependencies: `npm install`
2. Create `.env.local`:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Run the dev server: `npm run dev`

## Supabase setup

- Run the SQL in `supabase/schema.sql` in the Supabase SQL editor.
- Create a public storage bucket named `resumes` for resume uploads.
- (Optional) Create an Edge Function named `send-email` if you want SMTP test emails from the UI.

## Deploy (Netlify)

- Build command: `npm run build`
- Publish directory: `dist`
- Add the same `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars in Netlify.
- SPA routing redirect is defined in `netlify.toml`.
