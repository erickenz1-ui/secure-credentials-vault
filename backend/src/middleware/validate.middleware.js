/**
 * Validation middleware using Zod
 * Validates request body, query, and params against schemas
 */

const { ValidationError } = require('../utils/errors');

/**
 * Creates a validation middleware
 * @param {Object} schemas - Object with body, query, and/or params schemas
 */
const validate = (schemas) => {
  return async (req, res, next) => {
    try {
      // Validate body
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }

      // Validate query
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }

      // Validate params
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }

      next();
    } catch (error) {
      // Zod validation error
      if (error.name === 'ZodError') {
        const details = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        return next(new ValidationError('Validation failed', details));
      }

      next(error);
    }
  };
};

module.exports = validate;