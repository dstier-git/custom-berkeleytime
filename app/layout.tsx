import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Fall 2026 Course Triage',
  description: 'Personal UC Berkeley course planning tool',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
