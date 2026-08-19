import { Router } from "express";
import {
  buildLogbookWeek3,
  buildMentorQuestions,
  formatLogbookWeek3Text,
  formatMentorQuestionsText,
} from "../logbook/index.js";
import { respondExport } from "../export/respond.js";

const router = Router();

router.get("/week3", (req, res) => {
  const logbook = buildLogbookWeek3();
  respondExport(req, res, logbook, {
    formatText: formatLogbookWeek3Text,
    pageTitle: "Climate & Crisis Ops Command — Week 3 Logbook",
    subtitle: logbook.title || "Week 3 logbook",
  });
});

router.get("/mentor-questions", (req, res) => {
  const list = buildMentorQuestions({ priority: req.query.priority });
  respondExport(req, res, list, {
    formatText: formatMentorQuestionsText,
    pageTitle: "Climate & Crisis Ops Command — Mentor Questions",
    subtitle: "Mentor Q&A prep",
  });
});

export default router;
