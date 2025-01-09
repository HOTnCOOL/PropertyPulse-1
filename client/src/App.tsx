import { Switch, Route } from "wouter";
import Dashboard from "./pages/Dashboard";
import GuestRegistration from "./pages/GuestRegistration";
import Properties from "./pages/Properties";
import Financials from "./pages/Financials";
import Sidebar from "./components/Sidebar";

function App() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/guests" component={GuestRegistration} />
          <Route path="/properties" component={Properties} />
          <Route path="/financials" component={Financials} />
        </Switch>
      </main>
    </div>
  );
}

export default App;
