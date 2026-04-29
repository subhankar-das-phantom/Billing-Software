/**
 * Resolve tenantId from authenticated user.
 * Admin → own _id
 * Employee → createdByAdmin
 *
 * @param {Object} req - Express request (req.user and req.userRole set by auth middleware)
 * @returns {ObjectId} The tenantId for data scoping
 */
module.exports = function getTenantId(req) {
  if (req.userRole === 'admin') {
    return req.user._id;
  }
  return req.user.createdByAdmin;
};
