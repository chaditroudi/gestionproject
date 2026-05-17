export function notFoundHandler(req, res) {
  return res.status(404).json({ message: "Route introuvable." });
}

export function errorHandler(error, req, res, next) {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({
    message: error.message || "Une erreur interne est survenue."
  });
}
