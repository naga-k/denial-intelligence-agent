"""The five LangGraph node functions. Each is one focused Gemini call, except
impact_analyst which queries ClickHouse. Worker nodes run on gemini-3.5-flash;
the Critic runs on the stronger gemini-3.1-pro-preview so judges see a Pro-model
critic bounce work back to a Flash drafter in the Datadog trace."""
import json

from langchain_google_genai import ChatGoogleGenerativeAI

from .config import GEMINI_API_KEY
from .db import query_rows

llm = ChatGoogleGenerativeAI(
    model="gemini-3.5-flash", temperature=0.2,
    google_api_key=GEMINI_API_KEY, max_retries=2,
)
critic_llm = ChatGoogleGenerativeAI(
    model="gemini-3.1-pro-preview", temperature=0.0,
    google_api_key=GEMINI_API_KEY, max_retries=2,
)


def _text(msg) -> str:
    """Extract plain text from an AIMessage. Gemini 3.x returns content as a
    list of blocks (text + thinking), not a bare string — concatenate the text
    blocks and drop the rest."""
    c = msg.content
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        parts = []
        for b in c:
            if isinstance(b, str):
                parts.append(b)
            elif isinstance(b, dict) and "text" in b:
                parts.append(b["text"])
        return "".join(parts)
    return str(c)


def _json(msg) -> dict:
    """Parse a model response (AIMessage or str) that may be fenced in ```json."""
    t = _text(msg) if not isinstance(msg, str) else msg
    t = t.strip()
    if t.startswith("```"):
        t = t.split("\n", 1)[1] if "\n" in t else t
        t = t.removeprefix("json").strip()
        t = t.rsplit("```", 1)[0].strip()
    return json.loads(t)


def router(state):
    change = state["change"]
    prompt = (
        "You are a health-claims policy router. Given a payer policy change, "
        "identify which CPT codes and contracts are implicated.\n"
        f"Payer: {change.get('payer_name')}\n"
        f"Change summary: {change.get('diff_summary')}\n"
        f"Changed policy text:\n{state.get('policy_text', '')[:4000]}\n\n"
        'Return ONLY JSON: {"cpt_codes": ["..."], "contracts": ["..."], "summary": "..."}'
    )
    return {"implicated": _json(llm.invoke(prompt))}


def impact_analyst(state):
    cpts = state.get("implicated", {}).get("cpt_codes", [])
    cpt_list = ",".join(f"'{c}'" for c in cpts) or "''"
    rows = query_rows(f"""
        SELECT contract_id, payer_name,
               count() AS denials, toFloat64(sum(denied_amount)) AS dollars
        FROM denials.denials
        WHERE claim_id IN (
            SELECT claim_id FROM denials.claims WHERE cpt_code IN ({cpt_list})
        )
        GROUP BY contract_id, payer_name
        ORDER BY dollars DESC
    """)
    total = sum(r["dollars"] for r in rows)
    return {"impact": {"contracts": rows, "total_dollars": total}}


def policy_reasoner(state):
    prompt = (
        "You judge whether claim denials are CONTESTABLE under the payer's OWN "
        "published policy.\n"
        f"Changed policy text:\n{state.get('policy_text', '')[:4000]}\n"
        f"Impacted contracts/denials: {json.dumps(state.get('impact', {}))}\n\n"
        'Return ONLY JSON: {"verdict": "contestable|legitimate|mixed", '
        '"rationale": "cite the specific policy language"}'
    )
    return {"contestable": _json(llm.invoke(prompt))}


def rec_drafter(state):
    fb = state.get("critique", {}).get("feedback", "")
    prompt = (
        "Draft a concise contract-amendment recommendation (3-4 sentences) that "
        "would stop the denial bleed, grounded ONLY in the payer's published "
        "policy language.\n"
        f"Impact: {json.dumps(state.get('impact', {}))}\n"
        f"Contestability: {json.dumps(state.get('contestable', {}))}\n"
        f"Policy excerpt: {state.get('policy_text', '')[:2000]}\n"
        + (f"Revise to address this critic feedback: {fb}\n" if fb else "")
        + '\nReturn ONLY JSON: {"rec_text": "...", "confidence": 0.0}'
    )
    out = _json(llm.invoke(prompt))
    return {"rec_text": out["rec_text"], "confidence": float(out.get("confidence", 0.7))}


def critic(state):
    prompt = (
        "Critique this contract-amendment recommendation. Is it grounded in the "
        "cited policy, specific, and sensible?\n"
        f"Recommendation: {state.get('rec_text', '')}\n"
        f"Policy excerpt: {state.get('policy_text', '')[:2000]}\n\n"
        'Return ONLY JSON: {"ok": true|false, "feedback": "what to fix if not ok"}'
    )
    crit = _json(critic_llm.invoke(prompt))
    return {"critique": crit, "revisions": state.get("revisions", 0) + 1}
