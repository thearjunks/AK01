import './globals.css';

export const metadata = {
  title: 'stc Kuwait · Social Intelligence',
  description: 'Competitive social media intelligence for stc Kuwait',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

