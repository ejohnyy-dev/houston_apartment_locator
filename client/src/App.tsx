import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { QualificationProvider } from "./contexts/QualificationContext";
import Home from "./pages/Home";
import MoveInSpecials from "./pages/MoveInSpecials";
import FAQ from "./pages/FAQ";
import NeighborhoodPage from "./pages/NeighborhoodPage";
import ScrollToTop from "./components/ScrollToTop";
import MobileStickyBottomCTA from "./components/MobileStickyBottomCTA";
import ApartmentSearch from "./pages/ApartmentSearch";
import Services from "./pages/Services";
import HoustonPage from "./pages/HoustonPage";
import HowItWorksPage from "./pages/HowItWorksPage";
import ContactPage from "./pages/ContactPage";
import AdminNurture from "./pages/AdminNurture";
import AdminListings from "./pages/AdminListings";
import AdminReports from "./pages/AdminReports";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
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
        <Route path={"/neighborhoods/:slug"} component={NeighborhoodPage} />
        <Route path={"/admin/nurture"} component={AdminNurture} />
        <Route path={"/admin/listings"} component={AdminListings} />
        <Route path={"/admin/reports"} component={AdminReports} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <QualificationProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
            <MobileStickyBottomCTA />
          </TooltipProvider>
        </QualificationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
