import { Elysia } from "elysia";
import routes from "routes";

const app = new Elysia().use(routes);

const port = 3001;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
