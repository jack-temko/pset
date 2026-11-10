# Bone: log

## Built (2026-11-09)

Step 1 of the loading skeleton plan ([ideas/skeleton-plan.md](../../../../ideas/skeleton-plan.md), settled in [ideas/skeleton-grill.md](../../../../ideas/skeleton-grill.md)). Jack: "Ideally each component should be designed separately to be perfect loading skeletons, so when combined the whole UI should be perfect and uniform."

The one primitive every skeleton is made of. Nothing uses it yet: the units move onto it from step 4.

- Bars pulse slowly, all together: Jack picked "Slow pulse, all together (Recommended)" (S3).
- A bar is one line of its text style (1lh) and draws its colour with ::before, so it has no height of its own; the colour is a new token, `bone`, a step quieter than `border-muted`, so a skeleton never outshines what replaces it (Fable's review found the slabs brighter than their content).
