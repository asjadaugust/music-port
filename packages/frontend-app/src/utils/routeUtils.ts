import { matchPath, matchRoutes } from "react-router-dom";

import type { RouteObjectWithLoadData } from "react-router-dom";
import type { ICreateApiClient } from "../app/api";

import routes from "../app/routes";

export interface IPageDatas {
  [key: string]: any;
}

export interface ILoadableComponentProps {
  pageData: { [key: string]: any } | null;
  api: ICreateApiClient;
}

export interface ILoadData {
  api: ICreateApiClient;
}

export type IMacthedRoutes = ReturnType<
  typeof matchRoutes<RouteObjectWithLoadData>
>;

interface ILoadPageDataPromise {
  id: string;
  data: object | null;
}

export const loadPageResources = async (
  matchedRoutes: IMacthedRoutes,
  api: ICreateApiClient,
): Promise<IPageDatas> => {
  const matchedRoutesPromises = matchedRoutes!.map((matchedRoute) => {
    if (matchedRoute.route.loadData) {
      return new Promise<ILoadPageDataPromise>(async (resolve) => {
        let data = null;

        await matchedRoute.route.component.load();

        if (matchedRoute.route.loadData) {
          data = await matchedRoute.route.loadData({ api });
        }

        resolve({ id: matchedRoute.route.id, data });
      });
    }

    return null;
  });

  const pageDatas = await Promise.all(matchedRoutesPromises);

  return pageDatas.reduce((acc: IPageDatas, pageData) => {
    if (pageData) {
      return { ...acc, [pageData.id]: pageData.data };
    }

    return acc;
  }, {});
};

export const getPath = ({
  routes,
  routeId,
}: {
  routes: RouteObjectWithLoadData[];
  routeId: string;
}): string | undefined => {
  if (routes.length === 0) return undefined;

  const [firstRoute, ...restRoutes] = routes;

  if (firstRoute.id === routeId) {
    return firstRoute.path;
  } else if (firstRoute.children) {
    const path = getPath({ routes: firstRoute.children, routeId });

    if (path) return path;
  }

  return getPath({ routes: restRoutes, routeId });
};

export const doesPathMatch = ({
  routeId,
  pathname,
}: {
  routeId: string;
  pathname: string;
}): boolean => {
  const path = getPath({
    routes,
    routeId,
  });

  return Boolean(matchPath(path!, pathname));
};