/**
 * Flontmie Production API Client
 * Connects frontend directly to the PHP / MySQL backend
 */

import { Track, Playlist, ArtistProfile } from '../types/music';

// In production, API is served under /phpbackend/api
const API_BASE = '/phpbackend/api';

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = typeof window !== 'undefined' ? localStorage.getItem('flontmie_token') : null;
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('flontmie_token', token);
    } else {
      localStorage.removeItem('flontmie_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API request failed: ${response.status}`);
    }

    return response.json();
  }

  // --- HEALTH & STATUS ---
  public async getHealth() {
    return this.request<{ status: string; db_status: string; table_counts: Record<string, number> }>('/health.php');
  }

  // --- TRACKS ---
  public async getTracks(params?: { genre?: string; q?: string; artist_id?: string }): Promise<Track[]> {
    try {
      const query = new URLSearchParams();
      if (params?.genre) query.append('genre', params.genre);
      if (params?.q) query.append('q', params.q);
      if (params?.artist_id) query.append('artist_id', params.artist_id);

      const res = await this.request<{ status: string; tracks: any[] }>(`/tracks.php?${query.toString()}`);
      if (res && Array.isArray(res.tracks) && res.tracks.length > 0) {
        return res.tracks.map(t => ({
          id: t.id,
          title: t.title,
          artist: t.artist_name,
          artistId: t.artist_id,
          album: t.album_name || 'Single',
          duration: Number(t.duration) || 180,
          genre: t.genre,
          coverUrl: t.cover_art_url,
          audioUrl: t.audio_url,
          streams: Number(t.stream_count) || 0,
          likes: Number(t.likes_count) || 0,
          releaseDate: t.release_date || new Date().toISOString().split('T')[0],
          lyrics: t.lyrics,
          isrc: t.isrc || 'USFLM2026001',
          upc: '012345678901',
          label: 'Flontmie Music',
          distributor: 'TuneCore Direct',
          isExplicit: Boolean(Number(t.explicit)),
          scale: t.scale,
          bpm: Number(t.bpm) || 120,
          moods: ['trending', 'party'] as any[],
          moodTags: t.mood_tags || [t.genre]
        }));
      }
    } catch (e) {
      console.warn('Backend tracks fetch error, falling back:', e);
    }
    return [];
  }

  public async registerStream(trackId: string): Promise<void> {
    try {
      await this.request(`/tracks.php?action=stream&id=${encodeURIComponent(trackId)}`, {
        method: 'POST'
      });
    } catch (e) {
      console.warn('Stream count API register error:', e);
    }
  }

  public async toggleLike(trackId: string): Promise<{ liked: boolean }> {
    try {
      const res = await this.request<{ liked: boolean }>(`/tracks.php?action=like&id=${encodeURIComponent(trackId)}`, {
        method: 'POST'
      });
      return res;
    } catch (e) {
      return { liked: false };
    }
  }

  // --- ARTISTS ---
  public async getArtists(): Promise<ArtistProfile[]> {
    try {
      const res = await this.request<{ status: string; artists: any[] }>('/artists.php');
      if (res && Array.isArray(res.artists)) {
        return res.artists.map(a => ({
          id: a.id,
          name: a.name,
          avatarUrl: a.avatar_url,
          headerUrl: a.header_url,
          bio: a.bio,
          verified: Boolean(Number(a.verified)),
          monthlyListeners: Number(a.monthly_listeners) || 0,
          totalStreams: Number(a.total_streams) || 0,
          followers: Number(a.followers) || 0,
          label: a.label_name || 'Independent',
          topTracks: [],
          albums: [],
          genres: a.genres || [],
          country: 'NG',
          socialLinks: a.social_links || {},
          distributorName: a.distributor_name || 'TuneCore Direct',
          claimedStatus: a.claimed_status || 'unclaimed',
          claimedUserId: a.claimed_user_id
        }));
      }
    } catch (e) {
      console.warn('Backend artists fetch error:', e);
    }
    return [];
  }

  // --- PLAYLISTS ---
  public async getPlaylists(): Promise<Playlist[]> {
    try {
      const res = await this.request<{ status: string; playlists: any[] }>('/playlists.php');
      if (res && Array.isArray(res.playlists)) {
        return res.playlists.map(p => {
          let trackIds: string[] = [];
          if (Array.isArray(p.track_ids)) {
            trackIds = p.track_ids;
          } else if (Array.isArray(p.track_ids_json)) {
            trackIds = p.track_ids_json;
          } else if (typeof p.track_ids_json === 'string' && p.track_ids_json.trim()) {
            try {
              const parsed = JSON.parse(p.track_ids_json);
              trackIds = Array.isArray(parsed) ? parsed : [];
            } catch {
              trackIds = [];
            }
          }

          const pid = String(p.id || '');
          let genreCat = p.genre_category || p.category;
          if (!genreCat) {
            if (pid.includes('love')) genreCat = 'love_songs';
            else if (pid.includes('old')) genreCat = 'old_school';
            else if (pid.includes('work')) genreCat = 'workout';
            else if (pid.includes('focus') || pid.includes('chill')) genreCat = 'coding';
            else if (pid.includes('road')) genreCat = 'road_trip';
            else genreCat = 'all';
          }

          return {
            id: pid,
            title: p.title || 'Curated Collection',
            description: p.description || '',
            coverUrl: p.cover_art_url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
            curator: p.curator || 'Flontmie Editorial',
            trackIds,
            category: (p.category || 'trending') as any,
            genreCategory: genreCat,
            isPublic: Boolean(Number(p.is_public ?? 1)),
            isCollaborative: Boolean(Number(p.is_collaborative ?? 0)),
            followers: Number(p.followers) || 142000,
            createdAt: p.created_at || new Date().toISOString().split('T')[0]
          };
        });
      }
    } catch (e) {
      console.warn('Backend playlists fetch error:', e);
    }
    return [];
  }

  public async getPlaylistById(id: string): Promise<{ playlist: Playlist; tracks: Track[] } | null> {
    try {
      const res = await this.request<{ status: string; playlist: any }>(`/playlists.php?id=${encodeURIComponent(id)}`);
      if (res && res.playlist) {
        const p = res.playlist;
        let trackIds: string[] = [];
        if (Array.isArray(p.track_ids)) {
          trackIds = p.track_ids;
        } else if (typeof p.track_ids_json === 'string' && p.track_ids_json.trim()) {
          try {
            const parsed = JSON.parse(p.track_ids_json);
            trackIds = Array.isArray(parsed) ? parsed : [];
          } catch {
            trackIds = [];
          }
        }

        const rawTracks = Array.isArray(p.tracks) ? p.tracks : [];
        const mappedTracks: Track[] = rawTracks.map((t: any) => ({
          id: t.id,
          title: t.title,
          artist: t.artist_name || t.artist || 'Unknown Artist',
          artistId: t.artist_id || 'art_unknown',
          album: t.album_name || t.album || 'Single',
          duration: Number(t.duration) || 180,
          genre: t.genre || 'Pop',
          coverUrl: t.cover_art_url || t.coverUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
          audioUrl: t.audio_url || t.audioUrl || '',
          streams: Number(t.stream_count || t.streams || 0),
          likes: Number(t.likes_count || t.likes || 0),
          releaseDate: t.release_date || new Date().toISOString().split('T')[0],
          lyrics: t.lyrics,
          isrc: t.isrc || 'USFLM2026001',
          upc: '012345678901',
          label: 'Flontmie Music',
          distributor: 'TuneCore Direct',
          isExplicit: Boolean(Number(t.explicit)),
          scale: t.scale,
          bpm: Number(t.bpm) || 120,
          moods: ['trending', 'party'] as any[],
          moodTags: t.mood_tags || [t.genre || 'Pop']
        }));

        const pid = String(p.id || '');
        let genreCat = p.genre_category || p.category;
        if (!genreCat) {
          if (pid.includes('love')) genreCat = 'love_songs';
          else if (pid.includes('old')) genreCat = 'old_school';
          else if (pid.includes('work')) genreCat = 'workout';
          else if (pid.includes('focus') || pid.includes('chill')) genreCat = 'coding';
          else if (pid.includes('road')) genreCat = 'road_trip';
          else genreCat = 'all';
        }

        return {
          playlist: {
            id: pid,
            title: p.title || 'Curated Collection',
            description: p.description || '',
            coverUrl: p.cover_art_url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
            curator: p.curator || 'Flontmie Editorial',
            trackIds,
            category: (p.category || 'trending') as any,
            genreCategory: genreCat,
            isPublic: Boolean(Number(p.is_public ?? 1)),
            isCollaborative: Boolean(Number(p.is_collaborative ?? 0)),
            followers: Number(p.followers) || 142000,
            createdAt: p.created_at || new Date().toISOString().split('T')[0]
          },
          tracks: mappedTracks
        };
      }
    } catch (e) {
      console.warn('Backend single playlist fetch error:', e);
    }
    return null;
  }

  // --- AUTH ---
  public async login(login: string, password: string) {
    const res = await this.request<{ status: string; token: string; user: any }>('/auth.php?action=login', {
      method: 'POST',
      body: JSON.stringify({ login, password })
    });
    if (res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  public async getCurrentUser() {
    return this.request<{ status: string; user: any }>('/auth.php?action=me');
  }

  // --- DISTRIBUTOR & CLAIMS ---
  public async getDistributorClaims() {
    return this.request<{ status: string; claims: any[] }>('/distributor.php?action=claims');
  }

  public async reviewClaim(claimId: string, decision: 'approved' | 'rejected' | 'escalated', notes?: string) {
    return this.request<{ status: string; message: string }>('/distributor.php?action=review_claim', {
      method: 'POST',
      body: JSON.stringify({ claim_id: claimId, decision, notes })
    });
  }

  public async submitArtistClaim(artistId: string, evidenceType: string, evidenceDetails: string, proofUrl?: string) {
    return this.request<{ status: string; message: string; claim_id: string }>(`/artists.php?action=claim&id=${encodeURIComponent(artistId)}`, {
      method: 'POST',
      body: JSON.stringify({
        evidence_type: evidenceType,
        evidence_details: evidenceDetails,
        proof_url: proofUrl
      })
    });
  }

  // --- ADMIN ---
  public async getAdminStats() {
    return this.request<{ status: string; stats: any }>('/admin.php?action=stats');
  }

  public async getAdminUsers() {
    return this.request<{ status: string; users: any[] }>('/admin.php?action=users');
  }

  public async updateUserRole(userId: string, role: string) {
    return this.request<{ status: string; message: string }>('/admin.php?action=update_role', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, role })
    });
  }

  // --- YOUTUBE MUSIC DISCOVERY API (ytmusicapi standard) ---
  public async searchYouTubeMusic(query: string, filter?: 'songs' | 'artists' | 'albums' | 'playlists') {
    const filterParam = filter ? `&filter=${filter}` : '';
    return this.request<{
      status: string;
      query: string;
      results: {
        songs: any[];
        artists: any[];
        albums: any[];
        playlists: any[];
      };
      total_count: number;
    }>(`/youtube_music.php?action=search&q=${encodeURIComponent(query)}${filterParam}`);
  }

  public async getYouTubeMusicCharts() {
    return this.request<{
      status: string;
      count: number;
      charts: Array<{
        id: string;
        videoId?: string;
        title: string;
        artist: string;
        cover_url: string;
        shelf: string;
        streams: number;
      }>;
    }>('/youtube_music.php?action=charts');
  }

  public async getYouTubeMusicMoods() {
    return this.request<{
      status: string;
      count: number;
      moods_and_genres: Array<{
        name: string;
        browseId: string;
        color: string;
      }>;
    }>('/youtube_music.php?action=moods');
  }

  public async getYouTubeMusicLyrics(videoId: string) {
    return this.request<{
      status: string;
      videoId: string;
      lyrics: string;
      source: string;
    }>(`/youtube_music.php?action=lyrics&videoId=${encodeURIComponent(videoId)}`);
  }

  public async importYouTubeMusicTrack(trackData: {
    title: string;
    artist: string;
    album?: string;
    genre?: string;
    duration?: number;
    cover_url?: string;
    audio_url?: string;
    videoId?: string;
    lyrics?: string;
  }) {
    return this.request<{ status: string; message: string; track: Track }>('/youtube_music.php?action=import', {
      method: 'POST',
      body: JSON.stringify(trackData)
    });
  }

  // Fallback public music search
  public async searchPublicMusic(query: string) {
    return this.searchYouTubeMusic(query);
  }

  public async importPublicTrack(trackData: any) {
    return this.importYouTubeMusicTrack(trackData);
  }
}

export const api = new ApiService();
