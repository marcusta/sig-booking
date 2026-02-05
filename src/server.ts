import { Elysia } from "elysia";
import routes from "routes";
import logger from "logger";

const app = new Elysia().use(routes);

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  logger.info(`Server is running on http://localhost:${port}`);
});
