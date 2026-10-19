import SejongApp from "../../components/SejongApp";
import { PAGES, PROGRAMS, VENUES, NOTICES } from "../../src/data/catalog.js";

export function generateStaticParams() {
  const routes = new Set();

  for (const page of PAGES) {
    if (page.path && page.path !== "/") {
      routes.add(page.path.replace(/^\//, ""));
    }
  }

  for (const prog of PROGRAMS) {
    routes.add(`programs/${prog.id}`);
    routes.add(`booking/${prog.id}`);
  }

  for (const venue of VENUES) {
    routes.add(`rental/venues/${venue.id}`);
    routes.add(`visit/spaces/${venue.id}`);
  }

  for (const notice of NOTICES) {
    routes.add(`news/notices/${notice.id}`);
  }

  return Array.from(routes).map((route) => ({
    slug: route.split("/"),
  }));
}

export default function DynamicPage() {
  return <SejongApp />;
}
