import { DecorLayers } from '@/components/decor-layers';
import { Landing } from '@/components/landing';

export default function NotFound() {
  return <Landing heading={<h1>Page not found</h1>} lede="Check the link, or enter a wallet address." aside={<DecorLayers />} />;
}
