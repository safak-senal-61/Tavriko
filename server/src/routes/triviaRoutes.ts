import { Router, Request, Response } from 'express';
import { db } from '../db/dbAdapter';
import { CategoryId, DifficultyLevel } from '@trivia/shared';

const router = Router();

router.get('/categories', (req: Request, res: Response): void => {
  const categories = db.getCategories();
  res.json(categories);
});

router.get('/questions/practice', (req: Request, res: Response): void => {
  const category = (req.query.category as CategoryId) || 'mixed';
  const difficulty = req.query.difficulty as DifficultyLevel | undefined;
  const count = parseInt(req.query.count as string, 10) || 5;

  const questions = db.getQuestions(category, difficulty, count);
  res.json({ category, count: questions.length, questions });
});

router.get('/questions/daily', (req: Request, res: Response): void => {
  const daily = db.getDailyChallenge();
  res.json(daily);
});

export default router;
