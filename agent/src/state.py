"""Shared LangGraph state. total=False so nodes can populate keys incrementally."""
from typing import TypedDict


class AgentState(TypedDict, total=False):
    change: dict            # row from policy_changes
    policy_text: str        # changed policy content (latest snapshot)
    implicated: dict        # router: {cpt_codes:[], contracts:[], summary:str}
    impact: dict            # impact analyst: {contracts:[{contract_id,denials,dollars}], total_dollars}
    contestable: dict       # policy reasoner: {verdict:str, rationale:str}
    rec_text: str           # drafter output
    confidence: float
    critique: dict          # critic: {ok:bool, feedback:str}
    revisions: int
    grounded_policy_url: str
