from langgraph.graph import StateGraph
from agent.state import TravelState
from agent.nodes import extract_info, ask_question


def is_complete(state):
    return (
        state.get("country")
        and state.get("cities")
        and state.get("city_days")
        and state.get("travelers")
        and state.get("budget")
    )


def decide_next(state):
    if is_complete(state):
        return "stop"
    return "ask"


def build_graph():
    graph = StateGraph(TravelState)

    graph.add_node("extract", extract_info)
    graph.add_node("ask", ask_question)

    graph.set_entry_point("extract")

    graph.add_conditional_edges(
        "extract",
        decide_next,
        {
            "ask": "ask",
            "stop": "__end__" 
        }
    )

    graph.add_edge("ask", "extract")

    return graph.compile()