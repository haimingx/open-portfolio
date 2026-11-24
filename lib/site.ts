// Site identity comes from the Vercel production domain rather than a constant, so a fork shows its own domain on cards.
const NAME = 'Open Portfolio';

export const REPO_URL = 'https://github.com/haimingx/open-portfolio';
export const CLI_URL = 'https://github.com/haimingx/chaintable-cli';
export const DEPLOY_URL = `https://vercel.com/new/clone?repository-url=${REPO_URL}`;

export function siteUrl(env: NodeJS.ProcessEnv = process.env): URL | undefined {
  const host = env.VERCEL_PROJECT_PRODUCTION_URL;
  return host ? new URL(`https://${host}`) : undefined;
}

// Cards travel without their links, so print the custom domain when there is one and the project name on a vercel.app subdomain.
export function cardBrand(env: NodeJS.ProcessEnv = process.env): string {
  const host = env.VERCEL_PROJECT_PRODUCTION_URL;
  return host && !host.endsWith('.vercel.app') ? host : NAME;
}
