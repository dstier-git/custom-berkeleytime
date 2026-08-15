import type { Metadata } from 'next'
import { Libre_Franklin, Source_Serif_4 } from 'next/font/google'
import './globals.css'

const sans = Libre_Franklin({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

const serif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Fall 2026 Course Triage',
  description: 'Personal UC Berkeley course planning tool',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  )
}
