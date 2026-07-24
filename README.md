# WikiGov

Public, source-verifiable Government Knowledge Platform for Tamil Nadu.

**Live Deployment:** [govt-docket-ui.onrender.com](https://govt-docket-ui.onrender.com/)

## Run the UI locally

The first interface is dependency-free. From this directory run:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`.

The current interface is a front-end prototype using clearly labelled demonstration data. The future retrieval API will replace the local data adapter while retaining the chat, source viewer, timeline, and knowledge-map experience.

## Deploy on Render

This repository includes a [Render Blueprint](render.yaml) for the current static UI. It publishes the repository root; no dependency install or runtime environment variables are required.

1. Sign in to [Render](https://dashboard.render.com/) and connect the GitHub account that can access `governmentgpt/govtDocket`.
2. Select **New** → **Blueprint**, then select the `governmentgpt/govtDocket` repository.
3. Confirm the `main` branch and the default Blueprint path, `render.yaml`.
4. Review the `govt-docket-ui` static-site service and select **Deploy Blueprint**.
5. When the build completes, open the generated `*.onrender.com` URL from the service dashboard.

Render redeploys the UI automatically after each push to `main`. To use a custom domain later, add it from the service's **Settings** page and then apply the DNS records Render supplies. Do not add API keys to `render.yaml`; future backend credentials belong in Render environment variables with secret sync disabled.

## Documentation

- [Architecture protocol](docs/ARCHITECTURE_PROTOCOL.md)
- [Tamil Nadu implementation plan](docs/TAMIL_NADU_IMPLEMENTATION_PLAN.md)
