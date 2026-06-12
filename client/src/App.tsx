import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ScrollToTop from "@/components/ScrollToTop";
import ApartmentSearch from "@/pages/ApartmentSearch";
import FAQ from "@/pages/FAQ";
import MoveInSpecials from "@/pages/MoveInSpecials";
import NeighborhoodPage from "@/pages/NeighborhoodPage";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { QualificationProvider } from "./contexts/QualificationContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/search"} component={ApartmentSearch} />
      <Route
        path={"/houston-apartment-move-in-specials"}
        component={MoveInSpecials}
      />
      <Route path={"/faq"} component={FAQ} />
      <Route path={"/neighborhoods/downtown-houston-apartments"}>
        <NeighborhoodPage slug="downtown-houston-apartments" />
      </Route>
      <Route path={"/neighborhoods/midtown-houston-apartments"}>
        <NeighborhoodPage slug="midtown-houston-apartments" />
      </Route>
      <Route path={"/neighborhoods/the-heights-apartments"}>
        <NeighborhoodPage slug="the-heights-apartments" />
      </Route>
      <Route path={"/neighborhoods/galleria-apartments"}>
        <NeighborhoodPage slug="galleria-apartments" />
      </Route>
      <Route path={"/neighborhoods/medical-center-apartments"}>
        <NeighborhoodPage slug="medical-center-apartments" />
      </Route>
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <QualificationProvider>
          <TooltipProvider>
            <Toaster />
            <ScrollToTop />
            <Router />
          </TooltipProvider>
        </QualificationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
