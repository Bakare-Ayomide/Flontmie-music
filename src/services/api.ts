/**
 * Flontmie Production API Client
 * Connects the React SPA directly to the live PHP + MySQL backend (`phpbackend/api/*`).
 * Zero mock data fallbacks: all data is fetched from and persisted to real database records.
 */

import { Track, Playlist, ArtistProfile, ArtistDiscographyItem, RelatedArtistItem } from '../types/music';
import { resolveArtworkUrl } from '../utils/artwork';
import { nativePlatform } from './nativePlatform';

export const PRODUCTION_ORIGIN = 'https://flontmie.ticketplaster.com';
export const API_BASE = `${PRODUCTION_ORIGIN}/phpbackend/api`;

export const resolveServerMediaUrl = (rawUrl?: string | null): string => {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/phpbackend/')) {
    return `${PRODUCTION_ORIGIN}${trimmed}`;
  }
  if (trimmed.startsWith('phpbackend/')) {
    return `${PRODUCTION_ORIGIN}/${trimmed}`;
  }
  return trimmed;
};

class FlontmieApiService {
  private token: string | null = null;
  private csrfToken: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('flontmie_jwt');
      this.csrfToken = localStorage.getItem('flontmie_csrf');
      nativePlatform.getStoredAuthTokens().then(({ token, csrfToken }) => {
        if (token && !this.token) {
          this.token = token;
          localStorage.setItem('flontmie_jwt', token);
        }
        if (csrfToken && !this.csrfToken) {
          this.csrfToken = csrfToken;
          localStorage.setItem('flontmie_csrf', csrfToken);
        }
      });
    }
  }

  public setToken(token: string | null, csrfToken?: string | null) {
    this.token = token;
    if (csrfToken !== undefined) {
      this.csrfToken = csrfToken;
    }
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('flontmie_jwt', token);
      } else {
        localStorage.removeItem('flontmie_jwt');
      }
      if (csrfToken) {
        localStorage.setItem('flontmie_csrf', csrfToken);
      } else if (token === null) {
        localStorage.removeItem('flontmie_csrf');
      }
    }
    nativePlatform.saveAuthTokens(token, csrfToken);
  }

  public getToken(): string | null {
    return this.token;
  }

  public getCsrfToken(): string | null {
    return this.csrfToken;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    if (this.csrfToken) {
      headers['X-CSRF-Token'] = this.csrfToken;
    }

    let finalEndpoint = endpoint;
    if (this.token && !finalEndpoint.includes('token=')) {
      const sep = finalEndpoint.includes('?') ? '&' : '?';
      finalEndpoint = `${finalEndpoint}${sep}token=${encodeURIComponent(this.token)}`;
    }

    const response = await fetch(`${API_BASE}/${finalEndpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error((data && data.message) || `API Error: ${response.status}`);
    }

    return data as T;
  }

  // --- Parse Real LRC / SRT / Plain-Text Lyrics Without Inventing Timestamps ---
  public parseLyricsText(rawLyrics: string): { lines: Array<{ time: number | null; endTime?: number; text: string }>; synced: boolean } {
    if (!rawLyrics || typeof rawLyrics !== 'string') {
      return { lines: [], synced: false };
    }
    if (
      rawLyrics.includes('Synchronized Catalog Lyrics') ||
      rawLyrics.includes('Streaming from Flontmie authorized catalog storage')
    ) {
      return { lines: [], synced: false };
    }

    const linesOut: Array<{ time: number | null; endTime?: number; text: string }> = [];
    let hasTimedLine = false;

    const rawLines = rawLyrics.split(/\r?\n/);

    // Check if SRT format (contains "-->")
    if (rawLyrics.includes('-->')) {
      for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i].trim();
        const srtMatch = line.match(
          /^(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})/
        );
        if (srtMatch) {
          const startSec =
            parseInt(srtMatch[1], 10) * 3600 +
            parseInt(srtMatch[2], 10) * 60 +
            parseInt(srtMatch[3], 10) +
            parseInt(srtMatch[4].padEnd(3, '0'), 10) / 1000;
          const endSec =
            parseInt(srtMatch[5], 10) * 3600 +
            parseInt(srtMatch[6], 10) * 60 +
            parseInt(srtMatch[7], 10) +
            parseInt(srtMatch[8].padEnd(3, '0'), 10) / 1000;
          const textParts: string[] = [];
          while (i + 1 < rawLines.length && rawLines[i + 1].trim() !== '') {
            i++;
            textParts.push(rawLines[i].trim());
          }
          const txt = textParts.join(' ').trim();
          if (txt) {
            hasTimedLine = true;
            linesOut.push({ time: startSec, endTime: endSec, text: txt });
          }
        }
      }
      if (linesOut.length > 0) {
        return { lines: linesOut, synced: hasTimedLine };
      }
    }

    // Parse LRC or plain text
    for (const rawLine of rawLines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;
      // Ignore LRC metadata tags like [ar:...], [ti:...], [al:...], [by:...], [length:...]
      if (/^\[(ar|ti|al|au|by|length|offset|re|ve):/i.test(trimmed)) {
        continue;
      }

      const lrcRegex = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
      const matches = [...trimmed.matchAll(lrcRegex)];
      if (matches.length > 0) {
        const textAfterTags = trimmed.replace(lrcRegex, '').trim();
        for (const m of matches) {
          const mins = parseInt(m[1], 10);
          const secs = parseInt(m[2], 10);
          const frac = m[3] ? parseInt(m[3].padEnd(3, '0'), 10) / 1000 : 0;
          const timeSec = mins * 60 + secs + frac;
          if (textAfterTags) {
            hasTimedLine = true;
            linesOut.push({ time: timeSec, text: textAfterTags });
          }
        }
      } else {
        linesOut.push({ time: null, text: trimmed });
      }
    }

    if (hasTimedLine) {
      // Keep only timed lines or sort timed lines in chronological order and populate endTime
      linesOut.sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
      for (let i = 0; i < linesOut.length; i++) {
        if (linesOut[i].time !== null && i + 1 < linesOut.length && linesOut[i + 1].time !== null) {
          linesOut[i].endTime = linesOut[i + 1].time ?? undefined;
        }
      }
    }

    return { lines: linesOut, synced: hasTimedLine };
  }

  // --- Map DB Track to Frontend Track Interface ---
  public mapDbTrack(dbTrack: any): Track {
    const rawLyrics = dbTrack.lyrics || '';
    const { lines: parsedLyrics, synced: lyricsSynced } = this.parseLyricsText(String(rawLyrics));

    const moods = Array.isArray(dbTrack.mood_tags) && dbTrack.mood_tags.length > 0
      ? dbTrack.mood_tags
      : ['all'];

    const resolvedAudioUrl = resolveServerMediaUrl(dbTrack.audio_url);
    const resolvedVideoUrl = resolveServerMediaUrl(dbTrack.video_url);

    const rawCover = dbTrack.cover_art_url || dbTrack.cover_url || '';
    const resolvedCoverUrl = resolveServerMediaUrl(
      resolveArtworkUrl(rawCover, 'track', dbTrack.title || 'Track')
    );

    const rawId = String(dbTrack.id || '');
    const explicitVid = dbTrack.video_id || dbTrack.videoId || undefined;

    const hasLocalAudio = dbTrack.has_local_audio !== undefined ? Boolean(dbTrack.has_local_audio) : Boolean(resolvedAudioUrl);
    const hasLocalVideo = dbTrack.has_local_video !== undefined ? Boolean(dbTrack.has_local_video) : Boolean(resolvedVideoUrl);

    const realFlontmiePlays = Number(dbTrack.flontmie_plays ?? dbTrack.flontmiePlays ?? 0) || 0;

    return {
      id: rawId,
      videoId: explicitVid,
      title: dbTrack.title || 'Untitled Track',
      artist: dbTrack.artist_name || dbTrack.artist || 'Unknown Artist',
      artistId: dbTrack.artist_id || 'art_unknown',
      album: dbTrack.album_name || dbTrack.album || 'Single',
      duration: Number(dbTrack.duration) || 180,
      genre: (dbTrack.genre || 'Pop') as any,
      coverUrl: resolvedCoverUrl,
      audioUrl: hasLocalAudio ? resolvedAudioUrl : '',
      videoUrl: hasLocalVideo && resolvedVideoUrl ? resolvedVideoUrl : undefined,
      hasLocalAudio,
      hasLocalVideo,
      streams: realFlontmiePlays,
      ytPlays: null,
      flontmiePlays: realFlontmiePlays,
      likes: Number(dbTrack.likes_count ?? dbTrack.likes) || 0,
      commentsCount: Number(dbTrack.comments_count ?? dbTrack.commentsCount) || 0,
      isLiked: Boolean(dbTrack.is_liked ?? dbTrack.isLiked),
      dislikes: Number(dbTrack.dislikes_count ?? dbTrack.dislikes) || 0,
      isExplicit: Boolean(Number(dbTrack.explicit)),
      releaseDate: dbTrack.release_date || '2026-01-01',
      lyrics: parsedLyrics,
      rawLyrics: parsedLyrics.length > 0 ? String(rawLyrics) : undefined,
      lyricsSynced,
      bpm: Number(dbTrack.bpm) || 120,
      moods: moods as any,
      isrc: dbTrack.isrc || '',
      upc: dbTrack.upc || '',
      label: dbTrack.label_name || dbTrack.label || '',
      distributor: dbTrack.distributor_name || dbTrack.distributor || '',
      country: dbTrack.country || 'US',
      status: dbTrack.status === 'published' ? 'active' : (dbTrack.status || 'active'),
      featuredOnHome: dbTrack.featured_on_home !== undefined ? Boolean(Number(dbTrack.featured_on_home)) : true,
      source: dbTrack.source || (dbTrack.source_type ? 'catalog' : undefined)
    };
  }

  public mapDiscographyItem(raw: any): ArtistDiscographyItem {
    const title = raw.title || raw.name || 'Untitled Release';
    return {
      id: String(raw.id || raw.browse_id || raw.browseId || `rel_${Math.random().toString(36).slice(2, 8)}`),
      browseId: raw.browse_id || raw.browseId || undefined,
      collectionId: raw.collection_id || raw.collectionId || undefined,
      title,
      artist: raw.artist || raw.artist_name || '',
      artistId: raw.artist_id || raw.artistId || undefined,
      year: raw.year ? String(raw.year) : undefined,
      releaseDate: raw.release_date || raw.releaseDate || undefined,
      type: raw.type || 'Album',
      subtitle: raw.subtitle || undefined,
      coverUrl: resolveArtworkUrl(raw.cover_url || raw.coverUrl || raw.cover_art_url, 'album', title),
      trackCount: raw.track_count ? Number(raw.track_count) : undefined,
      explicit: Boolean(raw.explicit),
      tracks: Array.isArray(raw.tracks) ? raw.tracks.map((t: any) => this.mapDbTrack(t)) : undefined,
    };
  }

  public mapRelatedArtist(raw: any): RelatedArtistItem {
    const name = raw.name || 'Artist';
    return {
      id: String(raw.id || raw.browse_id || raw.browseId || `art_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`),
      browseId: raw.browse_id || raw.browseId || undefined,
      name,
      avatarUrl: resolveArtworkUrl(raw.avatar_url || raw.avatarUrl, 'artist', name),
      subscribers: raw.subscribers || undefined,
      monthlyAudience: raw.monthly_audience || undefined,
    };
  }

  public mapDbArtist(a: any): ArtistProfile {
    const name = a.name || 'Artist';
    const rawTracks = Array.isArray(a.popular_songs)
      ? a.popular_songs
      : Array.isArray(a.tracks)
      ? a.tracks
      : [];

    const mappedTracks: Track[] = rawTracks.map((t: any) => this.mapDbTrack(t));
    const computedFlontmieStreams =
      Number(a.flontmie_streams) ||
      mappedTracks.reduce((sum, t) => sum + (Number(t.flontmiePlays ?? t.streams) || 0), 0);

    return {
      id: a.id,
      name,
      avatarUrl: resolveArtworkUrl(a.avatar_url || a.avatarUrl, 'artist', name),
      headerUrl: resolveArtworkUrl(a.header_url || a.headerUrl || a.avatar_url, 'artist', name),
      bio: a.bio || '',
      bioSource: a.bio_source || a.bioSource || undefined,
      bioUrl: a.bio_url || a.bioUrl || undefined,
      wikidataId: a.wikidata_id || a.wikidataId || undefined,
      ytBrowseId: undefined,
      verified: Boolean(Number(a.verified ?? 0)),
      monthlyListeners: computedFlontmieStreams,
      ytMonthlyAudience: null,
      ytSubscribers: null,
      ytTotalViews: null,
      totalStreams: computedFlontmieStreams,
      flontmieStreams: computedFlontmieStreams,
      followers: a.followers !== null && a.followers !== undefined ? Number(a.followers) : 0,
      flontmieFollowers: Number(a.flontmie_followers ?? a.followers) || 0,
      label: a.label_name || a.label || '',
      distributorId: a.distributor_id || undefined,
      distributorName: a.distributor_name || a.created_by_distributor || undefined,
      claimedStatus: a.claimed_status === 'claimed' ? 'Claimed' : (a.claimed_status === 'pending' ? 'Pending Claim' : 'Unclaimed'),
      topTracks: mappedTracks.map((t) => t.id),
      popularSongs: mappedTracks,
      albums: Array.isArray(a.albums) ? a.albums.map((alb: any) => this.mapDiscographyItem(alb)) : [],
      singlesEps: Array.isArray(a.singles_eps) ? a.singles_eps.map((s: any) => this.mapDiscographyItem(s)) : [],
      featuredOn: Array.isArray(a.featured_on) ? a.featured_on.map((f: any) => this.mapDiscographyItem(f)) : [],
      playlists: Array.isArray(a.playlists) ? a.playlists.map((p: any) => this.mapDiscographyItem(p)) : [],
      relatedArtists: Array.isArray(a.related_artists) ? a.related_artists.map((r: any) => this.mapRelatedArtist(r)) : [],
      country: a.country || 'US',
      primaryGenre: a.primary_genre || (Array.isArray(a.genres) && a.genres[0]) || 'Music',
      socialLinks: a.social_links || {},
    };
  }

  // --- Fetch All Tracks (With Graceful Offline Fallback to Downloaded Device Tracks) ---
  public async getTracks(filters?: { genre?: string; q?: string; artist_id?: string; distributor_id?: string; label_id?: string }): Promise<Track[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.genre && filters.genre !== 'all') params.set('genre', filters.genre);
      if (filters?.q) params.set('q', filters.q);
      if (filters?.artist_id) params.set('artist_id', filters.artist_id);
      if (filters?.distributor_id) params.set('distributor_id', filters.distributor_id);
      if (filters?.label_id) params.set('label_id', filters.label_id);

      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const res = await this.request<{ status: string; tracks: any[] }>(`tracks.php${queryStr}`);
      if (res.status === 'success' && Array.isArray(res.tracks)) {
        return res.tracks.map((t) => this.mapDbTrack(t));
      }
    } catch (err) {
      const offlineTracks = nativePlatform.getDownloadedTracks();
      if (offlineTracks.length > 0) {
        return offlineTracks;
      }
      throw err;
    }
    return [];
  }

  // --- Increment Stream Counter in MySQL ---
  public async recordStream(trackId: string, progressSeconds: number = 0): Promise<void> {
    try {
      await this.request(`tracks.php?action=stream`, {
        method: 'POST',
        body: JSON.stringify({ track_id: trackId, progress_seconds: progressSeconds }),
      });
    } catch {
      // Ignore transient network errors during playback telemetry
    }
  }

  public async registerStream(trackId: string, progressSeconds: number = 0): Promise<void> {
    return this.recordStream(trackId, progressSeconds);
  }

  // --- Toggle Track Like ---
  public async toggleLikeTrack(
    trackId: string,
    mode?: 'like' | 'unlike' | 'toggle'
  ): Promise<{ status?: string; track_id?: string; liked: boolean; likes_count?: number }> {
    return this.request(`tracks.php?action=like`, {
      method: 'POST',
      body: JSON.stringify({ track_id: trackId, ...(mode ? { mode } : {}) }),
    });
  }

  public async toggleLike(
    trackId: string,
    mode?: 'like' | 'unlike' | 'toggle'
  ): Promise<{ status?: string; track_id?: string; liked: boolean; likes_count?: number }> {
    return this.toggleLikeTrack(trackId, mode);
  }

  // --- Synchronize Authoritative Likes, Comments & Counts Across Clients ---
  public async syncEngagement(trackId?: string): Promise<{
    status: string;
    counts: Record<string, { likes_count: number; comments_count: number; flontmie_plays: number }>;
    liked_track_ids: string[] | null;
    comments?: Array<{ id: string; user: string; text: string; time: string; user_id?: string }> | null;
  }> {
    const qs = trackId ? `&track_id=${encodeURIComponent(trackId)}` : '';
    const res = await this.request<any>(`tracks.php?action=engagement_sync${qs}`);
    let mappedComments: Array<{ id: string; user: string; text: string; time: string; user_id?: string }> | null = null;
    if (Array.isArray(res.comments)) {
      mappedComments = res.comments.map((c: any) => ({
        id: String(c.id),
        user: c.author_name || 'Listener',
        text: c.comment_text || c.body || '',
        time: c.created_at || '',
        user_id: c.user_id ? String(c.user_id) : undefined,
      }));
    }
    return {
      status: res.status || 'success',
      counts: res.counts || {},
      liked_track_ids: Array.isArray(res.liked_track_ids) ? res.liked_track_ids.map(String) : null,
      comments: mappedComments,
    };
  }

  // --- Dislike Track ---
  public async dislikeTrack(trackId: string): Promise<{ status: string; dislikes_count: number }> {
    return this.request(`tracks.php?action=dislike`, {
      method: 'POST',
      body: JSON.stringify({ track_id: trackId }),
    });
  }

  // --- Track Comments ---
  public async getTrackCommentsWithMeta(trackId: string): Promise<{
    comments: Array<{ id: string; user: string; text: string; time: string; user_id?: string }>;
    comments_count: number;
    likes_count?: number;
  }> {
    const res = await this.request<{
      status: string;
      comments: any[];
      comments_count?: number;
      likes_count?: number;
    }>(`tracks.php?action=comments&track_id=${encodeURIComponent(trackId)}`);
    const mapped = Array.isArray(res.comments)
      ? res.comments.map((c: any) => ({
          id: String(c.id),
          user: c.author_name || 'Listener',
          text: c.comment_text || c.body || '',
          time: c.created_at || '',
          user_id: c.user_id ? String(c.user_id) : undefined,
        }))
      : [];
    return {
      comments: mapped,
      comments_count: typeof res.comments_count === 'number' ? res.comments_count : mapped.length,
      likes_count: typeof res.likes_count === 'number' ? res.likes_count : undefined,
    };
  }

  public async getTrackComments(trackId: string): Promise<Array<{ id: string; user: string; text: string; time: string; user_id?: string }>> {
    try {
      const data = await this.getTrackCommentsWithMeta(trackId);
      return data.comments;
    } catch {}
    return [];
  }

  public async postTrackComment(
    trackId: string,
    text: string
  ): Promise<{ id: string; user: string; text: string; time: string; comments_count?: number; track_id?: string } | null> {
    const res = await this.request<{
      status: string;
      track_id?: string;
      comments_count?: number;
      comment: any;
    }>(`tracks.php?action=add_comment`, {
      method: 'POST',
      body: JSON.stringify({ track_id: trackId, text }),
    });
    if (res.status === 'success' && res.comment) {
      return {
        id: String(res.comment.id),
        user: res.comment.author_name || 'Listener',
        text: res.comment.comment_text || res.comment.body || text,
        time: res.comment.created_at || 'Just now',
        comments_count: typeof res.comments_count === 'number' ? res.comments_count : undefined,
        track_id: res.track_id || trackId,
      };
    }
    return null;
  }

  public async deleteTrackComment(commentId: string | number): Promise<{ status: string; comment_id: number; track_id: string; comments_count: number }> {
    return this.request(`tracks.php?action=delete_comment`, {
      method: 'POST',
      body: JSON.stringify({ comment_id: commentId }),
    });
  }

  // --- Create / Update / Delete Track ---
  public async createTrack(payload: any): Promise<any> {
    return this.request(`tracks.php?action=create`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async updateTrack(payload: any): Promise<any> {
    return this.request(`tracks.php?action=update`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async deleteTrack(trackId: string): Promise<any> {
    return this.request(`tracks.php?action=delete`, {
      method: 'POST',
      body: JSON.stringify({ track_id: trackId }),
    });
  }

  // --- Fetch Playlists ---
  public async getPlaylists(): Promise<Playlist[]> {
    const res = await this.request<{ status: string; playlists: any[] }>('playlists.php');
    if (res.status === 'success' && Array.isArray(res.playlists)) {
      return res.playlists.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description || '',
        coverUrl: resolveArtworkUrl(p.cover_art_url, 'playlist', p.title),
        trackIds: Array.isArray(p.track_ids) ? p.track_ids : [],
        curator: p.curator_name || 'Flontmie',
        curatorAvatar: p.curator_avatar || undefined,
        creatorId: p.user_id || undefined,
        creatorUsername: p.creator_username || undefined,
        creatorRole: p.creator_role || undefined,
        isAdminCreated: Boolean(p.is_admin_created),
        isPublic: Boolean(Number(p.is_public)),
        isCollaborative: false,
        followers: Number(p.followers || 0),
        category: (p.genre_category || 'all') as any,
        genreCategory: p.genre_category || 'all',
        createdAt: p.created_at || new Date().toISOString().split('T')[0],
        updatedAt: p.updated_at || undefined,
      }));
    }
    return [];
  }

  public async getPlaylistById(playlistId: string): Promise<{ playlist: Playlist; tracks: Track[] } | null> {
    try {
      const res = await this.request<{ status: string; playlist: any; tracks: any[] }>(
        `playlists.php?id=${encodeURIComponent(playlistId)}`
      );
      if (res.status === 'success' && res.playlist) {
        const p = res.playlist;
        const playlist: Playlist = {
          id: p.id,
          title: p.title,
          description: p.description || '',
          coverUrl: resolveArtworkUrl(p.cover_art_url, 'playlist', p.title),
          trackIds: Array.isArray(p.track_ids) ? p.track_ids : [],
          curator: p.curator_name || 'Flontmie',
          curatorAvatar: p.curator_avatar || undefined,
          creatorId: p.user_id || undefined,
          creatorUsername: p.creator_username || undefined,
          creatorRole: p.creator_role || undefined,
          isAdminCreated: Boolean(p.is_admin_created),
          isPublic: Boolean(Number(p.is_public)),
          isCollaborative: false,
          followers: Number(p.followers || 0),
          category: (p.genre_category || 'all') as any,
          genreCategory: p.genre_category || 'all',
          createdAt: p.created_at || new Date().toISOString().split('T')[0],
          updatedAt: p.updated_at || undefined,
        };
        const tracks = Array.isArray(res.tracks) ? res.tracks.map((t) => this.mapDbTrack(t)) : [];
        return { playlist, tracks };
      }
    } catch {}
    return null;
  }

  // --- Create Playlist in MySQL ---
  public async createPlaylist(playlist: {
    id?: string;
    title: string;
    description: string;
    cover_art_url?: string;
    genre_category?: string;
    is_public?: boolean;
    track_ids?: string[];
  }): Promise<{ status: string; id: string }> {
    return this.request('playlists.php?action=create', {
      method: 'POST',
      body: JSON.stringify(playlist),
    });
  }

  // --- Update Playlist Tracks in MySQL ---
  public async updatePlaylistTracks(playlistId: string, trackIds: string[], title?: string): Promise<void> {
    await this.request(`playlists.php?action=update&id=${encodeURIComponent(playlistId)}`, {
      method: 'POST',
      body: JSON.stringify({ id: playlistId, track_ids: trackIds, title }),
    });
  }

  public async deletePlaylist(playlistId: string): Promise<void> {
    await this.request(`playlists.php?action=delete&id=${encodeURIComponent(playlistId)}`, {
      method: 'POST',
      body: JSON.stringify({ id: playlistId }),
    });
  }

  // --- Fetch All Artists ---
  public async getArtists(filters?: { distributor_id?: string; label_id?: string; q?: string }): Promise<Record<string, ArtistProfile>> {
    const params = new URLSearchParams();
    if (filters?.distributor_id) params.set('distributor_id', filters.distributor_id);
    if (filters?.label_id) params.set('label_id', filters.label_id);
    if (filters?.q) params.set('q', filters.q);
    const qs = params.toString() ? `?${params.toString()}` : '';

    const res = await this.request<{ status: string; artists: any[] }>(`artists.php${qs}`);
    const map: Record<string, ArtistProfile> = {};
    if (res.status === 'success' && Array.isArray(res.artists)) {
      res.artists.forEach((a) => {
        map[a.id] = this.mapDbArtist(a);
      });
    }
    return map;
  }

  // --- Fetch Single Enriched Artist Profile & 6-Section Discography ---
  public async getArtistById(artistIdOrName: string): Promise<ArtistProfile | null> {
    try {
      const res = await this.request<{ status: string; artist: any }>(
        `artists.php?id=${encodeURIComponent(artistIdOrName)}`
      );
      if (res.status === 'success' && res.artist) {
        return this.mapDbArtist(res.artist);
      }
    } catch (err) {
      console.warn('getArtistById error:', err);
    }
    return null;
  }

  // --- Toggle Follow / Unfollow Artist ---
  public async toggleFollowArtist(artistId: string): Promise<{ following: boolean; followers_count: number }> {
    return this.request(`artists.php?action=follow`, {
      method: 'POST',
      body: JSON.stringify({ artist_id: artistId }),
    });
  }

  // --- Fetch Release (Album / EP / Single) Tracklist on Demand ---
  public async getReleaseTracks(browseId: string, title?: string, artist?: string, coverUrl?: string): Promise<{
    title: string;
    artist: string;
    coverUrl: string;
    tracks: Track[];
  } | null> {
    try {
      const params = new URLSearchParams({
        action: 'release_tracks',
        browse_id: browseId,
        title: title || '',
        artist: artist || '',
        cover_url: coverUrl || '',
      });
      const res = await this.request<{ status: string; release: any }>(`artists.php?${params.toString()}`);
      if (res.status === 'success' && res.release) {
        const r = res.release;
        return {
          title: r.title || title || 'Release',
          artist: r.artist || artist || 'Artist',
          coverUrl: resolveArtworkUrl(r.cover_url || coverUrl, 'album', r.title || title),
          tracks: Array.isArray(r.tracks) ? r.tracks.map((t: any) => this.mapDbTrack(t)) : [],
        };
      }
    } catch (err) {
      console.warn('getReleaseTracks error:', err);
    }
    return null;
  }

  // --- Artist Portal Dashboard ---
  public async getArtistDashboard(artistId?: string): Promise<any> {
    const qs = artistId ? `&artist_id=${encodeURIComponent(artistId)}` : '';
    return this.request(`artists.php?action=dashboard${qs}`);
  }

  public async updateArtistProfile(payload: any): Promise<any> {
    return this.request(`artists.php?action=update`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async saveArtistSplit(payload: { track_id: string; artist_id?: string; members: any[] }): Promise<any> {
    return this.request(`artists.php?action=save_split`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- Albums / Releases ---
  public async getAlbums(filters?: { artist_id?: string; distributor_id?: string; label_id?: string }): Promise<any[]> {
    const params = new URLSearchParams();
    if (filters?.artist_id) params.set('artist_id', filters.artist_id);
    if (filters?.distributor_id) params.set('distributor_id', filters.distributor_id);
    if (filters?.label_id) params.set('label_id', filters.label_id);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await this.request<{ status: string; albums: any[] }>(`albums.php${qs}`);
    return res.albums || [];
  }

  public async createAlbum(payload: any): Promise<any> {
    return this.request(`albums.php?action=create`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async updateAlbum(payload: any): Promise<any> {
    return this.request(`albums.php?action=update`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async deleteAlbum(albumId: string): Promise<any> {
    return this.request(`albums.php?action=delete`, {
      method: 'POST',
      body: JSON.stringify({ id: albumId }),
    });
  }

  // --- Auth Login / Register (Listener-Only Public Registration) ---
  public async login(email: string, password: string): Promise<any> {
    const res = await this.request<any>('auth.php?action=login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.token) {
      this.setToken(res.token, res.csrf_token);
    }
    return res;
  }

  public async register(payload: {
    email: string;
    username: string;
    password: string;
    display_name?: string;
    country?: string;
  }): Promise<any> {
    const res = await this.request<any>('auth.php?action=register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.token) {
      this.setToken(res.token, res.csrf_token);
    }
    return res;
  }

  public async getCurrentUser(): Promise<any> {
    const res = await this.request<any>('auth.php?action=me');
    if (res.user?.csrf_token) {
      this.csrfToken = res.user.csrf_token;
      if (typeof window !== 'undefined') {
        localStorage.setItem('flontmie_csrf', res.user.csrf_token);
      }
    }
    return res;
  }

  public async logout(): Promise<void> {
    try {
      await this.request('auth.php?action=logout', { method: 'POST' });
    } catch {}
    this.setToken(null, null);
  }

  public async updateProfile(payload: { display_name: string; country?: string; avatar_url?: string; bio?: string }): Promise<any> {
    return this.request('auth.php?action=update_profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async changePassword(currentPassword: string, newPassword: string): Promise<any> {
    return this.request('auth.php?action=change_password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
  }

  public async requestPasswordReset(email: string): Promise<any> {
    return this.request('auth.php?action=request_password_reset', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  public async confirmPasswordReset(email: string, code: string, newPassword: string): Promise<any> {
    return this.request('auth.php?action=confirm_password_reset', {
      method: 'POST',
      body: JSON.stringify({ email, code, new_password: newPassword }),
    });
  }

  public async getOnboardingData(): Promise<{
    status: string;
    genres: Array<{ id: string; name: string; slug: string }>;
    artists: Array<{ id: string; name: string; avatar_url: string; country?: string; verified?: number; followers?: number; genres?: string[] }>;
    legal: {
      platform_name: string;
      terms_version: string;
      privacy_version: string;
      effective_date: string;
      terms_sections: Array<{ heading: string; body: string }>;
      privacy_sections: Array<{ heading: string; body: string }>;
      system_settings?: Array<{ key: string; value: string; category: string; description: string; updated_at: string }>;
      role_permissions?: Array<any>;
    };
    user?: any;
  }> {
    return this.request('auth.php?action=onboarding_data');
  }

  public async saveOnboardingPreferences(payload: {
    favorite_genres?: string[];
    favorite_artist_ids?: string[];
  }): Promise<any> {
    return this.request('auth.php?action=save_onboarding', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async acceptTerms(payload: {
    accepted: boolean;
    terms_version: string;
    privacy_version?: string;
    favorite_genres?: string[];
    favorite_artist_ids?: string[];
  }): Promise<any> {
    return this.request('auth.php?action=accept_terms', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- Admin Governance APIs ---
  public async getAdminDashboard(): Promise<any> {
    return this.request('admin.php?action=dashboard');
  }

  public async updateAdminUser(payload: {
    user_id: string;
    role?: string;
    status?: 'active' | 'suspended' | 'banned';
    email_verified?: boolean;
    display_name?: string;
    distributor_id?: string | null;
    label_id?: string | null;
    artist_id?: string | null;
  }): Promise<any> {
    return this.request('admin.php?action=update_user', {
      method: 'POST',
      body: JSON.stringify({ ...payload, csrf_token: this.csrfToken }),
    });
  }

  public async createAdminUser(payload: {
    email: string;
    username?: string;
    display_name: string;
    password: string;
    role: string;
    country?: string;
    distributor_id?: string;
    label_id?: string;
    artist_id?: string;
    must_change_password?: boolean;
  }): Promise<any> {
    return this.request('admin.php?action=create_user', {
      method: 'POST',
      body: JSON.stringify({ ...payload, csrf_token: this.csrfToken }),
    });
  }

  public async deleteAdminUser(userId: string): Promise<any> {
    return this.request('admin.php?action=delete_user', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, csrf_token: this.csrfToken }),
    });
  }

  public async reviewAdminClaim(payload: {
    claim_id: string;
    decision: 'approved' | 'rejected' | 'escalated' | 'disputed';
    notes?: string;
  }): Promise<any> {
    return this.request('admin.php?action=review_claim', {
      method: 'POST',
      body: JSON.stringify({ ...payload, csrf_token: this.csrfToken }),
    });
  }

  public async createAdminArtist(payload: {
    name: string;
    stage_name?: string;
    bio?: string;
    country?: string;
    primary_genre?: string;
    avatar_url?: string;
    header_url?: string;
    label_id?: string;
    label_name?: string;
    distributor_id?: string;
    verified?: boolean;
    claimed_status?: string;
    claimed_user_id?: string;
  }): Promise<any> {
    return this.request('admin.php?action=create_artist', {
      method: 'POST',
      body: JSON.stringify({ ...payload, csrf_token: this.csrfToken }),
    });
  }

  public async updateAdminArtist(payload: {
    artist_id: string;
    verified?: boolean;
    claimed_status?: string;
    name?: string;
    bio?: string;
    country?: string;
    primary_genre?: string;
    avatar_url?: string;
    header_url?: string;
    label_id?: string;
    label_name?: string;
    distributor_id?: string;
  }): Promise<any> {
    return this.request('admin.php?action=update_artist', {
      method: 'POST',
      body: JSON.stringify({ ...payload, csrf_token: this.csrfToken }),
    });
  }

  public async deleteAdminArtist(artistId: string): Promise<any> {
    return this.request('admin.php?action=delete_artist', {
      method: 'POST',
      body: JSON.stringify({ artist_id: artistId, csrf_token: this.csrfToken }),
    });
  }

  public async createAdminTrack(payload: {
    title: string;
    artist_id?: string;
    artist_name?: string;
    album_id?: string;
    album_name?: string;
    genre?: string;
    country?: string;
    duration?: number;
    bpm?: number;
    isrc?: string;
    upc?: string;
    release_date?: string;
    cover_art_url?: string;
    audio_url?: string;
    video_url?: string;
    lyrics?: string;
    explicit?: boolean;
    featured_on_home?: boolean;
    status?: string;
    distributor_id?: string;
    label_id?: string;
  }): Promise<any> {
    return this.request('admin.php?action=create_track', {
      method: 'POST',
      body: JSON.stringify({ ...payload, csrf_token: this.csrfToken }),
    });
  }

  public async updateAdminTrack(payload: {
    track_id: string;
    status?: string;
    featured_on_home?: boolean;
    title?: string;
    artist_name?: string;
    album_name?: string;
    genre?: string;
    country?: string;
    release_year?: number;
    isrc?: string;
    upc?: string;
    explicit?: boolean;
    license_status?: string;
    cover_art_url?: string;
    audio_url?: string;
    video_url?: string;
    lyrics?: string;
    delete_permanently?: boolean;
  }): Promise<any> {
    return this.request('admin.php?action=update_track', {
      method: 'POST',
      body: JSON.stringify({ ...payload, csrf_token: this.csrfToken }),
    });
  }

  public async createAdminAlbum(payload: {
    title: string;
    artist_id?: string;
    artist_name?: string;
    release_type?: 'album' | 'ep' | 'single';
    genre?: string;
    release_date?: string;
    cover_art_url?: string;
    upc?: string;
    status?: string;
    distributor_id?: string;
    label_id?: string;
  }): Promise<any> {
    return this.request('admin.php?action=create_album', {
      method: 'POST',
      body: JSON.stringify({ ...payload, csrf_token: this.csrfToken }),
    });
  }

  public async updateAdminAlbum(payload: {
    album_id: string;
    status?: string;
    title?: string;
    artist_name?: string;
    genre?: string;
    release_type?: string;
    release_date?: string;
    upc?: string;
    cover_art_url?: string;
    delete?: boolean;
  }): Promise<any> {
    return this.request('admin.php?action=update_album', {
      method: 'POST',
      body: JSON.stringify({ ...payload, csrf_token: this.csrfToken }),
    });
  }

  public async updateAdminDistributor(payload: any): Promise<any> {
    return this.request('admin.php?action=update_distributor', {
      method: 'POST',
      body: JSON.stringify({ ...payload, csrf_token: this.csrfToken }),
    });
  }

  public async deleteAdminDistributor(id: string): Promise<any> {
    return this.request('admin.php?action=delete_distributor', {
      method: 'POST',
      body: JSON.stringify({ id, csrf_token: this.csrfToken }),
    });
  }

  public async updateAdminLabel(payload: any): Promise<any> {
    return this.request('admin.php?action=update_label', {
      method: 'POST',
      body: JSON.stringify({ ...payload, csrf_token: this.csrfToken }),
    });
  }

  public async deleteAdminLabel(id: string): Promise<any> {
    return this.request('admin.php?action=delete_label', {
      method: 'POST',
      body: JSON.stringify({ id, csrf_token: this.csrfToken }),
    });
  }

  public async updateAdminRolePermission(payload: any): Promise<any> {
    return this.request('admin.php?action=update_role_permission', {
      method: 'POST',
      body: JSON.stringify({ ...payload, csrf_token: this.csrfToken }),
    });
  }

  public async resolveAdminReport(payload: {
    report_id: string;
    status: string;
    resolution_notes?: string;
    enforce_action?: string;
  }): Promise<any> {
    return this.request('admin.php?action=resolve_report', {
      method: 'POST',
      body: JSON.stringify({ ...payload, csrf_token: this.csrfToken }),
    });
  }

  public async createAdminReport(payload: {
    target_type: string;
    target_id: string;
    target_name: string;
    category: string;
    reason: string;
  }): Promise<any> {
    return this.request('admin.php?action=create_report', {
      method: 'POST',
      body: JSON.stringify({ ...payload, csrf_token: this.csrfToken }),
    });
  }

  public async createAdminPlaylist(payload: {
    title: string;
    description?: string;
    cover_art_url?: string;
    genre_category?: string;
    is_public?: boolean;
    is_featured?: boolean;
    track_ids?: string[];
  }): Promise<any> {
    return this.request('admin.php?action=create_playlist', {
      method: 'POST',
      body: JSON.stringify({ ...payload, csrf_token: this.csrfToken }),
    });
  }

  public async updateAdminPlaylist(payload: {
    playlist_id: string;
    title?: string;
    description?: string;
    cover_art_url?: string;
    genre_category?: string;
    is_featured?: boolean;
    is_public?: boolean;
    status?: string;
    track_ids?: string[];
    delete?: boolean;
  }): Promise<any> {
    return this.request('admin.php?action=update_playlist', {
      method: 'POST',
      body: JSON.stringify({ ...payload, csrf_token: this.csrfToken }),
    });
  }

  public async saveAdminGenre(payload: {
    id?: string;
    name: string;
    description?: string;
    color_theme?: string;
    is_featured?: boolean;
    display_order?: number;
  }): Promise<any> {
    return this.request('admin.php?action=save_genre', {
      method: 'POST',
      body: JSON.stringify({ ...payload, csrf_token: this.csrfToken }),
    });
  }

  public async deleteAdminGenre(id: string): Promise<any> {
    return this.request('admin.php?action=delete_genre', {
      method: 'POST',
      body: JSON.stringify({ id, csrf_token: this.csrfToken }),
    });
  }

  public async updateAdminSettings(settings: Record<string, string>): Promise<any> {
    return this.request('admin.php?action=update_settings', {
      method: 'POST',
      body: JSON.stringify({ settings, csrf_token: this.csrfToken }),
    });
  }

  public async revokeAdminSession(sessionIdOrPayload: string | { session_id: string }): Promise<any> {
    const sessionId = typeof sessionIdOrPayload === 'string' ? sessionIdOrPayload : sessionIdOrPayload.session_id;
    return this.request('admin.php?action=revoke_session', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, csrf_token: this.csrfToken }),
    });
  }

  public async clearAdminSecurityEvents(): Promise<any> {
    return this.request('admin.php?action=clear_security_events', {
      method: 'POST',
      body: JSON.stringify({ csrf_token: this.csrfToken }),
    });
  }

  // --- Admin Visibility: Searchable, Paginated Playlists, User Activity, User Profiles & Engagement ---
  public async getAdminPlaylists(params: {
    q?: string;
    creator_type?: 'all' | 'admin' | 'user';
    visibility?: 'all' | 'public' | 'private';
    user_id?: string;
    page?: number;
    per_page?: number;
  } = {}): Promise<any> {
    const qs = new URLSearchParams({ action: 'playlists' });
    if (params.q) qs.set('q', params.q);
    if (params.creator_type) qs.set('creator_type', params.creator_type);
    if (params.visibility) qs.set('visibility', params.visibility);
    if (params.user_id) qs.set('user_id', params.user_id);
    if (params.page) qs.set('page', String(params.page));
    if (params.per_page) qs.set('per_page', String(params.per_page));
    return this.request(`admin.php?${qs.toString()}`);
  }

  public async getAdminPlaylistDetail(playlistId: string): Promise<any> {
    return this.request(`admin.php?action=playlist_detail&playlist_id=${encodeURIComponent(playlistId)}`);
  }

  public async getAdminActivities(params: {
    q?: string;
    user_id?: string;
    action_type?: string;
    target_type?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    per_page?: number;
  } = {}): Promise<any> {
    const qs = new URLSearchParams({ action: 'activities' });
    if (params.q) qs.set('q', params.q);
    if (params.user_id) qs.set('user_id', params.user_id);
    if (params.action_type) qs.set('action_type', params.action_type);
    if (params.target_type) qs.set('target_type', params.target_type);
    if (params.date_from) qs.set('date_from', params.date_from);
    if (params.date_to) qs.set('date_to', params.date_to);
    if (params.page) qs.set('page', String(params.page));
    if (params.per_page) qs.set('per_page', String(params.per_page));
    return this.request(`admin.php?${qs.toString()}`);
  }

  public async getAdminUserDetail(params: {
    user_id: string;
    action_type?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    per_page?: number;
  }): Promise<any> {
    const qs = new URLSearchParams({ action: 'user_detail', user_id: params.user_id });
    if (params.action_type) qs.set('action_type', params.action_type);
    if (params.date_from) qs.set('date_from', params.date_from);
    if (params.date_to) qs.set('date_to', params.date_to);
    if (params.page) qs.set('page', String(params.page));
    if (params.per_page) qs.set('per_page', String(params.per_page));
    return this.request(`admin.php?${qs.toString()}`);
  }

  public async getAdminEngagement(params: {
    q?: string;
    track_id?: string;
    user_id?: string;
    page?: number;
    per_page?: number;
  } = {}): Promise<any> {
    const qs = new URLSearchParams({ action: 'engagement' });
    if (params.q) qs.set('q', params.q);
    if (params.track_id) qs.set('track_id', params.track_id);
    if (params.user_id) qs.set('user_id', params.user_id);
    if (params.page) qs.set('page', String(params.page));
    if (params.per_page) qs.set('per_page', String(params.per_page));
    return this.request(`admin.php?${qs.toString()}`);
  }

  public async deleteAdminComment(commentId: number | string): Promise<any> {
    return this.request('admin.php?action=delete_comment', {
      method: 'POST',
      body: JSON.stringify({ comment_id: commentId, csrf_token: this.csrfToken }),
    });
  }

  // --- Distributor Portal Operations (Scoped to Authorized Distributor) ---
  public async getDistributorDashboard(): Promise<any> {
    return this.request('distributor.php?action=overview');
  }

  public async createDistributorArtist(payload: {
    name: string;
    stage_name?: string;
    bio?: string;
    country?: string;
    primary_genre?: string;
    label_id?: string;
    label_name?: string;
    avatar_url?: string;
    header_url?: string;
    instagram?: string;
    twitter?: string;
    website?: string;
  }): Promise<any> {
    return this.request('distributor.php?action=create_artist', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async updateDistributorArtist(payload: any): Promise<any> {
    return this.request('distributor.php?action=update_artist', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async deleteDistributorArtist(artistId: string): Promise<any> {
    return this.request('distributor.php?action=delete_artist', {
      method: 'POST',
      body: JSON.stringify({ artist_id: artistId }),
    });
  }

  public async createDistributorLabel(payload: {
    name: string;
    contact_email?: string;
    country?: string;
  }): Promise<any> {
    return this.request('distributor.php?action=create_label', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async updateDistributorLabel(payload: any): Promise<any> {
    return this.request('distributor.php?action=update_label', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async deleteDistributorLabel(labelId: string): Promise<any> {
    return this.request('distributor.php?action=delete_label', {
      method: 'POST',
      body: JSON.stringify({ label_id: labelId }),
    });
  }

  public async createDistributorRelease(payload: {
    title: string;
    artist_id: string;
    release_type?: 'single' | 'ep' | 'album';
    genre?: string;
    release_date?: string;
    upc?: string;
    label_id?: string;
    cover_art_url?: string;
  }): Promise<any> {
    return this.request('distributor.php?action=create_release', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async updateDistributorTrack(payload: any): Promise<any> {
    return this.request('distributor.php?action=update_track', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async deleteDistributorTrack(trackId: string): Promise<any> {
    return this.request('distributor.php?action=delete_track', {
      method: 'POST',
      body: JSON.stringify({ track_id: trackId }),
    });
  }

  public async submitArtistClaim(payload: {
    artist_id: string;
    claimant_name: string;
    claimant_email: string;
    evidence_type: string;
    evidence_details: string;
    proof_url?: string;
  }): Promise<any> {
    return this.request('distributor.php?action=submit_claim', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- Record Label Portal Operations ---
  public async getLabelDashboard(): Promise<any> {
    return this.request('label.php?action=overview');
  }

  public async createLabelArtist(payload: {
    name: string;
    stage_name?: string;
    bio?: string;
    country?: string;
    primary_genre?: string;
    avatar_url?: string;
    advance_amount?: number;
    recouped_amount?: number;
    roster_status?: string;
  }): Promise<any> {
    return this.request('label.php?action=create_artist', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async updateLabelArtist(payload: any): Promise<any> {
    return this.request('label.php?action=update_artist', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async createLabelRelease(payload: {
    title: string;
    artist_id: string;
    release_type?: string;
    genre?: string;
    release_date?: string;
    upc?: string;
    cover_art_url?: string;
    status?: string;
  }): Promise<any> {
    return this.request('label.php?action=create_release', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- Multipart Media Upload with Real Progress Tracking (Audio, Artwork, Video, Lyrics) ---
  public uploadReleaseMultipartWithProgress(
    formData: FormData,
    onProgress?: (percent: number) => void
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/upload.php`, true);

      if (this.token) {
        xhr.setRequestHeader('Authorization', `Bearer ${this.token}`);
      }
      if (this.csrfToken) {
        xhr.setRequestHeader('X-CSRF-Token', this.csrfToken);
      }

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const pct = Math.round((event.loaded / event.total) * 100);
            onProgress(pct);
          }
        };
      }

      xhr.onload = () => {
        let data: any = null;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {}
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject(new Error((data && data.message) || `Upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error occurred during file upload.'));
      };

      xhr.send(formData);
    });
  }

  // --- Catalog Lyrics & Admin/Distributor Storage Sync APIs ---
  public async getTrackLyrics(
    trackId: string,
    extra?: { trackId?: string; title?: string; artist?: string }
  ): Promise<{ status: string; lyrics: string | null; synced?: boolean; source?: string }> {
    const params = new URLSearchParams({
      action: 'lyrics',
      track_id: extra?.trackId || trackId || '',
    });
    if (extra?.title) params.set('title', extra.title);
    if (extra?.artist) params.set('artist', extra.artist);
    return this.request(`tracks.php?${params.toString()}`);
  }

  public async syncAllStorage(): Promise<any> {
    return this.request('media_scanner.php?action=scan_now', {
      method: 'POST',
      body: JSON.stringify({ batch_size: 50, csrf_token: this.csrfToken }),
    });
  }

  public async uploadMediaFile(file: File, mediaType: 'audio' | 'artwork', trackId?: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('media_type', mediaType);
    if (trackId) {
      formData.append('track_id', trackId);
    }

    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    if (this.csrfToken) {
      headers['X-CSRF-Token'] = this.csrfToken;
    }

    const response = await fetch(`${API_BASE}/youtube_music.php?action=upload_media_file`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error((data && data.message) || `Upload Error: ${response.status}`);
    }
    return data;
  }

  public async bulkUpdateAdminTracks(trackIds: string[], bulkAction: 'publish' | 'unpublish' | 'verify_license' | 'resync_audio' | 'delete'): Promise<any> {
    return this.request('admin.php?action=bulk_update_tracks', {
      method: 'POST',
      body: JSON.stringify({ track_ids: trackIds, bulk_action: bulkAction, csrf_token: this.csrfToken }),
    });
  }

  // --- Media Scanner & Auto-Matching Admin APIs ---
  public async getMediaScannerStatus(): Promise<any> {
    return this.request('media_scanner.php?action=status');
  }

  public async getMediaScannerFiles(params: {
    status?: string;
    media_type?: string;
    q?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<any> {
    const qs = new URLSearchParams({ action: 'files' });
    if (params.status) qs.set('status', params.status);
    if (params.media_type) qs.set('media_type', params.media_type);
    if (params.q) qs.set('q', params.q);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    return this.request(`media_scanner.php?${qs.toString()}`);
  }

  public async startMediaScanNow(batchSize: number = 25): Promise<any> {
    return this.request('media_scanner.php?action=scan_now', {
      method: 'POST',
      body: JSON.stringify({ batch_size: batchSize, csrf_token: this.csrfToken }),
    });
  }

  public async resumeMediaScan(batchSize: number = 25): Promise<any> {
    return this.request('media_scanner.php?action=resume_scan', {
      method: 'POST',
      body: JSON.stringify({ batch_size: batchSize, csrf_token: this.csrfToken }),
    });
  }

  public async runMediaScanBatch(batchSize: number = 25): Promise<any> {
    return this.request('media_scanner.php?action=scan_batch', {
      method: 'POST',
      body: JSON.stringify({ batch_size: batchSize, csrf_token: this.csrfToken }),
    });
  }

  public async manualLinkMediaFile(fileId: string, trackId: string): Promise<any> {
    return this.request('media_scanner.php?action=manual_link', {
      method: 'POST',
      body: JSON.stringify({ file_id: fileId, track_id: trackId, csrf_token: this.csrfToken }),
    });
  }

  public async unlinkMediaFile(fileId: string): Promise<any> {
    return this.request('media_scanner.php?action=unlink', {
      method: 'POST',
      body: JSON.stringify({ file_id: fileId, csrf_token: this.csrfToken }),
    });
  }

  public async searchCatalogForMediaMatch(query: string): Promise<any> {
    return this.request(`media_scanner.php?action=search_tracks&q=${encodeURIComponent(query)}`);
  }

  public async hydrateSavedTokens(): Promise<void> {
    const stored = await nativePlatform.getStoredAuthTokens();
    if (stored.token) {
      this.setToken(stored.token, stored.csrfToken);
    }
  }

  public async getSearchSuggestions(query: string): Promise<Array<{
    text: string;
    type: 'query' | 'song' | 'artist' | 'album';
    artist?: string;
    track_id?: string;
    cover_url?: string;
  }>> {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    try {
      const tracks = await this.getTracks({ q });
      const items: Array<{
        text: string;
        type: 'query' | 'song' | 'artist' | 'album';
        artist?: string;
        track_id?: string;
        cover_url?: string;
      }> = [];
      const seenArtists = new Set<string>();
      for (const t of tracks.slice(0, 8)) {
        items.push({
          text: t.title,
          type: 'song',
          artist: t.artist,
          track_id: t.id,
          cover_url: t.coverUrl,
        });
        if (t.artist && !seenArtists.has(t.artist.toLowerCase())) {
          seenArtists.add(t.artist.toLowerCase());
          items.push({
            text: t.artist,
            type: 'artist',
            cover_url: t.coverUrl,
          });
        }
      }
      return items.slice(0, 8);
    } catch {
      return [];
    }
  }

  public async uploadTrack(payload: {
    title: string;
    artist: string;
    album?: string;
    genre?: string;
    lyrics?: string;
    audioFile?: File | null;
    videoFile?: File | null;
    lyricsFile?: File | null;
    artworkFile?: File | null;
  }): Promise<any> {
    const formData = new FormData();
    formData.append('title', payload.title);
    formData.append('artist_name', payload.artist);
    formData.append('album_name', payload.album || 'Single');
    formData.append('genre', payload.genre || 'Afrobeats');
    if (payload.lyrics) {
      formData.append('lyrics', payload.lyrics);
    }
    if (payload.audioFile) {
      formData.append('audio_file', payload.audioFile);
    }
    if (payload.videoFile) {
      formData.append('video_file', payload.videoFile);
    }
    if (payload.lyricsFile) {
      formData.append('lyrics_file', payload.lyricsFile);
    }
    if (payload.artworkFile) {
      formData.append('artwork_file', payload.artworkFile);
    }
    return this.uploadReleaseMultipartWithProgress(formData);
  }

  public async retryImportJob(jobId: string): Promise<any> {
    return this.request('admin.php?action=retry_import_job', {
      method: 'POST',
      body: JSON.stringify({ job_id: jobId, csrf_token: this.csrfToken }),
    });
  }

  public async cancelImportJob(jobId: string): Promise<any> {
    return this.request('admin.php?action=cancel_import_job', {
      method: 'POST',
      body: JSON.stringify({ job_id: jobId, csrf_token: this.csrfToken }),
    });
  }
}

export const api = new FlontmieApiService();
