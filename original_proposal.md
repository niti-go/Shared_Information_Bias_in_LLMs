## When Pleasing the Group Beats Finding the Truth: Mitigating Shared Information Bias in LLM Group Decisions
Sam Chitgopekar (snc62)
Kevin Biliguun (ktb53)
Niti Goyal (ng459)

### Project Description
We aim to investigate "Shared Information Bias" inside groups of Large Language Models. The Hidden Profile Problem (Stasser & Titus, 1985) from social psychology shows that groups tend to arrive at an inferior decision because the discussion centers around facts all members already possess, and leaves out crucial unique facts held by single members. If the ‘unique’ information was to all be pooled together, it would lead to a clearly more optimal decision. Humans tend to behave this way because it is socially easier to continue discussing commonly shared information, rather than introducing new or unique information that could potentially invite skepticism and criticism by the rest of the group. 

We will assign a scenario to a group of decision-making LLMs and explore whether they fall victim to the same problem. We hypothesize that they will exhibit the Shared Information Bias, because LLMs that learn through Reinforcement Learning from Human Feedback tend to develop a habit called sycophancy, where they side with what they sense is the majority view instead of weighing uncommon evidence. This preference for the majority view may prevent the group of LLMs from bringing their scattered knowledge to the table.

Our goal is to build an LLM group discussion simulation engine using Vercel AI SDK and Next.js. We will design group decision scenarios, such as fund allocation or courtroom verdicts. Some information will be shared among all agents, which would alone objectively lead to a suboptimal decision, and each agent will also hold some unique, private information that, when combined, would reveal the truly optimal decision. While the agents talk with each other, the interface will display the shape of the conversation as it changes. It will also highlight when agents actually bring up any unique information during the discussion, and how other agents react to it – whether it is overlooked, dismissed, or meaningfully considered. At the end, the engine will display the final decision that the group has arrived at, determined either through a vote among agents or via a moderator agent that summarizes the group’s consensus.

We will analyze the results by observing whether the group reaches the ‘correct’ optimal decision or settles on a suboptimal one due to failing to share and consider uniquely held information. The system will also support two discussion modes: unstructured, where there is no intervention, and structured, where a moderator agent guides participants with prompts designed to encourage sharing and discussion of overlooked information. If we have time, we can experiment with different structured discussion strategies to try to reduce shared information bias among the LLMs. Beyond understanding LLM behavior in group scenarios, this project could also potentially discover effective moderator prompting strategies that could be applied to real-world human group discussions to reduce the hidden profile problem.

### AI Aspects

The AI aspects of our project are on designing the workflows for the autonomous agents and managing their state through MCP. Instead of handling the interactions as a simple chat log, we will build a deterministic state machine using the Vercel AI SDK ToolLoopAgent abstraction. We plan to compare two different types of architectures:

1. Unstructured Discussion: A free discussion where agents send messages into a shared context window. Because each model is trained to agree, we expect the group to go towards a quick suboptimal decision due to the models' alignment bias.
2. Structured Discussion: A moderated workflow in which an Orchestrator agent actively facilitates the discussion. Rather than letting agents freely converge on a majority view, the Orchestrator uses structured prompts designed to probe the agents to consider overlooked information. The Orchestrator may, for example, explicitly invite agents to share evidence that hasn't yet been discussed, or flag when the group appears to be converging prematurely. This will mirror structured discussion interventions studied in the human hidden profile literature.

We will also build an administrative visualization dashboard with TypeScript and Next.js. The dashboard will display live updates of the discussion as it unfolds, tracking when and how often agents introduce unique private information into the conversation. For the voting ledger, agents will submit their decisions through structured tool calls, allowing the system to record each action with strict type checks and parsing at every step. At the end of each simulation, the dashboard will compare the group's final decision against the ground-truth optimal decision derived from the full pool of unique information held collectively by the agents, making it immediately visible whether the outcome reflects the optimal decision that the combined knowledge would support, or whether critical unique clues were shared too late, ignored, or never surfaced at all.

### Evaluation

We will evaluate the success of our project along two dimensions: system functionality and research insight.

For system functionality, success means the simulation engine runs end-to-end reliably across our designed scenarios: agents receive their private and shared information correctly, discussions are logged accurately, and the final decision is recorded cleanly through the voting mechanism. The structured and unstructured modes should both be fully operational and meaningfully distinct in how they conduct the discussion.

For research validity, we will know our project has produced meaningful results if we observe a measurable difference in unique information density and decision accuracy between the unstructured and structured discussion workflows across our scenarios. Even a null result, where the structured moderator fails to improve outcomes, would be a valid and interesting finding, as it would suggest that prompt-based intervention alone may not be sufficient to overcome shared information bias and sycophantic behavior in LLMs. It could additionally be interesting to compare our performance to real humans using existing human performance data from studies that already exist on the Hidden Profile Problem (e.g., Stasser & Titus meta-analyses). We will see if our agents arrive at better conclusions and decisions compared to the average human group which approximately has a 18-25% success rate in high-conflict hidden profiles. 

### Project Timeline
- Weeks 1-3: Infrastructure & MCP Implementation:
    - Set up the Next.js repo with Vercel AI SDK.
    - Implement the MCP server for the "Voting" and "Clue Revelation" tools.
    - Milestone: A single agent can read a clue and cast a tool-call vote that updates a database.
- Weeks 4-6: Workflow Engineering:
    - Implement the "Unstructured Mesh" logic (shared context injection).
    - Implement the "Orchestrator-Worker" logic (state-gated turns).
    - Generate the 8-10 textual scenarios (Restaurant Grants, Hiring Decisions, etc.) with ground-truth logic.
    - Milestone: Two teams of 5 agents can run a full simulation loop automatically.
- Weeks 7-9: Visualization & Refinement:
    - Build the frontend dashboard to visualize the voting steps and confidence intervals.
    - Run initial pilot tests. If agents are too agreeable, increase the "temperature" or adjust system prompts to encourage debate.
- Weeks 10-12: Large Scale Evaluation & Analysis:
    - Run n=50 trials for both conditions.
    - Parse logs to extract "Unique Information" mentions.
    - Milestone: Raw data collected for all scenarios.
- Weeks 13-14: Final Write-up & Demo Polish:
    - Analyze results: Did the Orchestrator mitigate shared information bias?
    - Finalize the project report and video demo.

### Existing Resources
- Software Frameworks: We will heavily rely on the Vercel AI SDK (specifically the Core and RSC libraries) for handling agent streaming and tool calling. We will use the Model Context Protocol (MCP) specification for standardizing the voting tools. The frontend will be built on Next.js 16 with the App Router.
- Models: We will use major frontier models such as Claude Opus 4.6, Gemini 3 Pro, GPT-5.2, and Grok 4, and evaluate which ones are most performant. Frontier models are chosen because they are often used for applications where reasoning and chain of thought are critical.
    - If time permits, we’d like to evaluate open weight models like GPT OSS 120B and Kimi K2, and possibly “mini” variants of frontier models (e.g. Gemini 3 Flash, Claude Haiku 4.5) to see how they differ from the SOTA performance.
- Data: We will generate our own "Hidden Profile" datasets based on the logic described in the DebateLLM and MAD papers, ensuring we have ground truth control. We do not need external datasets as the problem is logic-based, not training-based.

### Connection to Other Work
Sam works at Vercel as a maintainer of the AI SDK and AI Gateway. Kevin and Niti have no relation to the current project proposal.

### References
- Stasser, G., & Titus, W. (1985). Pooling of unshared information in group decision making: Biased information sampling during discussion. Journal of Personality and Social Psychology.
- Liang, T., et al. (2023). Encouraging Divergent Thinking in Large Language Models through Multi-Agent Debate. arXiv preprint arXiv:2305.19118 (MAD Framework).
- Pitre, P., et al. (2025). CONSENSAGENT: Towards Efficient and Effective Consensus in Multi-Agent LLM Interactions through Sycophancy Mitigation. Findings of ACL.
- Vercel. (2024). Building Agentic Workflows with the AI SDK. Vercel Engineering Blog.

