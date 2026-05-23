"""Datadog LLM Observability. Enabling LLMObs auto-instruments the langchain
integration, so every LangGraph node becomes a span for free. Run the loop with
`ddtrace-run` to be safe. No-ops cleanly if DD_API_KEY is unset."""
import os


def init_observability():
    if not os.getenv("DD_API_KEY"):
        print("[obs] DD_API_KEY unset — skipping Datadog LLM Obs")
        return
    from ddtrace.llmobs import LLMObs
    LLMObs.enable(
        ml_app=os.getenv("DD_LLMOBS_ML_APP", "contract-denial-agent"),
        api_key=os.environ["DD_API_KEY"],
        site=os.getenv("DD_SITE", "datadoghq.com"),
        agentless_enabled=True,  # send directly, no local datadog-agent
    )
    print("[obs] Datadog LLM Obs enabled (agentless)")
