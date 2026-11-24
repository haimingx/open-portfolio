import { DecorLayers } from '@/components/decor-layers';
import { Landing } from '@/components/landing';

// Shared by malformed addresses and names that do not resolve. The copy is fixed and ignores the URL, so the page looks the same for any input; the form prefills the input in the browser.
export default function NotFound() {
  return (
    <Landing
      heading={<h1>Wallet not found</h1>}
      lede="Enter a 0x address or an ENS name."
      aside={<DecorLayers />}
      prefillFromPath
    />
  );
}
