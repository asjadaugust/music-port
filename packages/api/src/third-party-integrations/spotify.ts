import axios from "axios";
import passport from "passport";
import { Strategy } from "passport-spotify";

import { AxiosError } from "axios";
import type { StrategyOptions } from "passport-spotify";
import type { IThirdPartyIntegrations } from "./types";
import type { IPlaylist, IRawPlaylist } from "../models";

import { MusicStreamingPlatformResourceFailureError } from "../errors/music-streaming-platform-resource-failure-error";

const clientID = process.env.SPOTIFY_CLIENTID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const callbackURL = process.env.FRONTEND_SPOTIFY_AUTH_CALLBACK_URL;

class Spotify implements IThirdPartyIntegrations {
  private readonly integrationName: string = "spotify";

  getIntegrationName(): ReturnType<
    IThirdPartyIntegrations["getIntegrationName"]
  > {
    return this.integrationName;
  }

  getPassportStrategy(): ReturnType<
    IThirdPartyIntegrations["getPassportStrategy"]
  > {
    return new Strategy(
      {
        clientID,
        clientSecret,
        callbackURL,
      } as StrategyOptions,
      function (accessToken, refreshToken, expiresIn, profile, done) {
        return done(null, {
          accessToken,
          refreshToken,
          expiresIn,
          userId: profile.id,
        });
      },
    );
  }

  authenticate(
    ...args: Parameters<IThirdPartyIntegrations["authenticate"]>
  ): ReturnType<IThirdPartyIntegrations["authenticate"]> {
    return passport.authenticate(
      "spotify",
      {
        scope: ["playlist-modify-public"],
        ...args[0],
      },
      args[1],
    );
  }

  async getPlaylist({
    accessToken,
    link,
  }: {
    accessToken: string;
    link: string;
  }): Promise<IRawPlaylist> {
    const url = new URL(link);
    const paths = url.pathname.split("/");
    const playlistId = paths[paths.length - 1];

    try {
      const { data } = await axios.get(
        `https://api.spotify.com/v1/playlists/${playlistId}`,
        {
          headers: { Authorization: "Bearer " + accessToken },
        },
      );

      return this.transformPlaylistToInternalFormat(data);
    } catch (error) {
      if (error instanceof AxiosError && error.response) {
        const { data, status, statusText } = error.response;

        throw new MusicStreamingPlatformResourceFailureError({
          message: data?.error?.message || statusText,
          code: status,
        });
      }

      throw error;
    }
  }

  async createPlaylist({
    playlist,
    accessToken,
    userId,
  }: {
    playlist: IPlaylist;
    accessToken: string;
    userId: string;
  }): Promise<void> {
    try {
      // Search for the items that should be added into the playlist
      // This function should return an array of strings corresponding to
      // the uri of the track
      const items = await this.searchForItems({ playlist, accessToken });

      // Create a playlist for the user on spotify
      const { data: playlistOnSpotify } = await axios.post(
        `https://api.spotify.com/v1/users/${userId}/playlists`,
        {
          name: playlist.name,
          public: true,
          collaborative: false,
        },
        {
          headers: { Authorization: "Bearer " + accessToken },
        },
      );

      // Add items to the playlist we created earlier
      await axios.post(
        `https://api.spotify.com/v1/playlists/${playlistOnSpotify.id}/tracks`,
        {
          uris: items,
        },
        {
          headers: { Authorization: "Bearer " + accessToken },
        },
      );
    } catch (error) {
      if (error instanceof AxiosError && error.response) {
        const { data, status } = error.response;

        throw new MusicStreamingPlatformResourceFailureError({
          message: data?.error?.message,
          code: status,
        });
      }

      throw error;
    }
  }

  async searchForItems({
    playlist,
    accessToken,
  }: {
    playlist: IPlaylist;
    accessToken: string;
  }): Promise<string[]> {
    async function searchItem(
      song: IPlaylist["songs"][number],
    ): Promise<string | null> {
      const { artists, name } = song;
      const url = encodeURI(
        `https://api.spotify.com/v1/search?q=${name}&artist:${artists[0].name}`,
      );

      const { data } = await axios.get(url, {
        params: {
          type: "track",
          limit: 10,
        },
        headers: { Authorization: "Bearer " + accessToken },
      });

      // We are only interested in the first item from the tracks
      // query result. The item comes with a uri we should resolve
      const {
        tracks: { items },
      } = data;

      return items?.[0].uri || null;
    }

    if (playlist.songs.length > 25) {
      throw new MusicStreamingPlatformResourceFailureError({
        message: "Can only export a maximum of 25 songs",
      });
    }

    const searchItems = playlist.songs.map((song) => searchItem(song));

    const items = await Promise.all(searchItems);
    const filteredItems: string[] = items.filter(
      (item): item is string => item !== null,
    );

    if (filteredItems.length === 0) {
      throw new MusicStreamingPlatformResourceFailureError({
        message: "There are no items to add to the playlist",
      });
    }

    return filteredItems;
  }

  transformPlaylistToInternalFormat(data: {
    [key: string]: any;
  }): IRawPlaylist {
    type Image = IRawPlaylist["images"][number];
    type Song = IRawPlaylist["songs"][number];

    if (data.tracks.items.length > 25) {
      throw new MusicStreamingPlatformResourceFailureError({
        message: "Can only import a maxium of 25 songs from a playlist",
      });
    }

    return {
      importLink: data.external_urls.spotify,
      importPlaylistId: data.id,
      images: data.images.map((image: Image) => ({
        url: image.url,
        width: image.width,
        height: image.height,
      })),
      apiLink: data.href,
      name: data.name,
      owner: {
        name: data.owner.display_name,
      },
      songs: data.tracks.items.map((item: any) => {
        const {
          track,
          track: { album },
        } = item;

        const artists: Song["artists"] = album.artists.map(
          (artist: { name: string }) => ({
            name: artist.name,
          }),
        );

        const images: Song["images"] = album.images.map((image: Image) => ({
          url: image.url,
          width: image.width,
          height: image.height,
        }));

        return {
          artists,
          images,
          name: track.name,
          previewURL: track.preview_url,
        };
      }),
    };
  }
}

const spotify = new Spotify();
export default spotify;
