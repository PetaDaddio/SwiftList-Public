# Session Note-Taking Workflow

## Purpose
Capture valuable insights, decisions, and action items from Claude AI sessions without losing critical information in long chat histories.

---

## Workflow

### At End of Each Session:

**User says:** "End of session summary"

**Claude creates:**
```
/docs/session-notes/YYYY-MM-DD_Session_Summary.md
```

**Contains:**
1. **Topics Covered** - What we discussed
2. **Key Decisions Made** - What you approved/rejected
3. **Files Created/Modified** - What was built
4. **Action Items** - What to do next
5. **Open Questions** - What needs clarification

---

## File Naming Convention

```
/docs/session-notes/
├── 2024-12-17_CTO_Technical_Review.md (major deliverable)
├── 2024-12-18_UX_Architecture_Review.md (major deliverable)
├── 2024-12-18_Session_Summary.md (end of day recap)
├── 2024-12-19_Session_Summary.md
└── WEEKLY_ROLLUP_Dec_15-21.md (weekly consolidation)
```

---

## Types of Session Notes

### 1. **Major Deliverables** (like today's UX review)
- Standalone analysis/review documents
- Reference-quality content
- Named by topic, not just date

### 2. **Daily Session Summaries**
- Quick recap of what was accomplished
- Decision log
- Next steps
- Lighter weight than deliverables

### 3. **Weekly Rollups**
- Every Friday, consolidate the week's work
- High-level progress tracking
- Links to major deliverables

---

## Quick Commands

**To save current response:**
"Save this to session notes as [TOPIC_NAME]"

**To end session:**
"Create end of session summary"

**To find something:**
"Search session notes for [KEYWORD]"

---

## Benefits

✅ Never lose valuable insights
✅ Easy to onboard new team members
✅ Searchable decision history
✅ Can feed back to Claude in future sessions for context
✅ Creates institutional knowledge

---

## Example Usage

**User:** "End of session summary"

**Claude creates:** `2024-12-18_Session_Summary.md` with:
- Reviewed UX and architecture
- Identified 4 missing UX flows (preset creation, earnings dashboard, etc.)
- Created session note workflow
- Next: Design preset creation modal

---

Last Updated: Dec 18, 2024
