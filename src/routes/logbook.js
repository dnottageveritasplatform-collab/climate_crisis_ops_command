import { Router } from "express";
import {
  buildLogbookWeek3,
  buildMentorQuestions,
  formatLogbookWeek3Text,
  formatMentorQuestionsText,
} from "../logbook/index.js";

const router = Router();

router.get("/week3", (req, res) => {
  const logbook = buildLogbookWeek3();
  if (req.query.format === "text") {
    res.type("text/plain").send(formatLogbookWeek3Text(logbook));
    return;
  }
  res.json(logbook);
});

router.get("/mentor-questions", (req, res) => {
  const list = buildMentorQuestions({ priority: req.query.priority });
  if (req.query.format === "text") {
    res.type("text/plain").send(formatMentorQuestionsText(list));
    return;
  }
  res.json(list);
});

export default router;
