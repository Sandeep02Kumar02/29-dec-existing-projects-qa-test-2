module.exports = (req, res, next) => {
  const err = new Error(`Not Found - ${req.path}`);
  err.status = 404;
  next(err);
};
