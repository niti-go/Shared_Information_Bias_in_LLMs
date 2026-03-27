# When Pleasing the Group Beats Finding the Truth: Mitigating Shared Information Bias in LLM Group Decisions

Niti Goyal (ng459)
Kevin Biliguun (ktb53)
Sam Chitgopekar (snc62)


## Project Description

We aim to investigate "Shared Information Bias" inside groups of Large Language Models. The Hidden Profile Problem (Stasser & Titus, 1985) from social psychology shows that groups tend to arrive at an inferior decision because the discussion centers around facts all members already possess, and leaves out crucial unique facts held by single members. If the 'unique' information was to all be pooled together, it would lead to a clearly more optimal decision. Humans tend to behave this way because it is socially easier to continue discussing commonly shared information, rather than introducing new or unique information that could potentially invite skepticism and criticism by the rest of the group.

We will assign a scenario to a group of decision-making LLMs and explore whether they fall victim to the same problem. We hypothesize that they will exhibit the Shared Information Bias, because LLMs that learn through Reinforcement Learning from Human Feedback tend to develop a habit called sycophancy, where they side with what they sense is the majority view instead of weighing uncommon evidence. This preference for the majority view may prevent the group of LLMs from bringing their scattered knowledge to the table.

Our central research question is: **Can a structured moderator agent reduce Shared Information Bias in LLM group decision-making?** The unstructured (no moderator) condition serves as a baseline and also answers the prerequisite question: do LLM groups exhibit this bias at all?

### Real-World Motivation

This research is directly relevant to multi-agent LLM systems already being deployed for high-stakes group decisions:

- **Financial trading:** TradingAgents (UCLA/MIT, ICML 2025) simulates a trading firm where LLM analysts with bullish and bearish roles debate in multiple rounds before a trader agent makes a final call. If agents converge on the majority view without fully weighing a bearish analyst's unique signals, the result is shared information bias leading to bad trades.
- **Medical diagnosis:** Oxford University's Department of Oncology, in collaboration with Microsoft, deployed TrustedMDT — three agents that summarize patient charts, determine cancer staging, and draft treatment plans for tumor board review at Oxford University Hospitals (pilot Q1 2026). Each agent sees different aspects of patient data; if discrepancies between agents go unsurfaced, the board gets a consensus that misses critical information.
- **Intelligence and defense:** Palantir's Maven system fuses data from multiple AI agents across intelligence streams (satellite imagery, signals intelligence, human intelligence) for the Pentagon, with contracts worth up to $10B formalized in 2026. The 9/11 Commission Report specifically identified failure to share and integrate unique information across agencies as a root cause of the intelligence failure — multi-agent AI systems designed for this domain must not replicate the same failure mode.
- **Content moderation:** Meta, OpenAI, and researchers use multi-agent LLM judge panels where critic, defender, and judge agents debate under shared safety rubrics. If a critic agent identifies a subtle policy violation but the other agents see no obvious issue, the unique signal gets outvoted.

All of these systems are vulnerable to Shared Information Bias. Our project directly tests that vulnerability and evaluates a mitigation strategy.

## References

- Stasser, G., & Titus, W. (1985). Pooling of unshared information in group decision making: Biased information sampling during discussion. *Journal of Personality and Social Psychology*.
- Liang, T., et al. (2023). Encouraging Divergent Thinking in Large Language Models through Multi-Agent Debate. *arXiv preprint arXiv:2305.19118* (MAD Framework).
- Pitre, P., et al. (2025). CONSENSAGENT: Towards Efficient and Effective Consensus in Multi-Agent LLM Interactions through Sycophancy Mitigation. *Findings of ACL*.
- TradingAgents: Multi-Agents LLM Financial Trading Framework. *ICML 2025*. https://arxiv.org/abs/2412.20138
- Oxford/Microsoft TrustedMDT. Microsoft Industry Blog, 2025. https://www.microsoft.com/en-us/industry/blog/healthcare/2025/11/18/agentic-ai-in-action-healthcare-innovation-at-microsoft-ignite-2025/
- Pentagon Expands Use of Palantir AI. Military.com, 2026. https://www.military.com/feature/2026/03/22/pentagon-expands-palantirs-role-ai-contract.html
