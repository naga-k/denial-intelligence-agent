"""Datadog LLM Observability. Enabling LLMObs auto-instruments the langchain
integration, so every LangGraph node becomes a span for free — no `ddtrace-run`
needed (agentless sends straight to the LLM Obs intake over HTTPS). No-ops
cleanly if DD_API_KEY is unset."""
import os

from . import config  # noqa: F401 — importing config loads the repo-root .env


def init_observability():
    if not os.getenv("DD_API_KEY"):
        print("[obs] DD_API_KEY unset — skipping Datadog LLM Obs")
        return
    # Agentless LLM Obs only — disable APM trace submission so ddtrace doesn't
    # spam connection errors trying to reach a local agent at localhost:8126.
    os.environ.setdefault("DD_TRACE_ENABLED", "false")
    from ddtrace.llmobs import LLMObs
    LLMObs.enable(
        ml_app=os.getenv("DD_LLMOBS_ML_APP", "contract-denial-agent"),
        api_key=os.environ["DD_API_KEY"],
        site=os.getenv("DD_SITE", "datadoghq.com"),
        agentless_enabled=True,
    )
    print("[obs] Datadog LLM Obs enabled (agentless)")
