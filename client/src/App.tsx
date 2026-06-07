import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ApartmentSearch from "./pages/ApartmentSearch";
<<<<<<< Updated upstream
=======
import Services from "./pages/Services";
import HoustonPage from "./pages/HoustonPage";
import HowItWorksPage from "./pages/HowItWorksPage";
import ContactPage from "./pages/ContactPage";
import AdminNurture from "./pages/AdminNurture";
import AdminListings from "./pages/AdminListings";
import AdminReports from "./pages/AdminReports";
import AdminRentcast from "./pages/AdminRentcast";
import ApartmentDetail from "./pages/ApartmentDetail";
>>>>>>> Stashed changes

function Router() {
  return (
<<<<<<< Updated upstream
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/search"} component={ApartmentSearch} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
=======
    <>
      <ScrollToTop />
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/search"} component={ApartmentSearch} />
        <Route path={"/services"} component={Services} />
        <Route path={"/houston"} component={HoustonPage} />
        <Route path={"/how-it-works"} component={HowItWorksPage} />
        <Route path={"/contact"} component={ContactPage} />
        <Route path={"/houston-apartment-move-in-specials"} component={MoveInSpecials} />
        <Route path={"/faq"} component={FAQ} />
        <Route path={"/:neighborhoods/:slug"} component={NeighborhoodPage} />
        <Route path={"/apartments/:slug"} component={ApartmentDetail} />
        <Route path={"/admin"}><Redirect to="/admin/listings" /></Route>
        <Route path={"/admin/nurture"} component={AdminNurture} />
        <Route path={"/admin/listings"} component={AdminListings} />
        <Route path={"/admin/reports"} component={AdminReports} />
        <Route path={"/admin/rentcast"} component={AdminRentcast} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </>
>>>>>>> Stashed changes
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
