import { Component } from '@angular/core';
import { SidebarMenu } from '../sidebar-menu/sidebar-menu';

@Component({
  selector: 'app-database-management',
  imports: [
    SidebarMenu
  ],
  templateUrl: './database-management.html',
  styleUrl: './database-management.css',
})
export class DatabaseManagement {}
