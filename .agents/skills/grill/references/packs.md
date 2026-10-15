# Packs: default gates and question seeds

Used when the brief has no stage plan of its own. Pick the pack that fits the topic and
adapt it; a pack is seeds, not a script. Each gate ends in an artifact the user
confirms. A caller with its own stage plan (like `pset-view`'s view gates) replaces
this.

Every pack starts the same way: **Gate 0, Frame**. Read what exists and show a one-
message brief of what is true, what is unknown and what looks wrong. Ask no decisions.

## Redesign (of anything that exists)

1. **Purpose and scope.** Seeds: what is it for, and for whom, in one sentence? What
   must it keep? What is the pain that started this? What will it explicitly not do?
   What could be removed outright? Artifact: the mission sentence and a keep, change,
   remove table.
2. **Shape.** Seeds: the main flow, step by step; the structure (what goes where and
   why); two or three genuinely different arrangements, shown, not described. Artifact:
   the chosen structure, drawn.
3. **Behavior and edge cases.** Seeds: what happens when it is empty, slow, wrong,
   interrupted; what it remembers; what can be undone. Artifact: a state list.
4. **Delivery.** Seeds: what it needs from other systems; what changes underneath; what
   "done" means, as checks someone could run. Artifact: dependencies and acceptance.

## Feature or functionality

1. **The job.** Who needs it, when, and what they do today instead. What outcome makes
   it worth building. What is out of scope. Artifact: a job statement and a scope list.
2. **The behavior.** Inputs, outputs, the happy path, the main alternatives, what it
   must never do. Artifact: a behavior table.
3. **Fit.** Where it lives in the product, what it touches, what it changes for
   existing users, what could break. Artifact: touchpoints and risks.
4. **Acceptance.** How you would know it works: scenarios, numbers, the smallest
   version worth shipping and what comes later. Artifact: acceptance list and phases.

## Removal (what to cut)

1. **Inventory.** List everything the thing does or contains. For each: who uses it,
   how often, what breaks without it. Artifact: the inventory with usage.
2. **Cut list.** For each item: keep, merge, move, or remove, and why. What would a
   newcomer miss? What is kept only out of habit? Artifact: the decided list.
3. **Fallout.** What depends on the removed things; the migration or the message to
   people who used them; what is reversible. Artifact: a fallout table.

## Architecture decision

1. **Forces.** What must be true (constraints, scale, team, time); what hurts today.
   Artifact: the list of forces, ranked.
2. **Options.** Two to four real approaches, each with its cost, its risk, what it
   makes easy and what it makes hard. Artifact: an options table.
3. **Decision and consequences.** The choice, why it beat the others, what it commits
   you to, what would make you revisit it. Artifact: a decision record.

## Positioning or marketing

1. **Audience.** Who exactly, what they are trying to do, what they use now, what they
   do not care about. Artifact: an audience statement.
2. **Promise.** The one thing it is for, the proof you have, what you will not claim.
   Artifact: the promise and its proof.
3. **Message and channels.** The words, the tone, where it is seen, what the first
   thing a person does is. Artifact: a message hierarchy and a channel list.
4. **Measure.** What a good result looks like and how it will be seen. Artifact: the
   measures.

## Any pack: the tail

Before ending, ask about what the grill may have missed: what would make the user
regret this in a month, what they would cut if forced to halve it, and what they have
not said out loud. These are the highest-uncertainty questions and are easy to forget;
ask them last, when the rest has made them concrete.
