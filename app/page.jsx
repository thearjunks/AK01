import Dashboard from './Dashboard.jsx';

// Keep the HTML and its hashed CSS/JS assets on the same deployment. Hostinger
// must not retain an old prerendered page after replacing the Next.js bundles.
export const dynamic = 'force-dynamic';

export default function Page() {
  return <Dashboard />;
}
