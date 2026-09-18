import site from '../data/site.json' with {type:'json'};

// Content IDs remain stable; public paths follow the document's site structure.
/** @param {string} slug */
export function articlePath(slug) {
  const paths = /** @type {Record<string, string>} */ (site.articlePaths);
  return paths[slug] || `/blog/${slug}/`;
}

export const routeAliases = Object.fromEntries(
  Object.entries(site.articlePaths).map(([slug, path]) => [`/blog/${slug}/`, path])
);
