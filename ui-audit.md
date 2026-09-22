Audit this UI as a UX reviewer.

Do not focus only on aesthetics. Evaluate whether the UI clearly communicates
its current state and helps the user accomplish their goal.

For each issue, consider:

1. CONTEXT
   - Where am I?
   - What was I trying to do?
   - Is important context preserved?

2. STATE
   - Is the current state obvious?
   - Is it loading, successful, empty, failed, cancelled, or unavailable?
   - Does the UI describe the user-facing problem rather than internal implementation?

3. ACTIONABILITY
   - What should the user do next?
   - Is the primary action obvious and enabled?
   - Does the action actually help recover?

4. ERROR QUALITY
   - Is the wording clear and specific?
   - Are there technical/internal terms?
   - Would a normal user understand the message?

5. HIERARCHY
   - What does the user notice first?
   - Is the most important information visually prioritized?
   - Are secondary elements competing with the primary action?

6. ORPHANED UI
   - Are there disabled, irrelevant, unexplained, or leftover elements?
   - Does every visible element make sense in the current state?

7. RECOVERY
   - If the primary operation failed, is there a clear fallback?
   - Can the user retry, edit, go back, cancel, or use another method?

8. CONSISTENCY
   - Does this state use terminology, controls, spacing, and patterns
     consistent with the rest of the application?

9. MENTAL MODEL
   Determine whether a new user can answer:
   - What happened?
   - Why did it happen?
   - Did I lose anything?
   - What can I do?
   - What will happen next?

10. SEVERITY
   Classify each issue as:
   P0 = blocking
   P1 = major UX problem
   P2 = noticeable usability problem
   P3 = polish

For each issue provide:

- Severity
- Location
- Problem
- Why it is confusing/harmful
- Recommended fix

Prioritize problems that affect comprehension, recovery, and task completion
over purely aesthetic issues.

Finally, provide the 3 highest-impact changes.