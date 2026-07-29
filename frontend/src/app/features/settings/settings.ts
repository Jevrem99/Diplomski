import { Component, inject } from '@angular/core';
import { SidebarMenu } from '../sidebar-menu/sidebar-menu';
import { ThemeService } from '../../core/services/theme';

@Component({
  selector: 'app-settings',
  imports: [
    SidebarMenu
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings {

  themeService = inject(ThemeService);

  toggleTheme() {
    this.themeService.toggleTheme();
  }
}
