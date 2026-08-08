# Logbook Entry — Day 20

**Paste-ready for Future Caribbean Buildathon organizers / mentor check-in.**

---

**Date:** Saturday, 8 Aug 2026  
**Project:** Climate & Crisis Ops Command  
**Track:** Climate Risk & Disaster Coordination (Future Caribbean Buildathon 2026)  
**Hours:** ~2

### Goal for the day
**Logbook #3 + mentor questions list** — Week 3 wrap-up paste-ready for organizers and prioritized mentor asks ahead of demo day. Week 3 · Day 20 sprint deliverable.

### Completed

**Logbook module (`src/logbook/index.js`)**
- **`WEEK3_DELIVERED`** — Days 15–20 deliverable summary with API/doc links
- **`buildLogbookWeek3()`** — live stats from eval, efficiency, and deploy checklist
- **`buildMentorQuestions()`** — 10 prioritized questions by category and rubric
- **`formatLogbookWeek3Text()` / `formatMentorQuestionsText()`** — terminal paste helpers

**API (`src/routes/logbook.js`)**
- `GET /api/logbook/week3` — JSON Week 3 summary + exit criteria
- `GET /api/logbook/week3?format=text` — paste-ready logbook #3
- `GET /api/logbook/mentor-questions` — full mentor ask list
- `GET /api/logbook/mentor-questions?priority=high` — high-priority subset

**Docs**
- `docs/logbook-week3.md` — Logbook entry #3 (Week 3 summary, paste-ready)
- `docs/mentor-questions.md` — categorized mentor questions with rubric tags

**CLI:** `npm run logbook:week3` · `npm run mentor:questions`

**Phase:** server + UI pill → **Week 3 · Day 20** · module chip `logbook: week3_ready`

### Verified
```bash
npm run eval:run
npm run logbook:week3
npm run mentor:questions
curl.exe http://127.0.0.1:8787/api/logbook/week3
curl.exe "http://127.0.0.1:8787/api/logbook/week3?format=text"
curl.exe http://127.0.0.1:8787/api/logbook/mentor-questions
curl.exe "http://127.0.0.1:8787/api/logbook/mentor-questions?priority=high&format=text"
```

### Tomorrow (Day 21)
Demo day — live run + Q&A prep.

### Rubric note
**PMF:** Mentor questions include design-partner intros and pitch deck review. **Agentic AI:** Q&A prep targets eval + HITL narrative vs. model showcase. **Team:** Solo-founder rubric question documented for mentor feedback.

### Attachments
| File | Shows |
|---|---|
| `docs/logbook-week3.md` | Logbook #3 paste-ready |
| `docs/mentor-questions.md` | Prioritized mentor ask list |

**Deliverables:** `src/logbook/index.js` · `docs/logbook-week3.md` · `docs/mentor-questions.md` · `GET /api/logbook/*`
