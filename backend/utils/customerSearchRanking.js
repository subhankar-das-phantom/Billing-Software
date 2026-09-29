const { escapeRegex, buildFuzzyPattern } = require('./searchUtils');

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const regexMatch = (input, regex) => ({
  $regexMatch: { input, regex, options: 'i' }
});

/**
 * Builds aggregation stages that rank customer search matches before pagination.
 * Ranking is deliberately name-first: primary names outrank parenthetical aliases,
 * which outrank generic field matches.
 */
function buildCustomerSearchRankingStages({ rawQuery, useFuzzy = false, sort = {}, skip = 0, limit = 50 }) {
  const normalizedQuery = String(rawQuery || '').trim().toLowerCase();
  const escapedQuery = escapeRegex(normalizedQuery);
  const name = { $ifNull: ['$customerName', ''] };
  // $regexReplace is unavailable on the deployed MongoDB version. Splitting at
  // the first parenthesis gives us the customer’s primary display name using
  // long-supported aggregation operators.
  const primaryName = {
    $arrayElemAt: [{ $split: [name, '('] }, 0]
  };
  const directFieldMatch = {
    $or: [
      regexMatch({ $ifNull: ['$phone', ''] }, escapedQuery),
      regexMatch({ $ifNull: ['$gstin', ''] }, escapedQuery),
      regexMatch({ $ifNull: ['$address', ''] }, escapedQuery)
    ]
  };
  const branches = [
    { case: { $eq: [{ $toLower: name }, normalizedQuery] }, then: 1000 },
    { case: regexMatch(name, `^${escapedQuery}`), then: 900 },
    { case: regexMatch(name, `(?:^|[^a-z0-9])${escapedQuery}\\s*$`), then: 850 },
    { case: regexMatch(primaryName, `(?:^|[^a-z0-9])${escapedQuery}(?=$|[^a-z0-9])`), then: 800 },
    { case: regexMatch(name, `\\([^)]*${escapedQuery}[^)]*\\)`), then: 700 },
    { case: regexMatch(name, escapedQuery), then: 600 },
    { case: directFieldMatch, then: 300 }
  ];

  if (useFuzzy && normalizedQuery.length >= 2) {
    const fuzzyPattern = buildFuzzyPattern(normalizedQuery);
    if (fuzzyPattern) {
      branches.push(
        { case: regexMatch(name, fuzzyPattern), then: 200 },
        {
          case: {
            $or: [
              regexMatch({ $ifNull: ['$phone', ''] }, fuzzyPattern),
              regexMatch({ $ifNull: ['$gstin', ''] }, fuzzyPattern),
              regexMatch({ $ifNull: ['$address', ''] }, fuzzyPattern)
            ]
          },
          then: 190
        }
      );
    }
  }

  const relevanceSort = { _searchRank: -1, ...sort };
  if (!hasOwn(relevanceSort, '_id')) relevanceSort._id = 1;

  return [
    { $set: { _searchRank: { $switch: { branches, default: 0 } } } },
    { $sort: relevanceSort },
    { $skip: Math.max(0, skip) },
    { $limit: Math.max(1, limit) },
    { $project: { _searchRank: 0 } }
  ];
}

module.exports = { buildCustomerSearchRankingStages };
