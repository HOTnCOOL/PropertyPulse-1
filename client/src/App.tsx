import { Switch, Route } from "wouter";
import Dashboard from "./pages/Dashboard";
import GuestDashboard from "./pages/GuestDashboard";
import GuestRegistration from "./pages/GuestRegistration";
import Properties from "./pages/Properties";
import Financials from "./pages/Financials";
import { PublicPropertyList } from "./pages/PublicPropertyList";
import Sidebar from "./components/Sidebar";

function App() {
  // Check if we're on the public or guest paths
  const isPublicPath = window.location.pathname === "/properties/public" ||
                      window.location.pathname === "/guest-dashboard";

  // Only show sidebar for admin routes
  const showSidebar = !isPublicPath;

  return (
    <div className="flex h-screen bg-background">
      {showSidebar && <Sidebar />}
      <main className={`flex-1 overflow-y-auto ${showSidebar ? 'p-8' : ''}`}>
        <Switch>
          {/* Admin routes */}
          <Route path="/" component={Dashboard} />
          <Route path="/guests" component={GuestRegistration} />
          <Route path="/properties" component={Properties} />
          <Route path="/financials" component={Financials} />

          {/* Public routes */}
          <Route path="/properties/public" component={PublicPropertyList} />
          <Route path="/guest-dashboard" component={GuestDashboard} />
        </Switch>
      </main>
    </div>
  );
}

export default App;