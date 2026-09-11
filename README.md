This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Importing scripts from other tools

`POST /api/import` creates a project from JSON without a browser session, so
tools like Scripty can push a script straight into Script Liner. Set two
environment variables on the deployment:

- `SCRIPTLINER_IMPORT_TOKEN` — shared secret; callers send it as
  `Authorization: Bearer <token>`. Unset = the endpoint is disabled (503).
- `SCRIPTLINER_IMPORT_OWNER_EMAIL` — default account that owns imported
  projects (a request may override it with `ownerEmail`).

```bash
curl -X POST https://scriptliner.com/api/import \
  -H "Authorization: Bearer $SCRIPTLINER_IMPORT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Episode 4","scriptText":"ACT ONE\n\nNARRATOR (V.O.)\n..."}'
# -> {"projectId":"...","shareToken":"...","url":"https://scriptliner.com/p/...","sections":12}
```

The script is split into sections with the same parser the **New Project**
form uses, and the project appears on the owner's dashboard.
