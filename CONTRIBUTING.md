# Contributing to Rakazo

Thank you for your interest in contributing to Rakazo! This guide covers the basics to help you get started.

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them onboard
- Focus on constructive feedback

## Getting Started

1. Fork the repository and clone your fork
2. Install Node.js 22.22.2+ (22.x line), Node.js 24.x, or Node.js 26+; Node.js 23.x and 25.x are not supported
3. Install pnpm 9 and Docker
4. Copy `.env.example` to `.env` and fill in required secrets:
   - `POSTGRES_PASSWORD` and matching `DATABASE_URL`
   - `BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`, `SCREEN_PROXY_SECRET`
   - Optional: model provider keys, sandbox provider keys

## Development Workflow

```bash
# Install dependencies
pnpm install

# Start Postgres
docker compose --env-file .env -f infra/compose/docker-compose.yml -f infra/compose/docker-compose.postgres-host.yml up postgres -d

# Generate and run migrations
pnpm db:generate
pnpm db:migrate

# Build sandboxes
pnpm sandbox:build

# Start the dev server
pnpm dev
```

## Testing

```bash
# Lint
pnpm lint

# Type checks
pnpm check

# Unit tests
pnpm test

# Integration tests
pnpm test:integration

# End-to-end tests
pnpm test:e2e
```

## Project Structure

- `apps/` — web, API, worker, desktop, mobile, and public website
- `packages/` — domain, contracts, persistence, adapters, UI, and test tooling
- `infra/` — local services and computer images
- `docs/` — architecture, operations, and release guides

## Submitting Changes

1. Create a feature branch from `main`
2. Make your changes with clear, descriptive commit messages
3. Ensure all tests and checks pass
4. Open a pull request with a description of the change and the problem it solves
5. Link related issues in the PR description

## Security

- Do not commit secrets, API keys, or credentials
- For security vulnerabilities, follow [SECURITY.md](./SECURITY.md) instead of filing a public issue

## Questions?

- Open a discussion or issue
- Join the [Rakazo Discord community](https://discord.gg/RWwKa2Sn7h)
