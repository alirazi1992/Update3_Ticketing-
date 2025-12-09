"use client"

import * as React from "react"
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from "next-themes"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // Centralized theme provider; attribute="class" is already set by layout.
  // Use a single storage key so all parts of the app read the same value.
  return (
    <NextThemesProvider
      storageKey="ticketing-theme"
      enableSystem
      defaultTheme="system"
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}
