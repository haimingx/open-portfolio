'use client';

export default function WalletError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="state">
      <h3>Chain data could not be loaded.</h3>
      <p><button className="text-btn" onClick={() => reset()}>Try again</button></p>
    </main>
  );
}
