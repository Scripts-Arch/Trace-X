'use client';

import { useTheme } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';

export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      position="top-center"
      theme={resolvedTheme === 'light' ? 'light' : 'dark'}
      toastOptions={{
        style: {
          fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
          fontSize: '12px',
        },
      }}
    />
  );
}
