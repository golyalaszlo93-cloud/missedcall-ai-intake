# MissedCall AI Intake Worker

Cloudflare Worker API for real audit-request capture.

## Endpoints

- POST /audit-request stores a lead in D1.
- GET /health checks the worker.

## Database

D1 database: missedcall_ai_leads

Apply schema:

    npm run schema:remote

Deploy:

    npm run deploy
