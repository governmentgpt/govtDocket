# GovGPT

Public, source-verifiable Government Knowledge Platform for Tamil Nadu.

## Run the UI locally

The first interface is dependency-free. From this directory run:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`.

The current interface is a front-end prototype using clearly labelled demonstration data. The future retrieval API will replace the local data adapter while retaining the chat, source viewer, timeline, and knowledge-map experience.

## Documentation

- [Architecture protocol](docs/ARCHITECTURE_PROTOCOL.md)
- [Tamil Nadu implementation plan](docs/TAMIL_NADU_IMPLEMENTATION_PLAN.md)
