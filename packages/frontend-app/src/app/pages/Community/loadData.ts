import type { ILoadData } from "../../../utils/routeUtils";
import type { ICreateApiClient } from "../../api";

type PageData = {
  playlists: Awaited<ReturnType<ICreateApiClient["playlist"]["getPlaylists"]>>;
};

export interface IPageQuery {
  currentPage: string;
  pageSize: string;
  genre?: string;
  isAuthTokenAvailableForCreatingPlaylist?: string;
  platform?: string;
  isAuthTokenAvailableForConvertingPlaylist?: string;
  selectedPlaylistId?: string;
}

export async function loadData({ api, query }: ILoadData): Promise<PageData> {
  const { genre, currentPage = "1", limit = "10" } = query;

  const playlists = await api.playlist.getPlaylists({
    genre: genre ?? null,
    currentPage: Number(currentPage),
    pageSize: Number(limit),
  });

  return { playlists };
}