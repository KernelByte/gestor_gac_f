import { Injectable, signal, effect, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
   providedIn: 'root'
})
export class ThemeService {
   private platformId = inject(PLATFORM_ID);

   // Signal to manage theme state
   darkMode = signal<boolean>(false);

   constructor() {
      // Only run in browser environment
      if (isPlatformBrowser(this.platformId)) {
         this.initializeTheme();
      }

      // Effect to apply class to html/body and save to localStorage
      effect(() => {
         if (isPlatformBrowser(this.platformId)) {
            const isDark = this.darkMode();
            const html = document.documentElement;

            console.log('Toggling Theme:', isDark ? 'Dark' : 'Light'); // Debug

            if (isDark) {
               html.classList.add('dark');
               localStorage.setItem('theme', 'dark');
            } else {
               html.classList.remove('dark');
               localStorage.setItem('theme', 'light');
            }
         }
      });
   }

   private initializeTheme() {
      const storedTheme = localStorage.getItem('theme');

      if (storedTheme) {
         this.darkMode.set(storedTheme === 'dark');
      } else {
         // Check OS preference
         const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
         this.darkMode.set(prefersDark);
      }
   }

   toggleTheme() {
      this.darkMode.update(v => !v);
   }
}
