// Static public content with a request-specific CSP nonce for Cloudflare bot checks.
// No login, review endpoints, database or outbound requests are included.
export default {
  async fetch(request, env) {
    const asset = await env.ASSETS.fetch(request);
    if (!asset.headers.get('content-type')?.includes('text/html')) return asset;
    const response = new Response(asset.body, asset);
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))));
    const policy = response.headers.get('content-security-policy');
    if (policy?.includes("script-src 'self'")) {
      response.headers.set('content-security-policy', policy.replace("script-src 'self'", `script-src 'self' 'nonce-${nonce}'`));
    }
    return response;
  }
};
