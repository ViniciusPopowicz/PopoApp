import { RouterProvider } from "react-router-dom";
import { router } from "./routes";

/**
 * App — Root application component.
 * Provides the router to the entire component tree.
 */
export default function App() {
  return <RouterProvider router={router} />;
}
