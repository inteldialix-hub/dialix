const { ZodError } = require('zod');

function validateSchema(schema) {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req.body || {});
      req.body = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: 'Invalid request payload',
          issues: err.errors.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }
      next(err);
    }
  };
}

module.exports = { validateSchema };