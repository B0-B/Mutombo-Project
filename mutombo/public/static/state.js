export class DashboardState {
  constructor() {
    this.authenticated = false;
    this.stats = {};
    this.messages = [];
    this.downloads = [];
    this.elements = {};
    this.dashboard = {
      containers: {}
    }
  }
}

// Export global instance in singleton-style
export var state = new DashboardState(); 