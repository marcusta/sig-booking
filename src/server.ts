import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";
import routes from "routes";

const app = new Elysia()
  // Serve static files from the public directory
  .use(
    staticPlugin({
      assets: "public",
      prefix: "/public",
    })
  )
  // Apply routes
  .use(routes);

const port = 3001;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
