import { 
  Track, 
  Playlist, 
  ArtistProfile, 
  LabelArtist, 
  ReleaseScheduleItem, 
  FeaturedAccount,
  DistributorIngestionItem,
  DistributorAccessGrant,
  AdminRolePermission
} from '../types/music';

import synthwaveCover from '../assets/images/cover_synthwave_neon_1791398427032.jpg';
import lofiCover from '../assets/images/cover_lofi_aesthetic_1791398438421.jpg';
import afrobeatsCover from '../assets/images/cover_afrobeats_sunset_1791398448268.jpg';
import ambientCover from '../assets/images/cover_ambient_space_1791398457534.jpg';
import partyMixCover from '../assets/images/cover_partymix_club_1791399957935.jpg';
import seriesCover from '../assets/images/cover_series_chronicles_1791399970443.jpg';

// Fallback artwork assets only (never used for fake catalog records)
export const IMAGES = {
  synthwave: synthwaveCover,
  lofi: lofiCover,
  afrobeats: afrobeatsCover,
  ambient: ambientCover,
  partyMix: partyMixCover,
  series: seriesCover,
};

// Zero mock data: all application entities come strictly from the MySQL database & live APIs
export const INITIAL_TRACKS: Track[] = [];
export const INITIAL_PLAYLISTS: Playlist[] = [];
export const ARTIST_PROFILES: Record<string, ArtistProfile> = {};
export const LABEL_ARTISTS: LabelArtist[] = [];
export const UPCOMING_RELEASES: ReleaseScheduleItem[] = [];
export const FEATURED_ACCOUNTS: FeaturedAccount[] = [];
export const DISTRIBUTOR_INGESTIONS: DistributorIngestionItem[] = [];
export const DISTRIBUTOR_ACCESS_GRANTS: DistributorAccessGrant[] = [];
export const ADMIN_ROLE_PERMISSIONS: AdminRolePermission[] = [];
