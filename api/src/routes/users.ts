import express from 'express';

const router = express.Router();

/* GET users listing. */
router.get('/', (_req, res) => {
  res.json({ message: 'respond with a resource' });
});

export default router;
