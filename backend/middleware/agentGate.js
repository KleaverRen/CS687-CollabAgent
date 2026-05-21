const agentGate = (req, res, next) => {
  // We only gate mutating actions (POST, PUT, PATCH, DELETE)
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const { user_confirmed } = req.body;
    
    if (user_confirmed !== true) {
      return res.status(403).json({
        error: 'Agent autonomous action denied. Mutating requests must include user_confirmed: true',
        requires_confirmation: true
      });
    }
  }
  
  next();
};

module.exports = agentGate;
