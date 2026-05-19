# MissedCall AI Intake Worker

Cloudflare Worker API for real audit-request capture.

## Endpoints

- POST /audit-request stores a lead in D1.
- POST /twilio/missed-call logs a missed call, sends instant recovery SMS, and schedules follow-up tasks.
- POST /twilio/inbound-sms logs customer replies, updates customer memory, and sends a basic TwiML response.
- GET /health checks the worker.

## Database

D1 database: missedcall_ai_leads

Apply schema:

    npm run schema:remote

Deploy:

    npm run deploy

## Required Worker Secrets For SMS

- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_FROM_NUMBER
- OWNER_ALERT_PHONE
