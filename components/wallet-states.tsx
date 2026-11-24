
import { DEPLOY_URL } from '@/lib/site';

export function RateLimited() {
  return (
    <main className="state">
      <h3>Too many requests right now</h3>
      <p>Try again in 30 seconds, or <a href={DEPLOY_URL}>deploy your own copy</a> with an API key.</p>
    </main>
  );
}
