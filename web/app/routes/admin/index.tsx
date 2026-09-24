import type { Route } from "./+types/index";

export const meta: Route.MetaFunction = () => [{ name: "robots", content: "noindex" }];

// Admin area (TZ PG-15). Placeholder until the admin UI lands.
export default function Admin() {
  return <div className="container-page pb-16 pt-6 md:pt-10" />;
}
