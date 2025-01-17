import express from "express";
import cookieParser from "cookie-parser";
import { createProxyMiddleware } from "http-proxy-middleware";

import { renderer } from "../app/server";
import authRoutes from "./auth-routes";
import cookieConsentRoutes from "./cookie-consent-routes";
import adminAuthTokenGeneratorRoutes from "./admin-auth-token-generator-routes";
import { getApiClient } from "../app/api";

const app = express();

app.use((req, _res, next) => {
  req.api = getApiClient();

  next();
});

app.use("/public", express.static("dist/public"));
app.use(cookieParser());

app.use(authRoutes);
app.use(adminAuthTokenGeneratorRoutes);
app.use(cookieConsentRoutes);

app.use(
  "/api",
  createProxyMiddleware({
    target: process.env.BACKEND_API_BASE_URL!,
    changeOrigin: true,
    pathRewrite: {
      "^/api": "/",
    },
  }),
);

app.get("/*", async (req, res) => {
  try {
    if (req.url === "/favicon.ico") {
      res.status(200).json({ status: "ok" });
      return;
    }

    const result = await renderer(req, res);

    if (result) {
      const { content, status } = result;
      res.status(status).send(content);
    }
  } catch (error) {
    const result = await renderer(req, res, error as Error);

    if (result) {
      const { content, status } = result;
      res.status(status).send(content);
    }
  }
});

app.listen(process.env.PORT, function () {
  console.log(`Frontend app is listening on port:  ${process.env.PORT}
    Frontend base URL:     http://localhost:${process.env.PORT}
    GraphQL base URL: http://localhost:${process.env.PORT}/api/graphql
  `);
});
