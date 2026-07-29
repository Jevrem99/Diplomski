import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-header',
  imports: [],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {

  @Output() toggleMenu = new EventEmitter<void>();

  onMenuClick() {
    this.toggleMenu.emit();
  }
}
