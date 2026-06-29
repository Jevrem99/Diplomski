import { Component } from '@angular/core';
import { SidebarMenu } from '../sidebar-menu/sidebar-menu';

@Component({
  selector: 'app-settings',
  imports: [
    SidebarMenu
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings {}
