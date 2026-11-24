import { Landing } from '@/components/landing';
import { Trending } from '@/components/trending';
import { TypeHeadline } from '@/components/type-headline';

// The home page is static and the ranking refreshes every 5 minutes, so visits do not turn into Redis reads.
export const revalidate = 300;

export default function Home() {
  return (
    <Landing
      heading={<TypeHeadline />}
      lede={<>Paste any EVM address or ENS name to get a page you can share. No&nbsp;sign-in.</>}
      aside={<Trending />}
    />
  );
}
