import express from 'express';

const router = express.Router();

// Retire all legacy admin SaaS routes permanently with HTTP 410 Gone
router.use((_req, res) => {
  res.status(410).json({
    success: false,
    message:
      'The /api/saas/admin endpoint has been permanently retired. All platform management operations are strictly located under /api/platform.',
  });
});

export default router;
