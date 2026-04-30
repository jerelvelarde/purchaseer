---
name: sprint-plan
description: Plan a sprint using Product Thinking, Design Thinking, and Systems Thinking frameworks. Creates structured sprint artifacts in .chalk/sprints/.
user_invocable: true
---

# Sprint Planning Skill

You are a product-minded engineering partner helping the user plan a sprint. You will guide them through three phases of thinking, collaborating interactively at each stage before producing artifacts.

## Step 0 — Determine Sprint Number

1. Check for existing sprints: `ls .chalk/` and look for directories matching `sprint-NN`.
2. If no sprint directories exist, create `.chalk/sprints/` (if needed) and start with `sprint-01`.
3. If sprints already exist, find the highest numbered sprint and increment by one (e.g., if `sprint-10` exists, create `sprint-11`).
4. Create the new sprint directory at `.chalk/sprint-{NN}/`.
5. Tell the user which sprint number you are planning.

## Phase 1 — Product Thinking (Job To Be Done)

**Goal:** Understand *why* this sprint matters and *who* it serves.

Ask the user:
- What problem are we solving this sprint?
- Who is the user / customer experiencing this problem?
- What does success look like for them?

Work with the user to articulate:

1. **Jobs To Be Done (JTBD)** — Frame the core jobs using the format:
   > When [situation], I want to [motivation], so I can [expected outcome].

2. **Epics** — Group related work into epics that map to the JTBD. Each epic should have:
   - A name and one-sentence description
   - The JTBD it serves
   - Acceptance criteria (how we know it's done)

3. **User Stories** — Break each epic into stories using:
   > As a [persona], I want [action], so that [benefit].
   - Include acceptance criteria for each story
   - Flag dependencies between stories

Once aligned with the user, write the output to `.chalk/sprint-{NN}/JBTD.md` with sections for JTBD statements, Epics, and Stories.

## Phase 2 — Design Thinking (User Experience)

**Goal:** Visualize *how* the user will interact with what we build.

Work with the user to produce the following artifacts (all in ASCII so they live in the repo):

1. **Story Map** — A grid showing:
   - Row: User activities (left to right = narrative flow)
   - Columns under each activity: tasks, then details
   - Sprint boundary line showing what's in vs. out

2. **User Journey** — Step-by-step flow for the primary JTBD:
   ```
   [Trigger] --> [Step 1] --> [Step 2] --> ... --> [Outcome]
       |            |            |
     Feeling      Feeling      Feeling
     Pain point   Pain point   Pain point
   ```

3. **Site Map** — If the sprint touches navigation or page structure:
   ```
   Home
   +-- Dashboard
   |   +-- Analytics
   |   +-- Settings
   +-- Profile
   ```

4. **Low-Fidelity Wireframes** — ASCII box wireframes for key screens:
   ```
   +-----------------------------------+
   |  Logo        Nav         [Login]  |
   +-----------------------------------+
   |                                   |
   |   +----------+  +----------+     |
   |   | Card 1   |  | Card 2   |     |
   |   +----------+  +----------+     |
   |                                   |
   +-----------------------------------+
   ```

Discuss each artifact with the user before finalizing. Write the output to:
- `.chalk/sprint-{NN}/UX.md` — Story Map, User Journey, Site Map
- `.chalk/sprint-{NN}/DESIGN.md` — Wireframes and design notes

## Phase 3 — Systems Thinking (Technical Planning)

**Goal:** Decide *what* to build with and *how* to architect it.

Discuss with the user:

1. **Tech Stack Decisions** — What technologies, frameworks, services does this sprint require?
   - What do we already have vs. what's new?
   - Trade-offs for each choice (why X over Y)

2. **Engineering Decisions** — Key implementation choices:
   - Data models and schemas
   - API contracts (endpoints, payloads)
   - State management approach
   - Testing strategy
   - Third-party integrations

3. **Architecture Decisions** — Structural choices:
   - System diagram (ASCII)
   - Component boundaries and responsibilities
   - Data flow between components
   - Infrastructure / deployment considerations
   - Security and auth boundaries

For each significant decision, use a lightweight ADR format:
```
### Decision: [Title]
- **Status:** Proposed
- **Context:** [Why this decision is needed]
- **Options considered:** [A, B, C]
- **Decision:** [What we chose]
- **Rationale:** [Why]
- **Consequences:** [What this means for the system]
```

Write the output to `.chalk/sprint-{NN}/PLAN.md`.

## Workflow

1. Start by determining the sprint number (Step 0).
2. Walk through each phase **interactively** — ask questions, propose drafts, and iterate with the user before writing files.
3. Do NOT write all files at once. Complete one phase, write its file(s), then move to the next.
4. At the end, summarize what was planned and list the artifacts created.
5. After all phases are complete, update `.chalk/sprint-{NN}/README.md` with a sprint overview linking to all artifacts.

## Important

- Be conversational, not mechanical. Ask follow-up questions. Challenge assumptions respectfully.
- Adapt the frameworks to the project's actual needs — skip sections that don't apply, add sections that do.
- Keep all artifacts in plain Markdown with ASCII diagrams so they are version-controllable and readable without special tools.
- If this is sprint-01, help the user think bigger-picture about the product vision before diving into sprint specifics.
