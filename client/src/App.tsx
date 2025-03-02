import { Switch, Route, useLocation } from "wouter";
import Dashboard from "./pages/Dashboard";
import GuestDashboard from "./pages/GuestDashboard";
import GuestRegistration from "./pages/GuestRegistration";
import Properties from "./pages/Properties";
import Financials from "./pages/Financials";
import { PublicPropertyList } from "./pages/PublicPropertyList";
import GuestPayment from "./pages/GuestPayment";
import Auth from "./pages/Auth";
import DepositPolicyPage from "./pages/DepositPolicyPage";
import PaymentCalculatorDemo from "./pages/PaymentCalculatorDemo";
import PaymentSchedule from "./pages/PaymentSchedule";
import PaymentTerminal from "./pages/PaymentTerminal";
import GuestInfo from "./pages/GuestInfo";
import Sidebar from "./components/Sidebar";
import React from "react";

// Layout components
function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  );
}

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <main className="w-full">
        {children}
      </main>
    </div>
  );
}

// Root redirect component
function RootRedirect() {
  const [, setLocation] = useLocation();
  React.useEffect(() => {
    setLocation("/properties/public");
  }, [setLocation]);
  return null;
}

function App() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/">
        <RootRedirect />
      </Route>

      <Route path="/properties/public">
        <PublicLayout>
          <PublicPropertyList />
        </PublicLayout>
      </Route>

      <Route path="/policies/deposit-policy">
        <PublicLayout>
          <DepositPolicyPage />
        </PublicLayout>
      </Route>

      <Route path="/auth">
        <PublicLayout>
          <Auth />
        </PublicLayout>
      </Route>

      <Route path="/register">
        <PublicLayout>
          <GuestRegistration />
        </PublicLayout>
      </Route>

      <Route path="/payment">
        <PublicLayout>
          <GuestPayment />
        </PublicLayout>
      </Route>

      <Route path="/guest-dashboard">
        <PublicLayout>
          <GuestDashboard />
        </PublicLayout>
      </Route>
      
      {/* Simple test route for guest dashboard */}
      <Route path="/guest-info">
        <PublicLayout>
          <GuestInfo />
        </PublicLayout>
      </Route>
      
      <Route path="/payment-demo">
        <PublicLayout>
          <PaymentCalculatorDemo />
        </PublicLayout>
      </Route>

      <Route path="/payment-schedule">
        <PublicLayout>
          <PaymentSchedule />
        </PublicLayout>
      </Route>
      
      <Route path="/payment-terminal">
        <PublicLayout>
          <PaymentTerminal />
        </PublicLayout>
      </Route>

      {/* Admin routes */}
      <Route path="/admin">
        <AdminLayout>
          <Dashboard />
        </AdminLayout>
      </Route>

      <Route path="/admin/guests">
        <AdminLayout>
          <GuestRegistration />
        </AdminLayout>
      </Route>

      <Route path="/admin/properties">
        <AdminLayout>
          <Properties />
        </AdminLayout>
      </Route>

      <Route path="/admin/financials">
        <AdminLayout>
          <Financials />
        </AdminLayout>
      </Route>
    </Switch>
  );
}

export default App;