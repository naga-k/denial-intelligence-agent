"""LangGraph wiring. Linear pipeline with a critic self-correction cycle:
router -> impact_analyst -> policy_reasoner -> rec_drafter -> critic
                                                   ^              |
                                                   +-- revise ----+  (max 2 revisions)
"""
from langgraph.graph import StateGraph, END

from . import nodes
from .state import AgentState

MAX_REVISIONS = 2


def _after_critic(state) -> str:
    if state.get("critique", {}).get("ok") or state.get("revisions", 0) >= MAX_REVISIONS:
        return "end"
    return "revise"


def build_graph():
    g = StateGraph(AgentState)
    g.add_node("router", nodes.router)
    g.add_node("impact_analyst", nodes.impact_analyst)
    g.add_node("policy_reasoner", nodes.policy_reasoner)
    g.add_node("rec_drafter", nodes.rec_drafter)
    g.add_node("critic", nodes.critic)

    g.set_entry_point("router")
    g.add_edge("router", "impact_analyst")
    g.add_edge("impact_analyst", "policy_reasoner")
    g.add_edge("policy_reasoner", "rec_drafter")
    g.add_edge("rec_drafter", "critic")
    g.add_conditional_edges("critic", _after_critic, {"revise": "rec_drafter", "end": END})
    return g.compile()
