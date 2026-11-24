import Link from 'next/link';
import { DEPLOY_URL, REPO_URL } from '@/lib/site';

const CHAINTABLE_DOCS = 'https://docs.chaintable.com';

// Both icons are monochrome marks in the text color to match the quiet footer text; only the words are underlined.
function ChaintableLink() {
  return (
    <a className="icon-link" href={CHAINTABLE_DOCS}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8.98105 1.28614H7.93186V1.57229H6.02425V1.85843H4.59353V2.14457H3.06744V2.43071H1.92287V3.003H1.35059V12.997H1.92287V13.5693H3.06744V13.8554H4.59353V14.1416H6.02425V14.4277H7.93186V14.7139H8.98105V15H10.82V8.57229H6.24648V10.5753H5.10191V5.42472H6.24648V7.42771H10.82V1H8.98105V1.28614ZM11.583 8.57229H12.7276V7.42771H11.583V8.57229ZM11.583 10.8614H12.7276V9.71686H11.583V10.8614ZM11.583 13.1506H12.7276V12.006H11.583V13.1506ZM11.583 6.28314H12.7276V5.13857H11.583V6.28314ZM11.583 3.994H12.7276V2.84943H11.583V3.994ZM13.4907 8.57229H14.6352V7.42771H13.4907V8.57229ZM13.4907 10.8614H14.6352V9.71686H13.4907V10.8614ZM13.4907 13.1506H14.6352V12.006H13.4907V13.1506ZM13.4907 6.28314H14.6352V5.13857H13.4907V6.28314ZM13.4907 2.84943V3.994H14.6352V2.84943H13.4907Z" />
      </svg>
      Chaintable API
    </a>
  );
}

function SourceLink() {
  return (
    <a className="icon-link" href={REPO_URL}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
      </svg>
      Source
    </a>
  );
}

// The project's source and its data are separate things, so they form two spaced groups; on narrow screens the second group wraps as a whole.
function DeployLink() {
  return (
    <a className="icon-link" href={DEPLOY_URL}>
      <svg width="14" height="14" viewBox="0 0 76 65" fill="currentColor" aria-hidden="true">
        <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
      </svg>
      one-click deploy
    </a>
  );
}

// Coverage describes the scope of Chaintable data, so it sits with the Chaintable API link; the icon is three layers from thin to thick, echoing the wallet layers without reading as a menu icon.
function CoverageLink() {
  return (
    <Link className="icon-link" href="/coverage">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M1 1.5h14v2.5H1zM1 5.5h14v3.5H1zM1 10.5h14v4.5H1z" />
      </svg>
      Coverage
    </Link>
  );
}

export function Credits() {
  return (
    <span className="credits">
      <span><SourceLink /> and <DeployLink /></span>
      <span>Built with <ChaintableLink /> · <CoverageLink /></span>
    </span>
  );
}
