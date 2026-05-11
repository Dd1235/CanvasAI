from __future__ import annotations

import asyncio
import unittest

from canvasai.knowledge_graph.merge import (
    KGEdgeCandidate,
    KGEdgeRecord,
    KGNodeCandidate,
    KGNodeRecord,
    lexical_similarity,
    merge_graph_candidates,
    normalize_topic_key,
)
from canvasai.knowledge_graph.pipeline import (
    _same_category_edges_for_sparse_manual,
    collapse_duplicate_candidates,
)
from canvasai.storage.knowledge_graph import empty_graph


class KnowledgeGraphMergeTests(unittest.TestCase):
    def test_normalize_topic_key(self) -> None:
        self.assertEqual(normalize_topic_key("Apache Kafka: Brokers!"), "apache-kafka-brokers")
        self.assertEqual(normalize_topic_key("  "), "topic")

    def test_exact_alias_merge_preserves_id_and_position(self) -> None:
        existing = _node("apache-kafka", "Apache Kafka", aliases=["Kafka"])
        candidate = KGNodeCandidate(
            title="Kafka",
            summary="Kafka is a distributed event streaming platform.",
            revision_prompt="Explain Kafka producers, brokers, and consumers.",
            evidence=["payload-fact:0"],
            source_session_ids=["session-1"],
        )

        merged = asyncio.run(
            merge_graph_candidates(
                existing_nodes=[existing],
                existing_edges=[],
                candidate_nodes=[candidate],
                candidate_edges=[],
            )
        )

        self.assertEqual(len(merged.nodes), 1)
        self.assertEqual(merged.nodes[0].id, "apache-kafka")
        self.assertEqual(merged.nodes[0].position, existing.position)
        self.assertIn("payload-fact:0", merged.nodes[0].evidence)

    def test_ambiguous_match_uses_gate(self) -> None:
        existing = _node("kafka-streams", "Kafka Streams")
        candidate = KGNodeCandidate(title="Kafka Stream Processing", evidence=["canvas-node:1"])
        self.assertGreaterEqual(lexical_similarity(candidate.title, existing.title), 0.60)

        async def reject_gate(*_args) -> bool:
            return False

        async def accept_gate(*_args) -> bool:
            return True

        rejected = asyncio.run(
            merge_graph_candidates(
                existing_nodes=[existing],
                existing_edges=[],
                candidate_nodes=[candidate],
                candidate_edges=[],
                same_concept_gate=reject_gate,
            )
        )
        accepted = asyncio.run(
            merge_graph_candidates(
                existing_nodes=[existing],
                existing_edges=[],
                candidate_nodes=[candidate],
                candidate_edges=[],
                same_concept_gate=accept_gate,
            )
        )

        self.assertEqual(len(rejected.nodes), 2)
        self.assertEqual(len(accepted.nodes), 1)
        self.assertEqual(accepted.nodes[0].id, "kafka-streams")

    def test_edge_merge_combines_same_relation(self) -> None:
        source = _node("producer", "Producer")
        target = _node("broker", "Broker")
        existing_edge = KGEdgeRecord(
            id="producer-prerequisite-broker",
            source="producer",
            target="broker",
            relation="prerequisite",
            strength=0.5,
            evidence="Existing evidence.",
            source_session_ids=["session-1"],
        )
        candidate_edge = KGEdgeCandidate(
            source_title="Producer",
            target_title="Broker",
            relation="prerequisite",
            strength=0.9,
            confidence=0.9,
            evidence="New evidence.",
            source_session_ids=["session-2"],
        )

        merged = asyncio.run(
            merge_graph_candidates(
                existing_nodes=[source, target],
                existing_edges=[existing_edge],
                candidate_nodes=[],
                candidate_edges=[candidate_edge],
            )
        )

        self.assertEqual(len(merged.edges), 1)
        self.assertEqual(merged.edges[0].strength, 0.9)
        self.assertIn("Existing evidence.", merged.edges[0].evidence)
        self.assertIn("New evidence.", merged.edges[0].evidence)
        self.assertEqual(merged.edges[0].source_session_ids, ["session-1", "session-2"])

    def test_edge_endpoints_fuzzy_match_existing_aliases(self) -> None:
        existing = _node(
            "kafka-consumer-group",
            "Kafka Consumer Group",
            aliases=["Kafka Consumer Group", "Consumer Group"],
        )
        partition = KGNodeCandidate(title="Kafka Partition")
        edge = KGEdgeCandidate(
            source_title="Consumer Groups",
            target_title="Kafka Partition",
            relation="extends",
            evidence="Consumer groups coordinate reads from partitions.",
        )

        merged = asyncio.run(
            merge_graph_candidates(
                existing_nodes=[existing],
                existing_edges=[],
                candidate_nodes=[partition],
                candidate_edges=[edge],
            )
        )

        self.assertEqual(len(merged.edges), 1)
        self.assertEqual(merged.edges[0].source, "kafka-consumer-group")
        self.assertEqual(merged.edges[0].target, "kafka-partition")

    def test_symmetric_edges_are_deduped_across_directions(self) -> None:
        left = _node("function-inlining", "Function Inlining")
        right = _node("cache-blocking", "Cache Blocking")
        existing_edge = KGEdgeRecord(
            id="function-inlining-analogous-cache-blocking",
            source="function-inlining",
            target="cache-blocking",
            relation="analogous",
            strength=0.6,
            evidence="Existing.",
            source_session_ids=["session-1"],
        )
        reverse_candidate = KGEdgeCandidate(
            source_title="Cache Blocking",
            target_title="Function Inlining",
            relation="analogous",
            strength=0.8,
            confidence=0.8,
            evidence="Reverse.",
            source_session_ids=["session-2"],
        )

        merged = asyncio.run(
            merge_graph_candidates(
                existing_nodes=[left, right],
                existing_edges=[existing_edge],
                candidate_nodes=[],
                candidate_edges=[reverse_candidate],
            )
        )

        self.assertEqual(len(merged.edges), 1)
        self.assertEqual(merged.edges[0].source, "cache-blocking")
        self.assertEqual(merged.edges[0].target, "function-inlining")
        self.assertIn("Existing.", merged.edges[0].evidence)
        self.assertIn("Reverse.", merged.edges[0].evidence)

    def test_empty_graph_serializes_as_valid_payload(self) -> None:
        graph = empty_graph("user-1")
        data = graph.model_dump(mode="json")

        self.assertEqual(data["graph_id"], "kg_user-1")
        self.assertEqual(data["version"], 0)
        self.assertEqual(data["nodes"], [])
        self.assertEqual(data["edges"], [])
        self.assertEqual(data["source_summary"], {"sessions": 0, "documents": 0, "cards": 0})

    def test_collapse_duplicate_candidates_folds_typo_and_casing(self) -> None:
        first = KGNodeCandidate(
            title="Throughput",
            summary="Throughput is a measure of how many units of information a system can process in a given amount of time.",
            tags=["performance"],
            cluster="performance-metrics",
        )
        typo = KGNodeCandidate(
            title="Throguhput",
            summary="Throughput refers to the amount of data processed by a system in a given amount of time.",
            tags=["performance"],
            cluster="performance metrics",
        )
        edge = KGEdgeCandidate(
            source_title="Throguhput",
            target_title="Latency",
            relation="contrasts",
            evidence="Higher throughput often increases latency.",
        )

        nodes, edges = collapse_duplicate_candidates([first, typo], [edge])

        self.assertEqual(len(nodes), 1)
        survivor = nodes[0]
        self.assertEqual(survivor.title, "Throughput")
        self.assertIn("Throguhput", survivor.aliases)
        self.assertEqual(len(edges), 1)
        self.assertEqual(edges[0].source_title, "Throughput")

    def test_collapse_duplicate_candidates_uses_embedding_for_distant_titles(self) -> None:
        first = KGNodeCandidate(
            title="Hash Table",
            summary="Key-value store with O(1) lookup.",
            embedding=[1.0, 0.0, 0.0],
        )
        rephrased = KGNodeCandidate(
            title="Associative Array",
            summary="Generic key-value lookup data structure.",
            embedding=[0.99, 0.01, 0.0],
        )

        nodes, _ = collapse_duplicate_candidates([first, rephrased], [])
        self.assertEqual(len(nodes), 1)
        self.assertIn("Associative Array", nodes[0].aliases)

    def test_embedding_similarity_merges_lexically_distant_titles(self) -> None:
        existing = _node("hash-table", "Hash Table", aliases=["Hash Table"])
        existing.embedding = [1.0, 0.0, 0.0]
        candidate = KGNodeCandidate(
            title="Associative Array",
            summary="Key-value lookup data structure.",
            evidence=["payload-fact:0"],
            embedding=[0.99, 0.05, 0.0],
        )

        async def reject_gate(*_args) -> bool:
            return False

        merged = asyncio.run(
            merge_graph_candidates(
                existing_nodes=[existing],
                existing_edges=[],
                candidate_nodes=[candidate],
                candidate_edges=[],
                same_concept_gate=reject_gate,
            )
        )
        self.assertEqual(len(merged.nodes), 1)
        self.assertEqual(merged.nodes[0].id, "hash-table")
        self.assertIn("Associative Array", merged.nodes[0].aliases)

    def test_edge_with_unknown_endpoint_creates_placeholder_node(self) -> None:
        existing = _node("kafka", "Kafka")
        candidate = KGNodeCandidate(
            title="Kafka",
            summary="Kafka is a distributed log.",
            evidence=["payload-fact:0"],
        )
        edge = KGEdgeCandidate(
            source_title="Kafka",
            target_title="Zookeeper",
            relation="prerequisite",
            evidence="Kafka used to require Zookeeper for coordination.",
        )

        merged = asyncio.run(
            merge_graph_candidates(
                existing_nodes=[existing],
                existing_edges=[],
                candidate_nodes=[candidate],
                candidate_edges=[edge],
            )
        )

        node_titles = {node.title for node in merged.nodes}
        self.assertIn("Zookeeper", node_titles)
        self.assertEqual(len(merged.edges), 1)
        edge_record = merged.edges[0]
        target_node = next(node for node in merged.nodes if node.id == edge_record.target)
        self.assertEqual(target_node.title, "Zookeeper")

    def test_sparse_optimization_facts_link_to_existing_optimization_nodes(self) -> None:
        existing = _node(
            "function-inlining",
            "Function Inlining",
            aliases=["Function Inlining"],
        )
        existing.summary = "Function inlining is a performance optimization technique."
        candidate = KGNodeCandidate(
            title="Cache blocking",
            summary="Cache blocking is an optimization technique.",
            tags=["optimization", "cache"],
        )

        edges = _same_category_edges_for_sparse_manual(
            {"manual_title": "Cache blocking", "facts": "Optimization method"},
            source_id="manual:Cache blocking",
            existing_nodes=[existing],
            candidate_nodes=[candidate],
        )

        self.assertEqual(len(edges), 1)
        self.assertEqual(edges[0].source_title, "Cache blocking")
        self.assertEqual(edges[0].target_title, "Function Inlining")
        self.assertEqual(edges[0].relation, "analogous")


def _node(node_id: str, title: str, *, aliases: list[str] | None = None) -> KGNodeRecord:
    return KGNodeRecord(
        id=node_id,
        title=title,
        summary=f"{title} summary",
        revision_prompt=f"Review {title}",
        mastery=0.5,
        confidence=0.7,
        cluster="kafka",
        tags=["kafka"],
        evidence=["seed"],
        source_session_ids=["session-1"],
        position={"x": 10, "y": 20},
        aliases=aliases or [title],
    )


if __name__ == "__main__":
    unittest.main()
