'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Portfolio X-ray now lives inside the Invest page.
export default function PortfolioRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/invest#xray'); }, [router]);
  return null;
}
